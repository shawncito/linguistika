/**
 * finanzas.routes.mjs
 */

import { Router } from 'express';
import { requireRoles } from '../../shared/middleware/roles.mjs';
import * as ctrl from './finanzas.controller.mjs';

const router = Router();

router.use(requireRoles(['admin', 'contador']));

router.get('/movimientos', ctrl.listMovimientos);
router.post('/comprobantes', ctrl.createComprobante);
router.get('/comprobantes', ctrl.listComprobantes);
router.patch('/comprobantes/:id', ctrl.updateComprobante);

export default router;
