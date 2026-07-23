'use strict';

(function (window) {
    try {
        class AdestioSdk {
            constructor() {
                try {
                    this.appId = null;
                    this.token = null;
                    this.pendingRequests = new Map();
                } catch (error) {
                    console.error('[AdestioSdk constructor Error]', error);
                }
            }

            init(config) {
                try {
                    if (config && config.appId) this.appId = config.appId;
                    if (config && config.token) this.token = config.token;
                } catch (error) {
                    console.error('[AdestioSdk init Error]', error);
                }
            }

            callAppApi(targetAppId, action, payload) {
                try {
                    return new Promise((resolve, reject) => {
                        try {
                            const requestId = 'req_' + Math.random().toString(36).substring(2, 11);
                            this.pendingRequests.set(requestId, { resolve: resolve, reject: reject });

                            if (window.adestioNative && typeof window.adestioNative.callAppApi === 'function') {
                                window.adestioNative.callAppApi({
                                    requestId: requestId,
                                    sourceApp: this.appId,
                                    targetApp: targetAppId,
                                    action: action,
                                    payload: payload
                                });
                            } else {
                                reject(new Error('Interfaccia Adestio non presente nel contesto'));
                            }
                        } catch (innerErr) {
                            reject(innerErr);
                        }
                    });
                } catch (error) {
                    console.error('[AdestioSdk callAppApi Error]', error);
                    return Promise.reject(error);
                }
            }

            handleResponse(requestId, success, data, errorMsg) {
                try {
                    if (this.pendingRequests.has(requestId)) {
                        const handler = this.pendingRequests.get(requestId);
                        this.pendingRequests.delete(requestId);
                        if (success) {
                            handler.resolve(data);
                        } else {
                            handler.reject(new Error(errorMsg || 'Errore invocazione API'));
                        }
                    }
                } catch (error) {
                    console.error('[AdestioSdk handleResponse Error]', error);
                }
            }
        }

        window.AdestioSdk = new AdestioSdk();
    } catch (globalError) {
        console.error('[AdestioSdk Global Scope Error]', globalError);
    }
})(typeof window !== 'undefined' ? window : this);
