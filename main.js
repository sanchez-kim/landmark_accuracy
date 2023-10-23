const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
});

// app.disableHardwareAcceleration();

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
