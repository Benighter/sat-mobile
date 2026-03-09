package com.example.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "DownloadsSaver")
public class DownloadsSaverPlugin extends Plugin {

    private static final int CHUNK_SIZE = 64 * 1024;

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (filename == null || filename.trim().isEmpty()) {
            call.reject("filename is required");
            return;
        }

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("base64Data is required");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(filename, mimeType, bytes)
                    : saveWithLegacyDownloads(filename, bytes);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        }).start();
    }

    private JSObject saveWithMediaStore(String filename, String mimeType, byte[] bytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri itemUri = resolver.insert(collection, values);

        if (itemUri == null) {
            throw new IOException("Failed to create file in Downloads.");
        }

        try (OutputStream outputStream = resolver.openOutputStream(itemUri, "w")) {
            if (outputStream == null) {
                throw new IOException("Failed to open output stream for Downloads file.");
            }

            writeBytesWithProgress(outputStream, filename, bytes);
        } catch (Exception ex) {
            resolver.delete(itemUri, null, null);
            throw ex;
        }

        ContentValues completedValues = new ContentValues();
        completedValues.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(itemUri, completedValues, null, null);

        JSObject result = new JSObject();
        result.put("uri", itemUri.toString());
        result.put("path", "Downloads/" + filename);
        return result;
    }

    private JSObject saveWithLegacyDownloads(String filename, byte[] bytes) throws IOException {
        File downloadsDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs()) {
            throw new IOException("Failed to create Downloads directory.");
        }

        File targetFile = new File(downloadsDirectory, filename);
        try (FileOutputStream outputStream = new FileOutputStream(targetFile, false)) {
            writeBytesWithProgress(outputStream, filename, bytes);
        }

        JSObject result = new JSObject();
        result.put("uri", Uri.fromFile(targetFile).toString());
        result.put("path", "Downloads/" + filename);
        return result;
    }

    private void writeBytesWithProgress(OutputStream outputStream, String filename, byte[] bytes) throws IOException {
        int totalBytes = bytes.length;
        int offset = 0;

        while (offset < totalBytes) {
            int remaining = totalBytes - offset;
            int bytesToWrite = Math.min(remaining, CHUNK_SIZE);
            outputStream.write(bytes, offset, bytesToWrite);
            offset += bytesToWrite;

            int percent = totalBytes == 0 ? 100 : Math.round((offset * 100f) / totalBytes);
            notifyProgress(filename, offset, totalBytes, percent);
        }

        outputStream.flush();
        notifyProgress(filename, totalBytes, totalBytes, 100);
    }

    private void notifyProgress(String filename, int bytesWritten, int totalBytes, int percent) {
        JSObject progress = new JSObject();
        progress.put("filename", filename);
        progress.put("bytesWritten", bytesWritten);
        progress.put("totalBytes", totalBytes);
        progress.put("percent", percent);
        progress.put("stage", percent >= 100 ? "completed" : "saving");
        notifyListeners("downloadProgress", progress);
    }
}