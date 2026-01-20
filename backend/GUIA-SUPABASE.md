# ============================================
# GUÍA DE MIGRACIÓN A SUPABASE
# ============================================

## 1. CREAR PROYECTO EN SUPABASE

1. Ve a https://supabase.com
2. Crea una cuenta o inicia sesión
3. Haz clic en "New Project"
4. Completa los datos:
   - Name: linguistika
   - Database Password: (guarda esta contraseña seguramente)
   - Region: Elige la más cercana (ej: South America - São Paulo)
5. Espera 2-3 minutos mientras se crea el proyecto

## 2. OBTENER CREDENCIALES

1. En tu proyecto de Supabase, ve a "Settings" (⚙️) en el menú lateral
2. Haz clic en "API"
3. Copia estos valores:
   - **Project URL**: `https://tu-proyecto.supabase.co`
   - **Project API Key (anon/public)**: `eyJhbGc...` (clave larga)
   - En "Database" → "Connection string" → "URI": Copia la URL completa

## 3. EJECUTAR SCHEMA SQL

1. En tu proyecto de Supabase, ve a "SQL Editor" en el menú lateral
2. Haz clic en "New Query"
3. Copia TODO el contenido del archivo `supabase-schema.sql`
4. Pégalo en el editor SQL
5. Haz clic en "Run" (▶️)
6. Verifica que se ejecutó sin errores (debe decir "Success")

## 4. CONFIGURAR VARIABLES DE ENTORNO

Crea o edita el archivo `.env` en la carpeta `backend/`:

```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT Secret (para autenticación - crea uno seguro)
JWT_SECRET=tu-secreto-super-seguro-cambialo-123456789

# Server Config
PORT=5000
NODE_ENV=development
```

**Importante**: 
- Reemplaza `SUPABASE_URL` con tu Project URL
- Reemplaza `SUPABASE_ANON_KEY` con tu anon key
- El `SUPABASE_SERVICE_KEY` lo encuentras en Settings → API → service_role key
- Cambia `JWT_SECRET` por algo único y seguro

## 5. INSTALAR DEPENDENCIAS

En la carpeta `backend/`, ejecuta:

```bash
npm install @supabase/supabase-js
```

## 6. REINICIAR BACKEND

```bash
npm run dev
```

## 7. MIGRAR DATOS EXISTENTES (Opcional)

Si tienes datos en SQLite que quieres migrar:

### Opción A: Exportar desde SQLite
1. Abre tu archivo `linguistika.db` con SQLite Browser o similar
2. Exporta cada tabla como CSV
3. En Supabase, ve a "Table Editor"
4. Selecciona cada tabla y usa "Import data from CSV"

### Opción B: Script de migración
Ejecuta el script `migrate-to-supabase.js` que se generó:
```bash
node migrate-to-supabase.js
```

## 8. VERIFICAR CONEXIÓN

1. Inicia tu backend: `npm run dev`
2. Deberías ver: "✅ Conectado a Supabase"
3. Prueba el login: `http://localhost:5000/api/auth/login`
4. Prueba listar tutores: `http://localhost:5000/api/tutores`

## 9. CONFIGURAR FRONTEND

El frontend ya está configurado para usar la API en `http://localhost:5000/api`.
No necesitas cambiar nada en el frontend, pero asegúrate de que:

1. El backend esté corriendo en el puerto 5000
2. CORS esté habilitado (ya está configurado)

## SOLUCIÓN DE PROBLEMAS

### Error: "Invalid API key"
- Verifica que copiaste correctamente las keys de Supabase
- Asegúrate de usar el `SUPABASE_ANON_KEY` correcto

### Error: "relation does not exist"
- El schema SQL no se ejecutó correctamente
- Vuelve a ejecutar `supabase-schema.sql` en SQL Editor

### Error: "Connection refused"
- Verifica que el `SUPABASE_URL` sea correcto
- Revisa que tu proyecto de Supabase esté activo

### Los datos no se actualizan en el Dashboard
- Asegúrate de que el backend esté usando Supabase (debe decir "Conectado a Supabase" al iniciar)
- Verifica en Supabase → Table Editor que los datos se están insertando
- Refresca el Dashboard con el botón "Actualizar"

## ESTRUCTURA FINAL

```
backend/
├── .env                          # ← NUEVO: Variables de entorno
├── supabase-schema.sql          # ← NUEVO: Schema SQL
├── migrate-to-supabase.js       # ← NUEVO: Script de migración
├── supabase.js                  # ← NUEVO: Cliente Supabase
├── database.js                  # ← MODIFICADO: Usa Supabase
├── server.js                    # Sin cambios
└── routes/                      # ← MODIFICADOS: Usan Supabase
    ├── tutores.js
    ├── cursos.js
    ├── estudiantes.js
    ├── matriculas.js
    ├── pagos.js
    ├── dashboard.js
    └── auth.js
```

## VENTAJAS DE SUPABASE

✅ Base de datos PostgreSQL alojada en la nube
✅ Backups automáticos
✅ Escalabilidad automática
✅ API REST generada automáticamente
✅ Panel de administración visual
✅ Sin necesidad de gestionar infraestructura
✅ Gratis hasta 500MB de base de datos

## PRÓXIMOS PASOS

1. Ejecuta el schema SQL en Supabase ✓
2. Configura las variables de entorno ✓
3. Instala las dependencias ✓
4. Reinicia el backend ✓
5. Verifica que todo funciona ✓
6. (Opcional) Migra datos de SQLite
7. ¡Listo! Tu aplicación ahora usa Supabase
