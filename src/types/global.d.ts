export {};

/**
 * Daum Postcode — 외부 CDN 스크립트가 window.daum에 붙여주는 주소검색 위젯.
 *
 * 전체 SDK 타입은 Daum 공식 문서에만 있고, oncomplete payload가 사용자가
 * 고른 방식(도로명 vs 지번)에 따라 다른 필드를 담는다. 호출하는 쪽
 * (components/AddressSearch.tsx, app/(main)/subscribe/[slug]/page.tsx)은 각자
 * 필요한 필드만 가진 local `DaumPostcodeData` interface를 선언해서 oncomplete
 * 파라미터를 타입캐스트로 받는 방식으로 이미 타입 안전성을 확보하고 있다.
 *
 * 따라서 window.daum 전역은 느슨하게 any로 두되, .d.ts 파일 관례에 따라
 * 이 한 줄에만 no-explicit-any를 disable한다. 구조적 타입 주입을 시도하면
 * 함수 파라미터 contravariance 때문에 호출 지점들의 local interface와
 * 충돌한다 (TS2322).
 */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daum: any;
  }
}