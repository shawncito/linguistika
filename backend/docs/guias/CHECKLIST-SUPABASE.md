# ✅ CHECKLIST DE CONFIGURACIÓN SUPABASE

Sigue estos pasos en orden para completar la migración:

---

## 📋 PASOS DE CONFIGURACIÓN

### ☐ Paso 1: Crear Proyecto en Supabase (5 min)

1. Ve a https://app.supabase.com
2. Click en "New Project"
3. Completa:
   - **Organization:** Selecciona o crea una
   - **Name:** linguistika (o el nombre que prefieras)
   - **Database Password:** Guarda esto en un lugar seguro
   - **Region:** Selecciona el más cercano (ej: South America - São Paulo)
4. Click "Create new project"
5. ⏳ Espera 2-3 minutos mientras se inicializa

---

### ☐ Paso 2: Ejecutar Schema SQL (2 min)

1. En tu proyecto de Supabase, ve a la barra lateral izquierda
2. Click en **SQL Editor**
3. Click en **New query**
4. Abre el archivo `backend/supabase-schema.sql` de este proyecto
5. **Copia TODO el contenido** (201 líneas)
6. **Pega** en el editor SQL de Supabase
7. Click en el botón verde **"Run"** (esquina inferior derecha)
8. ✅ Deberías ver: "Success. No rows returned"

**¿Qué hace esto?**
- Crea 8 tablas (usuarios, tutores, cursos, estudiantes, matriculas, clases, pagos, horas_trabajo)
- Crea índices para mejor rendimiento
- Inserta datos de ejemplo (admin user, 2 tutores, 3 cursos)

---

### ☐ Paso 3: Obtener Credenciales (1 min)

1. En Supabase, ve a **Settings** (⚙️ en barra lateral)
2. Click en **API**
3. En la sección **Project API keys**, verás:

   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public: eyJhbGc....(una clave MUY larga)
   ```

4. **Copia estos dos valores** (los necesitarás en el siguiente paso)

⚠️ **IMPORTANTE:** Copia el "anon public" key, NO el "service_role" key

---

### ☐ Paso 4: Configurar Variables de Entorno (2 min)

1. Abre el archivo `backend/.env` en tu editor
2. Reemplaza los placeholders:

   ```env
   # ANTES
   SUPABASE_URL=TU_PROJECT_URL_AQUI
   SUPABASE_KEY=TU_ANON_PUBLIC_KEY_AQUI
   
   # DESPUÉS (ejemplo)
   SUPABASE_URL=https://abcdefghijklmn.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
   ```

3. Opcionalmente, cambia `JWT_SECRET` por una cadena aleatoria segura
4. **Guarda el archivo**

---

### ☐ Paso 5: Instalar Dependencias (1 min)

```bash
cd backend
npm install
```

Esto instalará `@supabase/supabase-js` (y todas las demás dependencias).

---

### ☐ Paso 6: Iniciar Servidor (inmediato)

```bash
npm run dev
```

✅ **Deberías ver:**
```
🔌 Conectado a Supabase
✅ Usuario admin creado (o ya existe)
📊 Base de datos Supabase inicializada correctamente
🚀 Servidor corriendo en http://localhost:5000
```

❌ **Si ves errores:**
- "Invalid API key" → Verifica que copiaste la "anon public" key correctamente
- "Missing environment variables" → Verifica que .env existe y tiene SUPABASE_URL y SUPABASE_KEY
- "relation does not exist" → Ejecuta el schema SQL (Paso 2)

---

### ☐ Paso 7: Probar Frontend (inmediato)

1. Abre otra terminal
2. Ejecuta:
   ```bash
   cd LInguistika-Studio
   npm run dev
   ```
3. Abre http://localhost:5173 en tu navegador
4. Inicia sesión con:
   - **Usuario:** admin
   - **Contraseña:** admin123

---

## 🎉 ¡COMPLETADO!

Si todos los pasos tienen ✅, tu sistema ahora está funcionando con Supabase.

### ✨ Próximas Acciones

- **Ver datos:** Ve a Supabase Dashboard → Table Editor
- **Crear tutores:** Usa la pestaña "Tutores" en la aplicación
- **Ver SQL en vivo:** Supabase Dashboard → SQL Editor → History
- **Configurar RLS (opcional):** Row Level Security para mayor seguridad

---

## 🆘 TROUBLESHOOTING

### Error: "Cannot find module '@supabase/supabase-js'"
```bash
cd backend
npm install @supabase/supabase-js
```

### Error: "Invalid JWT token"
El JWT_SECRET en .env debe ser el mismo siempre. No lo cambies después de crear tokens.

### Error: Frontend no conecta con backend
Verifica que:
1. El backend esté corriendo en puerto 5000
2. No haya errores en la consola del backend
3. El frontend esté configurado para http://localhost:5000 (en services/api.ts)

### Ver logs de Supabase
En Supabase Dashboard → Logs → Postgres Logs

---

**¿Necesitas ayuda?** Revisa [GUIA-SUPABASE.md](./GUIA-SUPABASE.md) para más detalles.
