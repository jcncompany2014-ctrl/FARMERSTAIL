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
 *     바탕은 앱 바탕(--paper). 예전 크림(#F5F0E6)은 앱 바탕보다 누래서 로딩이 걷힐 때 색이 바뀌었고 상태바도
 *     누런 띠로 남았다(사장님 10/8 "앱 기본 배경색이랑 다른데") — 폰 화면·상태바·홈바까지 전부 앱 바탕색으로
 *     맞췄다. ★2026-10-09 앱 새 디자인('A 포스터')으로 앱 바탕이 흰색이 되며 셸 3세대(흰 네이티브)가 생겼다.
 *     2세대 셸(폰 화면이 종이색 #F7F5F0)은 업데이트 전까지 종이색 바탕 + 종이색 위에 구운 도장(v1)으로 잇는다
 *     (html.ft-paper-shell — 규칙166). 안드로이드는 상태바를 여기서 바로 그 셸 색으로 칠한다(네이티브 설정은 업데이트로만).
 *     웹뷰는 상태바 아래에서 시작하므로 도장 중심 = 화면 높이/2 − 상태바 높이(StatusBar.getInfo).
 *     iOS 런치 이미지는 화면 높이에 맞춰 늘어나므로(aspect fill) 크기도 화면 높이에 비례시킨다.
 *   · ①을 타이머가 아니라 **이 화면이 그려질 준비가 된 순간** 걷는다(SplashScreen.hide) — 빈틈·겹침 없음.
 *   · 걷힌 뒤엔 꼬리가 흔들리기 시작하고(영상) 점이 돈다. 문서 load 뒤에 사라지되 꼬리 한 번(1.6초)은
 *     보여 주고, 아무리 늦어도 4.5초. JS 가 죽어도 CSS 가 6초에 걷는다(globals.css ft-splash-fallback).
 *
 * 영상: 사장님 Higgsfield 영상(4.5MB)에서 도장만 오려 바탕색 위에 다시 얹은 384px H.264(150KB, 1.7초 반복).
 *   v2 = 흰 바탕(셸 3세대·설치형 PWA) · v1 = 종이색 바탕(2세대 셸). 같은 장면·같은 잉크, 바탕만 다르다(BT.601 제한 범위로 인코딩).
 * 정지 도장(첫 장면, 22KB)이 밑에 깔리고 영상이 재생되기 시작하면 그 위를 덮는다 — 같은 그림이라 이음새가 없다.
 *
 * ★꼬리 그림 장면(2026-10-10 사장님 아이폰 화면 "왜또 꼬리가 안움직여" — 배터리 아이콘이 노란색 = 저전력 모드):
 * 아이폰 저전력 모드는 영상 재생(play())을 거절한다(WebKit 버그 216887 — Capacitor 앱도 같다). 그러면 정지 도장만
 * 남고 점만 돌았다. 영상이 거절되거나 오류가 나면(그리고 장면 신호 requestVideoFrameCallback 이 없는 옛 웹뷰는 처음부터)
 * 꼬리가 실제로 움직이는 네모만 51장면 묶음 그림(200KB, 저전력·옛 웹뷰일 때만 받는다)으로 CSS 가 넘긴다 — 그림·CSS
 * 애니메이션은 안 막힌다. 영상 앞 장면의 도장 '쿵'(최대 5% 커짐)도 CSS 로 같이(globals.css .ft-splash__bob).
 * 웹 브라우저(standalone 아님)에선 display:none 이고 src 도 안 붙여 아무것도 받지 않는다.
 *
 * 노출 게이트·세션당 한 번(ft-splash-skip)은 app/layout.tsx head 인라인 스크립트가 정한다. (server component)
 */

export const SPLASH_STILL_SRC = '/splash/stamp-v2.webp'
export const SPLASH_WAG_SRC = '/splash/stamp-wag-v2.mp4'
/** 2세대 셸(FtShell/2 — 폰 화면이 종이색)용 — 종이색 위에 구운 같은 도장. 그 셸이 남아 있는 동안 지우지 말 것(규칙166). */
export const PAPER_SHELL_STILL_SRC = '/splash/stamp-v1.webp'
export const PAPER_SHELL_WAG_SRC = '/splash/stamp-wag-v1.mp4'
/** 영상이 막힐 때의 꼬리 그림 장면(3열×17행 = 51장면, 정지 도장과 같은 396 기준) — 흰 바탕(v2)·종이색(v1). 칸 자리·크기는 globals.css. */
export const SPLASH_TAIL_SRC = '/splash/stamp-tail-v2.webp'
export const PAPER_SHELL_TAIL_SRC = '/splash/stamp-tail-v1.webp'

/** 앱 바탕(--paper, 흰색 — 2026-10-09 앱 새 디자인) — 로딩 바탕·폰 화면·상태바·홈바가 모두 이 색(규칙149·84). 도장 그림·영상(v2)도 이 바탕 위에 구웠다. */
export const APP_PAPER = '#FFFFFF'
/** 2세대 셸의 네이티브 바탕(앱 종이색) — 그 셸에선 로딩 바탕·안드로이드 상태바를 이 색으로 잇는다(규칙166). */
export const PAPER_SHELL_BG = '#F7F5F0'

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
// ★iOS(사장님 10/8 아이폰 화면 "이거봐바"): 앱이 띄우는 폰 화면은 런치 화면을 **웹뷰 맨 위(상태바 아래)에
// 화면 크기로** 다시 붙인 것이라(@capacitor/splash-screen iOS — parentView = 웹뷰) 그림 중심이 웹뷰 기준
// 화면 높이/2 다. 그래서 iOS 는 상태바를 빼지 않는다. 걷을 때는 겹쳐 사라지는 0.2초 효과를 끈다 — 그 사이에
// 옛 글자 로고와 새 도장이 겹쳐 보였다.
// ★2026-10-10 옛 아이폰 앱(FtShell/2 이전, 런치 화면 = 크림 바탕 글자 로고)도 꼬리 흔드는 도장(사장님 "로딩도 도장
// 꼬리 흔드는 걸로") — 크림 바탕에 종이색 위에 구운 v1. 예전엔 런치 화면의 글자 로고를 그대로 이어 보였다.
// ★2026-10-10 옛 셸(oldShell = 2세대 종이색·옛 아이폰 크림)은 로딩이 걷힐 때(또는 이미 본 세션이면 바로) 상태바를
// 흰색으로 바꾸고, 성공하면 html.ft-sb-white 를 붙여 윗줄도 흰색으로 맞춘다 — 위쪽 띠가 사라진다(실패하면 셸 색 그대로).
const SCRIPT = `(function(){try{
var el=document.currentScript&&document.currentScript.parentNode;if(!el)return;
var root=document.documentElement,cap=window.Capacitor;
var nat=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
var call=function(p,m,o){try{return nat&&cap.nativePromise?cap.nativePromise(p,m,o||{}):Promise.reject(0)}catch(e){return Promise.reject(e)}};
var ios=nat&&typeof cap.getPlatform==='function'&&cap.getPlatform()==='ios';
var hideNative=function(){call('SplashScreen','hide',ios?{fadeOutDuration:0}:{}).catch(function(){})};
var paperShell=root.classList.contains('ft-paper-shell');
var oldIos=ios&&root.classList.contains('ft-old-shell-ios');
var oldShell=paperShell||oldIos;
var sbWhite=function(){if(oldShell)call('StatusBar','setBackgroundColor',{color:'${APP_PAPER}'}).then(function(){root.classList.add('ft-sb-white')},function(){})};
if(nat&&!ios)call('StatusBar','setBackgroundColor',{color:paperShell?'${PAPER_SHELL_BG}':'${APP_PAPER}'}).catch(function(){});
var standalone=nat||root.classList.contains('ft-standalone')||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
if(!standalone||root.classList.contains('ft-splash-skip')){hideNative();sbWhite();return}
var H=screen.height,gap=Math.max(0,H-innerHeight);
var size=ios?${IOS_LAUNCH_STAMP_PX}*H/2732:${SPLASH_STAMP_BOX};
var place=function(top){el.style.setProperty('--ft-stamp-size',size.toFixed(1)+'px');el.style.setProperty('--ft-stamp-y',(H/2-top).toFixed(1)+'px')};
var info=Promise.resolve();
if(ios){place(0)}
else if(nat){place(gap>1?Math.max(0,gap-24):0);
info=call('StatusBar','getInfo').then(function(i){if(i&&typeof i.height==='number'&&gap>1)place(i.overlays?0:Math.min(i.height+0.5,gap))},function(){})}
var pic=el.querySelector('.ft-splash__still'),wag=el.querySelector('.ft-splash__wag'),tail=el.querySelector('.ft-splash__tail');
pic.src=(oldShell&&pic.getAttribute('data-src-paper'))||pic.getAttribute('data-src');
var ready=pic.decode?pic.decode().catch(function(){}):new Promise(function(r){pic.onload=pic.onerror=r});
var calm=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var rvfc=typeof wag.requestVideoFrameCallback==='function';
var wagOn=false,tailOn=false;
if(!calm&&rvfc){wag.muted=true;wag.setAttribute('muted','');wag.src=(oldShell&&wag.getAttribute('data-src-paper'))||wag.getAttribute('data-src');var frames=0;var onFrame=function(){if(tailOn)return;if(++frames>=2){wagOn=true;el.classList.add('ft-splash--wag')}else wag.requestVideoFrameCallback(onFrame)};wag.requestVideoFrameCallback(onFrame);wag.addEventListener('error',function(){startTail()})}
var stopWag=function(){try{wag.pause();wag.removeAttribute('src');wag.load()}catch(e){}};
var shown=false,gone=false,t0=0;
var startTail=function(){if(tailOn||wagOn||gone||calm||!tail)return;tailOn=true;stopWag();var src=(oldShell&&tail.getAttribute('data-src-paper'))||tail.getAttribute('data-src');var im=new Image();im.src=src;(im.decode?im.decode():new Promise(function(r,j){im.onload=r;im.onerror=j})).then(function(){if(gone)return;tail.style.backgroundImage='url('+src+')';el.classList.add('ft-splash--tail')},function(){})};
var out=function(){if(gone)return;gone=true;sbWhite();el.classList.add('ft-splash--out');setTimeout(function(){el.style.display='none';stopWag()},450)};
var reveal=function(){if(shown)return;shown=true;t0=Date.now();hideNative();
if(!calm){if(rvfc){var p=wag.play();if(p&&p.catch)p.catch(function(){startTail()})}else startTail()}
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
        {/* 옛 셸(2세대·옛 아이폰)은 data-src-paper(종이색 위에 구운 v1) — 스크립트가 html.ft-paper-shell·ft-old-shell-ios 를 보고 고른다. */}
        {/* 정지 도장 + 꼬리 그림 장면은 '쿵' 칸 안 — 그림 장면으로 돌 때 둘이 같이 커졌다 돌아온다(영상엔 '쿵'이 들어 있다). */}
        <div className="ft-splash__bob">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ft-splash__still"
            data-src={SPLASH_STILL_SRC}
            data-src-paper={PAPER_SHELL_STILL_SRC}
            alt=""
            width={396}
            height={396}
          />
          {/* 영상이 막힐 때(아이폰 저전력 모드)의 꼬리 — 스크립트가 묶음 그림을 받아 다 풀린 뒤 배경으로 붙인다. */}
          <div className="ft-splash__tail" data-src={SPLASH_TAIL_SRC} data-src-paper={PAPER_SHELL_TAIL_SRC} />
        </div>
        <video
          className="ft-splash__wag"
          data-src={SPLASH_WAG_SRC}
          data-src-paper={PAPER_SHELL_WAG_SRC}
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
