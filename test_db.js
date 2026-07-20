const { app } = require('electron');
const db = require('./backend/db');
const db_manager = require('./backend/db/db_manager');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
    console.log('Testing DB Initialization and Better-Sqlite3 integration...');
    try {
        app.setPath('userData', path.join(app.getPath('appData'), 'NunzioTech', 'Adestio_Test'));
        const netCode = await db.initEmptyDB('TestNetwork');
        console.log('initEmptyDB OK, code:', netCode);

        console.log('Testing auth DB...');
        const authDb = db.getDB('auth');
        authDb.execute('INSERT INTO users (id, username, password, passkey, last_modified) VALUES (?, ?, ?, ?, ?)', ['123', 'admin', 'hash', 'passkey', Date.now()]);
        const users = authDb.query('SELECT * FROM users');
        console.log('Users retrieved:', users.length);
        if (users.length !== 1) throw new Error('Query error');

        console.log('Saving all DBs...');
        await db.saveDB();
        
        console.log('Checking if enc files exist...');
        const base = db_manager.basePath;
        if (!fs.existsSync(base + '/auth.enc')) throw new Error('auth.enc missing');

        console.log('All DB tests passed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
});
