/**
 * 오프라인 화면(/offline)의 '다시 시도하기' — **스크립트 묶음 없이도** 동작하게(2026-10-13, 규칙200).
 *
 * # 왜 (안드로이드 에뮬레이터 재현 — 버튼이 먹통)
 * 서비스 워커(public/sw.js)는 /offline 화면(HTML)만 미리 담아 두고 Next 스크립트 묶음(_next/static)은 담지 않는다
 * (일부러 — 옛 묶음이 남으면 새 배포 뒤 흰 화면, audit #94). 그래서 오프라인에서 이 화면이 뜨면 하이드레이션이
 * 안 되고, `onClick={() => window.location.reload()}` 버튼엔 처리기가 붙지 않아 눌러도 아무 일이 없었다
 * (직접 새로고침하면 복구됐다).
 *
 * # 어떻게
 *  1. 버튼 = 일반 링크 `<a href="/" data-ft-retry>` — 스크립트가 하나도 없어도 누르면 홈으로 다시 불러온다.
 *  2. 아래 인라인 스크립트(HTML 안에 들어 있어 묶음이 없어도 돈다)가
 *     · 링크 주소를 **지금 주소**로 바꾼다 — 서비스 워커는 원래 가려던 주소(예: /dogs/…)에 이 화면을 대신 보여 주므로,
 *       예전 reload() 처럼 그 화면을 다시 부른다. 주소가 /offline 그 자체면 홈('/')으로.
 *     · 인터넷이 돌아오면('online') 그 주소로 다시 불러온다.
 *     스크립트가 실패해도 1번 링크는 그대로 동작한다(try 로 감쌌다).
 *
 * ⚠️ 안드로이드 앱(WebView)은 네트워크 상태 권한(ACCESS_NETWORK_STATE)이 없어 'online' 이 안 올 수 있다 — 그래서
 *    자동 새로고침은 덤이고, 링크가 본체다.
 * ⚠️ 이 문자열은 브라우저에서 그대로 실행된다 — 옛 브라우저도 돌게 ES5 로만 쓴다(화살표·const 금지).
 */

/** '다시 시도하기' 링크 표식 — 스크립트가 이 표식의 링크 주소를 바꾼다. */
export const OFFLINE_RETRY_ATTR = 'data-ft-retry'

export const OFFLINE_RETRY_SCRIPT =
  '(function(){try{' +
  "var p=location.pathname||'/';" +
  "var t=p==='/offline'?'/':p+(location.search||'');" +
  "var a=document.querySelectorAll('a[" + OFFLINE_RETRY_ATTR + "]');" +
  "for(var i=0;i<a.length;i++){a[i].setAttribute('href',t);}" +
  "window.addEventListener('online',function(){location.replace(t);});" +
  '}catch(e){}})();'
