import UIKit
import Capacitor
import WebKit

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
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
