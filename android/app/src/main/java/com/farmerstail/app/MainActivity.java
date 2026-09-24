package com.farmerstail.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.net.URISyntaxException;

public class MainActivity extends BridgeActivity {

    /**
     * ★2026-08-22 — `about:` 스킴 iframe 이 "선택할 수 없는 외부 앱 선택창"으로
     * 튕기던 것 차단 (사장님 3회 재현 — 주소 검색 불능의 진짜 원인).
     *
     * # 무슨 일이 있었나
     * Daum 우편번호 위젯은 iframe 을 `about:blank` 로 만든 뒤 그 안에 내용을
     * 직접 써넣는다 (프로덕션 실측: iframe src 가 끝까지 about:blank 다 —
     * 다음 도메인으로 아예 가지 않는다). Capacitor 의 기본 WebViewClient 는
     * 서브프레임 이동도 allowNavigation 도메인 목록으로 검사하는데,
     * `about:blank` 은 호스트가 없어 어떤 도메인과도 매치될 수 없다 →
     * ACTION_VIEW 인텐트로 외부에 던져진다. `about:blank` 을 받을 수 있는
     * 앱은 없으므로 "크롬/삼성인터넷 선택창이 뜨는데 눌러도 아무 일도 없는"
     * 상태가 되고, 원래 iframe 초기화는 취소돼 주소 시트는 빈 채로 남는다.
     *
     * allowNavigation 은 도메인만 표현할 수 있어 이 문제를 설정으로는 못
     * 푼다(*.daum.net 을 넣어봐야 과녁이 다르다 — 실제로 세 번 빗나갔다).
     * 그래서 WebViewClient 단계에서 `about:` 스킴만 WebView 내부 처리로
     * 돌려보낸다. Toss 결제창처럼 iframe 을 쓰는 다른 외부 위젯도 같은
     * 패턴이므로 이 수정이 함께 지킨다.
     *
     * # 왜 안전한가
     * `about:blank`/`about:srcdoc` 은 빈 문서다 — 어디로도 나가지 않는다.
     * 그 외 모든 이동은 super(기본 검사)로 그대로 흘러간다.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge == null) {
            return; // WebView 미탑재 기기 — BridgeActivity 가 no_webview 화면을 띄운 경우
        }
        this.bridge.setWebViewClient(
            new BridgeWebViewClient(this.bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    if (url != null && "about".equalsIgnoreCase(url.getScheme())) {
                        return false; // WebView 가 내부에서 처리 (iframe 초기화)
                    }
                    // ★2026-09-24 — `intent:` · `market:` 링크를 직접 처리한다(출시 전 점검).
                    //   Capacitor 기본 동작은 우리 호스트가 아닌 모든 링크를 ACTION_VIEW 로 던지고
                    //   ActivityNotFoundException 을 조용히 삼킨다(Bridge.launchIntent 실측). 그런데
                    //   `intent://…#Intent;scheme=…;package=…;end` 는 "intent" 스킴을 받는 앱이 없어서
                    //   **앱이 설치돼 있어도 항상** 무반응이다 — 카카오 웹 로그인의 "카카오톡으로 로그인",
                    //   카드사 앱 전환(ISP·앱카드) 모두 이 형식이다. 9/10 실제 고객이 안드로이드 앱에서
                    //   카카오 로그인을 4번 눌렀는데 한 번도 돌아오지 않았다(인증 로그). 토스 WebView
                    //   가이드와 같은 방식으로 Intent.parseUri + 미설치 시 스토어/대체 주소로 보낸다.
                    if (url != null && "intent".equalsIgnoreCase(url.getScheme())) {
                        return handleIntentUri(view, url.toString());
                    }
                    if (url != null && "market".equalsIgnoreCase(url.getScheme())) {
                        return openMarket(url.toString(), url.getQueryParameter("id"));
                    }
                    // 앱 전용 스킴(ispmobile://·kakaotalk:// 등) — 기본 동작은 미설치 시 무반응이라
                    // 같은 방식으로 열되, 못 열면 한 줄 안내를 띄운다. http(s)·data·blob 은 기본 동작 그대로.
                    if (url != null && isAppScheme(url.getScheme())) {
                        try {
                            Intent open = new Intent(Intent.ACTION_VIEW, url);
                            open.addCategory(Intent.CATEGORY_BROWSABLE);
                            startActivity(open);
                        } catch (ActivityNotFoundException e) {
                            Toast.makeText(MainActivity.this, "이 기능을 열 앱이 설치되어 있지 않아요", Toast.LENGTH_SHORT).show();
                        }
                        return true;
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            }
        );
    }

    /**
     * `intent:` URI 를 풀어 외부 앱을 연다. 못 열면(앱 미설치) 대체 주소 → 스토어 순서.
     *
     * 보안: 웹 페이지가 만든 인텐트이므로 Chrome 과 같이 컴포넌트·셀렉터를 지우고 BROWSABLE
     * 로만 연다 — 우리 앱의 비공개 화면이나 다른 앱의 내부 컴포넌트를 직접 겨냥하지 못한다.
     * 대체 주소가 우리 호스트/허용 도메인이면 WebView 안에서(로그인 흐름 유지), 아니면 외부 브라우저.
     */
    private boolean handleIntentUri(WebView view, String raw) {
        Intent intent;
        try {
            intent = Intent.parseUri(raw, Intent.URI_INTENT_SCHEME);
        } catch (URISyntaxException e) {
            return true; // 깨진 링크 — 아무 데도 가지 않는다(WebView 에 로드하지도 않는다)
        }
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.setComponent(null);
        intent.setSelector(null);
        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            // 앱 미설치 — 아래 대체 경로로
        }
        String fallback = intent.getStringExtra("browser_fallback_url");
        if (fallback != null && (fallback.startsWith("https://") || fallback.startsWith("http://"))) {
            Uri f = Uri.parse(fallback);
            if (isInAppHost(f.getHost())) {
                view.loadUrl(fallback);
            } else {
                openExternal(Uri.parse(fallback));
            }
            return true;
        }
        String pkg = intent.getPackage();
        if (pkg != null && !pkg.isEmpty()) {
            return openMarket("market://details?id=" + pkg, pkg);
        }
        Toast.makeText(this, "이 기능을 열 앱이 설치되어 있지 않아요", Toast.LENGTH_SHORT).show();
        return true;
    }

    /** 플레이 스토어로. 스토어 앱이 없으면 웹 스토어 페이지를 외부 브라우저로. */
    private boolean openMarket(String marketUrl, String pkg) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(marketUrl)));
        } catch (ActivityNotFoundException e) {
            if (pkg != null && !pkg.isEmpty()) {
                openExternal(Uri.parse("https://play.google.com/store/apps/details?id=" + Uri.encode(pkg)));
            }
        }
        return true;
    }

    private void openExternal(Uri uri) {
        try {
            Intent browse = new Intent(Intent.ACTION_VIEW, uri);
            browse.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(browse);
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "링크를 열 수 있는 앱이 없어요", Toast.LENGTH_SHORT).show();
        }
    }

    /** 외부 앱으로 넘겨야 하는 스킴인가 — 웹 스킴과 WebView 내부 스킴은 제외. */
    private static boolean isAppScheme(String scheme) {
        if (scheme == null) return false;
        String s = scheme.toLowerCase();
        return !(s.equals("http") || s.equals("https") || s.equals("about") || s.equals("data")
            || s.equals("blob") || s.equals("file") || s.equals("javascript") || s.equals("intent")
            || s.equals("market"));
    }

    /** 앱 WebView 안에서 열어도 되는 호스트인가 — 우리 서버 또는 capacitor allowNavigation. */
    private boolean isInAppHost(String host) {
        if (host == null || this.bridge == null) return false;
        Uri app = Uri.parse(this.bridge.getAppUrl());
        if (host.equalsIgnoreCase(app.getHost())) return true;
        return this.bridge.getAppAllowNavigationMask() != null && this.bridge.getAppAllowNavigationMask().matches(host);
    }
}
