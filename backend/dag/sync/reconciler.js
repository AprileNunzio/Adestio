'use strict';
const merkle = require('../graph/merkle');
const ingest = require('../application/block_ingest');
const { sendRequest } = require('../../p2p/protocol/rpc');
function _diff(a, b) {
    const setB = new Set(b);
    return a.filter(x => !setB.has(x));
}
async function reconcileWithPeer(ws) {
    const local = merkle.summarize();
    const remote = await sendRequest(ws, 'sync_summary', {}, 15000).catch(() => null);
    if (!remote || typeof remote.root !== 'string') return { converged: false, pulled: 0, pushed: 0, error: 'no-summary' };
    if (remote.root === local.root) return { converged: true, pulled: 0, pushed: 0 };
    const prefixes = merkle.diffPrefixes(local, remote);
    let pulled = 0;
    let pushed = 0;
    for (const prefix of prefixes) {
        const localIds = merkle.bucketIds(prefix);
        const remoteRes = await sendRequest(ws, 'sync_bucket', { prefix }, 15000).catch(() => null);
        const remoteIds = (remoteRes && Array.isArray(remoteRes.ids)) ? remoteRes.ids : [];
        const missingLocal = _diff(remoteIds, localIds);
        if (missingLocal.length > 0) {
            const res = await sendRequest(ws, 'sync_get_blocks', { ids: missingLocal }, 20000).catch(() => null);
            if (res && Array.isArray(res.blocks)) {
                const r = ingest.ingestMany(res.blocks);
                pulled += r.stored;
            }
        }
        const missingRemote = _diff(localIds, remoteIds);
        if (missingRemote.length > 0) {
            const { getBlockById } = require('../graph/dag_store');
            const blocks = missingRemote.map(id => getBlockById(id)).filter(Boolean);
            if (blocks.length > 0) {
                await sendRequest(ws, 'blocks_push', { blocks }, 20000).catch(() => {});
                pushed += blocks.length;
            }
        }
    }
    const after = merkle.summarize();
    const remoteAfter = await sendRequest(ws, 'sync_summary', {}, 15000).catch(() => null);
    const converged = remoteAfter ? after.root === remoteAfter.root : false;
    return { converged, pulled, pushed };
}
module.exports = { reconcileWithPeer };
