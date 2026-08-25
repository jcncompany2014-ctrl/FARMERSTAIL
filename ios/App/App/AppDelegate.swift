import UIKit
import Capacitor
import WebKit
import KakaoSDKAuth

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// 외부 페이지에서만 가장자리 스와이프 뒤로가기를 켜는 감시자. 아래 설명 참조.
    private var edgeSwipeObserver: NSKeyValueObservation?

    /**
     * 카카오·토스 같은 **외부 페이지에서만** iOS 가장자리 스와이프 뒤로가기를 켠다.
     *
     * # 왜 필요한가 (사장님 실기기 제보 2026-08-25)
     * 안드로이드는 하드웨어 뒤로가기가 있지만 iOS 는 없다. 우리 앱은 WebView 가
     * 카카오 로그인(kauth.kakao.com)·토스 결제창으로 **그대로 이동**하는데, 그
     * 페이지엔 우리 헤더(AppChrome)가 없으므로 **되돌아올 수단이 하나도 없다.**
     * 실기기에서 "잘못 들어왔는데 뒤로가기가 안 된다"로 재현됨.
     * Capacitor 는 `allowsBackForwardNavigationGestures` 를 설정하지 않아
     * WKWebView 기본값(false)으로 꺼져 있고, capacitor.config 에 옵션도 없다.
     *
     * # 왜 전역으로 켜지 않는가
     * 앱 내부 화면의 뒤로가기는 **히스토리 되감기가 아니라 계층형 up-nav** 로
     * 가기로 사장님이 정했다(AppChrome `parentForPath`). 전역으로 켜면 폼 작성
     * 중 되감기가 되살아나 그 결정을 뒤집는다. 그래서 **우리 도메인에서는 끄고
     * 외부 도메인에서만 켠다** — 탈출구로서만 존재한다.
     *
     * ⚠️ 서브클래스 대신 AppDelegate 에 둔 이유: 이 Xcode 프로젝트는 구식 포맷
     * (objectVersion 60)이라 새 .swift 파일을 넣으려면 project.pbxproj 를 손으로
     * 편집해야 해서 위험하다. 기존 파일 안에서 끝내는 편이 안전하다.
     */
    private func enableEdgeSwipeOnExternalPagesOnly() {
        guard edgeSwipeObserver == nil,
              let webView = (window?.rootViewController as? CAPBridgeViewController)?.webView
        else { return }

        edgeSwipeObserver = webView.observe(\.url, options: [.initial, .new]) { webView, _ in
            let host = webView.url?.host?.lowercased() ?? ""
            let isOurSite = host == "farmerstail.kr" || host.hasSuffix(".farmerstail.kr")
            webView.allowsBackForwardNavigationGestures = !isOurSite
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        // 여기서 거는 이유: didFinishLaunching 시점엔 아직 webView 가 없다(스토리보드
        // 뷰컨트롤러의 viewDidLoad 에서 생성). 최초 1회만 설치되고 이후는 no-op.
        enableEdgeSwipeOnExternalPagesOnly()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call

        // 카카오톡에서 로그인을 마치고 우리 앱으로 돌아오는 주소를 먼저 가로챈다.
        // 이걸 빼먹으면 카카오톡은 열리는데 **결과를 받지 못해 영원히 대기**한다.
        // (Capacitor 프록시로 넘기면 카카오 SDK 가 응답을 못 본다.)
        //
        // ⚠️ 스킴을 먼저 우리 손으로 거른다. `isKakaoTalkLoginUrl` 은 내부에서
        //    `KakaoSDK.shared.redirectUri()` 를 부르고 그 안에 **`try!`** 가 있어,
        //    SDK 가 초기화되지 않은 상태면 **앱이 그 자리에서 죽는다.**
        //    이 메서드에는 토스 복귀·유니버설 링크 등 카카오와 무관한 URL 도 전부
        //    들어오므로, 그것들까지 카카오 SDK 를 건드리게 두면 안 된다.
        if url.scheme?.lowercased().hasPrefix("kakao") == true,
           AuthApi.isKakaoTalkLoginUrl(url) {
            return AuthController.handleOpenUrl(url: url)
        }

        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    /**
     * APNs 토큰을 Capacitor 푸시 플러그인에 전달한다.
     *
     * # 없으면 무슨 일이 벌어지나 (2026-08-26 자기검토에서 발견)
     * `@capacitor/push-notifications` 는 토큰을 **오직 이 NotificationCenter 알림으로만**
     * 받는다(플러그인 소스에서 `.capacitorDidRegisterForRemoteNotifications` 를 구독).
     * `ApplicationDelegateProxy` 는 이걸 대신 해주지 않는다 — openURL 과
     * continueUserActivity 만 처리한다.
     *
     * 즉 이 두 메서드가 없으면 **iOS 는 토큰을 영원히 못 받는다.** 그런데
     * `PushNotifications.register()` 는 성공으로 resolve 하므로 아무도 실패를 모른다:
     * 알림 설정 토글은 계속 돌기만 하고, `native_push_tokens` 에 행이 안 생기고,
     * 그런데도 발송 크론은 "보낼 대상 0명"으로 **초록**을 찍는다.
     * AGENTS 규칙8("조용한 실패가 지표를 초록으로 만든다")과 같은 형태다.
     * 오늘 aps-environment·remote-notification 을 켜면서 이 경로가 실제로 열렸다.
     */
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken,
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error,
        )
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
