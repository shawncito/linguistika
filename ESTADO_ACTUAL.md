# 📊 ESTADO ACTUAL DEL PROYECTO - LINGUISTIKA

## ✅ ACTUALIZACIÓN VIGENTE (v0.4)

**Fecha:** 9 de marzo de 2026  
**Rama:** `v0.4`  
**Estado general:** Estabilización y optimización de rendimiento (Dashboard)

### Resumen de avance reciente
- Se optimizó la carga de `Dashboard` para reducir tiempo inicial.
- Se eliminó patrón N+1 en frontend para sesiones del día y del mes.
- Se implementó endpoint por rango para estados de clases:
  - `GET /api/dashboard/estados-clases-rango`
- Se consolidó lectura de estados (`avisado`, `confirmado`, `estado_sesion`) en una sola llamada mensual.

### Archivos tocados en esta fase
- `backend/routes/dashboard.js`
- `LInguistika-Studio/services/api.ts`
- `LInguistika-Studio/views/Dashboard.tsx`
- `CHANGELOG.md`

### Impacto esperado
- Menos requests al abrir Dashboard.
- Menor carga en backend/Supabase durante render inicial.
- Mejor experiencia percibida al entrar a la vista principal.

### Pendiente técnico identificado
- El `typecheck` global del frontend presenta errores preexistentes en:
  - `LInguistika-Studio/views/Pagos.tsx`
- Esto no bloquea la mejora de rendimiento del Dashboard, pero sí es recomendable corregirlo antes de una release estable.

---

**Fecha:** 22 de enero de 2026  
**Rama:** master  
**Estado:** En desarrollo (Feature: Asignación de Tutores a Cursos)

---

## ✅ LO QUE SE COMPLETÓ

### **1. Sistema de Asignación de Tutores a Cursos**

#### **Base de Datos**
- ✅ Columna `cursos.tutor_id` creada en Supabase
- ✅ Foreign key constraint: `cursos_tutor_id_fkey`
- ✅ Migraciones SQL ejecutadas exitosamente

#### **Backend**

**Nuevos Archivos:**
- `backend/utils/scheduleValidator.js` - Utilidad para validar compatibilidad horario tutor-curso
  - Funciones: `validateTutorCourseSchedule()`, `canAssignTutorToCourse()`, `timeToMinutes()`
  - Compara `tutores.dias_horarios` vs `cursos.dias_schedule`

**Rutas Actualizadas:**
- `backend/routes/cursos.js`
  - POST /: Valida tutor_id contra disponibilidad (bloquea con 409 si incompatible)
  - PUT /:id: Guarda y actualiza tutor_id
  - GET /: Retorna tutor_id en respuesta
  - Importa: scheduleValidator.js

- `backend/routes/matriculas.js`
  - POST /: Valida compatibilidad tutor-curso antes de crear matrícula
  - GET /validate/tutor-course/:tutor_id/:curso_id: Nuevo endpoint para validación en tiempo real
  - Bloquea creación con 409 si hay conflicto de horarios

- `backend/routes/tutores.js`
  - Acepta y persiste `dias_horarios` (Object con horas específicas por día)
  - Migramos de `dias_turno` (Tarde/Noche genérico) a `dias_horarios` (horas específicas)

#### **Frontend - TypeScript**
- ✅ `types.ts`: Interface `Tutor` actualizada
  - `dias_horarios?: Record<string, { hora_inicio: string; hora_fin: string }>`
  - Tipo: `horario_tipo?: 'personalizado' | 'predefinido'`

#### **Frontend - Servicios API**
- ✅ `services/api.ts`: 
  - Nuevo método `matriculas.validateTutorCourse(tutor_id, curso_id)`
  - Llamada GET a `/matriculas/validate/tutor-course/:tutor_id/:curso_id`

#### **Frontend - Vistas**

**Tutores.tsx** - COMPLETAMENTE REDISEÑADO
- ✅ Nuevo formulario con inputs de tiempo (HH:MM) para cada día
- ✅ Estado: `dias_horarios` (Object en lugar de `dias_turno`)
- ✅ Validación: Requiere hora_inicio y hora_fin para cada día seleccionado
- ✅ Display: Muestra horarios en formato "Lun 09:00 - 11:00" en tarjetas
- ✅ Edición: Precarga dias_horarios existentes al editar tutor

**Cursos.tsx** - MEJORADO
- ✅ Dropdown "Asignar Tutor (opcional)" en formulario de creación
- ✅ Tutor selector carga lista completa de tutores
- ✅ Persiste tutor_id en POST y PUT
- ✅ Display: Badge índigo con nombre del tutor en tarjetas de cursos
- ✅ Validación: Previene crear curso con tutor incompatible (409 error)

**Matriculas.tsx** - CON VALIDACIÓN
- ✅ Mantiene validación local y del servidor
- ✅ Función `validateTutorCourseOnServer()` para validación en tiempo real
- ✅ Despliega estado de compatibilidad (verde si compatible, ámbar si no)

**Dashboard.tsx** - ACTUALIZADO
- ✅ Muestra tutor en resumen de matrículas

---

## 🔄 CAMBIOS RECIENTES

