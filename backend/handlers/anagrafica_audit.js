const { getDB } = require('../db');
const IGNORED_FIELDS = new Set(['id', 'last_modified', '_actor_user_id']);
function computeChanges(previousPayload, currentPayload) {
    const changes = [];
    const keys = new Set([...Object.keys(previousPayload || {}), ...Object.keys(currentPayload || {})]);
    for (const key of keys) {
        if (IGNORED_FIELDS.has(key)) continue;
        const oldValue = previousPayload ? previousPayload[key] : undefined;
        const newValue = currentPayload ? currentPayload[key] : undefined;
        if (oldValue !== newValue) {
            changes.push({ field: key, oldValue: oldValue === undefined ? null : oldValue, newValue: newValue === undefined ? null : newValue });
        }
    }
    return changes;
}
async function getHistory(event, args) {
    try {
        const { tableName, recordId } = args;
        if (!tableName || !recordId) throw new Error('Parametri mancanti');
        const ledger = getDB('ledger');
        const rows = ledger.query(
            'SELECT block_id, event_type, payload, node_id, created_at, payload_version FROM event_log WHERE table_name = ? AND record_id = ? ORDER BY created_at ASC',
            [tableName, String(recordId)]
        );
        const auth = getDB('auth');
        const actorIds = new Set();
        const parsed = rows.map(row => {
            let payload = {};
            try { payload = JSON.parse(row.payload) || {}; } catch (e) {}
            const actorUserId = payload._actor_user_id || '';
            if (actorUserId) actorIds.add(actorUserId);
            return { ...row, payload, actorUserId };
        });
        const actorNames = {};
        if (actorIds.size > 0) {
            const users = auth.query(
                `SELECT id, nome, cognome, username FROM users WHERE id IN (${Array.from(actorIds).map(() => '?').join(',')})`,
                Array.from(actorIds)
            );
            users.forEach(u => {
                actorNames[u.id] = (u.nome || u.cognome) ? `${u.cognome || ''} ${u.nome || ''}`.trim() : (u.username || u.id);
            });
        }
        let previousPayload = null;
        const revisions = parsed.map(row => {
            const changes = row.event_type === 'DELETE' ? [] : computeChanges(previousPayload, row.payload);
            if (row.event_type !== 'DELETE') previousPayload = row.payload;
            return {
                blockId: row.block_id,
                eventType: row.event_type,
                nodeId: row.node_id,
                actorUserId: row.actorUserId,
                actorName: row.actorUserId ? (actorNames[row.actorUserId] || 'Utente sconosciuto') : 'Nodo di rete (azione di sistema)',
                timestamp: row.created_at,
                changes
            };
        });
        revisions.reverse();
        return revisions;
    } catch (e) {
        console.error('[AnagraficaAuditHandler] getHistory error:', e);
        throw new Error('Impossibile recuperare lo storico delle revisioni');
    }
}
module.exports = { getHistory };
