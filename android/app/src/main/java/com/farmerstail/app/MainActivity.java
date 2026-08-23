package com.farmerstail.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

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
                    return super.shouldOverrideUrlLoading(view, request);
                }
            }
        );
    }
}
