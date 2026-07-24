'use strict';

class AppMetrics {
    constructor() {
        try {
            this._metrics = new Map();
        } catch (e) {}
    }

    recordIpcInvocation(appId, action, durationMs, success = true, errorMsg = null) {
        try {
            if (!this._metrics.has(appId)) {
                this._metrics.set(appId, {
                    totalInvocations: 0,
                    totalErrors: 0,
                    actions: new Map()
                });
            }
            const appData = this._metrics.get(appId);
            appData.totalInvocations++;
            if (!success) appData.totalErrors++;

            if (!appData.actions.has(action)) {
                appData.actions.set(action, {
                    count: 0,
                    errors: 0,
                    totalDurationMs: 0,
                    minMs: durationMs,
                    maxMs: durationMs,
                    lastError: null
                });
            }
            const actData = appData.actions.get(action);
            actData.count++;
            if (!success) {
                actData.errors++;
                actData.lastError = errorMsg;
            }
            actData.totalDurationMs += durationMs;
            if (durationMs < actData.minMs) actData.minMs = durationMs;
            if (durationMs > actData.maxMs) actData.maxMs = durationMs;
        } catch (e) {}
    }

    getAppMetrics(appId = null) {
        try {
            if (appId) {
                const data = this._metrics.get(appId);
                if (!data) return null;
                const actionsObj = {};
                data.actions.forEach((val, key) => {
                    actionsObj[key] = {
                        ...val,
                        avgDurationMs: val.count > 0 ? (val.totalDurationMs / val.count).toFixed(2) : 0
                    };
                });
                return {
                    appId,
                    totalInvocations: data.totalInvocations,
                    totalErrors: data.totalErrors,
                    actions: actionsObj
                };
            }

            const result = {};
            this._metrics.forEach((val, key) => {
                const actionsObj = {};
                val.actions.forEach((actVal, actKey) => {
                    actionsObj[actKey] = {
                        ...actVal,
                        avgDurationMs: actVal.count > 0 ? (actVal.totalDurationMs / actVal.count).toFixed(2) : 0
                    };
                });
                result[key] = {
                    totalInvocations: val.totalInvocations,
                    totalErrors: val.totalErrors,
                    actions: actionsObj
                };
            });
            return result;
        } catch (e) {
            return {};
        }
    }

    resetMetrics(appId = null) {
        try {
            if (appId) {
                this._metrics.delete(appId);
            } else {
                this._metrics.clear();
            }
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new AppMetrics();
