## 🚀 PRÓXIMOS PASOS - Migraciones y Testing

### ⚠️ PASO 1: Ejecutar Migraciones SQL en Supabase (BLOQUEANTE)

#### Antes de ejecutar cualquier código, necesitas:
1. Ir a: https://supabase.com → Tu Proyecto → SQL Editor
2. Copiar el contenido de cada archivo SQL y ejecutar:

**Archivo 1: `docs/migraciones/FIX_RLS_POLICIES.sql`**
- Soluciona: Error 42501 "new row violates row-level security policy"
- Acción: Copia → Pega → Run
- Espera: Mensaje "Executed successfully"

**Archivo 2: `docs/migraciones/MIGRACION_TUTORES_DIAS_TURNO.sql`**
- Nota: es parte del histórico. El sistema actual usa `dias_horarios` para disponibilidad por hora.
- Acción: Copia → Pega → Run
- Espera: Mensaje "Executed successfully"

**Archivo 3: `backend/migrations/002_add_estudiantes_bulk_extra_fields.sql`**
- Soluciona: que importación bulk guarde los mismos campos que el formulario (grado, encargado, etc.)

**Archivo 4: `backend/migrations/003_add_turno_to_matriculas_grupo.sql`**
- Soluciona: soportar `turno` en grupos (Plantilla de carga masiva)

**Archivo 5: `backend/migrations/003_add_matricula_grupo_id_to_estudiantes.sql`**
- Soluciona: Permitir que estudiantes “manuales” se asignen a grupos (`matricula_grupo_id`)
- Acción: Copia → Pega → Run
- Espera: Mensaje "Executed successfully"

---

### ✅ CAMBIOS YA IMPLEMENTADOS EN EL CÓDIGO

**Backend:**
- ✅ `backend/routes/tutores.js` - Ya usa `dias_turno` (no `horario_preferido`, `dias`, `turno`)
- ✅ `backend/routes/cursos.js` - Ya usa `dias_turno` en POST/PUT/GET
- ✅ `backend/MIGRACION_TUTORES_DIAS_TURNO.sql` - Creado
- ✅ `backend/FIX_RLS_POLICIES.sql` - Creado

**Frontend:**
- ✅ Manejo de horarios por día y rangos horarios (`dias_horarios`) y schedule por curso (`dias_schedule`)
- ✅ Gestión de grupos (bulk + manual) y borrado de cursos con opción cascade

---

### 📝 CÓMO FUNCIONA AHORA

#### Crear un Docente (Tutor):
1. Click "Nuevo Docente"
2. Completa: Nombre, Teléfono (+506 8888-8888), Especialidad, Tarifa
3. Selecciona días y define rangos de hora inicio/fin por día (`dias_horarios`)
5. Click "Guardar"
6. Datos se guardan como objeto JSON: `{ "Lunes": {"hora_inicio":"09:00","hora_fin":"11:00"}, ... }`

#### Crear un Curso:
- Define `dias_schedule` por día (hora inicio/fin) y asigna tutor.
- La compatibilidad se valida por traslape de rangos horarios.

#### Crear un Estudiante:
- Ya funcionaba, mantiene el mismo patrón

---

### 🔍 VERIFICACIÓN DESPUÉS DE EJECUTAR SQL

**En Supabase → SQL Editor:**

```sql
-- Verificar que tutores tiene columna dias_turno
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'tutores' 
AND column_name = 'dias_turno';

-- Verificar que RLS policies existen
SELECT * FROM pg_policies WHERE tablename = 'tutores';
```

---

### ❌ ERRORES A RESOLVER

Después de ejecutar SQL, si guardas un tutor y ves:
- `PGRST204 'horario_preferido' column does not exist` → Recarga la página (F5)
- `42501 row violates row-level security` → Ejecutaste FIX_RLS_POLICIES.sql? ✓
- `undefined is not a function` → Borra caché del navegador (Ctrl+Shift+Del)

---

### 🧪 TESTING FULL FLOW

