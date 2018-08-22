const {app, BrowserWindow} = require('electron');
const fs = require('fs');
var Player = require('player');

var musicDir = __dirname + ((process.mainModule.filename.indexOf('app.asar') !== -1) ? '.unpacked' : '') + '/music/';
fs.readdir(musicDir, (err, files) => {
    var player = new Player(files.filter(file => file.endsWith('.mp3')).map(file => musicDir + file));

    player.on('error', function(err) {
        player.stop();
        player.play();
    });

    if (player.list.length > 0) {
        player.play();
    }
});

function createWindow () {
    let mainWindow = new BrowserWindow({
        fullscreen:true,
        backgroundColor: '#000000',
        show: false
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