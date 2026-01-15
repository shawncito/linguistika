import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todos los cursos
router.get('/', async (req, res) => {
  try {
    const cursos = await db.all('SELECT * FROM cursos WHERE estado = 1');
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un curso por ID
router.get('/:id', async (req, res) => {
  try {
    const curso = await db.get('SELECT * FROM cursos WHERE id = ?', [req.params.id]);
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }
    res.json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo curso
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, nivel, max_estudiantes } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    const result = await db.run(
      'INSERT INTO cursos (nombre, descripcion, nivel, max_estudiantes) VALUES (?, ?, ?, ?)',
      [nombre, descripcion, nivel, max_estudiantes || 10]
    );
    
    const curso = await db.get('SELECT * FROM cursos WHERE id = ?', [result.id]);
    res.status(201).json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar curso
router.put('/:id', async (req, res) => {
  try {
    const { nombre, descripcion, nivel, max_estudiantes, estado } = req.body;
    
    await db.run(
      'UPDATE cursos SET nombre = ?, descripcion = ?, nivel = ?, max_estudiantes = ?, estado = ? WHERE id = ?',
      [nombre, descripcion, nivel, max_estudiantes, estado, req.params.id]
    );
    
    const curso = await db.get('SELECT * FROM cursos WHERE id = ?', [req.params.id]);
    res.json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar curso
router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE cursos SET estado = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Curso desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
