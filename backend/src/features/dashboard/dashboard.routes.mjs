import { Router } from 'express';
import * as ctrl from './dashboard.controller.mjs';
import { requireRoles } from '../../shared/middleware/roles.mjs';

const router = Router();
const EMPLOYEE_ROLES = ['admin', 'contador', 'tutor_view_only'];

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

// Notas colaborativas por tutor
router.get('/tutores/:tutorId/notas', requireRoles(EMPLOYEE_ROLES), ctrl.listTutorNotas);
router.post('/tutores/:tutorId/notas', requireRoles(EMPLOYEE_ROLES), ctrl.createTutorNota);
router.patch('/tutores/:tutorId/notas/:notaId', requireRoles(EMPLOYEE_ROLES), ctrl.updateTutorNotaTexto);
router.patch('/tutores/:tutorId/notas/:notaId/estado', requireRoles(EMPLOYEE_ROLES), ctrl.setTutorNotaEstado);
router.delete('/tutores/:tutorId/notas/:notaId', requireRoles(EMPLOYEE_ROLES), ctrl.deleteTutorNota);

export default router;
