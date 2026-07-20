'use strict';
const { getAllBlocks } = require('../graph/dag_store');
const { topologicalSort } = require('../graph/dag_traversal');
const { reapplyToTables } = require('./block_applier');
const { SYNC_TABLES, getDomainForTable } = require('../schema/schema_registry');
async function rebuildFromLog() {
    const ledger = require('../../db').getDB('ledger');
    const blocks = getAllBlocks();
    const tablesInLog = new Set(blocks.map(b => b.table_name).filter(t => SYNC_TABLES.includes(t)));
    const touchedDomains = new Set();
    for (const table of tablesInLog) {
        const domain = getDomainForTable(table);
        touchedDomains.add(domain);
        try {
            const db = require('../../db').getDB(domain);
            db.run(`UPDATE ${table} SET is_deleted = 1`);
        } catch (_) {}
    }
    ledger.run('UPDATE event_log SET is_applied = 0');
    const sorted = topologicalSort(blocks);
    let applied = 0;
    for (const block of sorted) {
        if (reapplyToTables(block)) {
            applied++;
            ledger.run('UPDATE event_log SET is_applied = 1 WHERE block_id = ?', [block.block_id]);
        }
    }
    for (const domain of touchedDomains) {
        try { require('../../db').saveDB(domain); } catch (_) {}
    }
    require('../../db').saveDB('ledger');
    console.log(`[StateRebuilder] Completato: ${applied}/${sorted.length} blocchi applicati.`);
    return applied;
}
module.exports = { rebuildFromLog };
