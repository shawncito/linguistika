import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Dashboard: Obtener tutorías del día
router.get('/tutorías/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    const tutorías = await db.all(`
      SELECT 
        c.id,
        c.fecha,
        c.hora_inicio,
        c.hora_fin,
        c.estado,
        e.nombre as estudiante_nombre,
        e.id as estudiante_id,
        t.nombre as tutor_nombre,
        t.id as tutor_id,
        cu.nombre as curso_nombre,
        t.tarifa_por_hora
      FROM clases c
      JOIN matriculas m ON c.matricula_id = m.id
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN tutores t ON m.tutor_id = t.id
      JOIN cursos cu ON m.curso_id = cu.id
      WHERE c.fecha = ? AND c.estado IN ('programada', 'completada')
      ORDER BY c.hora_inicio ASC
    `, [fecha]);
    
    res.json(tutorías);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Dashboard: Resumen de tutorías por tutor
router.get('/resumen-tutores/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    const resumen = await db.all(`
      SELECT 
        t.id,
        t.nombre,
        COUNT(c.id) as total_clases,
        GROUP_CONCAT(DISTINCT cu.nombre) as cursos,
        GROUP_CONCAT(DISTINCT e.nombre) as estudiantes
      FROM tutores t
      LEFT JOIN matriculas m ON t.id = m.tutor_id
      LEFT JOIN clases c ON m.id = c.matricula_id AND c.fecha = ?
      LEFT JOIN cursos cu ON m.curso_id = cu.id
      LEFT JOIN estudiantes e ON m.estudiante_id = e.id
      WHERE t.estado = 1
      GROUP BY t.id, t.nombre
      ORDER BY total_clases DESC
    `, [fecha]);
    
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Estadísticas generales
router.get('/estadisticas/general', async (req, res) => {
  try {
    const [
      tutores,
      estudiantes,
      cursos,
      matriculas,
      clases_totales,
      pagos_pendientes
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as total FROM tutores WHERE estado = 1'),
      db.get('SELECT COUNT(*) as total FROM estudiantes WHERE estado = 1'),
      db.get('SELECT COUNT(*) as total FROM cursos WHERE estado = 1'),
      db.get('SELECT COUNT(*) as total FROM matriculas WHERE estado = 1'),
      db.get('SELECT COUNT(*) as total FROM clases'),
      db.get('SELECT SUM(monto) as total FROM pagos WHERE estado = "pendiente"')
    ]);

    res.json({
      tutores: tutores.total,
      estudiantes: estudiantes.total,
      cursos: cursos.total,
      matriculas: matriculas.total,
      clases_totales: clases_totales.total,
      ingresos_pendientes: pagos_pendientes.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
