/**
 * main.mjs
 *
 * Punto de entrada del servidor.
 * Detecta si es el módulo principal y arranca el servidor.
 */

import app from './app.mjs';

const PORT = parseInt(process.env.PORT ?? '5000', 10);

export function startServer({ port: portOpt = PORT, host: hostOpt = '0.0.0.0' } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(portOpt, hostOpt, () => {
      const addr = server.address();
      const assignedPort = typeof addr === 'object' ? addr.port : portOpt;
      const resolvedHost = typeof addr === 'object' && addr.address !== '0.0.0.0'
        ? addr.address
        : '127.0.0.1';
      console.log(`[Linguistika] Servidor iniciado en http://${resolvedHost}:${assignedPort}`);
      resolve({ server, host: resolvedHost, port: assignedPort });
    });
    server.on('error', reject);
  });
}

// Auto-arrange si se ejecuta directamente: node main.mjs
const isMain = process.argv[1] && (
  process.argv[1].endsWith('main.mjs') ||
  process.argv[1].endsWith('main')
);

if (isMain) {
  startServer().catch((err) => {
    console.error('[Linguistika] Error al iniciar el servidor:', err);
    process.exit(1);
  });
}

export default app;
