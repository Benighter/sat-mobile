package com.benighter.satmobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "AndroidUpdater")
public class AndroidUpdaterPlugin extends Plugin {
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final int MAX_REDIRECTS = 5;
    private static final long MAX_APK_BYTES = 250L * 1024L * 1024L;
    private static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        new Thread(() -> {
            try {
                UpdateManifest manifest = fetchManifest();
                PackageInfo installed = getInstalledPackageInfo(0);
                long installedVersionCode = getLongVersionCode(installed);

                JSObject result = new JSObject();
                result.put("available", manifest.versionCode > installedVersionCode);
                result.put("installedVersionCode", installedVersionCode);
                result.put("installedVersionName", installed.versionName == null ? "" : installed.versionName);
                result.put("versionCode", manifest.versionCode);
                result.put("versionName", manifest.versionName);
                result.put("releaseNotes", manifest.releaseNotes);
                result.put("publishedAt", manifest.publishedAt);
                result.put("sizeBytes", manifest.sizeBytes);
                call.resolve(result);
            } catch (Exception exception) {
                call.reject(safeMessage(exception, "Unable to check for Android updates."), exception);
            }
        }, "sat-update-check").start();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settingsIntent);

            JSObject permissionResult = new JSObject();
            permissionResult.put("status", "permissionRequired");
            call.resolve(permissionResult);
            return;
        }

        new Thread(() -> {
            File partialFile = null;
            try {
                UpdateManifest manifest = fetchManifest();
                PackageInfo installed = getInstalledPackageInfo(0);
                if (manifest.versionCode <= getLongVersionCode(installed)) {
                    throw new IllegalStateException("This app is already up to date.");
                }

                File updatesDirectory = new File(getContext().getCacheDir(), "updates");
                if (!updatesDirectory.exists() && !updatesDirectory.mkdirs()) {
                    throw new IllegalStateException("Unable to prepare update storage.");
                }
                deleteOldUpdateFiles(updatesDirectory);

                partialFile = new File(updatesDirectory, "sat-mobile-" + manifest.versionCode + ".apk.part");
                File apkFile = new File(updatesDirectory, "sat-mobile-" + manifest.versionCode + ".apk");
                downloadApk(manifest, partialFile);
                validateDownloadedApk(partialFile, manifest);

                if (apkFile.exists() && !apkFile.delete()) {
                    throw new IllegalStateException("Unable to replace the previous update file.");
                }
                if (!partialFile.renameTo(apkFile)) {
                    throw new IllegalStateException("Unable to finalize the downloaded update.");
                }
                partialFile = null;

                openPackageInstaller(apkFile);
                JSObject result = new JSObject();
                result.put("status", "installerOpened");
                call.resolve(result);
            } catch (Exception exception) {
                if (partialFile != null) {
                    // A partial or failed verification result must never reach the package installer.
                    partialFile.delete();
                }
                call.reject(safeMessage(exception, "Unable to install the Android update."), exception);
            }
        }, "sat-update-download").start();
    }

    private UpdateManifest fetchManifest() throws Exception {
        String json = downloadText(BuildConfig.UPDATE_MANIFEST_URL);
        JSONObject object = new JSONObject(json);

        int schemaVersion = object.getInt("schemaVersion");
        String packageName = object.getString("packageName").trim();
        long versionCode = object.getLong("versionCode");
        String versionName = object.getString("versionName").trim();
        String apkUrl = object.getString("apkUrl").trim();
        String sha256 = object.getString("sha256").trim().toLowerCase(Locale.ROOT);
        long sizeBytes = object.optLong("sizeBytes", 0);
        String releaseNotes = object.optString("releaseNotes", "").trim();
        String publishedAt = object.optString("publishedAt", "").trim();

        if (schemaVersion != 1) {
            throw new IllegalArgumentException("Unsupported update manifest schema.");
        }
        if (!getContext().getPackageName().equals(packageName)) {
            throw new SecurityException("The update manifest targets a different Android package.");
        }
        if (versionCode <= 0 || versionName.isEmpty() || versionName.length() > 64) {
            throw new IllegalArgumentException("The update manifest has an invalid version.");
        }
        if (!sha256.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("The update manifest has an invalid SHA-256 digest.");
        }
        if (sizeBytes < 0 || sizeBytes > MAX_APK_BYTES) {
            throw new IllegalArgumentException("The update manifest has an invalid APK size.");
        }
        if (releaseNotes.length() > 4_000) {
            throw new IllegalArgumentException("The update release notes are too large.");
        }
        validateApkUrl(apkUrl);

        return new UpdateManifest(versionCode, versionName, apkUrl, sha256, sizeBytes, releaseNotes, publishedAt);
    }

    private String downloadText(String location) throws Exception {
        HttpsURLConnection connection = openHttpsConnection(location);
        try {
            int contentLength = connection.getContentLength();
            if (contentLength > MAX_MANIFEST_BYTES) {
                throw new IllegalArgumentException("The update manifest is too large.");
            }

            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8 * 1024];
                int total = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_MANIFEST_BYTES) {
                        throw new IllegalArgumentException("The update manifest is too large.");
                    }
                    output.write(buffer, 0, read);
                }
                return output.toString(StandardCharsets.UTF_8.name());
            }
        } finally {
            connection.disconnect();
        }
    }

    private void downloadApk(UpdateManifest manifest, File destination) throws Exception {
        HttpsURLConnection connection = openHttpsConnection(manifest.apkUrl);
        try {
            long contentLength = getContentLength(connection);
            if (contentLength > MAX_APK_BYTES || (manifest.sizeBytes > 0 && contentLength > 0 && contentLength != manifest.sizeBytes)) {
                throw new SecurityException("The APK download size does not match the update manifest.");
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long total = 0;
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(destination, false)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_APK_BYTES || (manifest.sizeBytes > 0 && total > manifest.sizeBytes)) {
                        throw new SecurityException("The APK download exceeded its expected size.");
                    }
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    notifyDownloadProgress(total, manifest.sizeBytes > 0 ? manifest.sizeBytes : contentLength);
                }
                output.getFD().sync();
            }

            if (manifest.sizeBytes > 0 && total != manifest.sizeBytes) {
                throw new SecurityException("The downloaded APK size does not match the update manifest.");
            }
            String actualSha256 = bytesToHex(digest.digest());
            if (!MessageDigest.isEqual(
                actualSha256.getBytes(StandardCharsets.US_ASCII),
                manifest.sha256.getBytes(StandardCharsets.US_ASCII)
            )) {
                throw new SecurityException("The downloaded APK failed SHA-256 verification.");
            }
            notifyDownloadProgress(total, total);
        } finally {
            connection.disconnect();
        }
    }

    private void validateDownloadedApk(File apkFile, UpdateManifest manifest) throws Exception {
        PackageManager packageManager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
        PackageInfo archive = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), flags);
        PackageInfo installed = getInstalledPackageInfo(flags);

        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
            throw new SecurityException("The downloaded file is not a SAT Mobile APK.");
        }
        if (getLongVersionCode(archive) != manifest.versionCode) {
            throw new SecurityException("The downloaded APK version does not match the update manifest.");
        }
        if (!signaturesOverlap(installed, archive)) {
            throw new SecurityException("The downloaded APK is not signed by the installed app's signing key.");
        }
    }

    private boolean signaturesOverlap(PackageInfo first, PackageInfo second) throws Exception {
        Set<String> firstSignatures = signatureDigests(first);
        Set<String> secondSignatures = signatureDigests(second);
        firstSignatures.retainAll(secondSignatures);
        return !firstSignatures.isEmpty();
    }

    @SuppressWarnings("deprecation")
    private Set<String> signatureDigests(PackageInfo packageInfo) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo == null) {
                return new HashSet<>();
            }
            signatures = packageInfo.signingInfo.hasMultipleSigners()
                ? packageInfo.signingInfo.getApkContentsSigners()
                : packageInfo.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = packageInfo.signatures;
        }

        Set<String> digests = new HashSet<>();
        if (signatures != null) {
            for (Signature signature : signatures) {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                digests.add(bytesToHex(digest.digest(signature.toByteArray())));
            }
        }
        return digests;
    }

    private void openPackageInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, APK_MIME_TYPE);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(installIntent);
    }

    private HttpsURLConnection openHttpsConnection(String location) throws Exception {
        URL url = new URI(location).toURL();
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                throw new SecurityException("Update downloads require HTTPS.");
            }

            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json, application/vnd.android.package-archive, application/octet-stream");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("User-Agent", "SAT-Mobile-Android-Updater");

            int status = connection.getResponseCode();
            if (status >= 200 && status < 300) {
                return connection;
            }
            if (status >= 300 && status < 400) {
                String redirectLocation = connection.getHeaderField("Location");
                connection.disconnect();
                if (redirectLocation == null || redirectLocation.trim().isEmpty()) {
                    throw new IllegalStateException("The update server returned an invalid redirect.");
                }
                url = new URL(url, redirectLocation);
                continue;
            }

            connection.disconnect();
            throw new IllegalStateException("The update server returned HTTP " + status + ".");
        }
        throw new IllegalStateException("The update server returned too many redirects.");
    }

    private void validateApkUrl(String location) throws Exception {
        URL url = new URI(location).toURL();
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new SecurityException("The APK URL must use HTTPS.");
        }

        String host = url.getHost().toLowerCase(Locale.ROOT);
        String manifestHost = new URI(BuildConfig.UPDATE_MANIFEST_URL).getHost().toLowerCase(Locale.ROOT);
        boolean trustedHost = host.equals(manifestHost) || host.equals("github.com") || host.endsWith(".githubusercontent.com");
        if (!trustedHost) {
            throw new SecurityException("The APK URL uses an untrusted host.");
        }
    }

    private PackageInfo getInstalledPackageInfo(int flags) throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), flags);
    }

    @SuppressWarnings("deprecation")
    private long getLongVersionCode(PackageInfo packageInfo) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? packageInfo.getLongVersionCode()
            : packageInfo.versionCode;
    }

    private long getContentLength(HttpURLConnection connection) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
            ? connection.getContentLengthLong()
            : connection.getContentLength();
    }

    private void notifyDownloadProgress(long bytesDownloaded, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("bytesDownloaded", bytesDownloaded);
        progress.put("totalBytes", Math.max(totalBytes, 0));
        progress.put("percent", totalBytes > 0 ? Math.min(100, Math.round(bytesDownloaded * 100f / totalBytes)) : 0);
        notifyListeners("updateDownloadProgress", progress);
    }

    private void deleteOldUpdateFiles(File directory) {
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (file.isFile()) {
                file.delete();
            }
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            value.append(String.format(Locale.ROOT, "%02x", item));
        }
        return value.toString();
    }

    private String safeMessage(Exception exception, String fallback) {
        String message = exception.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    private static final class UpdateManifest {
        final long versionCode;
        final String versionName;
        final String apkUrl;
        final String sha256;
        final long sizeBytes;
        final String releaseNotes;
        final String publishedAt;

        UpdateManifest(long versionCode, String versionName, String apkUrl, String sha256, long sizeBytes,
                       String releaseNotes, String publishedAt) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl;
            this.sha256 = sha256;
            this.sizeBytes = sizeBytes;
            this.releaseNotes = releaseNotes;
            this.publishedAt = publishedAt;
        }
    }
}
