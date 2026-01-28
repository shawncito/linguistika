import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import Database from './database.js';
import tutoresRouter from './routes/tutores.js';
import cursosRouter from './routes/cursos.js';
import estudiantesRouter from './routes/estudiantes.js';
import matriculasRouter from './routes/matriculas.js';
import horariosRouter from './routes/horarios.js';
import pagosRouter from './routes/pagos.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import horasTrabajoRouter from './routes/horas-trabajo.js';
import adminRouter from './routes/admin.js';
import finanzasRouter from './routes/finanzas.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Inicializar base de datos
const db = new Database();
db.initialize();

// Rutas
app.use('/api/auth', authRouter);

// API: Obtener fecha actual del servidor en zona horaria de Costa Rica (UTC-6)
app.get('/api/server-date', (req, res) => {
  // Formatear fecha local para Costa Rica en formato YYYY-MM-DD
  const fechaCR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const ahoraCR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));

  res.json({ 
    date: fechaCR, // e.g. 2026-01-19
    timestamp: ahoraCR.getTime(),
    timezone: 'America/Costa_Rica (UTC-6)'
  });
});

// DEBUG: Endpoint sin autenticación para revisar matrículas
app.get('/api/dashboard/debug/matriculas-cursos', async (req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    const { data: matriculas, error: mErr } = await supabase
      .from('matriculas')
      .select(`
        id,
        estudiante_id,
        curso_id,
        estado,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (id, nombre, estado, dias_schedule)
      `)
      .eq('estado', true);

    if (mErr) throw mErr;

    const debug = matriculas.map(m => ({
      matricula_id: m.id,
      estudiante: m.estudiantes?.nombre,
      curso_id: m.curso_id,
      curso_nombre: m.cursos?.nombre,
      curso_estado: m.cursos?.estado ? 'ACTIVO' : 'INACTIVO',
      tiene_dias_schedule: !!m.cursos?.dias_schedule
    }));

    res.json(debug);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Listar todos los cursos con su estado
app.get('/api/dashboard/debug/cursos', async (req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    const { data: cursos, error } = await supabase
      .from('cursos')
      .select('id, nombre, estado, dias_schedule')
      .order('id');

    if (error) throw error;

    const debug = cursos.map(c => ({
      curso_id: c.id,
      curso_nombre: c.nombre,
      estado: c.estado ? 'ACTIVO' : 'INACTIVO',
      tiene_dias_schedule: !!c.dias_schedule,
      dias_schedule: c.dias_schedule
    }));

    res.json(debug);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Corregir matrículas que apuntan a cursos inactivos
app.post('/api/dashboard/debug/fix-matriculas', async (req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    
    // Actualizar matrícula 1: Alejandro curso 1 → curso 3
    const { error } = await supabase
      .from('matriculas')
      .update({ curso_id: 3 })
      .eq('id', 1);

    if (error) throw error;

    res.json({ 
      mensaje: 'Matrículas corregidas',
      cambios: [
        { matricula_id: 1, anterior_curso_id: 1, nuevo_curso_id: 3 }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Calcular qué día de semana es una fecha
app.get('/api/dashboard/debug/dia-semana/:fecha', (req, res) => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const date = new Date(req.params.fecha + 'T00:00:00');
  const diaSemana = dias[date.getDay()];
  res.json({ 
    fecha: req.params.fecha,
    diaSemana,
    numeroSemana: date.getDay()
  });
});

// DEBUG: Calcular sesiones para una fecha (completo)
app.get('/api/dashboard/debug/sesiones-debug/:fecha', async (req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    const fecha = req.params.fecha;
    
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T00:00:00');
    const diaSemana = dias[date.getDay()];
    
    // Obtener SOLO matrículas activas
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('*')
      .eq('estado', true);
    
    const resultado = [];
    
    for (const matricula of matriculas || []) {
      const { data: curso } = await supabase
        .from('cursos')
        .select('*')
        .eq('id', matricula.curso_id)
        .single();
      
      const { data: estudiante } = await supabase
        .from('estudiantes')
        .select('nombre')
        .eq('id', matricula.estudiante_id)
        .single();
      
      const tieneSchedule = curso?.dias_schedule ? JSON.parse(curso.dias_schedule)[diaSemana] : null;
      
      resultado.push({
        matricula_id: matricula.id,
        estudiante: estudiante?.nombre,
        curso_id: matricula.curso_id,
        curso: curso?.nombre,
        curso_estado: curso?.estado ? 'ACTIVO' : 'INACTIVO',
        fecha,
        diaSemana,
        dias_schedule: curso?.dias_schedule,
        tiene_clase_ese_dia: !!tieneSchedule,
        horario: tieneSchedule
      });
    }
    
    res.json({ fecha, diaSemana, total_matriculas_activas: matriculas?.length, sesiones: resultado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aplicar requireAuth a todas las rutas protegidas
app.use('/api/tutores', (req, res, next) => requireAuth(req, res, next));
app.use('/api/cursos', (req, res, next) => requireAuth(req, res, next));
app.use('/api/estudiantes', (req, res, next) => requireAuth(req, res, next));
app.use('/api/matriculas', (req, res, next) => requireAuth(req, res, next));
app.use('/api/horarios', (req, res, next) => requireAuth(req, res, next));
app.use('/api/pagos', (req, res, next) => requireAuth(req, res, next));
app.use('/api/dashboard', (req, res, next) => requireAuth(req, res, next));
app.use('/api/horas-trabajo', (req, res, next) => requireAuth(req, res, next));
app.use('/api/admin', (req, res, next) => requireAuth(req, res, next));
app.use('/api/finanzas', (req, res, next) => requireAuth(req, res, next));

app.use('/api/tutores', tutoresRouter);
app.use('/api/cursos', cursosRouter);
app.use('/api/estudiantes', estudiantesRouter);
app.use('/api/matriculas', matriculasRouter);
app.use('/api/horarios', horariosRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/horas-trabajo', horasTrabajoRouter);
app.use('/api/admin', adminRouter);
app.use('/api/finanzas', finanzasRouter);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
