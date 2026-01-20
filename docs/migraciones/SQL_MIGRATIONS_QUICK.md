    ## 🔧 SQL MIGRATIONS - Copia y Pega en Supabase

### PASO 1: Copiar todo lo de abajo y pegarlo en Supabase SQL Editor

**Configuración:**
1. Abre: https://supabase.com → Tu Proyecto → SQL Editor
2. Click en "New Query"
3. Pega UNO de los scripts de abajo
4. Click "Run"
5. Espera: "Executed successfully"

---

## ⚡ FIX_RLS_POLICIES (EJECUTA PRIMERO)

```sql
-- ============================================
-- CORREGIR POLÍTICAS RLS EN TODAS LAS TABLAS
-- Permite CRUD completo (cambiar después si necesitas más seguridad)
-- ============================================

-- 1. USUARIOS
DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON usuarios;

CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (true);
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE USING (true);

-- 2. TUTORES
DROP POLICY IF EXISTS "tutores_select" ON tutores;
DROP POLICY IF EXISTS "tutores_insert" ON tutores;
DROP POLICY IF EXISTS "tutores_update" ON tutores;
DROP POLICY IF EXISTS "tutores_delete" ON tutores;

CREATE POLICY "tutores_select" ON tutores FOR SELECT USING (true);
CREATE POLICY "tutores_insert" ON tutores FOR INSERT WITH CHECK (true);
CREATE POLICY "tutores_update" ON tutores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tutores_delete" ON tutores FOR DELETE USING (true);

-- 3. CURSOS
DROP POLICY IF EXISTS "cursos_select" ON cursos;
DROP POLICY IF EXISTS "cursos_insert" ON cursos;
DROP POLICY IF EXISTS "cursos_update" ON cursos;
DROP POLICY IF EXISTS "cursos_delete" ON cursos;

CREATE POLICY "cursos_select" ON cursos FOR SELECT USING (true);
CREATE POLICY "cursos_insert" ON cursos FOR INSERT WITH CHECK (true);
CREATE POLICY "cursos_update" ON cursos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cursos_delete" ON cursos FOR DELETE USING (true);

-- 4. ESTUDIANTES
DROP POLICY IF EXISTS "estudiantes_select" ON estudiantes;
DROP POLICY IF EXISTS "estudiantes_insert" ON estudiantes;
DROP POLICY IF EXISTS "estudiantes_update" ON estudiantes;
DROP POLICY IF EXISTS "estudiantes_delete" ON estudiantes;

CREATE POLICY "estudiantes_select" ON estudiantes FOR SELECT USING (true);
CREATE POLICY "estudiantes_insert" ON estudiantes FOR INSERT WITH CHECK (true);
CREATE POLICY "estudiantes_update" ON estudiantes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "estudiantes_delete" ON estudiantes FOR DELETE USING (true);

-- 5. MATRICULAS
DROP POLICY IF EXISTS "matriculas_select" ON matriculas;
DROP POLICY IF EXISTS "matriculas_insert" ON matriculas;
DROP POLICY IF EXISTS "matriculas_update" ON matriculas;
DROP POLICY IF EXISTS "matriculas_delete" ON matriculas;

CREATE POLICY "matriculas_select" ON matriculas FOR SELECT USING (true);
CREATE POLICY "matriculas_insert" ON matriculas FOR INSERT WITH CHECK (true);
CREATE POLICY "matriculas_update" ON matriculas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "matriculas_delete" ON matriculas FOR DELETE USING (true);

-- 6. CLASES
DROP POLICY IF EXISTS "clases_select" ON clases;
DROP POLICY IF EXISTS "clases_insert" ON clases;
DROP POLICY IF EXISTS "clases_update" ON clases;
DROP POLICY IF EXISTS "clases_delete" ON clases;

CREATE POLICY "clases_select" ON clases FOR SELECT USING (true);
CREATE POLICY "clases_insert" ON clases FOR INSERT WITH CHECK (true);
CREATE POLICY "clases_update" ON clases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "clases_delete" ON clases FOR DELETE USING (true);

-- 7. PAGOS
DROP POLICY IF EXISTS "pagos_select" ON pagos;
DROP POLICY IF EXISTS "pagos_insert" ON pagos;
DROP POLICY IF EXISTS "pagos_update" ON pagos;
DROP POLICY IF EXISTS "pagos_delete" ON pagos;

CREATE POLICY "pagos_select" ON pagos FOR SELECT USING (true);
CREATE POLICY "pagos_insert" ON pagos FOR INSERT WITH CHECK (true);
CREATE POLICY "pagos_update" ON pagos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pagos_delete" ON pagos FOR DELETE USING (true);

-- ✅ RESULTADO: Todos los CRUD ahora funcionarán
```

---

## 🔨 MIGRACION_TUTORES_DIAS_TURNO (EJECUTA SEGUNDO)

```sql
-- ============================================
-- AGREGAR COLUMNA 'dias_turno' A TUTORES
-- Almacena un mapeo JSON: { "Lun": "Tarde", "Mar": "Noche", ... }
-- ============================================

ALTER TABLE tutores
ADD COLUMN IF NOT EXISTS dias_turno TEXT DEFAULT NULL;

-- Verificación (ejecuta si quieres confirmar):
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tutores' AND column_name = 'dias_turno';
```

---

## 📋 CHECKLIST

- [ ] Abriste: https://supabase.com
- [ ] Entraste al proyecto Linguistika
- [ ] Fuiste a: SQL Editor
- [ ] Pegaste script FIX_RLS_POLICIES
- [ ] Hiciste Click "Run"
- [ ] Esperaste: "Executed successfully"
- [ ] Pegaste script MIGRACION_TUTORES_DIAS_TURNO
- [ ] Hiciste Click "Run"
- [ ] Esperaste: "Executed successfully"
- [ ] Recargaste la App (F5)
- [ ] Probaste crear un nuevo docente ✓

---

## ❌ TROUBLESHOOTING

### Si aparece error al ejecutar SQL:

**Error: "column tutores.dias_turno already exists"**
- ✓ OK! Significa que ya ejecutaste la migración antes. Continúa.

**Error: "permission denied"**
- Verifica que estés logeado en Supabase como proyecto owner
- No uses conexión "Anonymous" - debe ser "Service Role"

**Error: "syntax error"**
- Copia exactamente desde aquí (sin líneas previas)
- Asegúrate que no incluyas lineas comentario (#)
- Usa Ctrl+A para seleccionar todo en el editor antes de pegar

---

## 🎯 DESPUÉS DE EJECUTAR

**En la App:**
1. Abre `LInguistika-Studio`
2. Click "Nuevo Docente"
3. Completa: Nombre, Teléfono, Especialidad, Tarifa
4. Marca: Lunes, Miércoles, Viernes
5. **NUEVO:** Para cada día, elige Tarde o Noche
6. Click "Guardar"
7. ✓ Debe guardarse sin error

**En Supabase (verificación):**
1. Tabla `tutores`
2. Busca el docente creado
3. Columna `dias_turno` debe mostrar: `{"Lunes":"Tarde","Miércoles":"Noche",...}`

---

## 📞 SOPORTE

Si aparece error `42501` o `PGRST204`:
1. Recarga la página (F5)
2. Abre DevTools (F12) → Console
3. Copia el error exacto
4. Verifica que ejecutaste AMBOS scripts SQL

Si `500 Internal Server Error`:
- Probablemente RLS no se aplicó correctamente
- Ejecuta FIX_RLS_POLICIES nuevamente en Supabase
- Recarga app (F5)
