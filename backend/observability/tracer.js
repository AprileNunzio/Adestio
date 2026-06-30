'use strict';
const { debug } = require('./logger');

function trace(operationName, fn) {
    const t0 = Date.now();
    const result = fn();
    if (result && typeof result.then === 'function') {
        return result.then(r => { debug(`[trace] ${operationName} ${Date.now() - t0}ms`); return r; })
                     .catch(e => { debug(`[trace] ${operationName} FAILED ${Date.now() - t0}ms ${e.message}`); throw e; });
    }
    debug(`[trace] ${operationName} ${Date.now() - t0}ms`);
    return result;
}

module.exports = { trace };
