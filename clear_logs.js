const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

app.setPath('userData', path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'));

const dbPath = path.join(app.getPath('userData'), 'db', 'auth.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening db:', err);
        process.exit(1);
    }
    db.run("DELETE FROM distributed_logs", (err2) => {
        if (err2) console.error('Error clearing distributed logs:', err2);
        else console.log('Distributed logs cleared.');
        process.exit(0);
    });
});
