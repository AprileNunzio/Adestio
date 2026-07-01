'use strict';
function getCurrentTips(db) {
    try {
        const res = db.query('SELECT block_id FROM dag_tips');
        return (res && res.length > 0) ? res.map(r => r.block_id) : ['GENESIS'];
    } catch (_) { return ['GENESIS']; }
}
function updateTips(db, removedIds, newBlockId) {
    for (const pid of removedIds) {
        db.run('DELETE FROM dag_tips WHERE block_id = ?', [pid]);
    }
    db.run('INSERT OR REPLACE INTO dag_tips (block_id) VALUES (?)', [newBlockId]);
}
module.exports = { getCurrentTips, updateTips };
