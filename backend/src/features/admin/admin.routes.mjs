import { Router } from 'express';
import { requireRoles } from '../../shared/middleware/roles.mjs';
import * as ctrl from './admin.controller.mjs';

const router = Router();

// Todas las rutas requieren rol admin
router.use(requireRoles(['admin']));

router.post('/crear-empleado', ctrl.crearEmpleado);
router.get('/empleados', ctrl.listarEmpleados);
router.patch('/empleados/:id', ctrl.actualizarEmpleado);
router.delete('/empleados/:id', ctrl.eliminarEmpleado);

router.get('/paginas', ctrl.listarPaginas);
router.patch('/paginas/:slug', ctrl.togglePagina);

export default router;
