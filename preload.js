const { ipcRenderer } = require("electron");

// Expose ipcRenderer to the window object for the renderer to use
window.ipcRenderer = ipcRenderer;
