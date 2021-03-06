const {app, BrowserWindow} = require('electron');

function createWindow () {
    let mainWindow = new BrowserWindow({
        fullscreen: true,
        backgroundColor: '#000000',
        show: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.setMenu(null);
    mainWindow.loadFile('index.html');
    // mainWindow.openDevTools();
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    app.quit()
});