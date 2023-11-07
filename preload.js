const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("imageProcessing", {
  rotateImage: (buffer) => ipcRenderer.invoke("rotate-image", buffer),
});

window.ipcRenderer = ipcRenderer;
