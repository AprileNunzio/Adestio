'use strict';
function resolve(blockA, blockB) {
    if (blockA.created_at !== blockB.created_at) {
        return blockA.created_at > blockB.created_at ? blockA : blockB;
    }
    return blockA.node_id > blockB.node_id ? blockA : blockB;
}
function shouldApply(incomingCreatedAt, incomingNodeId, existingCreatedAt, existingNodeId) {
    if (incomingCreatedAt > existingCreatedAt) return true;
    if (incomingCreatedAt === existingCreatedAt) return incomingNodeId > existingNodeId;
    return false;
}
module.exports = { resolve, shouldApply };
