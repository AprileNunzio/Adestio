const db = require('./backend/db');
console.log(db.getDB('config').query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'"));
