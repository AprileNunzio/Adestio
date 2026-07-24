'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class FlightRecorder {
    constructor() {
        try {
            this._ringBufferCapacity = 1000;
            this._ringBuffer = [];
            this._cursor = 0;
            this._startWalWatchdog();
        } catch (e) {}
    }

    _startWalWatchdog() {
        try {
            setInterval(() => {
                try {
                    this.recordEvent('SYSTEM', 'WAL_CHECKPOINT_PING', { memory: process.memoryUsage().rss });
                } catch (e) {}
            }, 60000);
        } catch (e) {}
    }

    recordEvent(source, eventType, data = null) {
        try {
            const entry = {
                ts: Date.now(),
                iso: new Date().toISOString(),
                source: String(source),
                type: String(eventType),
                data: data || null
            };

            if (this._ringBuffer.length < this._ringBufferCapacity) {
                this._ringBuffer.push(entry);
            } else {
                this._ringBuffer[this._cursor] = entry;
                this._cursor = (this._cursor + 1) % this._ringBufferCapacity;
            }
        } catch (e) {}
    }

    getEvents(limit = 100) {
        try {
            const ordered = [];
            const total = this._ringBuffer.length;
            if (total === 0) return [];

            if (total < this._ringBufferCapacity) {
                return this._ringBuffer.slice(-limit).reverse();
            }

            for (let i = 0; i < total; i++) {
                const idx = (this._cursor - 1 - i + total) % total;
                ordered.push(this._ringBuffer[idx]);
                if (ordered.length >= limit) break;
            }
            return ordered;
        } catch (e) {
            return [];
        }
    }

    exportDiagnosticDump() {
        try {
            const userData = app.getPath('userData');
            const dumpDir = path.join(userData, 'diagnostics');
            if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

            const dumpFile = path.join(dumpDir, `flight_dump_${Date.now()}.diag`);
            const dumpData = {
                version: app.getVersion(),
                generatedAt: new Date().toISOString(),
                events: this.getEvents(1000)
            };

            fs.writeFileSync(dumpFile, JSON.stringify(dumpData, null, 2), 'utf8');
            return { success: true, filePath: dumpFile };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = new FlightRecorder();
