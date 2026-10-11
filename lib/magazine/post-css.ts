/**
 * 본문 글 칸(시안 C09 의 article) — lib/markdown 이 만드는 태그(h1~h6·p·ul/li·blockquote·hr·img·a·strong·em·code·pre)만 다룬다.
 * 가게 틀(.fts main h1·h2)이 소제목을 포스터 글꼴로 이미 바꾸므로 여기선 크기·간격만 준다.
 * 목록 바로 뒤 구분선(ul + hr)은 숨긴다 — 목록 줄마다 아래 선이 있어 hr 까지 그리면 빈 줄 하나처럼 보였다(간격은 다음 칸이 갖는다).
 * 공유 단추(.ftb-share) — 공용 ShareButton 의 동작(카카오 → 기기 공유 → 주소 복사)을 그대로 쓰고, 아이콘만 시안 원본 path
 * (M12 3v13 · M7 8l5-5 5 5 · M5 13v6…)로 씌운다. 공용 부품은 고치지 않는다.
 */
const SHARE_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v13'/%3E%3Cpath d='M7 8l5-5 5 5'/%3E%3Cpath d='M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'/%3E%3C/svg%3E\")"

/** 매거진 글 화면(app/blog/[slug])과 점검 화면의 초안 미리보기(design-check-store ?s=magazine-draft)가 같이 쓴다. */
export const MAGAZINE_POST_CSS = `
.ftb-post { font-size: 17px; line-height: 1.8; color: #141414; overflow-wrap: break-word; }
.ftb-post > * { margin: 0; }
.ftb-post > * + * { margin-top: 16px; }
.ftb-post > h1, .ftb-post > h2 { margin-top: 40px; }
.ftb-post > h3 { margin-top: 32px; }
.ftb-post > h4, .ftb-post > h5, .ftb-post > h6 { margin-top: 28px; }
.ftb-post > :first-child { margin-top: 0; }
.ftb-post > h1 + *, .ftb-post > h2 + *, .ftb-post > h3 + *, .ftb-post > h4 + * { margin-top: 12px; }
.ftb-post h1 { font-size: 28px; line-height: 1.2; }
.ftb-post h2 { font-size: 24px; line-height: 1.25; }
.ftb-post h3 { font-family: var(--font-poster), var(--font-sans), sans-serif; font-weight: 400; letter-spacing: -0.01em; font-size: 20px; line-height: 1.3; }
.ftb-post h4, .ftb-post h5, .ftb-post h6 { font-size: 17px; font-weight: 800; line-height: 1.5; }
.ftb-post strong { font-weight: 800; }
.ftb-post em { font-style: normal; }
.ftb-post a { color: #141414; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
.ftb-post ul { padding: 0; list-style: none; border-top: 2px solid #141414; }
.ftb-post ul > li { position: relative; padding: 14px 0 14px 22px; border-bottom: 1px solid #E5E5E5; line-height: 1.6; }
.ftb-post ul > li::before { content: ''; position: absolute; left: 2px; top: calc(14px + 0.8em - 4px); width: 8px; height: 8px; background: #141414; }
.ftb-post > blockquote { margin-top: 40px; padding: 18px; border-left: 4px solid #141414; background: #F6F4F5; font-size: 16px; line-height: 1.7; }
.ftb-post > blockquote + blockquote { margin-top: 8px; }
.ftb-post > hr { border: 0; border-top: 1px solid #E5E5E5; }
.ftb-post > hr, .ftb-post > hr + * { margin-top: 36px; }
.ftb-post > ul + hr { display: none; }
.ftb-post img { display: block; width: 100%; height: auto; border-radius: 4px; }
.ftb-post > img { margin-top: 20px; }
.ftb-post code { padding: 0.1em 0.4em; border-radius: 4px; background: #F6F4F5; font-size: 0.9em; }
.ftb-post pre { padding: 16px; border-radius: 4px; background: #F6F4F5; overflow-x: auto; font-size: 15px; line-height: 1.6; }
.ftb-post pre code { padding: 0; background: none; }
.ftb-post > .ftb-card { margin-top: 24px; }
.ftb-post > .ftb-card + * { margin-top: 24px; }
.ftb-post a.ftb-card { padding: 12px; border: 2px solid #141414; border-radius: 4px; display: flex; align-items: center; gap: 12px; color: #141414; font-weight: 400; text-decoration: none; line-height: 1.4; }
.ftb-post .ftb-card img { width: 72px; height: 72px; flex-shrink: 0; object-fit: cover; border-radius: 4px; background: #F6F4F5; }
.ftb-post .ftb-card-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ftb-post .ftb-card-t strong { font-size: 18px; font-weight: 400; }
.ftb-post .ftb-card-t span { font-size: 14px; color: #595959; }
.ftb-post .ftb-card-t b { font-size: 15px; font-weight: 800; }
/* ── 읽기 좋은 모양(2026-10-11 "본문을 더 가시성 좋게") — 문법은 lib/markdown 머리 주석 ── */
.ftb-post { counter-reset: sec; }
.ftb-post > h2 { counter-increment: sec; scroll-margin-top: 72px; padding-top: 28px; border-top: 2px solid #141414; }
.ftb-post > h2::before { content: counter(sec, decimal-leading-zero); display: block; margin-bottom: 8px; font-family: var(--font-num), var(--font-sans), sans-serif; font-size: 15px; letter-spacing: 0.06em; color: #8C8C8C; }
.ftb-post > p { color: #262626; }
.ftb-post mark { background: linear-gradient(transparent 56%, #FBDDB0 56%); color: inherit; padding: 0 1px; }
.ftb-post > ol { padding: 4px 0 0; list-style: none; counter-reset: step; }
.ftb-post > ol + *, .ftb-post > ul + *, .ftb-post > table + * { margin-top: 24px; }
.ftb-post > ol > li { counter-increment: step; position: relative; min-height: 34px; padding: 4px 0 22px 50px; line-height: 1.6; }
.ftb-post > ol > li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 34px; height: 34px; border-radius: 50%; background: #141414; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-family: var(--font-num), var(--font-sans), sans-serif; font-size: 17px; }
.ftb-post > ol > li::after { content: ''; position: absolute; left: 16px; top: 38px; bottom: 6px; width: 2px; background: #E5E5E5; }
.ftb-post > ol > li:last-child { padding-bottom: 0; }
.ftb-post > ol > li:last-child::after { display: none; }
.ftb-post table { width: 100%; border-collapse: collapse; border-top: 2px solid #141414; border-bottom: 2px solid #141414; font-size: 16px; line-height: 1.45; }
.ftb-post th { padding: 10px 8px; background: #F6F4F5; font-size: 14px; font-weight: 800; color: #3D3D3D; text-align: left; }
.ftb-post td { padding: 13px 8px; border-top: 1px solid #E5E5E5; vertical-align: top; }
.ftb-post th:first-child, .ftb-post td:first-child { padding-left: 0; }
.ftb-post th:last-child, .ftb-post td:last-child { padding-right: 0; }
.ftb-post th:not(:first-child), .ftb-post td:not(:first-child) { text-align: right; white-space: nowrap; }
.ftb-post td:not(:first-child) { font-weight: 800; }
.ftb-post .md-box { padding: 18px; border-radius: 4px; }
.ftb-post .md-box > * { margin: 0; }
.ftb-post .md-box > * + * { margin-top: 10px; }
.ftb-post .md-box-t { font-family: var(--font-poster), var(--font-sans), sans-serif; font-weight: 400; font-size: 19px; line-height: 1.3; letter-spacing: -0.01em; }
.ftb-post .md-box p { font-size: 16px; line-height: 1.7; }
.ftb-post .md-box ul { border-top: 0; }
.ftb-post .md-box ul > li { padding: 8px 0 8px 22px; border-bottom: 0; font-size: 16px; }
.ftb-post .md-box ul > li::before { top: calc(8px + 0.8em - 4px); }
.ftb-post .md-sum { border: 2px solid #141414; }
.ftb-post .md-sum ul { counter-reset: sum; }
.ftb-post .md-sum ul > li { counter-increment: sum; padding-left: 34px; font-size: 17px; }
.ftb-post .md-sum ul > li::before { content: counter(sum); left: 0; top: 9px; width: 24px; height: 24px; border-radius: 50%; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-family: var(--font-num), var(--font-sans), sans-serif; font-size: 13px; }
.ftb-post .md-tip { background: #EDF4F0; }
.ftb-post .md-tip .md-box-t { color: #1D3B2F; }
.ftb-post .md-tip ul > li::before { background: #1D3B2F; }
.ftb-post .md-warn { background: #FBEDEA; }
.ftb-post .md-warn .md-box-t { color: #A8321F; }
.ftb-post .md-warn ul > li::before { background: #A8321F; }
.ftb-post .md-toc { padding: 18px; border-radius: 4px; background: #F6F4F5; }
.ftb-post .md-toc ol { margin: 8px 0 0; padding: 0; list-style: none; }
.ftb-post .md-toc li { padding: 0; }
.ftb-post .md-toc a { padding: 8px 0; display: flex; gap: 12px; align-items: baseline; color: #141414; font-weight: 700; text-decoration: none; font-size: 16px; line-height: 1.45; }
.ftb-post .md-toc a span { flex-shrink: 0; font-family: var(--font-num), var(--font-sans), sans-serif; font-weight: 400; font-size: 15px; letter-spacing: 0.06em; color: #8C8C8C; }
.ftb-post > details.md-qa { margin-top: 0; border-bottom: 1px solid #E5E5E5; }
.ftb-post > h2 + details.md-qa { margin-top: 14px; border-top: 2px solid #141414; }
.ftb-post .md-qa > summary { min-height: 60px; padding: 14px 0; display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 800; line-height: 1.45; list-style: none; cursor: pointer; }
.ftb-post .md-qa > summary::-webkit-details-marker { display: none; }
.ftb-post .md-q { width: 26px; height: 26px; flex-shrink: 0; border-radius: 4px; background: #141414; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-family: var(--font-num), var(--font-sans), sans-serif; font-weight: 400; font-size: 15px; }
.ftb-post .md-qt { flex: 1; min-width: 0; }
.ftb-post .md-qa-i::before { content: '+'; font-size: 26px; font-weight: 300; }
.ftb-post .md-qa[open] .md-qa-i::before { content: '−'; }
.ftb-post .md-a { padding: 0 0 18px 38px; color: #3D3D3D; }
.ftb-post .md-a > * { margin: 0; }
.ftb-post .md-a > * + * { margin-top: 10px; }
.ftb-post .md-a p { font-size: 16px; line-height: 1.7; }
.ftb-share svg { display: none; }
.ftb-share::before { content: ''; width: 22px; height: 22px; background: currentColor; -webkit-mask: ${SHARE_ICON} center / contain no-repeat; mask: ${SHARE_ICON} center / contain no-repeat; }
`
