import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todas las matrículas
router.get('/', async (req, res) => {
  try {
    const matriculas = await db.all(`
      SELECT 
        m.*,
        e.nombre as estudiante_nombre,
        c.nombre as curso_nombre,
        t.nombre as tutor_nombre
      FROM matriculas m
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN cursos c ON m.curso_id = c.id
      JOIN tutores t ON m.tutor_id = t.id
      WHERE m.estado = 1
    `);
    res.json(matriculas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener una matrícula por ID
router.get('/:id', async (req, res) => {
  try {
    const matricula = await db.get(`
      SELECT 
        m.*,
        e.nombre as estudiante_nombre,
        c.nombre as curso_nombre,
        t.nombre as tutor_nombre,
        t.tarifa_por_hora
      FROM matriculas m
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN cursos c ON m.curso_id = c.id
      JOIN tutores t ON m.tutor_id = t.id
      WHERE m.id = ?
    `, [req.params.id]);
    
    if (!matricula) {
      return res.status(404).json({ error: 'Matrícula no encontrada' });
    }
    res.json(matricula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nueva matrícula
router.post('/', async (req, res) => {
  try {
    const { estudiante_id, curso_id, tutor_id } = req.body;
    
    if (!estudiante_id || !curso_id || !tutor_id) {
      return res.status(400).json({ error: 'Campos requeridos: estudiante_id, curso_id, tutor_id' });
    }

    // Verificar que estudiante, curso y tutor existan
    const estudiante = await db.get('SELECT * FROM estudiantes WHERE id = ?', [estudiante_id]);
    const curso = await db.get('SELECT * FROM cursos WHERE id = ?', [curso_id]);
    const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [tutor_id]);

    if (!estudiante || !curso || !tutor) {
      return res.status(400).json({ error: 'Estudiante, curso o tutor no existen' });
    }

    const result = await db.run(
      'INSERT INTO matriculas (estudiante_id, curso_id, tutor_id) VALUES (?, ?, ?)',
      [estudiante_id, curso_id, tutor_id]
    );
    
    const matricula = await db.get(`
      SELECT 
        m.*,
        e.nombre as estudiante_nombre,
        c.nombre as curso_nombre,
        t.nombre as tutor_nombre
      FROM matriculas m
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN cursos c ON m.curso_id = c.id
      JOIN tutores t ON m.tutor_id = t.id
      WHERE m.id = ?
    `, [result.id]);
    
    res.status(201).json(matricula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar matrícula
router.put('/:id', async (req, res) => {
  try {
    const { estudiante_id, curso_id, tutor_id, estado } = req.body;
    
    await db.run(
      'UPDATE matriculas SET estudiante_id = ?, curso_id = ?, tutor_id = ?, estado = ? WHERE id = ?',
      [estudiante_id, curso_id, tutor_id, estado, req.params.id]
    );
    
    const matricula = await db.get(`
      SELECT 
        m.*,
        e.nombre as estudiante_nombre,
        c.nombre as curso_nombre,
        t.nombre as tutor_nombre
      FROM matriculas m
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN cursos c ON m.curso_id = c.id
      JOIN tutores t ON m.tutor_id = t.id
      WHERE m.id = ?
    `, [req.params.id]);
    
    res.json(matricula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar matrícula
router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE matriculas SET estado = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Matrícula desactivada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