**Nota de autenticación (importante):**
- Todas las rutas `/api/*` requieren `Bearer token` y que el usuario exista en `public.usuarios`.
- Si no tenés un usuario empleado/admin creado, podés crearlo con el script del backend:

```powershell
cd backend
npm run bootstrap-admin -- --email "tu-correo@dominio.com" --password "TuPasswordSegura123" --nombre "Admin" --telefono "+506 8888-8888"
```

#### Opción recomendada: Roundtrip automatizado (API end-to-end)

Desde `backend\\`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CheckPagoPhase
```

- Por defecto deja datos creados (listos para validar UI y fase de pagos).
- Guarda `.roundtrip-state.json` para permitir limpieza segura.

Limpieza cuando termines:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CleanupOnly
```

#### Fase de Pagos (prerrequisitos)

- El módulo `pagos` y `finanzas` requiere rol `admin` o `contador`.
- `GET /api/finanzas/movimientos` puede requerir `SUPABASE_SERVICE_KEY` configurado en el backend.

Ver guía: `docs/guias/GUIA_TESTING_ROUNDTRIP.md`

1. **Crea un Docente:**
   - Nombre: "Carlos García"
   - Teléfono: 8888-8888
   - Especialidad: Inglés
   - Días: Lun, Mié, Vie
   - Turnos: Lun→Tarde, Mié→Noche, Vie→Tarde
   - Tarifa: 25000
   - ✓ Debe guardarse y mostrar "Lun • Tarde, Mié • Noche, Vie • Tarde"

2. **Edita el Docente:**
   - Agregar sábado con turno Noche
   - ✓ Debe actualizar la tarjeta

3. **Crea un Curso con mismo patrón:**
   - Nombre: "English A1"
   - Nivel: A1
   - Tipo: Grupal
   - Max estudiantes: 8
   - Días: Mar, Jue
   - Turnos: Mar→Tarde, Jue→Noche
   - ✓ Debe guardarse correctamente

4. **Matricula un Estudiante en el Curso:**
   - ✓ Debe validar compatibilidad de horarios

5. **Borrado de Curso (cuando esté en uso):**
   - Al borrar un curso con grupos/matrículas/clases/movimientos asociados, el backend responde 409 con `blockers`.
   - La UI ofrece confirmar **borrado en cascada** (elimina dependencias y luego borra el curso).
   - Si no querés borrar datos, usá “Inactivar” (solo cambia `estado`).

---

### 📞 EN CASO DE PROBLEMAS

**Si aparece "400 Bad Request" al guardar:**
- Abre DevTools (F12) → Console
- Copia el error exacto
- Verifica que enviaste `dias_turno` como Object, no string

**Si aparece "500 Internal Server Error":**
- Revisa que ejecutaste FIX_RLS_POLICIES.sql ✓
- Revisa que ejecutaste MIGRACION_TUTORES_DIAS_TURNO.sql ✓
- Recarga la página (F5)

**Si la UI no muestra los turnos:**
- Borra localStorage: DevTools → Application → LocalStorage → Clear All
- Recarga (F5)

---

### 🎯 RESUMEN DE LO QUE CAMBIA

| Campo Antiguo | Nuevo Campo | Formato |
|---|---|---|
| `horario_preferido` ❌ | `dias_turno` ✅ | JSON Object |
| `dias` (array) ❌ | `dias_turno` keys ✅ | ["Lunes", "Martes"] |
| `turno` (1 valor) ❌ | `dias_turno` values ✅ | "Tarde" \| "Noche" |

**Ejemplo:**
```json
// ANTES (NO FUNCIONA)
{ "dias": ["Lunes", "Martes"], "turno": "Tarde" }

// AHORA (✓ CORRECTO)
{ "dias_turno": { "Lunes": "Tarde", "Martes": "Noche" } }
```

---

**🔔 IMPORTANTE:**
- No olvides ejecutar los 2 archivos SQL en Supabase PRIMERO
- Sin las migraciones, los guardar fallarán con 42501 o PGRST204
- Todo el código frontend/backend YA ESTÁ LISTO
