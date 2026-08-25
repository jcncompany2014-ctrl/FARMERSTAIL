import { registerPlugin } from '@capacitor/core';
const CapacitorKakaoLogin = registerPlugin('CapacitorKakaoLogin', {
    web: () => import('./web').then(m => new m.CapacitorKakaoLoginWeb()),
});
export * from './definitions';
export { CapacitorKakaoLogin };
//# sourceMappingURL=index.js.map