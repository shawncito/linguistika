## 🚀 PRÓXIMOS PASOS - Migraciones y Testing

### ⚠️ PASO 1: Ejecutar Migraciones SQL en Supabase (BLOQUEANTE)

#### Antes de ejecutar cualquier código, necesitas:
1. Ir a: https://supabase.com → Tu Proyecto → SQL Editor
2. Copiar el contenido de cada archivo SQL y ejecutar:

**Archivo 1: `backend/FIX_RLS_POLICIES.sql`**
- Soluciona: Error 42501 "new row violates row-level security policy"
- Acción: Copia → Pega → Run
- Espera: Mensaje "Executed successfully"

**Archivo 2: `backend/MIGRACION_TUTORES_DIAS_TURNO.sql`**
- Soluciona: Agregar columna `dias_turno` a tabla tutores
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
- ✅ `LInguistika-Studio/views/Tutores.tsx` - Formulario con selección de turno por día
- ✅ `LInguistika-Studio/types.ts` - Interfaces actualizadas (Tutor, Curso con `dias_turno`)
- ✅ Tarjetas de tutores - Muestran horarios como "Lun • Tarde, Mar • Noche"

---

### 📝 CÓMO FUNCIONA AHORA

#### Crear un Docente (Tutor):
1. Click "Nuevo Docente"
2. Completa: Nombre, Teléfono (+506 8888-8888), Especialidad, Tarifa
3. Selecciona "Días Hábiles" (checkboxes)
4. Para cada día seleccionado → Elige Tarde o Noche
5. Click "Guardar"
6. Datos se guardan como: `{ "Lunes": "Tarde", "Martes": "Noche", ... }`

#### Crear un Curso:
- Igual que Tutores - Selecciona días, elige turno por día

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
