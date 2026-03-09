import { Router } from 'express';
import { requireRoles } from '../../shared/middleware/roles.mjs';
import * as ctrl from './activity.controller.mjs';

const router = Router();

router.get('/', requireRoles(['admin', 'contador']), ctrl.list);

export default router;
