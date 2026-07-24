'use strict';

(function (window) {
    try {
        class AdestioSdk {
            constructor() {
                try {
                    this.appId = null;
                    this.token = null;
                    this.pendingRequests = new Map();
                    this.eventSubscribers = new Map();
                } catch (error) {}
            }

            init(config) {
                try {
                    if (config && config.appId) this.appId = config.appId;
                    if (config && config.token) this.token = config.token;
                } catch (error) {}
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
                                }).then(res => {
                                    if (res && res.success) {
                                        resolve(res.data);
                                    } else {
                                        reject(new Error(res?.error || 'Errore invocazione API'));
                                    }
                                }).catch(err => reject(err));
                            } else {
                                reject(new Error('Interfaccia Adestio non presente nel contesto'));
                            }
                        } catch (innerErr) {
                            reject(innerErr);
                        }
                    });
                } catch (error) {
                    return Promise.reject(error);
                }
            }

            publishDomainEvent(eventName, aggregateId, payload) {
                try {
                    return this.callAppApi('core', 'events:publish', {
                        eventName,
                        aggregateId,
                        actorId: this.appId,
                        payload
                    });
                } catch (e) {
                    return Promise.reject(e);
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
                } catch (error) {}
            }

            formatCurrency(amount, currency = 'EUR', locale = 'it-IT') {
                try {
                    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount || 0);
                } catch (e) {
                    return `${amount} ${currency}`;
                }
            }

            formatDate(dateVal, locale = 'it-IT') {
                try {
                    const d = new Date(dateVal);
                    return new Intl.DateTimeFormat(locale).format(d);
                } catch (e) {
                    return String(dateVal);
                }
            }

            formatNumber(num, locale = 'it-IT') {
                try {
                    return new Intl.NumberFormat(locale).format(num || 0);
                } catch (e) {
                    return String(num);
                }
            }
        }

        window.AdestioSdk = new AdestioSdk();
    } catch (globalError) {}
})(typeof window !== 'undefined' ? window : this);