### **Última Modificación:**
```
Cambio: Tutores.tsx - Reemplazar inputs de turno genérico por inputs de tiempo específico
Fecha: 22 de enero, 2026
Archivos modificados:
  - LInguistika-Studio/views/Tutores.tsx (completo)
  - LInguistika-Studio/types.ts (Interface Tutor)
  - LInguistika-Studio/services/api.ts (ya estaba listo)
```

### **Compilación:**
- ✅ Frontend buildea sin errores: `npm run build` = 378.35 kB
- ✅ Backend compila correctamente con Node.js --watch

### **Servidores:**
- ✅ Backend: http://localhost:5000 (conectado a Supabase)
- ✅ Frontend: http://localhost:3000 (Vite dev server)

---

## 🚀 LO QUE FALTA

### **1. Testing End-to-End (CRÍTICO)**
- ❌ Crear tutores con horarios específicos en la UI
- ❌ Crear alumnos
- ❌ Crear curso COMPATIBLE con tutor (validar que funciona)
- ❌ Intentar crear curso INCOMPATIBLE (validar que bloquea con 409)
- ❌ Crear matrícula grupal (validar grupo con 2+ alumnos)
- ❌ Verificar datos en Supabase (todas las tablas)

### **2. Validaciones Adicionales (OPCIONAL)**
- 🟡 Mejorar mensajes de error (más descriptivos)
- 🟡 Agregar validación de solapamiento de horarios (si dos bloques se cruzan)
- 🟡 Test de casos edge (horarios de medianoche, cambios de día, etc.)

### **3. UI/UX Mejoras (POLISH)**
- 🟡 Loading states en formularios
- 🟡 Confirmación visual después de guardar
- 🟡 Tooltip explicativo sobre compatibilidad de horarios
- 🟡 Historial de cambios en matrículas (quién cambió qué)

### **4. Documentación (PENDING)**
- 🟡 Documentar casos de uso de validación horaria
- 🟡 Guía para administrador sobre asignación de tutores
- 🟡 Schema SQL con comentarios

---

## 📋 RESUMEN TÉCNICO

| Componente | Estado | Notas |
|-----------|--------|-------|
| DB: cursos.tutor_id | ✅ Listo | FK a tutores.id, ON DELETE SET NULL |
| Backend validation | ✅ Listo | scheduleValidator.js implementado |
| Backend routes | ✅ Listo | cursos, matriculas, tutores actualizados |
| Frontend types | ✅ Listo | Tutor.dias_horarios: Object<string, time> |
| Frontend: Tutores.tsx | ✅ Listo | Inputs de tiempo HH:MM por día |
| Frontend: Cursos.tsx | ✅ Listo | Tutor dropdown + badge display |
| Frontend: Matriculas.tsx | ✅ Listo | Validación tutor-curso |
| **Testing** | 🟡 PARCIAL | Roundtrip automatizado por script + validación en UI pendiente |
| **Documentación** | 🟡 PARCIAL | ESTADO_ACTUAL.md + guías varias |

---

## 🎯 PRÓXIMOS PASOS

1. **Ejecutar roundtrip automatizado (API + Auth + grupos + sesiones + movimientos):**
  - Desde `backend\`:
    - `powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CheckPagoPhase`
  - El script genera un `RunTag` y guarda state en `.roundtrip-state.json`.
  - Por defecto deja los datos creados (listos para validar UI y la fase de pagos).

2. **Limpieza (cuando termines de probar):**
  - `powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CleanupOnly`

3. **Validar en Supabase:**
  - Tabla `tutores`: registros con `dias_horarios` JSON correcto
  - Tabla `cursos`: curso con `tutor_id` asignado
  - Tablas de grupo/sesiones/movimientos: se crean al completar sesión

4. **Siguiente fase: Pagos**
  - Requiere usuario con rol `admin` o `contador`.
  - Validar acceso a endpoints:
    - `GET /api/pagos`
    - `GET /api/finanzas/movimientos` (puede requerir `SUPABASE_SERVICE_KEY` en backend)

3. **Capturar evidencia:**
   - Screenshots de UI (Tutores, Cursos, Matrículas)
   - Intento fallido con error 409
   - Query de Supabase mostrando datos

---

## 📌 NOTAS IMPORTANTES

- **Cambio importante:** De `dias_turno` (texto) a `dias_horarios` (JSON con horas exactas)
  - Backend soporta ambos pero frontend ahora usa `dias_horarios`
  - Tutores antiguos sin `dias_horarios` deberán ser re-configurados

- **Validación horaria:** Compara rangos de tiempo exactos (minuto a minuto)
  - Si tutor disponible Lunes 09:00-11:00 y curso Lunes 10:00-12:00 = COMPATIBLE (overlap)
  - Si tutor disponible Lunes 09:00-11:00 y curso Lunes 11:00-13:00 = NO compatible (no hay overlap)

- **Blocking behavior:**
  - Crear curso con tutor incompatible = HTTP 409 Conflict
  - Crear matrícula con tutor incompatible = HTTP 409 Conflict

---

**Generado:** 22/01/2026 - Estado previo a testing
