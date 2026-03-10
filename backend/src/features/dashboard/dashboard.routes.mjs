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

// Métricas financieras del mes
router.get('/metricas', ctrl.getMetricas);

// Estados de clases por rango de fechas
router.get('/estados-clases-rango', ctrl.obtenerEstadosClasesRango);

// Gestión de sesiones individuales
router.post('/sesion/:matriculaId/:fecha/completar', ctrl.completarSesion);
router.post('/sesion/:matriculaId/:fecha/cancelar-dia', ctrl.cancelarSesionDia);
router.patch('/sesion/:matriculaId/:fecha/estado', ctrl.actualizarEstadoSesion);

export default router;
