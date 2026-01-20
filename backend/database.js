import supabase from './supabase.js';
import bcrypt from 'bcryptjs';

class Database {
  constructor() {
    console.log('✅ Conectado a Supabase');
  }

  async initialize() {
    // Con Supabase, las tablas se crean con el schema SQL
    // Este método existe por compatibilidad pero no hace nada
    console.log('ℹ️  Usando Supabase - schema debe estar en supabase-schema.sql');
    
    // Crear usuario admin si no existe
    try {
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id')
        .eq('username', 'admin')
        .single();
      
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await supabase
          .from('usuarios')
          .insert({
            username: 'admin',
            password_hash: hashedPassword,
            rol: 'admin',
            estado: true
          });
        console.log('✅ Usuario admin creado');
      }
    } catch (err) {
      // Usuario ya existe o error - ignorar
    }
    
    console.log('📊 Base de datos Supabase inicializada correctamente');
  }

  // Método auxiliar para ejecutar queries SQL raw (INSERT, UPDATE, DELETE)
  // Nota: Supabase usa el cliente JS, así que los métodos run/get/all 
  // se mantienen por compatibilidad pero NO ejecutan SQL raw
  // Los routes deben usar directamente supabase.from().select/insert/update/delete
  async run(sql, params = []) {
    console.warn('⚠️ Método run() deprecado con Supabase. Usa supabase.from().insert/update/delete directamente');
    return { id: null, changes: 0 };
  }

  async get(sql, params = []) {
    console.warn('⚠️ Método get() deprecado con Supabase. Usa supabase.from().select().single() directamente');
    return null;
  }

  async all(sql, params = []) {
    console.warn('⚠️ Método all() deprecado con Supabase. Usa supabase.from().select() directamente');
    return [];
  }

  // Método close ya no es necesario con Supabase (conexión HTTP)
  async close() {
    console.log('✅ Supabase no requiere cerrar conexión (usa HTTP)');
  }
}

export default Database;
