/**
 * AppSplash — 앱(네이티브·설치형 PWA)을 켤 때 한 번 뜨는 로딩: 꼬리 흔드는 도장 + 점 3개.
 *
 * # 왜 이렇게 생겼나 (사장님 2026-10-08 "앱 들어가면 로딩이 두 번 뜨는데 왜 그래" · "이 영상으로 로딩")
 * 에뮬레이터로 앱을 켜며 녹화해 보니 서로 모르는 화면 두 개가 차례로 떴다.
 *   ① 폰이 띄우는 화면 — 안드로이드 12+ 는 OS 가 앱 아이콘(도장)을 가운데 띄운다. 1.5초 타이머.
 *   ② 이 웹 화면 — 글자 로고 + 점. 1.8초 CSS 타이머. 그런데 이 타이머는 ①에 가려진 동안에도 흘렀다.
 * 그림이 다르고(도장 → 글자 로고) 타이머가 따로 돌아 로딩이 두 번처럼 보였고, ①이 걷힐 때 도장만
 * 늦게 지워져(안드로이드 12 아이콘은 페이드를 안 따라간다) 한 번 더 겹쳐 보였다.
 *
 * 그래서 ②를 ①의 **연장**으로 만든다.
 *   · 같은 도장 · 같은 크기(아이콘 실측 지름 126dp → 여백 포함 132) · 같은 자리(화면 정중앙) · 같은 바탕.
 *     바탕은 앱 종이색(#F7F5F0 = --paper). 예전 크림(#F5F0E6)은 앱 바탕보다 누래서 로딩이 걷힐 때 색이
 *     바뀌었고 상태바도 누런 띠로 남았다(사장님 10/8 "앱 기본 배경색이랑 다른데") — 폰 화면·상태바·홈바까지
 *     전부 종이색으로 맞췄다. 안드로이드 옛 셸은 상태바만 여기서 바로 종이색으로 바꾼다(네이티브 설정은 업데이트로만).
 *     웹뷰는 상태바 아래에서 시작하므로 도장 중심 = 화면 높이/2 − 상태바 높이(StatusBar.getInfo).
 *     iOS 런치 이미지는 화면 높이에 맞춰 늘어나므로(aspect fill) 크기도 화면 높이에 비례시킨다.
 *   · ①을 타이머가 아니라 **이 화면이 그려질 준비가 된 순간** 걷는다(SplashScreen.hide) — 빈틈·겹침 없음.
 *   · 걷힌 뒤엔 꼬리가 흔들리기 시작하고(영상) 점이 돈다. 문서 load 뒤에 사라지되 꼬리 한 번(1.6초)은
 *     보여 주고, 아무리 늦어도 4.5초. JS 가 죽어도 CSS 가 6초에 걷는다(globals.css ft-splash-fallback).
 *
 * 영상: 사장님 Higgsfield 영상(4.5MB)에서 도장만 오려 크림 바탕에 다시 얹은 384px H.264(150KB, 1.7초 반복).
 * 정지 도장(첫 장면, 22KB)이 밑에 깔리고 영상이 재생되기 시작하면 그 위를 덮는다 — 같은 그림이라 이음새가 없다.
 * 웹 브라우저(standalone 아님)에선 display:none 이고 src 도 안 붙여 아무것도 받지 않는다.
 *
 * 노출 게이트·세션당 한 번(ft-splash-skip)은 app/layout.tsx head 인라인 스크립트가 정한다. (server component)
 */

export const SPLASH_STILL_SRC = '/splash/stamp-v1.webp'
export const SPLASH_WAG_SRC = '/splash/stamp-wag-v1.mp4'

/** 앱 종이색(--paper) — 로딩 바탕·폰 화면·상태바·홈바가 모두 이 색(규칙149·84). 도장 그림·영상도 이 바탕 위에 구웠다. */
export const APP_PAPER = '#F7F5F0'

/** 안드로이드 12+ 스플래시 아이콘(도장) 실측 지름 126dp 에 여백(오려 낸 사각형의 4.5%)을 더한 그림 한 변. */
export const SPLASH_STAMP_BOX = 132
/** iOS 런치 이미지(2732² 정사각, aspect fill) 안의 도장 그림 한 변(px) — ios/App/App/Assets.xcassets/Splash.imageset. */
export const IOS_LAUNCH_STAMP_PX = 427

