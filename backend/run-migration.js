import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY deben estar en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    console.log('🔄 Iniciando migración: Agregar tutor_id a cursos...\n');

    // SQL para agregar columna
    const sql = `
      ALTER TABLE cursos 
      ADD COLUMN tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL;
      
      CREATE INDEX idx_cursos_tutor_id ON cursos(tutor_id);
    `;

    // Ejecutar migración usando Supabase SQL
    const { error } = await supabase.rpc('execute_sql', { sql });

    if (error) {
      // Si el error es que la columna ya existe, no es un problema
      if (error.message.includes('already exists') || error.message.includes('ya existe')) {
        console.log('✅ La columna tutor_id ya existe en la tabla cursos');
        return;
      }
      throw error;
    }

    console.log('✅ Migración completada exitosamente');
    console.log('✅ Columna tutor_id agregada a tabla cursos');
    console.log('✅ Índice idx_cursos_tutor_id creado\n');

  } catch (error) {
    // Si es error de columna duplicada, ignorar
    if (error.message && error.message.includes('already exists')) {
      console.log('✅ La columna tutor_id ya existe. Continuando...\n');
      return;
    }
    
    console.error('❌ Error durante la migración:', error.message);
    
    // Intentar alternativa: usar directamente SQL via admin
    console.log('\n🔄 Intentando alternativa de migración...\n');
    await runMigrationViaSQL();
  }
}

async function runMigrationViaSQL() {
  try {
    // Intentar crear la columna si no existe
    const migration = `
      -- Agregar columna tutor_id si no existe
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'cursos' AND column_name = 'tutor_id'
        ) THEN 
          ALTER TABLE cursos ADD COLUMN tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL;
          CREATE INDEX idx_cursos_tutor_id ON cursos(tutor_id);
          RAISE NOTICE 'Columna tutor_id agregada exitosamente';
        ELSE
          RAISE NOTICE 'Columna tutor_id ya existe';
        END IF;
      END $$;
    `;

    const { error } = await supabase.rpc('execute_sql', { 
      sql: migration 
    });

    if (error) throw error;
    console.log('✅ Migración alternativa completada');
  } catch (err) {
    console.error('❌ Error en alternativa:', err.message);
    console.log('\n⚠️  Para agregar la columna manualmente en Supabase:\n');
    console.log('1. Ir a https://app.supabase.com/project/[PROJECT_ID]/editor/[TABLE_ID]');
    console.log('2. Click en "+" para agregar columna');
    console.log('3. Nombre: tutor_id');
    console.log('4. Tipo: int8');
    console.log('5. Relación: cursos.tutor_id -> tutores.id (ON DELETE SET NULL)\n');
  }
}

// Ejecutar migración
runMigration().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
