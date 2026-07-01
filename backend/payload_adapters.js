'use strict';
const { CURRENT_PAYLOAD_VERSION, SYNC_TABLES } = require('./dag/schema/schema_registry');
const { adaptPayload } = require('./dag/schema/schema_migrator');
const { validatePayloadSchema } = require('./dag/schema/payload_validator');
const { computeBlockId } = require('./dag/block/block_hasher');
module.exports = { CURRENT_PAYLOAD_VERSION, SYNC_TABLES, adaptPayload, validatePayloadSchema, computeBlockId };
