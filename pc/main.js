/* Rogue em' Slash — versão de PC (Electron): uma janela que abre o mesmo jogo do navegador (www/index.html).
   F11 liga e desliga a tela cheia. */
const { app, BrowserWindow } = require('electron');
const path = require('path');

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 360,
    title: "Rogue em' Slash", backgroundColor: '#151724', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  janela.removeMenu();
  janela.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { janela.setFullScreen(!janela.isFullScreen()); ev.preventDefault(); }
  });
  janela.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
}

app.whenReady().then(() => {
  criarJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });   // (macOS)
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
