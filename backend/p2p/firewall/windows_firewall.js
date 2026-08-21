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
        const stdout = await _runPowerShell(`(Get-NetFirewallRule -DisplayName '*Adestio*' -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq $true }).Count`);
        const count = parseInt(String(stdout).trim(), 10);
        return !isNaN(count) && count >= 2;
    } catch(e) {
        return false;
    }
}

async function ensureFirewallRules() {
    try {
        if (process.platform !== 'win32') return;
        const rulesExist = await _checkIfRulesExist();
        if (rulesExist) {
            logger.info('[Firewall] Regole Firewall già configurate e attive.');
            return;
        }
        const elevated = await _isElevated();
        if (!elevated) {
            logger.info('[Firewall] Processo standard, tentativo applicazione regole UAC...');
            const execPath = process.execPath.replace(/'/g, "''");
            const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Get-NetFirewallRule -DisplayName '*Adestio*' | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Adestio App (In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Program '${execPath}' -Profile Any -EdgeTraversalPolicy Allow
New-NetFirewallRule -DisplayName 'Adestio App (Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Program '${execPath}' -Profile Any
New-NetFirewallRule -DisplayName 'Adestio Sync (TCP-In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${PORT},34568,34569,34570,34571,45891,7345 -Profile Any -EdgeTraversalPolicy Allow
New-NetFirewallRule -DisplayName 'Adestio Discovery (UDP-In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Protocol UDP -LocalPort ${UDP_PORT},5353,7346 -Profile Any -EdgeTraversalPolicy Allow
New-NetFirewallRule -DisplayName 'Adestio Sync (TCP-Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Protocol TCP -LocalPort ${PORT},34568,34569,34570,34571,45891,7345 -Profile Any
New-NetFirewallRule -DisplayName 'Adestio Discovery (UDP-Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Protocol UDP -LocalPort ${UDP_PORT},5353,7346 -Profile Any
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
        const execPath = process.execPath.replace(/'/g, "''");
        await _runPowerShell(`
New-NetFirewallRule -DisplayName 'Adestio App (In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Program '${execPath}' -Profile Any -EdgeTraversalPolicy Allow;
New-NetFirewallRule -DisplayName 'Adestio App (Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Program '${execPath}' -Profile Any;
New-NetFirewallRule -DisplayName 'Adestio Sync (TCP-In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${PORT},34568,34569,34570,34571,45891,7345 -Profile Any -EdgeTraversalPolicy Allow;
New-NetFirewallRule -DisplayName 'Adestio Discovery (UDP-In)' -Group '${FW_GROUP_NAME}' -Direction Inbound -Action Allow -Protocol UDP -LocalPort ${UDP_PORT},5353,7346 -Profile Any -EdgeTraversalPolicy Allow;
New-NetFirewallRule -DisplayName 'Adestio Sync (TCP-Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Protocol TCP -LocalPort ${PORT},34568,34569,34570,34571,45891,7345 -Profile Any;
New-NetFirewallRule -DisplayName 'Adestio Discovery (UDP-Out)' -Group '${FW_GROUP_NAME}' -Direction Outbound -Action Allow -Protocol UDP -LocalPort ${UDP_PORT},5353,7346 -Profile Any;
`);
        logger.info('[Firewall] Configurazione Firewall completata con successo.');
    } catch (e) {
        logger.error('[Firewall] Errore configurazione Firewall', { error: e.message });
    }
}

module.exports = { ensureFirewallRules };
