import express from 'express';
import Database from '../database.js';

const router = express.Router();
const db = new Database();

// GET - Listar todos los pagos
router.get('/', async (req, res) => {
  try {
    const pagos = await db.all(`
      SELECT 
        p.*,
        t.nombre as tutor_nombre,
        t.email as tutor_email
      FROM pagos p
      JOIN tutores t ON p.tutor_id = t.id
      ORDER BY p.fecha_pago DESC
    `);
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Pagos de un tutor
router.get('/tutor/:tutor_id', async (req, res) => {
  try {
    const pagos = await db.all(`
      SELECT * FROM pagos
      WHERE tutor_id = ?
      ORDER BY fecha_pago DESC
    `, [req.params.tutor_id]);
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registrar pago
router.post('/', async (req, res) => {
  try {
    const { tutor_id, clase_id, cantidad_clases, monto, descripcion } = req.body;
    
    if (!tutor_id || !monto) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, monto' });
    }

    const result = await db.run(
      'INSERT INTO pagos (tutor_id, clase_id, cantidad_clases, monto, descripcion) VALUES (?, ?, ?, ?, ?)',
      [tutor_id, clase_id, cantidad_clases, monto, descripcion]
    );
    
    const pago = await db.get(`
      SELECT 
        p.*,
        t.nombre as tutor_nombre
      FROM pagos p
      JOIN tutores t ON p.tutor_id = t.id
      WHERE p.id = ?
    `, [result.id]);
    
    res.status(201).json(pago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Calcular pago automático por clases dadas
router.post('/calcular', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin } = req.body;
    
    if (!tutor_id) {
      return res.status(400).json({ error: 'Campo requerido: tutor_id' });
    }

    // Obtener todas las clases del tutor en el período
    let query = `
      SELECT 
        c.id,
        c.fecha,
        c.hora_inicio,
        c.hora_fin,
        t.tarifa_por_hora,
        t.nombre as tutor_nombre
      FROM clases c
      JOIN matriculas m ON c.matricula_id = m.id
      JOIN tutores t ON m.tutor_id = t.id
      WHERE m.tutor_id = ? AND c.estado = 'programada'
    `;
    
    const params = [tutor_id];
    
    if (fecha_inicio) {
      query += ' AND c.fecha >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      query += ' AND c.fecha <= ?';
      params.push(fecha_fin);
    }

    const clases = await db.all(query, params);

    // Calcular monto total
    let monto_total = 0;
    clases.forEach(clase => {
      // Calcular duración en horas
      const [hi, mi] = clase.hora_inicio.split(':').map(Number);
      const [hf, mf] = clase.hora_fin.split(':').map(Number);
      const duracion = ((hf - hi) + (mf - mi) / 60);
      monto_total += duracion * clase.tarifa_por_hora;
    });

    res.json({
      tutor_id,
      cantidad_clases: clases.clases,
      monto_total,
      clases_detalles: clases
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar estado de pago
router.put('/:id', async (req, res) => {
  try {
    const { estado } = req.body;
    
    await db.run('UPDATE pagos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    
    const pago = await db.get(`
      SELECT 
        p.*,
        t.nombre as tutor_nombre
      FROM pagos p
      JOIN tutores t ON p.tutor_id = t.id
      WHERE p.id = ?
    `, [req.params.id]);
    
    res.json(pago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
