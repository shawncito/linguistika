import { Router } from 'express';
import * as ctrl from './horasTrabajo.controller.mjs';

const router = Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.post('/:id/aprobar', ctrl.aprobar);

export default router;
