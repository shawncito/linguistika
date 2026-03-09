import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import tutoresRouter from './routes/tutores.js';
import cursosRouter from './routes/cursos.js';
import estudiantesRouter from './routes/estudiantes.js';
import matriculasRouter from './routes/matriculas.js';
import horariosRouter from './routes/horarios.js';
import pagosRouter from './routes/pagos.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import horasTrabajoRouter from './routes/horas-trabajo.js';
import adminRouter from './routes/admin.js';
import finanzasRouter from './routes/finanzas.js';
import tesoreriaRouter from './routes/tesoreria.js';
import bulkRouter from './routes/bulk.js';
import activityRouter from './routes/activity.js';
import { requireAuth } from './middleware/auth.js';
import { activityLogMiddleware } from './middleware/activityLog.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Evita caídas por errores transitorios de red (ej. Supabase timeouts).
// Nota: en producción normalmente conviene reiniciar, pero en local esto evita que te "saque".
process.on('unhandledRejection', (reason) => {
  console.error('❌ UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UncaughtException:', err);
});

export function createApp() {
  const app = express();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Archivos estáticos (comprobantes, etc.)
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Rutas
  app.use('/api/auth', authRouter);

// API: Obtener fecha actual del servidor en zona horaria de Costa Rica (UTC-6)
  app.get('/api/server-date', (req, res) => {
  // Formatear fecha local para Costa Rica en formato YYYY-MM-DD
  const fechaCR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const ahoraCR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));

  res.json({ 
    date: fechaCR, // e.g. 2026-01-19
    timestamp: ahoraCR.getTime(),
    timezone: 'America/Costa_Rica (UTC-6)'
  });
  });


  // Aplicar requireAuth a todas las rutas protegidas
  app.use('/api/tutores', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/cursos', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/estudiantes', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/matriculas', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/horarios', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/pagos', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/dashboard', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/horas-trabajo', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/admin', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/finanzas', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/tesoreria', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/bulk', (req, res, next) => requireAuth(req, res, next));
  app.use('/api/activity', (req, res, next) => requireAuth(req, res, next));

  // Audit log para mutaciones (crear/editar/borrar)
  app.use('/api', activityLogMiddleware);

  app.use('/api/tutores', tutoresRouter);
  app.use('/api/cursos', cursosRouter);
  app.use('/api/estudiantes', estudiantesRouter);
  app.use('/api/matriculas', matriculasRouter);
  app.use('/api/horarios', horariosRouter);
  app.use('/api/pagos', pagosRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/horas-trabajo', horasTrabajoRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/finanzas', finanzasRouter);
  app.use('/api/tesoreria', tesoreriaRouter);
  app.use('/api/bulk', bulkRouter);
  app.use('/api/activity', activityRouter);

  // Ruta de prueba
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
  });

  return app;
}

export async function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || 5000);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';

  const app = createApp();
  return await new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ app, server, host, port: actualPort });
    });
    server.on('error', (err) => reject(err));
  });
}

// Ejecutar como script (node server.js)
const isMain = (() => {
  try {
    const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
    const selfPath = fileURLToPath(import.meta.url);
    return argvPath && path.resolve(argvPath) === path.resolve(selfPath);
  } catch {
    return false;
  }
})();

if (isMain) {
  startServer()
    .then(({ host, port }) => {
      console.log(`🚀 Servidor ejecutándose en http://${host}:${port}`);
    })
    .catch((err) => {
      console.error('No se pudo iniciar el servidor:', err);
      process.exit(1);
    });
}
