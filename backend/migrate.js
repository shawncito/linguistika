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

// ============================================================================
// FUNCIONES DE EXPLORACIÓN - Ver contenido de las tablas
// ============================================================================

async function verTabla(nombreTabla, limite = 100) {
  console.log(`\n📋 Contenido de tabla: ${nombreTabla}\n`);
  try {
    const { data, error } = await supabase
      .from(nombreTabla)
      .select('*')
      .limit(limite);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log(`  (tabla vacía)\n`);
      return [];
    }

    console.table(data);
    console.log(`\n  Total registros: ${data.length}\n`);
    return data;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function verFilasPor(nombreTabla, columna, valor) {
  console.log(`\n📋 Filas en ${nombreTabla} donde ${columna} = ${valor}\n`);
  try {
    const { data, error } = await supabase
      .from(nombreTabla)
      .select('*')
      .eq(columna, valor);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log(`  (no hay registros)\n`);
      return [];
    }

    console.table(data);
    console.log(`\n  Total: ${data.length}\n`);
    return data;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return [];
  }
}

async function verEstructura() {
  console.log('\n📊 ESTRUCTURA DE TABLAS\n');
  const tablas = [
    'cursos',
    'tutores',
    'estudiantes',
    'matriculas',
    'sesiones_clases',
    'movimientos_dinero',
    'horas_trabajo'
  ];

  for (const tabla of tablas) {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ${tabla}: Error`);
      continue;
    }

    if (data && data.length > 0) {
      const columnas = Object.keys(data[0]);
      console.log(`✅ ${tabla}: ${columnas.join(', ')}`);
    } else {
      console.log(`⚪ ${tabla}: (vacía)`);
    }
  }
  console.log();
}

// ============================================================================
// FUNCIÓN PRINCIPAL - Aquí van los cambios que quieres hacer
// ============================================================================

async function runMigrations() {
  try {
    console.log('🚀 Herramienta de Migración y Exploración\n');
    console.log('='.repeat(60));

    // ========== DESCOMENTA LO QUE QUIERAS EJECUTAR ==========
    
    // 1. VER ESTRUCTURA DE TODAS LAS TABLAS
    // await verEstructura();

    // 2. VER CONTENIDO COMPLETO DE UNA TABLA
    // await verTabla('tutores');
    // await verTabla('cursos');
    // await verTabla('matriculas');
    // await verTabla('sesiones_clases');
    // await verTabla('movimientos_dinero');
    // await verTabla('estudiantes');
    // await verTabla('horas_trabajo');

    // 3. VER FILAS ESPECÍFICAS
    // await verFilasPor('matriculas', 'id', 1);
    // await verFilasPor('cursos', 'estado', 1);
    // await verFilasPor('tutores', 'id', 1);

    // 4. ACTUALIZAR UN REGISTRO
    // const { error: err1 } = await supabase
    //   .from('tutores')
    //   .update({ tarifa_por_hora: 50 })
    //   .eq('id', 1);
    // if (err1) throw err1;
    // console.log('✅ Tutor actualizado');

    // 5. INSERTAR UN NUEVO REGISTRO
    // const { error: err2 } = await supabase
    //   .from('tutores')
    //   .insert([{ 
    //     nombre: 'Juan', 
    //     email: 'juan@test.com', 
    //     tarifa_por_hora: 30, 
    //     estado: 1 
    //   }]);
    // if (err2) throw err2;
    // console.log('✅ Nuevo tutor insertado');

    // 6. ELIMINAR UN REGISTRO
    // const { error: err3 } = await supabase
    //   .from('tutores')
    //   .delete()
    //   .eq('id', 99);
    // if (err3) throw err3;
    // console.log('✅ Registro eliminado');

    console.log('\n\n📌 INSTRUCCIONES:');
    console.log('1. Descomenta el código arriba que quieras ejecutar');
    console.log('2. Ejecuta: node migrate.js');
    console.log('3. Los cambios se aplican directamente a Supabase\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigrations();
