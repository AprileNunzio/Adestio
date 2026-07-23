'use strict';

const crypto = require('crypto');

class CrdtEngine {
    constructor() {
        try {
            this.nodeId = crypto.randomBytes(8).toString('hex');
            this.stateVector = new Map();
            this.opLog = [];
        } catch (error) {
            console.error('[CrdtEngine constructor Error]', error);
        }
    }

    setNodeId(id) {
        try {
            if (id && typeof id === 'string') {
                this.nodeId = id;
            }
        } catch (error) {
            console.error('[CrdtEngine setNodeId Error]', error);
        }
    }

    createOperation(table, primaryKey, action, payload) {
        try {
            const currentSeq = (this.stateVector.get(this.nodeId) || 0) + 1;
            this.stateVector.set(this.nodeId, currentSeq);

            const op = {
                id: `${this.nodeId}:${currentSeq}:${Date.now()}`,
                nodeId: this.nodeId,
                seq: currentSeq,
                timestamp: Date.now(),
                table: table,
                primaryKey: String(primaryKey),
                action: action,
                payload: payload,
                hash: ''
            };

            op.hash = this.computeOpHash(op);
            this.opLog.push(op);
            return op;
        } catch (error) {
            console.error('[CrdtEngine createOperation Error]', error);
            return null;
        }
    }

    computeOpHash(op) {
        try {
            const data = `${op.id}|${op.nodeId}|${op.seq}|${op.timestamp}|${op.table}|${op.primaryKey}|${op.action}|${JSON.stringify(op.payload || {})}`;
            return crypto.createHash('sha256').update(data).digest('hex');
        } catch (error) {
            console.error('[CrdtEngine computeOpHash Error]', error);
            return '';
        }
    }

    mergeOperations(remoteOps) {
        try {
            if (!Array.isArray(remoteOps)) return [];
            const appliedOps = [];

            for (const op of remoteOps) {
                try {
                    if (!op || !op.id || !op.hash) continue;
                    if (this.computeOpHash(op) !== op.hash) continue;

                    const exists = this.opLog.some(item => item.id === op.id);
                    if (exists) continue;

                    const currentRemoteSeq = this.stateVector.get(op.nodeId) || 0;
                    if (op.seq > currentRemoteSeq) {
                        this.stateVector.set(op.nodeId, op.seq);
                    }

                    this.opLog.push(op);
                    appliedOps.push(op);
                } catch (singleErr) {
                    console.error('[CrdtEngine single op merge Error]', singleErr);
                }
            }

            this.opLog.sort((a, b) => {
                if (a.timestamp !== b.timestamp) {
                    return a.timestamp - b.timestamp;
                }
                return a.nodeId.localeCompare(b.nodeId);
            });

            return appliedOps;
        } catch (error) {
            console.error('[CrdtEngine mergeOperations Error]', error);
            return [];
        }
    }

    getStateVector() {
        try {
            const obj = {};
            for (const [k, v] of this.stateVector.entries()) {
                obj[k] = v;
            }
            return obj;
        } catch (error) {
            console.error('[CrdtEngine getStateVector Error]', error);
            return {};
        }
    }

    getOpsSince(remoteStateVector) {
        try {
            const missing = [];
            const remoteMap = new Map(Object.entries(remoteStateVector || {}));

            for (const op of this.opLog) {
                const knownSeq = remoteMap.get(op.nodeId) || 0;
                if (op.seq > knownSeq) {
                    missing.push(op);
                }
            }
            return missing;
        } catch (error) {
            console.error('[CrdtEngine getOpsSince Error]', error);
            return [];
        }
    }
}

module.exports = new CrdtEngine();
