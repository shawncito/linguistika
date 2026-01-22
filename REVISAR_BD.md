# 🔍 REVISIÓN DE BASE DE DATOS

## Estado Actual del Curso Creado

**Curso: "Frances"**

### Lo que DEBE estar correcto:

1. **Tabla `cursos`**
   - ✅ `nombre`: "Frances"
   - ✅ `nivel`: "None"
   - ✅ `tipo_clase`: "Grupal"
   - ✅ `tutor_id`: ID de María García
   - ❓ `dias_schedule`: Debe ser JSON con estructura como:
     ```json
     {
       "Lunes": {
         "hora_inicio": "14:00",
         "hora_fin": "18:00",
         "duracion_horas": 4
       }
     }
     ```
   - ❌ `dias_turno`: Debe estar VACIO o NULL (ya no lo usamos)

2. **Tabla `tutores`**
   - ✅ `nombre`: "Maria García"
   - ✅ `dias_horarios`: Debe ser JSON con estructura como:
     ```json
     {
       "Lunes": {
         "hora_inicio": "09:00",
         "hora_fin": "11:00"
       },
       "Miércoles": {
         "hora_inicio": "14:00",
         "hora_fin": "16:00"
       }
     }
     ```

3. **Tabla `matriculas`**
   - Si creaste matrículas, deben tener:
     - ✅ `tutor_id`: ID correcto
     - ✅ `curso_id`: ID del curso
     - ✅ `estudiante_id` o grupo de estudiantes

---

## PASOS PARA VERIFICAR EN SUPABASE:

### 1️⃣ Ver el curso creado
```sql
SELECT id, nombre, tipo_clase, tutor_id, dias_schedule, dias_turno 
FROM cursos 
WHERE nombre = 'Frances';
```

**Esperado:**
- `dias_schedule`: JSON con horas (ej: `{"Lunes": {"hora_inicio": "14:00", ...}}`)
- `dias_turno`: NULL o vacío {}

### 2️⃣ Ver el tutor María García
```sql
SELECT id, nombre, dias_horarios, dias_turno 
FROM tutores 
WHERE nombre = 'Maria García';
```

**Esperado:**
- `dias_horarios`: JSON con estructura correcta
- `dias_turno`: NULL o vacío {} (ahora no se usa)

### 3️⃣ Ver si hay conflictos
Si creaste dos cursos (uno compatible y uno incompatible):
```sql
SELECT id, nombre, tutor_id, dias_schedule 
FROM cursos 
WHERE tutor_id IS NOT NULL 
ORDER BY created_at DESC;
```

---

## ✅ LISTA DE VERIFICACIÓN

- [ ] El curso "Frances" tiene `dias_schedule` como JSON (no `dias_turno`)
- [ ] María García tiene `dias_horarios` con horas específicas
- [ ] Si creaste un segundo curso incompatible, NO debería estar en la BD (error 409)
- [ ] Las horas del curso NO solapan con las del tutor (validación correcta)

---

## 🚀 SI TODO ESTÁ BIEN:

El sistema está listo para:
1. Crear tutores con horas específicas ✅
2. Crear cursos con horas específicas ✅
3. Validar automáticamente que tutor y curso sean compatibles ✅
4. Bloquear creación si hay conflicto ✅

**Puedes volver a intentar crear cursos y la validación debería funcionar correctamente.**

