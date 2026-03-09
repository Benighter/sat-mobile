package com.example.app;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		registerPlugin(AppShellPlugin.class);
		registerPlugin(DownloadsSaverPlugin.class);
		super.onCreate(savedInstanceState);

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
