'use strict';
const merkle = require('../../dag/graph/merkle');
module.exports = {
    async sync_summary() {
        return merkle.summarize();
    },
    async sync_bucket(payload) {
        const prefix = payload && payload.prefix;
        if (typeof prefix !== 'string') throw new Error('prefix required');
        return { ids: merkle.bucketIds(prefix) };
    },
    async sync_get_blocks(payload) {
        const ids = payload && payload.ids;
        if (!Array.isArray(ids)) throw new Error('ids required');
        const { getBlockById } = require('../../dag/graph/dag_store');
        const blocks = [];
        for (const id of ids.slice(0, 2000)) {
            const b = getBlockById(id);
            if (b) blocks.push(b);
        }
        return { blocks };
    },
    async key_announce(payload) {
        const { nodeId, publicKey } = payload || {};
        if (nodeId && publicKey) {
            try { require('../../dag/block/block_signer').learnKey(nodeId, publicKey); } catch (_) {}
        }
        return {
            nodeId: require('../../core/node_identity').getNodeId(),
            publicKey: require('../../security/node_keypair').getPublicKeyPem()
        };
    }
};
