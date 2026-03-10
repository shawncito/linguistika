import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ctrl from './pagos.controller.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'comprobantes');

const ensureUploadDir = () => { try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch {} };

const sanitizeFilename = (name) => String(name || 'archivo').replace(/[^a-zA-Z0-9._-]+/g, '_');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { ensureUploadDir(); cb(null, UPLOAD_ROOT); },
    filename: (req, file, cb) => {
      const movId = String(req.params?.id || 'mov');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      cb(null, `${movId}-${stamp}-${sanitizeFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf';
    cb(ok ? null : new Error('Tipo de archivo no permitido (solo imagen o PDF)'), ok);
  },
});

const router = Router();

// CRUD
router.get('/', ctrl.getAll);
router.get('/libro-diario', ctrl.getLibroDiario);
router.get('/pendientes/resumen', ctrl.getPendientesResumen);
router.get('/pendientes/resumen-tutores', ctrl.getPendientesResumenTutores);
router.get('/pendientes/resumen-estudiantes', ctrl.getPendientesResumenEstudiantes);
router.get('/pendientes/detalle-tutor', ctrl.getPendientesDetalleTutor);
router.get('/pendientes/detalle-estudiante', ctrl.getPendientesDetalleEstudiante);
router.get('/pendientes/sesiones', ctrl.getPendientesSesiones);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

// Liquidaciones
router.post('/liquidar', ctrl.liquidarPendientes);
router.post('/ingresos/liquidar-sesion', ctrl.liquidarIngresoSesion);
router.post('/ingresos/liquidar-estudiante', ctrl.liquidarIngresoEstudiante);

// Comprobantes
router.post('/comprobantes-ingreso', ctrl.createComprobanteIngreso);

// Movimientos manuales
router.post('/movimientos/comprobante/bulk', ctrl.bulkComprobante);
router.post('/movimientos/manual', ctrl.registrarMovimientoManual);
router.post('/movimientos/:id/comprobante', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Archivo inválido' });
    ctrl.uploadMovimientoComprobante(req, res, next);
  });
});

export default router;
