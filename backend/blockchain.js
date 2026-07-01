'use strict';
const dag = require('./dag/index');
module.exports = {
    createBlock:        dag.createBlock,
    applyBlock:         dag.applyBlock,
    getBlocksSince:     dag.getBlocksSince,
    getAllBlocks:        dag.getAllBlocks,
    rebuildStateFromLog: dag.rebuildStateFromLog,
    applyPendingBlocks: () => {},
    fullChainResync:    () => {},
    getNodeId:          require('./core/node_identity').getNodeId,
    getCurrentTips:     dag.getCurrentTips,
    topologicalSort:    dag.topologicalSort,
    SYNC_TABLES:        dag.SYNC_TABLES,
    CURRENT_PAYLOAD_VERSION: dag.CURRENT_PAYLOAD_VERSION,
    computeBlockId:     dag.computeBlockId
};
