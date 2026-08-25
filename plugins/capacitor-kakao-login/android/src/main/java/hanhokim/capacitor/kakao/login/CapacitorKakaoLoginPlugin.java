package hanhokim.capacitor.kakao.login;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.kakao.sdk.auth.model.OAuthToken;
import com.kakao.sdk.common.KakaoSdk;
import com.kakao.sdk.user.UserApiClient;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;


@CapacitorPlugin(name = "CapacitorKakaoLogin")
public class CapacitorKakaoLoginPlugin extends Plugin {

    private CapacitorKakaoLogin implementation = new CapacitorKakaoLogin();

    @Override
    public void load() {
        super.load();

        try {
            // capacitor.config.ts에서 kakaoAppKey 가져오기
            String kakaoAppKey = getConfig().getString("app_key", null);

            // 플러그인 로드 시 Kakao SDK 자동 초기화
            if (kakaoAppKey != null && !kakaoAppKey.isEmpty()) {
                KakaoSdk.init(getContext(), kakaoAppKey);
                Log.d("Capacitor", "✅ Kakao SDK initialized with App Key: " + kakaoAppKey);
            } else {
                Log.e("Capacitor", "❌ Kakao SDK initialization failed: App Key is missing.");
            }
        } catch (Exception e) {
            Log.e("Capacitor", "❌ Kakao SDK initialization error: " + e.getMessage(), e);
        }
    }

    // JS 에서 호출할 수 있는 빈 initSDK() 함수. 이게 실행되면 load() 가 실행되면서 initSDK 가 실행된다.
    @PluginMethod
    public void initSDK(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", implementation.echo(value));
        call.resolve(ret);
    }

    @PluginMethod
    public void prompt(PluginCall call) {
        Activity activity = getActivity();

        if (UserApiClient.getInstance() == null) {
            call.reject("Kakao SDK가 초기화되지 않았습니다.");
            return;
        }

        // JS에서 넘어온 scopes 배열 읽기
        JSArray jsScopes = call.getArray("scopes");
        List<String> scopes = new ArrayList<>();
        if (jsScopes != null) {
            for (int i = 0; i < jsScopes.length(); i++) {
                try {
                    scopes.add(jsScopes.getString(i));
                } catch (JSONException e) {
                    call.reject("Invalid scope value at index " + i);
                    return;
                }
            }
        }

        // KakaoTalk 앱이 설치되어 있는지 확인
        if (UserApiClient.getInstance().isKakaoTalkLoginAvailable(activity)) {
            // KakaoTalk 앱으로 로그인
            UserApiClient.getInstance().loginWithKakaoTalk(activity, (oauthToken, error) -> {
                handleLoginResult(oauthToken, error);
                return null;
            });
        } else {
            // Kakao 계정 웹 로그인
            UserApiClient.getInstance().loginWithKakaoAccount(activity, (oauthToken, error) -> {
                handleLoginResult(oauthToken, error);
                return null;
            });
        }

        call.resolve();
    }

    private void handleLoginResult(OAuthToken oauthToken, Throwable error) {
        if (error != null) {
            Log.e("Capacitor", "❌ Kakao login failed", error);
            JSObject errorData = new JSObject();
            errorData.put("success", false);
            errorData.put("error", error.getLocalizedMessage());
            notifyListeners("callback", errorData);
        } else if (oauthToken != null) {
            Log.d("Capacitor", "✅ Kakao login successful: " + oauthToken.getAccessToken());

            // iOS와 동일한 데이터 구조 반환 (callback 이벤트)
            JSObject response = new JSObject();
            response.put("success", true);
            response.put("access_token", oauthToken.getAccessToken());
            response.put("expires_in", ""); // Not valid in Android
            response.put("refresh_token", oauthToken.getRefreshToken());
            response.put("refresh_token_expires_in", ""); // Not valid in Android

            // `refreshTokenExpiredAt`는 `Date` 타입이므로 변환 필요
            Date refreshTokenExpiredAt = oauthToken.getRefreshTokenExpiresAt();
            response.put("refresh_token_expired_at", refreshTokenExpiredAt != null ? refreshTokenExpiredAt.getTime() : null);

            response.put("id_token", oauthToken.getIdToken() != null ? oauthToken.getIdToken() : ""); // Can be null
            response.put("token_type", "Bearer");

            // callback 이벤트로 전송
            notifyListeners("callback", response);
        }
    }

}
