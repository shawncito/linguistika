import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.mjs';
import * as ctrl from './auth.controller.mjs';

const router = Router();

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

export default router;
