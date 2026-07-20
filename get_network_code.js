const { app } = require('electron'); app.whenReady().then(async () => { try { const dbm = require('./backend/db/db_manager'); dbm.initPaths(); console.log('DeviceKey:', dbm.loadOrGenerateLocalDeviceKey()); dbm.basePath = require('path').join(app.getPath('userData'), 'dbs', 'Aprile'); const mConfig = require('./backend/migrations/config'); await dbm.loadDatabase('config', mConfig); const res = dbm.getDB('config').query(\
SELECT
key_value
FROM
network_config
WHERE
key_name
=
network_code
\); console.log('NetworkCode Aprile:', res); } catch(e) { console.error('ERROR Aprile:', e); } try { const dbm = require('./backend/db/db_manager'); dbm.basePath = require('path').join(app.getPath('userData'), 'dbs', 'ISISCaruso'); const mConfig = require('./backend/migrations/config'); await dbm.loadDatabase('config', mConfig); const res = dbm.getDB('config').query(\SELECT
key_value
FROM
network_config
WHERE
key_name
=
network_code
\); console.log('NetworkCode ISISCaruso:', res); } catch(e) { console.error('ERROR ISISCaruso:', e); } app.quit(); });
