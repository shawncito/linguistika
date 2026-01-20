# 🎯 MIGRACIÓN COMPLETA: SQLite → Supabase

## ✅ ARCHIVOS CONVERTIDOS

### Backend - Infraestructura
- ✅ `database.js` - Convertido de SQLite a Supabase client
- ✅ `supabase.js` - Nuevo cliente de Supabase creado
- ✅ `package.json` - Actualizado (@supabase/supabase-js agregado, sqlite3 eliminado)

### Backend - Rutas (8 archivos)
- ✅ `routes/tutores.js` - Convertido a queries Supabase
- ✅ `routes/cursos.js` - Convertido a queries Supabase
- ✅ `routes/estudiantes.js` - Convertido a queries Supabase
- ✅ `routes/matriculas.js` - Convertido con JOINs de Supabase
- ✅ `routes/pagos.js` - Convertido con queries complejas
- ✅ `routes/auth.js` - Convertido para autenticación
- ✅ `routes/dashboard.js` - Convertido con agregaciones
- ✅ `routes/horas-trabajo.js` - Convertido completamente
- ✅ `routes/horarios.js` - Convertido incluyendo clases

### Documentación y Configuración
- ✅ `supabase-schema.sql` - Schema completo PostgreSQL con datos de ejemplo
- ✅ `GUIA-SUPABASE.md` - Guía detallada paso a paso
- ✅ `.env.example` - Template de variables de entorno

---

## 📋 PRÓXIMOS PASOS

### 1️⃣ Configurar Proyecto en Supabase (5 minutos)

```bash
# 1. Ve a https://app.supabase.com
# 2. Crea un nuevo proyecto
# 3. Espera a que se inicialice (2-3 minutos)
```

### 2️⃣ Ejecutar Schema SQL (2 minutos)

```bash
# 1. En Supabase Dashboard → SQL Editor
# 2. Pega el contenido de backend/supabase-schema.sql
# 3. Click "Run" (esto crea todas las tablas + datos de ejemplo)
```

### 3️⃣ Configurar Variables de Entorno (3 minutos)

```bash
# 1. En Supabase → Settings → API
# 2. Copia Project URL y anon key
# 3. Crea backend/.env con estas credenciales
```

Crear `backend/.env`:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-anon-key-aqui
JWT_SECRET=tu-secreto-jwt-cambiar-en-produccion
PORT=5000
NODE_ENV=development
```

### 4️⃣ Instalar Dependencias (1 minuto)

```bash
cd backend
npm install
```

Esto instalará `@supabase/supabase-js` automáticamente.

### 5️⃣ Iniciar Servidor (inmediato)

```bash
npm run dev
```

El servidor debería iniciar en http://localhost:5000

### 6️⃣ Probar Login (inmediato)

Usuario de prueba creado automáticamente:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## 🔍 CAMBIOS TÉCNICOS REALIZADOS

### Antes (SQLite)
```javascript
// database.js
import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./linguistika.db');

// Queries
const tutores = await db.all('SELECT * FROM tutores WHERE estado = 1');
const tutor = await db.get('SELECT * FROM tutores WHERE id = ?', [id]);
```

### Después (Supabase)
```javascript
// supabase.js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(url, key);

// Queries
const { data: tutores } = await supabase
  .from('tutores')
  .select('*')
  .eq('estado', true);

const { data: tutor } = await supabase
  .from('tutores')
  .select('*')
  .eq('id', id)
  .single();
```

### JOINs en Supabase
```javascript
// SQLite JOIN
const query = `
  SELECT m.*, e.nombre as estudiante_nombre
  FROM matriculas m
  JOIN estudiantes e ON m.estudiante_id = e.id
`;

// Supabase JOIN
const { data } = await supabase
  .from('matriculas')
  .select(`
    *,
    estudiantes:estudiante_id (nombre)
  `);
```

---

## 🎁 DATOS DE EJEMPLO INCLUIDOS

El schema SQL incluye datos de prueba:

### Usuarios
- **admin / admin123** (rol: admin)

### Tutores
- Ana García (Inglés, ₡8,000/hora)
- Carlos Rodríguez (Matemáticas, ₡10,000/hora)

### Cursos
- Inglés Básico (Nivel A1)
- Matemáticas Avanzadas (Nivel Universitario)
- Programación Web (Nivel Intermedio)

---

## 🔧 TROUBLESHOOTING

### Error: "Missing environment variables"
```bash
# Solución: Verifica que backend/.env exista con SUPABASE_URL y SUPABASE_KEY
cat backend/.env
```

### Error: "relation does not exist"
```bash
# Solución: Ejecuta el schema SQL en Supabase Dashboard
# Dashboard → SQL Editor → Pega supabase-schema.sql → Run
```

### Error: "Invalid API key"
```bash
# Solución: Verifica que copiaste el "anon public" key, NO el "service_role" key
# Dashboard → Settings → API → Project API keys → anon public
```

### Error de CORS en frontend
```bash
# Solución: Ya está configurado en server.js
# Si persiste, verifica que el frontend use http://localhost:5000
```

---

## 📊 MIGRACIÓN DE DATOS EXISTENTES (Opcional)

Si tienes datos en la BD SQLite antigua que quieres conservar:

### Opción 1: Exportar/Importar Manual
```bash
# 1. Exporta datos de SQLite a JSON
# 2. Importa manualmente desde Supabase Dashboard → Table Editor
```

### Opción 2: Script de Migración
```javascript
// migrate-data.js (crear este archivo si necesitas migrar)
import Database from './database.js';
import { supabase } from './supabase.js';

const oldDb = new Database('./linguistika.db'); // SQLite antiguo
const tutores = await oldDb.all('SELECT * FROM tutores');

for (const tutor of tutores) {
  await supabase.from('tutores').insert(tutor);
}
```

---

## ✨ BENEFICIOS DE SUPABASE

✅ **Cloud-hosted** - No más archivos .db locales  
✅ **Backups automáticos** - Datos seguros  
✅ **Escalabilidad** - PostgreSQL robusto  
✅ **Real-time** - Capacidad de suscripciones en tiempo real  
✅ **Dashboard web** - Ver/editar datos fácilmente  
✅ **Autenticación integrada** - Potencial para Auth de Supabase  
✅ **Row Level Security** - Seguridad avanzada (ya preparado en schema)  

---

## 📞 SOPORTE

Si encuentras problemas:
1. Revisa [GUIA-SUPABASE.md](./GUIA-SUPABASE.md)
2. Verifica las variables de entorno en `.env`
3. Confirma que ejecutaste el schema SQL completo
4. Verifica que `npm install` completó exitosamente

---

**¡La migración está completa! 🎉**  
Solo faltan 5 pasos de configuración (15 minutos total).
