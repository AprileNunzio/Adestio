'use strict';
const PROTOCOL_VERSION = 2;
const MIN_COMPATIBLE_PROTOCOL_VERSION = 2;
function _envPort(name, fallback) {
    try {
        const parsed = parseInt(process.env[name], 10);
        if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
        return fallback;
    } catch (e) {
        return fallback;
    }
}
const PORT = _envPort('ADESTIO_P2P_PORT', 34567);
const UDP_PORT = _envPort('ADESTIO_UDP_PORT', 34568);
const PORT_FALLBACK_ATTEMPTS = 5;
const SERVICE_NAME = 'adestio-node';
module.exports = { PROTOCOL_VERSION, MIN_COMPATIBLE_PROTOCOL_VERSION, PORT, UDP_PORT, PORT_FALLBACK_ATTEMPTS, SERVICE_NAME };
