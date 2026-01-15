import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todos los tutores
router.get('/', async (req, res) => {
  try {
    const tutores = await db.all('SELECT * FROM tutores WHERE estado = 1');
    res.json(tutores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un tutor por ID
router.get('/:id', async (req, res) => {
  try {
    const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [req.params.id]);
    if (!tutor) {
      return res.status(404).json({ error: 'Tutor no encontrado' });
    }
    res.json(tutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo tutor
router.post('/', async (req, res) => {
  try {
    const { nombre, email, telefono, especialidad, tarifa_por_hora } = req.body;
    
    if (!nombre || !especialidad || !tarifa_por_hora) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, especialidad, tarifa_por_hora' });
    }

    const result = await db.run(
      'INSERT INTO tutores (nombre, email, telefono, especialidad, tarifa_por_hora) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, telefono, especialidad, tarifa_por_hora]
    );
    
    const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [result.id]);
    res.status(201).json(tutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar tutor
router.put('/:id', async (req, res) => {
  try {
    const { nombre, email, telefono, especialidad, tarifa_por_hora, estado } = req.body;
    
    await db.run(
      'UPDATE tutores SET nombre = ?, email = ?, telefono = ?, especialidad = ?, tarifa_por_hora = ?, estado = ? WHERE id = ?',
      [nombre, email, telefono, especialidad, tarifa_por_hora, estado, req.params.id]
    );
    
    const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [req.params.id]);
    res.json(tutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar tutor
router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE tutores SET estado = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tutor desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
