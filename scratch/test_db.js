const db = require('../backend/db');
const dbManager = db.dbManager;
const configDb = dbManager.getDB('config');
const res = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'");
console.log(res);
