package com.benighter.satmobile;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		registerPlugin(AppShellPlugin.class);
		registerPlugin(DownloadsSaverPlugin.class);
		super.onCreate(savedInstanceState);

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