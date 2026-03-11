package com.benighter.satmobile;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		registerPlugin(AppShellPlugin.class);
		registerPlugin(DownloadsSaverPlugin.class);
		super.onCreate(savedInstanceState);

		getWindow().setFlags(
			WindowManager.LayoutParams.FLAG_SECURE,
			WindowManager.LayoutParams.FLAG_SECURE
		);
		boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
		WebView.setWebContentsDebuggingEnabled(isDebuggable);

		getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
			@Override
			public void handleOnBackPressed() {
				if (getBridge() == null) {
					finishAndRemoveTask();
					return;
				}

				getBridge().triggerDocumentJSEvent("backbutton");
			}
		});
	}
}