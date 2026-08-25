// swift-tools-version: 5.9
import PackageDescription

// 카카오톡 앱 전환 로그인 플러그인 (벤더링본).
//
// 원본 @hanhokim/capacitor-kakao-login 8.0.0 의 Package.swift 는 **SPM 으로는
// 빌드가 되지 않았다.** 두 가지가 빠져 있었다:
//   ① 카카오 SDK 의존성이 없다 — podspec 에는 KakaoSDKAuth/User/Common 이
//      선언돼 있는데 Package.swift 에는 없어서, 소스의 `import KakaoSDKUser` 가
//      해석되지 않는다(작성자가 CocoaPods 로만 테스트한 것으로 보인다).
//   ② product 이름이 Capacitor 가 기대하는 이름과 달라 의존성 해석 자체가 실패.
//      Capacitor 는 npm 패키지명(스코프+이름)을 카멜케이스로 바꿔 참조한다
//      → `@farmerstail/capacitor-kakao-login` = `FarmerstailCapacitorKakaoLogin`.
//
// 우리 iOS 프로젝트는 CocoaPods 없이 SPM 으로 만들어졌으므로(맥 이사 때 sudo
// 불가로 CocoaPods 설치를 포기) 이 둘을 채워야만 쓸 수 있다.
let package = Package(
    name: "FarmerstailCapacitorKakaoLogin",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "FarmerstailCapacitorKakaoLogin",
            targets: ["CapacitorKakaoLoginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/kakao/kakao-ios-sdk.git", from: "2.24.0")
    ],
    targets: [
        .target(
            name: "CapacitorKakaoLoginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "KakaoSDKCommon", package: "kakao-ios-sdk"),
                .product(name: "KakaoSDKAuth", package: "kakao-ios-sdk"),
                .product(name: "KakaoSDKUser", package: "kakao-ios-sdk")
            ],
            path: "ios/Sources/CapacitorKakaoLoginPlugin")
    ]
)
