'use strict';
const { exec } = require('child_process');
const { PORT, UDP_PORT } = require('../protocol/constants');
const RULE_NAME = 'Adestio P2P Node';
function ensureFirewallRules() {
    try {
        exec(`netsh advfirewall firewall show rule name="${RULE_NAME}"`, (err, stdout) => {
            if (stdout && stdout.includes(RULE_NAME)) return;
            exec(`netsh advfirewall firewall add rule name="${RULE_NAME}" dir=in action=allow protocol=TCP localport=${PORT}`);
            exec(`netsh advfirewall firewall add rule name="${RULE_NAME} UDP" dir=in action=allow protocol=UDP localport=${UDP_PORT}`);
            console.log(`[Firewall] Regole aggiunte: TCP:${PORT}, UDP:${UDP_PORT}`);
        });
    } catch (e) {
        console.error('[Firewall] ensureFirewallRules error:', e.message);
    }
}
module.exports = { ensureFirewallRules };
