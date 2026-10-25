package com.nhaccuatoi.music;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean keepAliveEnabled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        keepAliveEnabled = getSharedPreferences("nhac_prefs", MODE_PRIVATE)
            .getBoolean("keep_alive_on_swipe", false);
        KeepAliveService.keepOnTaskRemoved = keepAliveEnabled;

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView wv = getBridge().getWebView();
            wv.addJavascriptInterface(new BgControlBridge(), "AndroidBgBridge");
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Giữ WebView tiếp tục chạy bộ đếm & phát nhạc khi app vào nền hoặc bị vuốt khỏi đa nhiệm
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        if (!keepAliveEnabled) {
            stopService(new Intent(this, KeepAliveService.class));
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().loadUrl("about:blank");
            }
        }
        super.onDestroy();
    }

    public class BgControlBridge {
        @JavascriptInterface
        public void setKeepAliveMode(boolean enabled, String songTitle) {
            keepAliveEnabled = enabled;
            KeepAliveService.keepOnTaskRemoved = enabled;
            getSharedPreferences("nhac_prefs", MODE_PRIVATE)
                .edit()
                .putBoolean("keep_alive_on_swipe", enabled)
                .apply();

            Intent svc = new Intent(MainActivity.this, KeepAliveService.class);
            if (songTitle != null) svc.putExtra("title", songTitle);

            if (enabled) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            } else {
                stopService(svc);
            }
        }

        @JavascriptInterface
        public boolean getKeepAliveMode() {
            return keepAliveEnabled;
        }
    }
}
