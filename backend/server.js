import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Database from './database.js';
import tutoresRouter from './routes/tutores.js';
import cursosRouter from './routes/cursos.js';
import estudiantesRouter from './routes/estudiantes.js';
import matriculasRouter from './routes/matriculas.js';
import horariosRouter from './routes/horarios.js';
import pagosRouter from './routes/pagos.js';
import dashboardRouter from './routes/dashboard.js';

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
app.use('/api/tutores', tutoresRouter);
app.use('/api/cursos', cursosRouter);
app.use('/api/estudiantes', estudiantesRouter);
app.use('/api/matriculas', matriculasRouter);
app.use('/api/horarios', horariosRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/dashboard', dashboardRouter);

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
