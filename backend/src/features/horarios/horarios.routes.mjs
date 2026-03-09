import { Router } from 'express';
import * as ctrl from './horarios.controller.mjs';

const router = Router();

router.get('/tutor/:tutor_id', ctrl.getByTutor);
router.get('/clases/todas', ctrl.getAllClases);
router.post('/clases/crear', ctrl.createClase);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.deactivate);

export default router;
