'use strict';

const auditLogger = require('../observability/auditLogger');

class SandboxGuard {
    constructor() {
        try {
            this._maxMemoryMB = 500;
            this._maxExecutionTimeMs = 30000;
            this._monitoredProcesses = new Map();
            this._startWatchdog();
        } catch (e) {}
    }

    _startWatchdog() {
        try {
            setInterval(() => {
                try {
                    this.checkResourceUsage();
                } catch (e) {}
            }, 5000);
        } catch (e) {}
    }

    registerProcess(appId, childProcess) {
        try {
            if (!childProcess || !childProcess.pid) return false;
            this._monitoredProcesses.set(appId, {
                pid: childProcess.pid,
                process: childProcess,
                startedAt: Date.now()
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    unregisterProcess(appId) {
        try {
            this._monitoredProcesses.delete(appId);
            return true;
        } catch (e) {
            return false;
        }
    }

    checkResourceUsage() {
        try {
            this._monitoredProcesses.forEach((info, appId) => {
                try {
                    if (info.process && info.process.killed) {
                        this.unregisterProcess(appId);
                        return;
                    }

                    const usage = process.memoryUsage();
                    const rssMB = usage.rss / (1024 * 1024);

                    if (rssMB > this._maxMemoryMB) {
                        auditLogger.logEvent('sandbox', 'RESOURCE_QUOTA_EXCEEDED', 'app', appId, { memoryMB: rssMB }, 'WARNING');
                    }
                } catch (eProc) {}
            });
        } catch (e) {}
    }

    executeGuarded(appId, taskFn) {
        try {
            const start = Date.now();
            return new Promise((resolve, reject) => {
                try {
                    const timer = setTimeout(() => {
                        try {
                            auditLogger.logEvent('sandbox', 'EXECUTION_TIMEOUT', 'app', appId, { elapsedMs: Date.now() - start }, 'FAILURE');
                            reject(new Error(`Timeout esecuzione sandbox superato per ${appId}`));
                        } catch (eTimer) {}
                    }, this._maxExecutionTimeMs);

                    Promise.resolve(taskFn())
                        .then(res => {
                            clearTimeout(timer);
                            resolve(res);
                        })
                        .catch(err => {
                            clearTimeout(timer);
                            reject(err);
                        });
                } catch (eTask) {
                    reject(eTask);
                }
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }
}

module.exports = new SandboxGuard();
