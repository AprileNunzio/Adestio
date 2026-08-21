'use strict';
const { exec } = require('child_process');
const util = require('util');
const { PORT, UDP_PORT } = require('../protocol/constants');
const logger = require('../../observability/logger');
const bus = require('../../core/event_bus');
const execAsync = util.promisify(exec);
const FW_GROUP_NAME = 'Adestio';

function _notifyFailure(reason) {
    try {
        bus.publish('firewall:rule-failed', { reason });
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send('firewall-rule-failed', { reason });
        });
    } catch (_) {}
}

async function _runPowerShell(command) {
    try {
        const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;
        const { stdout } = await execAsync(psCommand);
        return stdout;
    } catch (e) {
        return '';
    }
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
        await _runPowerShell(`Get-NetFirewallRule -DisplayName '*Adestio*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue`);
    } catch (e) {}
}

async function _checkIfRulesExist() {
    try {
        const stdout = await _runPowerShell("Get-NetFirewallRule -DisplayName 'Adestio' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Enabled");
        return stdout.includes('True');
    } catch(e) {
        return false;
    }
}

async function ensureFirewallRules() {
    try {
        if (process.platform !== 'win32') return;
        const rulesExist = await _checkIfRulesExist();
        if (rulesExist) {
            logger.info('[Firewall] Regole Firewall Adestio già attive.');
            return;
        }
        const execPath = process.execPath.replace(/'/g, "''");
        const elevated = await _isElevated();
        if (!elevated) {
            const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Get-NetFirewallRule -DisplayName '*Adestio*' | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Adestio' -Direction Inbound -Action Allow -Program '${execPath}' -Profile Any -EdgeTraversalPolicy Allow
New-NetFirewallRule -DisplayName 'Adestio' -Direction Outbound -Action Allow -Program '${execPath}' -Profile Any
`;
            const encodedCmd = Buffer.from(psScript, 'utf16le').toString('base64');
            exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encodedCmd}'"`, (err) => {
                try {
                    if (err) {
                        _notifyFailure('not-elevated-and-uac-failed');
                    }
                } catch (_) {}
            });
            return;
        }
        await _cleanOldRules();
        await _runPowerShell(`
New-NetFirewallRule -DisplayName 'Adestio' -Direction Inbound -Action Allow -Program '${execPath}' -Profile Any -EdgeTraversalPolicy Allow;
New-NetFirewallRule -DisplayName 'Adestio' -Direction Outbound -Action Allow -Program '${execPath}' -Profile Any;
`);
        logger.info('[Firewall] Regole Firewall Adestio configurate con successo.');
    } catch (e) {
        logger.error('[Firewall] Errore configurazione Firewall', { error: e.message });
    }
}

module.exports = { ensureFirewallRules };
