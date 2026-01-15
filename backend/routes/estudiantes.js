import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todos los estudiantes
router.get('/', async (req, res) => {
  try {
    const estudiantes = await db.all('SELECT * FROM estudiantes WHERE estado = 1');
    res.json(estudiantes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un estudiante por ID
router.get('/:id', async (req, res) => {
  try {
    const estudiante = await db.get('SELECT * FROM estudiantes WHERE id = ?', [req.params.id]);
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json(estudiante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const { nombre, email, telefono } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    const result = await db.run(
      'INSERT INTO estudiantes (nombre, email, telefono) VALUES (?, ?, ?)',
      [nombre, email, telefono]
    );
    
    const estudiante = await db.get('SELECT * FROM estudiantes WHERE id = ?', [result.id]);
    res.status(201).json(estudiante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar estudiante
router.put('/:id', async (req, res) => {
  try {
    const { nombre, email, telefono, estado } = req.body;
    
    await db.run(
      'UPDATE estudiantes SET nombre = ?, email = ?, telefono = ?, estado = ? WHERE id = ?',
      [nombre, email, telefono, estado, req.params.id]
    );
    
    const estudiante = await db.get('SELECT * FROM estudiantes WHERE id = ?', [req.params.id]);
    res.json(estudiante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar estudiante
router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE estudiantes SET estado = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Estudiante desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
