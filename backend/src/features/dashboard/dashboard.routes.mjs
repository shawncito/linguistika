import { Router } from 'express';
import * as ctrl from './dashboard.controller.mjs';

const router = Router();

// Tutorías del día (con y sin acento)
router.get('/tutor\u00edas/:fecha', ctrl.getTutorias);
router.get('/tutorias/:fecha', ctrl.getTutorias);

// Resumen por tutor
router.get('/resumen-tutores/:fecha', ctrl.getResumenTutores);
router.get('/resumen-tutores-estudiantes', ctrl.getResumenTutoresEstudiantes);
router.get('/resumen-cursos-grupos', ctrl.getResumenCursosGrupos);

// Stats
router.get('/estadisticas/general', ctrl.getEstadisticasGeneral);

// Debug
router.get('/debug/matriculas-cursos', ctrl.getDebugMatriculasCursos);

export default router;
