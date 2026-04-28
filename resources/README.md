# Capacitor 자산 (resources/)

`@capacitor/assets` 가 이 폴더의 source 이미지를 보고 iOS/Android 의 모든
크기 (38종) 를 자동 생성한다.

## 필요한 파일

다음 3개를 직접 만들어 이 폴더에 두면 됨. (생성 도구는 자동으로 cropping +
모든 사이즈로 다운샘플 처리.)

| 파일 | 크기 | 용도 |
|---|---|---|
| `icon.png` | **1024×1024** | 라이트 모드 앱 아이콘 |
| `icon-foreground.png` | **1024×1024** (투명 배경) | Android 12+ Adaptive Icon 의 foreground 레이어 |
| `icon-background.png` | **1024×1024** (단색) | Android Adaptive Icon background. 우리 brand bg `#F5F0E6` 단색 png |
| `splash.png` | **2732×2732** | 스플래시 (가운데 로고 + 여백 충분히) |
| `splash-dark.png` | **2732×2732** | 다크 모드 스플래시 (선택) |

`splash.png` 디자인 가이드:
- **safe area** = 가운데 1024×1024. 그 밖은 잘릴 수 있음.
- 배경은 `#F5F0E6` (cream). 다크는 `#171310`.
- 로고를 가운데에 ~600×600 으로 배치 + brightness(0) 처럼 검정 톤.

## 생성 실행

```bash
npm run cap:assets
```

자동으로 다음에 출력:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`
- `android/app/src/main/res/mipmap-*/`
- `android/app/src/main/res/drawable*/`

## 임시 placeholder (아이콘 디자인 전 빌드 테스트용)

`/public/icons/icon-512.png` 를 1024 로 업스케일해서 임시로 써도 무방.
스토어 제출 전엔 반드시 정식 디자인으로 교체.

```bash
# imagemagick 있으면
magick public/icons/icon-512.png -resize 1024x1024 resources/icon.png
```

또는 Figma 에서 1024×1024 frame 으로 export.
