'use strict';
const { exec } = require('child_process');
const { PORT, UDP_PORT } = require('../protocol/constants');
const logger = require('../../observability/logger');
const bus = require('../../core/event_bus');
const RULE_NAME = 'Adestio P2P Node';
function _notifyFailure(reason) {
    bus.publish('firewall:rule-failed', { reason });
    try {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send('firewall-rule-failed', { reason }); });
    } catch (_) {}
}
function _isElevated() {
    return new Promise((resolve) => {
        exec('net session', (err) => resolve(!err));
    });
}
function _addRule(name, protocol, port) {
    exec(`netsh advfirewall firewall add rule name="${name}" dir=in action=allow protocol=${protocol} localport=${port}`, (err, stdout, stderr) => {
        if (err) {
            logger.warn('[Firewall] Impossibile creare la regola (permessi negati o netsh assente)', { name, protocol, port, error: stderr || err.message });
            _notifyFailure('rule-create-failed');
        } else {
            logger.info('[Firewall] Regola creata', { name, protocol, port });
        }
    });
}
async function ensureFirewallRules() {
    try {
        const elevated = await _isElevated();
        if (!elevated) {
            logger.warn('[Firewall] Processo non elevato: impossibile garantire le regole firewall');
            _notifyFailure('not-elevated');
        }
        exec(`netsh advfirewall firewall show rule name="${RULE_NAME}"`, (err, stdout) => {
            if (err) {
                logger.warn('[Firewall] Impossibile verificare le regole esistenti', { error: err.message });
                return;
            }
            if (stdout && stdout.includes(RULE_NAME)) return;
            _addRule(RULE_NAME, 'TCP', PORT);
            _addRule(`${RULE_NAME} UDP`, 'UDP', UDP_PORT);
        });
    } catch (e) {
        logger.error('[Firewall] ensureFirewallRules error', { error: e.message });
    }
}
module.exports = { ensureFirewallRules };
