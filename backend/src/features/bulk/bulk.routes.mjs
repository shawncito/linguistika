/**
 * bulk.routes.mjs
 */

import { Router } from 'express';
import multer from 'multer';
import { requireRoles } from '../../shared/middleware/roles.mjs';
import * as ctrl from './bulk.controller.mjs';
import { MAX_BULK_FILE_SIZE } from './bulk.schemas.mjs';

const router = Router();

// Multer — almacenamiento en memoria (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BULK_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.originalname.endsWith('.xlsx')
      || file.originalname.endsWith('.xls');
    cb(null, ok ? true : false);
  },
});

router.use(requireRoles(['admin', 'contador', 'tutor_view_only']));

// Templates
router.get('/template/:tipo', ctrl.getTemplate);

// Grupos
router.get('/grupos', ctrl.listGrupos);
router.get('/grupos/:id', ctrl.getGrupo);
router.post('/grupos', ctrl.createGrupo);
router.put('/grupos/:id', ctrl.updateGrupo);
router.delete('/grupos/:id', ctrl.deleteGrupo);
router.post('/grupos/:id/estudiantes', ctrl.assignToGroup);

// Estudiantes bulk
router.get('/estudiantes', ctrl.listEstudiantes);
// IMPORTANTE: /unassign debe ir ANTES de /:id
router.post('/estudiantes/unassign', ctrl.unassignStudents);
router.post('/estudiantes', ctrl.createEstudiante);
router.put('/estudiantes/:id', ctrl.updateEstudiante);
router.delete('/estudiantes/:id', ctrl.deleteEstudiante);

// Preview / Upload (require roles admin / contador only for writes)
router.post('/preview', requireRoles(['admin', 'contador']), upload.single('file'), ctrl.preview);
router.post('/upload', requireRoles(['admin', 'contador']), upload.single('file'), ctrl.upload);

export default router;
