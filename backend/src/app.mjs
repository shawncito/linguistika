/**
 * app.mjs
 *
 * Crea y configura la aplicación Express.
 * Monta todos los routers bajo /api/v1.
 */

import express from 'express';
import cors from 'cors';
import { requireAuth } from './shared/middleware/requireAuth.mjs';
import { activityLogMiddleware } from './shared/middleware/activityLog.mjs';
import { errorHandler } from './shared/middleware/errorHandler.mjs';

// Routers de features
import authRouter from './features/auth/auth.routes.mjs';
import tutoresRouter from './features/tutores/tutores.routes.mjs';
import estudiantesRouter from './features/estudiantes/estudiantes.routes.mjs';
import cursosRouter from './features/cursos/cursos.routes.mjs';
import pagosRouter from './features/pagos/pagos.routes.mjs';
import horariosRouter from './features/horarios/horarios.routes.mjs';
import dashboardRouter from './features/dashboard/dashboard.routes.mjs';
import matriculasRouter from './features/matriculas/matriculas.routes.mjs';
import horasTrabajoRouter from './features/horasTrabajo/horasTrabajo.routes.mjs';
import adminRouter from './features/admin/admin.routes.mjs';
import activityRouter from './features/activity/activity.routes.mjs';
import bulkRouter from './features/bulk/bulk.routes.mjs';
import finanzasRouter from './features/finanzas/finanzas.routes.mjs';
import tesoreriaRouter from './features/tesoreria/tesoreria.routes.mjs';
import paginasRouter from './features/paginas/paginas.routes.mjs';

const app = express();

// ── Middlewares globales ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ── Auth (sin requireAuth, el router gestiona sus propias rutas) ────────────
app.use('/api/v1/auth', authRouter);

// ── Resto de rutas: requireAuth primero, luego log de actividad ────────────
app.use('/api/v1', requireAuth, activityLogMiddleware);

app.use('/api/v1/tutores', tutoresRouter);
app.use('/api/v1/estudiantes', estudiantesRouter);
app.use('/api/v1/cursos', cursosRouter);
app.use('/api/v1/pagos', pagosRouter);
app.use('/api/v1/horarios', horariosRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/matriculas', matriculasRouter);
app.use('/api/v1/horas-trabajo', horasTrabajoRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/activity', activityRouter);
app.use('/api/v1/bulk', bulkRouter);
app.use('/api/v1/finanzas', finanzasRouter);
app.use('/api/v1/tesoreria', tesoreriaRouter);
app.use('/api/v1/paginas-estado', paginasRouter);

// ── Error handler (último) ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;
