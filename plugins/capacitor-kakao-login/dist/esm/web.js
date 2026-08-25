import { WebPlugin } from '@capacitor/core';
export class CapacitorKakaoLoginWeb extends WebPlugin {
    async echo(options) {
        console.log('ECHO', options);
        return options;
    }
    initSDK() {
        throw new Error('Method not implemented.');
    }
    prompt(options) {
        console.log('prompt', options);
        throw new Error('Method not implemented.');
    }
    addListener(eventName, listenerFunc) {
        console.log(eventName, listenerFunc);
        return;
    }
}
//# sourceMappingURL=web.js.map