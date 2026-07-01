'use strict';
const { createBlock } = require('./block/block_factory');
const { applyBlock } = require('./application/block_applier');
const { getAllBlocks, getBlocksSince, isBlockKnown } = require('./graph/dag_store');
const { topologicalSort } = require('./graph/dag_traversal');
const { rebuildFromLog } = require('./application/state_rebuilder');
const { getCurrentTips, updateTips } = require('./graph/dag_tips');
const { SYNC_TABLES, CURRENT_PAYLOAD_VERSION } = require('./schema/schema_registry');
const { computeBlockId } = require('./block/block_hasher');
module.exports = {
    createBlock,
    applyBlock,
    getAllBlocks,
    getBlocksSince,
    isBlockKnown,
    topologicalSort,
    rebuildStateFromLog: rebuildFromLog,
    getCurrentTips,
    updateTips,
    SYNC_TABLES,
    CURRENT_PAYLOAD_VERSION,
    computeBlockId
};
