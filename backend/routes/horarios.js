import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todos los horarios de un tutor
router.get('/tutor/:tutor_id', async (req, res) => {
  try {
    const horarios = await db.all(
      'SELECT * FROM horarios_tutores WHERE tutor_id = ? AND estado = 1',
      [req.params.tutor_id]
    );
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo horario para tutor
router.post('/', async (req, res) => {
  try {
    const { tutor_id, dia_semana, hora_inicio, hora_fin } = req.body;
    
    if (!tutor_id || !dia_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, dia_semana, hora_inicio, hora_fin' });
    }

    // Verificar que el tutor existe
    const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [tutor_id]);
    if (!tutor) {
      return res.status(400).json({ error: 'Tutor no existe' });
    }

    const result = await db.run(
      'INSERT INTO horarios_tutores (tutor_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
      [tutor_id, dia_semana, hora_inicio, hora_fin]
    );
    
    const horario = await db.get('SELECT * FROM horarios_tutores WHERE id = ?', [result.id]);
    res.status(201).json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar horario
router.put('/:id', async (req, res) => {
  try {
    const { dia_semana, hora_inicio, hora_fin, estado } = req.body;
    
    await db.run(
      'UPDATE horarios_tutores SET dia_semana = ?, hora_inicio = ?, hora_fin = ?, estado = ? WHERE id = ?',
      [dia_semana, hora_inicio, hora_fin, estado, req.params.id]
    );
    
    const horario = await db.get('SELECT * FROM horarios_tutores WHERE id = ?', [req.params.id]);
    res.json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar horario
router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE horarios_tutores SET estado = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Horario desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear clase (programar una tutoría)
router.post('/clases/crear', async (req, res) => {
  try {
    const { matricula_id, fecha, hora_inicio, hora_fin, notas } = req.body;
    
    if (!matricula_id || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Campos requeridos: matricula_id, fecha, hora_inicio, hora_fin' });
    }

    const result = await db.run(
      'INSERT INTO clases (matricula_id, fecha, hora_inicio, hora_fin, notas) VALUES (?, ?, ?, ?, ?)',
      [matricula_id, fecha, hora_inicio, hora_fin, notas]
    );
    
    const clase = await db.get('SELECT * FROM clases WHERE id = ?', [result.id]);
    res.status(201).json(clase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener todas las clases
router.get('/clases/todas', async (req, res) => {
  try {
    const clases = await db.all(`
      SELECT 
        c.*,
        m.estudiante_id,
        m.tutor_id,
        e.nombre as estudiante_nombre,
        t.nombre as tutor_nombre
      FROM clases c
      JOIN matriculas m ON c.matricula_id = m.id
      JOIN estudiantes e ON m.estudiante_id = e.id
      JOIN tutores t ON m.tutor_id = t.id
    `);
    res.json(clases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
