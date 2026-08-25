import Foundation
import KakaoSDKUser
import KakaoSDKCommon
import KakaoSDKAuth
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CapacitorKakaoLoginPlugin)
public class CapacitorKakaoLoginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorKakaoLoginPlugin"
    public let jsName = "CapacitorKakaoLogin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "initSDK", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prompt", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = CapacitorKakaoLogin()

    override public func load() {
        super.load()

        let pluginConfig = bridge?.config.getPluginConfig("CapacitorKakaoLogin")

        if let kakaoAppKey = pluginConfig?.getString("app_key") {
            KakaoSDK.initSDK(appKey: kakaoAppKey)
            print("✅ Kakao SDK initialized with App Key: \(kakaoAppKey)")
        } else {
            print("❌ Kakao SDK initialization failed: App Key is missing in capacitor.config.ts")
        }
    }

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }

    @objc func initSDK(_ call: CAPPluginCall) {
        // 아무것도 하지 않는다. 다만 최초 init()이 실행되면 load()가 실행될 것이기 때문임
        call.resolve()
    }

    @objc func prompt(_ call: CAPPluginCall) {
        let scopes = call.getArray("scopes", String.self) ?? []

        if UserApi.isKakaoTalkLoginAvailable() {
            // 카카오톡 앱 로그인
            // handleLoginResult이 실행되려면 AppDelegation.swift에 코드가 추가되어야함 (README 참고)
          UserApi.shared.loginWithKakaoTalk() { (oauthToken, error) in
                self.handleLoginResult(oauthToken, error, call)
            }
        } else {
            // 카카오 계정 웹 로그인
            // handleLoginResult이 실행되려면 AppDelegation.swift에 코드가 추가되어야함 (README 참고)
            UserApi.shared.loginWithKakaoAccount(scopes: scopes) { (oauthToken, error) in
                self.handleLoginResult(oauthToken, error, call)
            }
        }
        call.resolve()
    }

    private func handleLoginResult(_ oauthToken: OAuthToken?, _ error: Error?, _ call: CAPPluginCall) {
        if let error = error {
            print("❌ Kakao login failed: \(error.localizedDescription)")
            self.notifyListeners("callback", data: ["success": false, "error": error.localizedDescription])
        } else if let oauthToken = oauthToken {
            print("✅ Kakao login successful. Token saved.")

            self.notifyListeners("callback", data: [
                "success": true,
                "access_token": oauthToken.accessToken,
                "expires_in": oauthToken.expiresIn,
                "refresh_token": oauthToken.refreshToken,
                "refresh_token_expires_in": oauthToken.refreshTokenExpiresIn,
                "refresh_token_expired_at": oauthToken.refreshTokenExpiredAt,
                "id_token": oauthToken.idToken ?? "", // Can be nil
                "token_type": oauthToken.tokenType,
            ])
        }
    }

}
