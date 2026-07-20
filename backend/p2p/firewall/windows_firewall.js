'use strict';
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const { PORT, UDP_PORT } = require('../protocol/constants');
const logger = require('../../observability/logger');
const bus = require('../../core/event_bus');
const execAsync = util.promisify(exec);
const FW_GROUP_NAME = 'Adestio';
function _notifyFailure(reason) {
    bus.publish('firewall:rule-failed', { reason });
    try {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send('firewall-rule-failed', { reason });
        });
    } catch (_) {}
}
async function _runPowerShell(command) {
    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;
    const { stdout } = await execAsync(psCommand);
    return stdout;
}
async function _isElevated() {
    try {
        await execAsync('net session');
        return true;
    } catch (err) {
        return false;
    }
}
async function _cleanOldRules() {
    try {
        logger.info('[Firewall] Rimozione di vecchie regole dal gruppo...');
        await _runPowerShell(`Remove-NetFirewallRule -Group '${FW_GROUP_NAME}' -ErrorAction SilentlyContinue`);
    } catch (e) {
        logger.info('[Firewall] Pulizia vecchie regole completata (o non presenti).');
    }
}
async function _addRule(name, protocol, port, isOutbound = false) {
    const direction = isOutbound ? 'Outbound' : 'Inbound';
    const execPath = process.execPath.replace(/'/g, "''");
    const edgePolicy = isOutbound ? '' : '-EdgeTraversalPolicy Allow';
    const cmd = `New-NetFirewallRule -DisplayName '${name}' ` +
                `-Group '${FW_GROUP_NAME}' ` +
                `-Direction ${direction} ` +
                `-Action Allow ` +
                `-Protocol ${protocol} ` +
                `-LocalPort ${port} ` +
                `-Program '${execPath}' ` +
                `-Profile Any ` + edgePolicy;
    try {
        await _runPowerShell(cmd);
        logger.info(`[Firewall] Regola ${direction} creata con successo`, { name, protocol, port, execPath });
    } catch (e) {
        const psError = e.stderr ? e.stderr.toString().trim() : e.message;
        logger.warn(`[Firewall] Impossibile creare regola ${direction} (permessi negati o GPO bloccante)`, { name, protocol, port, error: psError });
        _notifyFailure('rule-create-failed');
    }
}
async function _checkIfRulesExist() {
    try {
        const { stdout } = await _runPowerShell(`(Get-NetFirewallRule -Group '${FW_GROUP_NAME}' -ErrorAction SilentlyContinue).Count`);
        const count = parseInt(stdout.trim(), 10);
        return !isNaN(count) && count >= 6; 
    } catch(e) {
        return false;
    }
}
async function ensureFirewallRules() {
    try {
        logger.info('[Firewall] Inizializzazione configurazione Firewall Enterprise...');
        const rulesExist = await _checkIfRulesExist();
        if (rulesExist) {
            logger.info('[Firewall] Regole Firewall già presenti. Nessuna forzatura necessaria.');
            return;
        }
        const elevated = await _isElevated();
        if (!elevated) {
            logger.warn('[Firewall] Processo non elevato e regole mancanti: forzatura elevazione tramite PowerShell...');
            const execPath = process.execPath.replace(/'/g, "''");
            const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Remove-NetFirewallRule -Group '${FW_GROUP_NAME}'
$rules = @(
    @{ N='Adestio Sync (TCP-In)'; P='TCP'; Po=${PORT}; D='Inbound'; E='-EdgeTraversalPolicy Allow' },
    @{ N='Adestio Discovery (UDP-In)'; P='UDP'; Po=${UDP_PORT}; D='Inbound'; E='-EdgeTraversalPolicy Allow' },
    @{ N='Adestio mDNS Bonjour (UDP-In)'; P='UDP'; Po=5353; D='Inbound'; E='-EdgeTraversalPolicy Allow' },
    @{ N='Adestio Sync (TCP-Out)'; P='TCP'; Po=${PORT}; D='Outbound'; E='' },
    @{ N='Adestio Discovery (UDP-Out)'; P='UDP'; Po=${UDP_PORT}; D='Outbound'; E='' },
    @{ N='Adestio mDNS Bonjour (UDP-Out)'; P='UDP'; Po=5353; D='Outbound'; E='' }
)
foreach ($r in $rules) {
    $cmd = "New-NetFirewallRule -DisplayName '$($r.N)' -Group '${FW_GROUP_NAME}' -Direction $($r.D) -Action Allow -Protocol $($r.P) -LocalPort $($r.Po) -Program '${execPath}' -Profile Any $($r.E)"
    Invoke-Expression $cmd
}
`;
            // Encode per powershell -EncodedCommand (UTF-16LE Base64)
            const encodedCmd = Buffer.from(psScript, 'utf16le').toString('base64');
            try {
                const { exec } = require('child_process');
                exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encodedCmd}'"`, (err) => {
                    if (err) {
                        logger.error('[Firewall] Impossibile avviare il processo elevato', err);
                        _notifyFailure('not-elevated-and-uac-failed');
                    } else {
                        logger.info('[Firewall] Richiesta UAC inviata, regole in fase di applicazione.');
                    }
                });
            } catch (uacErr) {
                logger.error('[Firewall] Errore di lancio processo elevato', uacErr);
            }
            return;
        }
        await _cleanOldRules();
        await _addRule(`Adestio Sync (TCP-In)`, 'TCP', PORT, false);
        await _addRule(`Adestio Discovery (UDP-In)`, 'UDP', UDP_PORT, false);
        await _addRule(`Adestio mDNS Bonjour (UDP-In)`, 'UDP', 5353, false);
        await _addRule(`Adestio Sync (TCP-Out)`, 'TCP', PORT, true);
        await _addRule(`Adestio Discovery (UDP-Out)`, 'UDP', UDP_PORT, true);
        await _addRule(`Adestio mDNS Bonjour (UDP-Out)`, 'UDP', 5353, true);
        logger.info('[Firewall] Configurazione Firewall completata con successo.');
    } catch (e) {
        logger.error('[Firewall] Errore critico durante la gestione del Firewall', { error: e.message, stack: e.stack });
    }
}
module.exports = { ensureFirewallRules };
