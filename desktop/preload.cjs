// Preload mínimo: se puede ampliar luego si quieres integrar notificaciones nativas, auto-update, etc.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('linguistika', {
  platform: process.platform,
});
