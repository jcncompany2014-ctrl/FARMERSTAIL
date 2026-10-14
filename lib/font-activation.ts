/**
 * 본문 글꼴(Pretendard 부분 글꼴, 513KB) 늦게 켜기 — head 인라인 스크립트 정본(2026-10-14 점검, 규칙231). 순수 함수.
 *
 * # 왜
 * 루트 레이아웃이 이 글꼴을 미리 받기(preload)로 걸어 두어 **모든 화면**이 HTML 머리(Link 헤더)부터 513KB 를 먼저 받았다.
 * 느린 폰(빠른 3G · CPU 4배 느림 — scratchpad mail1014/perf 측정)에선 화면을 움직이는 JS(약 400KB)와 회선을 나눠 쓰느라
 * JS 가 글꼴과 함께 6~8초에야 도착했고, 그때까지 버튼이 눌리지 않았다(가게·로그인·주문서). 그래서
 *  · 미리 받기를 끈다(layout.tsx preload:false).
 *  · 연결이 느리면(Network Information API 의 effectiveType 2g·3g 또는 데이터 절약) 글꼴을 **페이지 스크립트가 다 온 뒤**
 *    (window load)에 받기 시작하고, **다 받은 뒤** html 에 ft-font 를 붙여 한 번에 바꾼다 — 그동안은 지표를 맞춘 대체 글꼴
 *    (globals.css ft-sans-*-fallback, 규칙232)로 그려 줄이 바뀌지 않는다.
 *  · 연결이 빠르거나 모르면(아이폰 사파리는 이 API 가 없다) · 이 기기에서 한 번 받은 적이 있으면(브라우저 캐시) 바로 켠다 —
 *    예전과 같다(글꼴 요청이 스타일시트 뒤로 조금 늦어질 뿐).
 * ft-font 가 없을 때의 대체 글꼴 지정은 globals.css 의 `html:not(.ft-font)` 한 줄이다.
 *
 * 스크립트는 기존 head 스크립트(스플래시·셸 표시 — 규칙들이 글자 그대로 검사한다)와 따로 둔다.
 */

/** html 에 붙는 '본문 글꼴 켜짐' 표시. globals.css 가 이 이름이 없을 때 대체 글꼴만 쓰게 한다. */
export const FONT_ON_CLASS = 'ft-font'
/** 이 기기에서 본문 글꼴을 다 받은 적이 있다는 표시(localStorage) — 다음 방문은 캐시에서 오므로 바로 켠다. */
export const FONT_SEEN_KEY = 'ft_font'

/**
 * head 인라인 스크립트 본문. family = next/font 가 만든 글꼴 이름(예: "'pretendard'") — document.fonts.load 가 그 @font-face 를 받는다.
 * 어떤 오류든 글꼴을 켜는 쪽(예전 동작)으로 떨어진다.
 */
export function fontActivationScript(family: string): string {
  const fam = JSON.stringify(`400 1em ${family}`)
  return (
    `(function(){var h=document.documentElement;function on(){h.classList.add('${FONT_ON_CLASS}')}` +
    `function mark(a){if(a&&a.length){try{localStorage.setItem('${FONT_SEEN_KEY}','1')}catch(e){}}}` +
    `try{var seen=false;try{seen=localStorage.getItem('${FONT_SEEN_KEY}')==='1'}catch(e){}` +
    `var c=navigator.connection;var slow=!!(c&&(c.saveData||/2g|3g/.test(c.effectiveType||'')));var fs=document.fonts;` +
    `if(seen||!slow||!fs||!fs.load){on();if(fs&&fs.load)fs.load(${fam}).then(mark,function(){});return}` +
    `window.addEventListener('load',function(){fs.load(${fam}).then(function(a){on();mark(a)},on)})` +
    `}catch(e){on()}})();`
  )
}
