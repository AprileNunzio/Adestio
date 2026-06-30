'use strict';

function encode(obj) {
    return JSON.stringify(obj);
}

function decode(raw) {
    const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
    return JSON.parse(str);
}

module.exports = { encode, decode };
