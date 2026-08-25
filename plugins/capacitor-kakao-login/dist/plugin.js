var capacitorCapacitorKakaoLogin = (function (exports, core) {
    'use strict';

    const CapacitorKakaoLogin = core.registerPlugin('CapacitorKakaoLogin', {
        web: () => Promise.resolve().then(function () { return web; }).then(m => new m.CapacitorKakaoLoginWeb()),
    });

    class CapacitorKakaoLoginWeb extends core.WebPlugin {
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

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CapacitorKakaoLoginWeb: CapacitorKakaoLoginWeb
    });

    exports.CapacitorKakaoLogin = CapacitorKakaoLogin;

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