// 오버레이 바로 뒤에서 한 번 실행된다(document.currentScript.parentNode = .ft-splash).
// 네이티브 호출은 Capacitor 브리지(문서 시작 때 주입)의 nativePromise 로 — 번들 로드를 기다리지 않는다.
// 안드로이드 StatusBar.getInfo 높이는 dp 를 버림한 정수라(실측 51.8 → 51) 0.5 를 더해 가운데값으로 쓴다
// (에뮬레이터 실측: 안 더하면 도장이 폰 화면보다 4.5px 아래). iOS 는 소수까지 준다.
// 영상은 **실제로 장면이 두 번 그려진 뒤**(requestVideoFrameCallback)에야 보이게 한다 — 'playing' 신호로 켰더니
// 안드로이드 웹뷰가 첫 장면을 그리기 전 1.8초 동안 빈 영상 칸이 정지 도장을 가렸다(새 앱 빌드 녹화 실측).
// 이 기능이 없는 웹뷰(iOS 15.3 이하 등)는 영상을 아예 안 받고 정지 도장 + 점만 보여 준다.
const SCRIPT = `(function(){try{
var el=document.currentScript&&document.currentScript.parentNode;if(!el)return;
var root=document.documentElement,cap=window.Capacitor;
var nat=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
var call=function(p,m,o){try{return nat&&cap.nativePromise?cap.nativePromise(p,m,o||{}):Promise.reject(0)}catch(e){return Promise.reject(e)}};
var hideNative=function(){call('SplashScreen','hide').catch(function(){})};
if(nat&&!(typeof cap.getPlatform==='function'&&cap.getPlatform()==='ios'))call('StatusBar','setBackgroundColor',{color:'${APP_PAPER}'}).catch(function(){});
var standalone=nat||root.classList.contains('ft-standalone')||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
if(!standalone||root.classList.contains('ft-splash-skip')){hideNative();return}
var ios=nat&&typeof cap.getPlatform==='function'&&cap.getPlatform()==='ios';
var H=screen.height,gap=Math.max(0,H-innerHeight);
var size=ios?${IOS_LAUNCH_STAMP_PX}*H/2732:${SPLASH_STAMP_BOX};
var place=function(top){el.style.setProperty('--ft-stamp-size',size.toFixed(1)+'px');el.style.setProperty('--ft-stamp-y',(H/2-top).toFixed(1)+'px')};
var info=Promise.resolve();
if(nat){place(gap>1?Math.max(0,gap-(ios?34:24)):0);
info=call('StatusBar','getInfo').then(function(i){if(i&&typeof i.height==='number'&&gap>1)place(i.overlays?0:Math.min(i.height+(ios?0:0.5),gap))},function(){})}
var still=el.querySelector('.ft-splash__still'),wag=el.querySelector('.ft-splash__wag');
still.src=still.getAttribute('data-src');
var ready=still.decode?still.decode().catch(function(){}):new Promise(function(r){still.onload=still.onerror=r});
var calm=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||typeof wag.requestVideoFrameCallback!=='function';
if(!calm){wag.muted=true;wag.setAttribute('muted','');wag.src=wag.getAttribute('data-src');var frames=0;var onFrame=function(){if(++frames>=2)el.classList.add('ft-splash--wag');else wag.requestVideoFrameCallback(onFrame)};wag.requestVideoFrameCallback(onFrame)}
var shown=false,gone=false,t0=0;
var out=function(){if(gone)return;gone=true;el.classList.add('ft-splash--out');setTimeout(function(){el.style.display='none';try{wag.pause();wag.removeAttribute('src');wag.load()}catch(e){}},450)};
var reveal=function(){if(shown)return;shown=true;t0=Date.now();hideNative();
if(!calm){var p=wag.play();if(p&&p.catch)p.catch(function(){})}
var loaded=function(){setTimeout(out,Math.max(0,1600-(Date.now()-t0)))};
if(document.readyState==='complete')loaded();else addEventListener('load',loaded,{once:true});
setTimeout(out,4500)};
Promise.race([Promise.all([ready,info]),new Promise(function(r){setTimeout(r,2500)})]).then(function(){setTimeout(reveal,34)});
}catch(e){try{window.Capacitor.nativePromise('SplashScreen','hide',{}).catch(function(){})}catch(_){}}})();`

// 안드로이드 웹뷰는 포스터 없는 video 에 회색 재생 그림을 그린다 — 투명 1px 로 막는다.
const BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export default function AppSplash() {
  return (
    <div className="ft-splash" aria-hidden>
      <div className="ft-splash__stamp">
        {/* src 는 스크립트가 앱일 때만 붙인다(웹 브라우저는 받지 않음). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ft-splash__still" data-src={SPLASH_STILL_SRC} alt="" width={396} height={396} />
        <video
          className="ft-splash__wag"
          data-src={SPLASH_WAG_SRC}
          poster={BLANK_POSTER}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      </div>
      <div className="ft-splash__dots">
        <span />
        <span />
        <span />
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  )
}
