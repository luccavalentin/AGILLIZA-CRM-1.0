package br.com.agillizatech.correspondente;

import com.getcapacitor.BridgeActivity;
import android.app.DownloadManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // PDFs e anexos autenticados precisam conservar o cookie do WebView.
        // Abrir a URL no navegador externo perde a sessão e baixava o login.
        bridge.getWebView().setDownloadListener((url, userAgent, disposition, mime, length) -> {
            Uri uri = Uri.parse(url);
            String appHost = Uri.parse(bridge.getConfig().getServerUrl()).getHost();
            if (!"https".equals(uri.getScheme()) || !appHost.equals(uri.getHost())) {
                Toast.makeText(this, "Abra o documento pelo botão de download do sistema.", Toast.LENGTH_LONG).show();
                return;
            }
            String name = URLUtil.guessFileName(url, disposition, mime);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) request.addRequestHeader("Cookie", cookie);
            request.addRequestHeader("User-Agent", userAgent);
            request.setTitle(name);
            if (mime != null) request.setMimeType(mime);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            } else {
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
            }
            try {
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                Toast.makeText(this, "Download iniciado: " + name, Toast.LENGTH_LONG).show();
            } catch (RuntimeException error) {
                Toast.makeText(this, "Não foi possível iniciar o download. Tente novamente.", Toast.LENGTH_LONG).show();
            }
        });
    }
}
