'use strict';
const { exec } = require('child_process');
const os = require('os');

function getLocalIPs() {
    const ips = ['127.0.0.1', 'localhost', '::1'];
    for (const addrs of Object.values(os.networkInterfaces())) {
        for (const iface of addrs) {
            if (!iface.internal) ips.push(iface.address);
        }
    }
    return ips;
}

function scanArpTable() {
    return new Promise((resolve) => {
        exec('arp -a', { timeout: 4000 }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const myIPs = new Set(getLocalIPs());
            const ips = new Set();
            for (const line of stdout.split('\n')) {
                const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                if (!match) continue;
                const ip = match[1];
                if (myIPs.has(ip)) continue;
                if (ip.endsWith('.255') || ip.endsWith('.0')) continue;
                if (ip.startsWith('224.') || ip.startsWith('239.') || ip.startsWith('255.')) continue;
                const last = parseInt(ip.split('.')[3], 10);
                if (last === 1 || last === 254) continue;
                ips.add(ip);
            }
            resolve([...ips]);
        });
    });
}

module.exports = { scanArpTable, getLocalIPs };
