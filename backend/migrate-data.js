/**
 * Script de Migración de Datos: SQLite → Supabase
 * 
 * USO:
 * node migrate-data.js
 * 
 * IMPORTANTE:
 * - Ejecuta esto SOLO si tienes datos existentes en SQLite que quieres conservar
 * - Asegúrate de haber ejecutado el schema SQL en Supabase primero
 * - Este script NO borra datos existentes, solo agrega
 * - Verifica las credenciales en .env antes de ejecutar
 */

import sqlite3 from 'sqlite3';
import { supabase } from './supabase.js';
import fs from 'fs';
import path from 'path';

// Ruta a la base de datos SQLite antigua
const SQLITE_DB_PATH = './linguistika.db';

// Verificar que existe el archivo SQLite
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error('❌ No se encontró el archivo SQLite:', SQLITE_DB_PATH);
  console.log('💡 Si no tienes datos antiguos que migrar, ignora este script.');
  process.exit(1);
}

// Wrapper para promisificar SQLite
class SQLiteDB {
  constructor(path) {
    this.db = new sqlite3.Database(path);
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
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

// Función para migrar una tabla
async function migrateTable(tableName, oldDb, processRow = (row) => row) {
  console.log(`\n📦 Migrando tabla: ${tableName}`);
  
  try {
    // Leer datos de SQLite
    const rows = await oldDb.all(`SELECT * FROM ${tableName}`);
    console.log(`   Encontrados ${rows.length} registros en SQLite`);
    
    if (rows.length === 0) {
      console.log(`   ⏭️  Tabla vacía, saltando...`);
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    // Insertar en Supabase (uno por uno para evitar conflictos)
    for (const row of rows) {
      try {
        const processedRow = processRow(row);
        const { error } = await supabase.from(tableName).insert(processedRow);
        
        if (error) {
          // Si es un error de duplicado, solo advertir
          if (error.code === '23505') {
            console.log(`   ⚠️  Registro ya existe (id: ${row.id}), saltando...`);
          } else {
            throw error;
          }
        } else {
          success++;
        }
      } catch (err) {
        console.error(`   ❌ Error al insertar registro id ${row.id}:`, err.message);
        errors++;
      }
    }

    console.log(`   ✅ ${success} registros migrados exitosamente`);
    if (errors > 0) {
      console.log(`   ⚠️  ${errors} registros con errores`);
    }

    return { success, errors };
  } catch (err) {
    console.error(`   ❌ Error al migrar ${tableName}:`, err.message);
    return { success: 0, errors: 1 };
  }
}

// Función principal de migración
async function migrate() {
  console.log('🚀 Iniciando migración de datos SQLite → Supabase\n');
  console.log('📂 Base de datos SQLite:', SQLITE_DB_PATH);
  
  const oldDb = new SQLiteDB(SQLITE_DB_PATH);
  const results = {};

  try {
    // 1. Migrar usuarios (sin el admin que ya existe)
    results.usuarios = await migrateTable('usuarios', oldDb, (row) => {
      // Saltar el usuario admin si ya existe
      if (row.username === 'admin') return null;
      return row;
    });

    // 2. Migrar tutores
    results.tutores = await migrateTable('tutores', oldDb);

    // 3. Migrar cursos
    results.cursos = await migrateTable('cursos', oldDb, (row) => {
      // Parsear dias_semana si está en formato JSON string
      if (row.dias_semana && typeof row.dias_semana === 'string') {
        try {
          row.dias_semana = JSON.parse(row.dias_semana);
        } catch {}
      }
      return row;
    });

    // 4. Migrar estudiantes
    results.estudiantes = await migrateTable('estudiantes', oldDb);

    // 5. Migrar matrículas
    results.matriculas = await migrateTable('matriculas', oldDb);

    // 6. Migrar horarios de tutores
    results.horarios_tutores = await migrateTable('horarios_tutores', oldDb);

    // 7. Migrar clases
    results.clases = await migrateTable('clases', oldDb);

    // 8. Migrar pagos
    results.pagos = await migrateTable('pagos', oldDb);

    // 9. Migrar horas de trabajo
    results.horas_trabajo = await migrateTable('horas_trabajo', oldDb);

  } catch (err) {
    console.error('\n❌ Error general durante la migración:', err);
  } finally {
    await oldDb.close();
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const [table, result] of Object.entries(results)) {
    console.log(`${table.padEnd(20)} → ${result.success} éxitos, ${result.errors} errores`);
    totalSuccess += result.success;
    totalErrors += result.errors;
  }

  console.log('='.repeat(60));
  console.log(`TOTAL: ${totalSuccess} registros migrados, ${totalErrors} errores`);
  console.log('='.repeat(60));

  if (totalErrors === 0) {
    console.log('\n✅ ¡Migración completada exitosamente!');
  } else {
    console.log('\n⚠️  Migración completada con algunos errores.');
    console.log('   Revisa los mensajes arriba para más detalles.');
  }
}

// Ejecutar migración
migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
