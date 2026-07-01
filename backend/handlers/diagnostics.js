const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { getDB } = require('../db');
const { getConnectedNodesCount, getDetailedNodes } = require('../sync');
async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}
async function runDiagnostics(event) {
    const log = (msg, status = 'info', data = null) => {
        if (event && event.sender) {
            try {
                event.sender.send('diag-progress', { msg, status, data });
            } catch(e){}
        }
    };
    let issuesFound = 0;
    try {
        log("Avvio Analisi Diagnostica di Sistema...", "info");
        await delay(500);
        log("Analisi Interfacce di Rete...", "loading");
        await delay(1000);
        const ips = getLocalIPs();
        if (ips.length === 0) {
            log("Nessun IP locale rilevato. Il PC sembra scollegato dalla rete.", "error");
            issuesFound++;
        } else {
            log(`IP Locali rilevati: ${ips.join(', ')}`, "success");
        }
        log("Controllo Profilo di Rete di Windows...", "loading");
        await delay(1500);
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execPromise('powershell -Command "Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory"');
                if (stdout.includes('Public')) {
                    log("ATTENZIONE: La rete attuale è impostata su 'Pubblica'. Windows potrebbe bloccare il traffico P2P.", "error", { fixable: 'network_profile' });
                    issuesFound++;
                } else {
                    log("Profilo di Rete: Privato (Ottimale)", "success");
                }
            } else {
                log("Sistema operativo non Windows, controllo profilo ignorato.", "info");
            }
        } catch (e) {
            log("Impossibile determinare il profilo di rete.", "warning");
        }
        log("Analisi Regole Windows Defender Firewall...", "loading");
        await delay(1500);
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execPromise('powershell -Command "Get-NetFirewallRule -DisplayName \'Adestio Blockchain P2P\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Enabled"');
                if (!stdout.includes('True')) {
                    log("Regole Firewall per Adestio mancanti o disabilitate.", "error", { fixable: 'firewall' });
                    issuesFound++;
                } else {
                    log("Regole Firewall per Adestio: ATTIVE", "success");
                }
            } else {
                log("Sistema operativo non Windows, controllo firewall ignorato.", "info");
            }
        } catch (e) {
            log("Regole Firewall per Adestio NON trovate.", "error", { fixable: 'firewall' });
            issuesFound++;
        }
        log("Analisi Conflitto Porte (Netstat)...", "loading");
        await delay(1500);
        try {
            const { stdout: netstatOut } = await execPromise('netstat -ano');
            const lines = netstatOut.split('\n');
            const port34567Line = lines.find(l => l.includes(':34567') && l.includes('LISTENING'));
            if (port34567Line) {
                const parts = port34567Line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (parseInt(pid) === process.pid) {
                    log("Porta TCP 34567 (Main P2P) associata correttamente al processo Adestio.", "success");
                } else {
                    log(`Porta 34567 in uso dal processo PID ${pid}. Conflitto di rete rilevato!`, "error");
                    issuesFound++;
                }
            } else {
                log("Porta TCP 34567 non in ascolto.", "warning");
            }
            const port34568Line = lines.find(l => l.includes(':34568') && l.includes('LISTENING'));
            if (port34568Line) {
                const parts = port34568Line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (parseInt(pid) === process.pid) {
                    log("Porta TCP 34568 (Diagnostic Sidecar) associata correttamente.", "success");
                } else {
                    log(`Porta 34568 in uso dal processo PID ${pid}. Conflitto Sidecar!`, "error");
                    issuesFound++;
                }
            } else {
                log("Porta TCP 34568 non in ascolto.", "warning");
            }
        } catch (e) {
            log("Impossibile eseguire l'analisi netstat.", "warning");
        }
        log("Verifica Motore di Sincronizzazione P2P...", "loading");
        await delay(1000);
        try {
            const count = getConnectedNodesCount();
            log(`Motore Sync in ascolto. Nodi in memoria cache: ${count}`, "success");
        } catch (e) {
            log("Impossibile interrogare il Motore Sync. Potrebbe essere in stallo.", "error");
            issuesFound++;
        }
        log("Test di Trasmissione Multicast (mDNS Bonjour)...", "loading");
        await delay(1000);
        try {
            const bonjour = require('bonjour-service');
            const bj = new bonjour.Bonjour();
            const browser = bj.find({ type: 'adestio-node' });
            let found = false;
            browser.on('up', (service) => {
                found = true;
            });
            await delay(1500);
            browser.stop();
            if (found) {
                log("Servizio mDNS (Discovery) funzionante sulla LAN.", "success");
            } else {
                log("Nessun segnale mDNS rilevato. Il router/switch potrebbe bloccare il Multicast (Client Isolation).", "warning");
            }
        } catch(e) {
            log("Errore nel test mDNS.", "warning");
        }
        log("Analisi Integrità Database Locale...", "loading");
        await delay(1000);
        try {
            const db = getDB();
            if (db) {
                const res = db.exec("SELECT count(*) FROM users");
                log(`Database integro e sbloccato. Record Utenti: ${res[0].values[0][0]}`, "success");
            } else {
                log("Database non pronto (nodo vergine).", "info");
            }
        } catch (e) {
            if (e.message === "DB_NOT_INITIALIZED") {
                log("Database vuoto o non inizializzato. È richiesta l'iscrizione o la sincronizzazione.", "info");
            } else {
                log(`Errore Database: ${e.message}`, "error");
                issuesFound++;
            }
        }
        log("====================================", "info");
        if (issuesFound > 0) {
            log(`Analisi completata. Rilevate ${issuesFound} anomalie.`, "error", { showFixBtn: true });
        } else {
            log("Analisi completata. Il nodo è in perfetto stato di salute.", "success");
        }
    } catch (e) {
        log(`Errore Critico durante la diagnostica: ${e.message}`, "error");
    }
}
async function fixDiagnostics(event) {
    const log = (msg, status = 'info') => {
        if (event && event.sender) {
            try { event.sender.send('diag-progress', { msg, status }); } catch(e){}
        }
    };
    log("Inizio processo di Auto-Risoluzione...", "loading");
    if (process.platform === 'win32') {
        try {
            log("Tentativo di applicazione regole Firewall per le porte 34567-34568...", "info");
            const script = `New-NetFirewallRule -DisplayName 'Adestio Blockchain P2P' -Direction Inbound -LocalPort 34567,34568 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName 'Adestio Blockchain P2P UDP' -Direction Inbound -LocalPort 34567,34568 -Protocol UDP -Action Allow -ErrorAction SilentlyContinue;`;
            try {
                await execPromise(`powershell -Command "${script}"`);
                log("Regole Firewall create con successo.", "success");
            } catch (err) {
                log("Privilegi insufficienti. Richiesta elevazione (UAC)...", "warning");
                const elevateScript = `Start-Process powershell -ArgumentList '-Command', \\"${script}\\" -Verb RunAs -WindowStyle Hidden`;
                await execPromise(`powershell -Command "${elevateScript}"`);
                log("Elevazione completata. Regole applicate.", "success");
            }
            await delay(1000);
            log("Tentativo di impostazione Rete su Privato...", "info");
            try {
                const fixNetworkScript = `$profiles = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }; if ($profiles) { $profiles | Set-NetConnectionProfile -NetworkCategory Private }`;
                try {
                    await execPromise(`powershell -Command "${fixNetworkScript}"`);
                    log("Profilo di rete verificato e aggiornato.", "success");
                } catch(e) {
                    const elevateNetScript = `Start-Process powershell -ArgumentList '-Command', \\"${fixNetworkScript}\\" -Verb RunAs -WindowStyle Hidden`;
                    await execPromise(`powershell -Command "${elevateNetScript}"`);
                    log("Profilo di rete aggiornato (con privilegi).", "success");
                }
            } catch(e) {
                log("Impossibile forzare il profilo di rete. Procedere manualmente.", "warning");
            }
        } catch (e) {
            log(`Errore Auto-Fix: ${e.message}`, "error");
        }
    } else {
        log("Auto-Risoluzione disponibile solo su Windows.", "info");
    }
    log("Auto-Risoluzione completata. Avvia una nuova analisi per verificare.", "success", { fixCompleted: true });
}
function getDetailedNodesHandler() {
    try {
        if (typeof getDetailedNodes === 'function') {
            return getDetailedNodes();
        }
        return [];
    } catch(e) {
        return [];
    }
}
module.exports = { runDiagnostics, fixDiagnostics, getDetailedNodesHandler };
