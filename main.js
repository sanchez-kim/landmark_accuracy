const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Function to rotate image
function rotateImage(arrayBuffer) {
  return sharp(arrayBuffer).rotate(-90).toBuffer();
}

ipcMain.handle("rotate-image", async (event, arrayBuffer) => {
  try {
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer);

    console.log(buffer);

    // Rotate the image using the sharp library
    const rotatedImageBuffer = await sharp(buffer).rotate(-90).toBuffer();

    // Return the rotated image buffer to the renderer process
    return rotatedImageBuffer;
  } catch (err) {
    console.error("Error rotating image", err);
    throw err; // Forward the error to the renderer process
  }
});

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    icon: path.join(__dirname, "assets/Insighter.ico"),
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

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
