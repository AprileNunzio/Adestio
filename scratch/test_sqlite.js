const Database = require('better-sqlite3');
const path = require('path');
const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
// The log dir is path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'Log')
// But the DB dir is usually in app.getPath('userData'), which is %APPDATA%\Adestio
const dbPath = path.join(appData, 'Adestio', 'databases', 'config.sqlite');
const db = new Database(dbPath, { readonly: true });
const res = db.prepare("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'").all();
console.log(res);
