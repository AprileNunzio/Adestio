const { app } = require('electron');
app.whenReady().then(async () => {
    try {
        const dbm = require('./backend/db/db_manager');
        dbm.initPaths();
        dbm.deviceKey = dbm.loadOrGenerateLocalDeviceKey();
        if(!dbm.deviceKey) throw new Error('No device key');
        dbm.basePath = require('path').join(app.getPath('userData'), 'dbs', 'Aprile');
        const mConfig = require('./backend/migrations/config');
        await dbm.loadDatabase('config', mConfig);
        const res = dbm.getDB('config').query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        console.log('CODE_APRILE:', res[0].key_value);
    } catch(e) { console.error('ERR_APRILE', e.message); }

    try {
        const dbm = require('./backend/db/db_manager');
        dbm.deviceKey = dbm.loadOrGenerateLocalDeviceKey();
        dbm.basePath = require('path').join(app.getPath('userData'), 'dbs', 'ISISCaruso');
        const mConfig = require('./backend/migrations/config');
        await dbm.loadDatabase('config', mConfig);
        const res = dbm.getDB('config').query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        console.log('CODE_CARUSO:', res[0].key_value);
    } catch(e) { console.error('ERR_CARUSO', e.message); }

    app.quit();
});
