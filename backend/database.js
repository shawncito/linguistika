import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'linguistika.db'), (err) => {
      if (err) {
        console.error('Error abriendo BD:', err);
      } else {
        console.log('✅ Conectado a la base de datos SQLite');
      }
    });
    this.db.configure('busyTimeout', 5000);
  }

  initialize() {
    // Habilitar claves foráneas
    this.db.run('PRAGMA foreign_keys = ON');

    // Tabla de Tutores
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tutores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE,
        telefono TEXT,
        especialidad TEXT NOT NULL,
        tarifa_por_hora REAL NOT NULL,
        estado BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Cursos
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cursos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        nivel TEXT,
        max_estudiantes INTEGER DEFAULT 10,
        estado BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Horarios Disponibles del Tutor
    this.db.run(`
      CREATE TABLE IF NOT EXISTS horarios_tutores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tutor_id INTEGER NOT NULL,
        dia_semana TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        estado BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE,
        UNIQUE(tutor_id, dia_semana, hora_inicio)
      )
    `);

    // Tabla de Estudiantes
    this.db.run(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT,
        telefono TEXT,
        fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP,
        estado BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Matrículas
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matriculas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_id INTEGER NOT NULL,
        curso_id INTEGER NOT NULL,
        tutor_id INTEGER NOT NULL,
        fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP,
        estado BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE
      )
    `);

    // Tabla de Clases Programadas
    this.db.run(`
      CREATE TABLE IF NOT EXISTS clases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricula_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        estado TEXT DEFAULT 'programada',
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
      )
    `);

    // Tabla de Pagos
    this.db.run(`
      CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tutor_id INTEGER NOT NULL,
        clase_id INTEGER,
        cantidad_clases INTEGER,
        monto REAL NOT NULL,
        fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'pendiente',
        descripcion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE,
        FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE SET NULL
      )
    `);

    console.log('📊 Tablas de base de datos creadas correctamente');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default Database;
