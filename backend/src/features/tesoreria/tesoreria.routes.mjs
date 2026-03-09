/**
 * tesoreria.routes.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import multer from 'multer';
import { requireRoles } from '../../shared/middleware/roles.mjs';
import * as ctrl from './tesoreria.controller.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'tesoreria');

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) { cb(null, UPLOAD_ROOT); },
    filename(_req, file, cb) {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(null, ok ? true : false);
  },
});

const router = Router();

router.use(requireRoles(['admin', 'contador']));

/* ─── Resúmenes ─────────────────────────────────────────────────────────── */
router.get('/encargados/resumen', ctrl.getResumenEncargados);
router.get('/tutores/resumen', ctrl.getResumenTutores);
router.get('/resumen', ctrl.getResumen);
router.get('/bolsa', ctrl.getBolsa);
router.get('/encargados/porcentaje', ctrl.getPorcentajeEncargados);
router.get('/esperado/diario', ctrl.getEsperadoDiario);

/* ─── Libro diario ──────────────────────────────────────────────────────── */
router.get('/diario', ctrl.getDiario);
router.get('/cuentas/encargado/:id/movimientos', ctrl.getMovimientosEncargado);
router.get('/cuentas/tutor/:id/movimientos', ctrl.getMovimientosTutor);

/* ─── Exportaciones ─────────────────────────────────────────────────────── */
router.get('/export/diario', ctrl.exportDiario);
router.get('/export/cuenta/:cuentaId', ctrl.exportCuenta);

/* ─── Pagos ─────────────────────────────────────────────────────────────── */
router.get('/pagos/:pagoId/aplicaciones', ctrl.getPagoAplicaciones);
router.post('/encargados/:id/pagos', ctrl.registrarPagoEncargado);
router.post('/tutores/:id/pagos', ctrl.registrarPagoTutor);
router.post('/pagos/:pagoId/comprobante', upload.single('file'), ctrl.actualizarPago);
router.patch('/pagos/:pagoId', ctrl.actualizarPago);

/* ─── Obligaciones ──────────────────────────────────────────────────────── */
router.get('/encargados/:id/obligaciones', ctrl.getObligacionesEncargado);
router.get('/tutores/:id/obligaciones', ctrl.getObligacionesTutor);

/* ─── Cobro grupal ──────────────────────────────────────────────────────── */
router.post('/grupos/:grupoId/cobro', ctrl.registrarCobroGrupal);

/* ─── Verificar contraseña ──────────────────────────────────────────────── */
router.post('/verificar-password', ctrl.verificarPassword);

export default router;
