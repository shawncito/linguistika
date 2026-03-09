import { Router } from 'express';
import * as ctrl from './matriculas.controller.mjs';

const router = Router();

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/from-bulk-grupo', ctrl.fromBulkGrupo);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.deactivate);

export default router;
