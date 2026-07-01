'use strict';
const { getAllBlocks } = require('../graph/dag_store');
const { topologicalSort } = require('../graph/dag_traversal');
const { applyBlock } = require('./block_applier');
const { SYNC_TABLES } = require('../schema/schema_registry');
async function rebuildFromLog() {
    const ledger = require('../../db').getDB('ledger');
    const auth   = require('../../db').getDB('auth');
    for (const table of SYNC_TABLES) {
        try { auth.run(`UPDATE ${table} SET is_deleted = 1`); } catch (_) {}
    }
    ledger.run('UPDATE event_log SET is_applied = 0');
    const sorted = topologicalSort(getAllBlocks());
    let applied = 0;
    for (const block of sorted) { if (applyBlock(block)) applied++; }
    console.log(`[StateRebuilder] Completato: ${applied}/${sorted.length} blocchi applicati.`);
    return applied;
}
module.exports = { rebuildFromLog };
