// Preload mínimo: se puede ampliar luego si quieres integrar notificaciones nativas, auto-update, etc.
const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('linguistika', {
  platform: process.platform,
  openExternal: async (url) => {
    try {
      if (!url || typeof url !== 'string') return { ok: false, error: 'URL inválida' };
      const opened = await shell.openExternal(url);
      // Electron retorna boolean: false si no hay app/handler para ese protocolo.
      return opened ? { ok: true } : { ok: false, error: 'No se pudo abrir el enlace (sin handler)' };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  },
});
