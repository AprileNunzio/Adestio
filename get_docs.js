const { app } = require('electron'); app.whenReady().then(() => { console.log(app.getPath('documents')); app.quit(); });
