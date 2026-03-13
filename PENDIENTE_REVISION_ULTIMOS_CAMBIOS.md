# Pendiente de revision - ultimos cambios

Fecha de corte: 2026-03-12
Rama base de trabajo: v.0.0.5

## Objetivo de este documento
Dejar trazabilidad para retomar la validacion funcional en la siguiente sesion sin perder contexto.

## Cambios ya implementados (codigo)
- Notas internas por tutor en dashboard (CRUD + historial + realtime).
- Restriccion de notas a roles de empleado.
- Fallback de estudiantes cuando falta columna `edad`.
- Persistencia segura de `tarifa_por_hora` en tutores (no nula).
- Modales de creacion portalizados y centrados en:
  - Tutores
  - Estudiantes
  - Matriculas
  - Cursos
- Mejoras de cache/realtime y ajustes de UI/transiciones.
- Exportacion de calendario mensual a Excel/PDF.
- Migracion creada: `backend/migrations/025_add_tutor_notes_and_history.sql`.

## Verificaciones tecnicas ya realizadas
- Frontend `npm run typecheck`: OK.
- Diagnosticos de archivos editados: sin errores.
- Import/smoke check backend dashboard/notas: OK.
- Tablas/columnas de notas en Supabase activo: OK.

## Revision funcional pendiente (manual)

### 1) Flujo crear Tutor
- Abrir pantalla Tutores.
- Abrir modal "Nuevo tutor".
- Verificar centrado y marco del modal.
- Crear tutor sin definir tarifa.
- Resultado esperado: no debe fallar por `tarifa_por_hora` nula.

### 2) Flujo crear Estudiante
- Abrir pantalla Estudiantes.
- Abrir modal "Nuevo estudiante".
- Verificar centrado y marco del modal.
- Crear estudiante en entorno donde DB pueda no tener `edad`.
- Resultado esperado: no debe fallar por columna `edad` faltante.

### 3) Flujo crear Matricula
- Abrir pantalla Matriculas.
- Abrir modal "Nueva matricula".
- Verificar centrado y marco del modal.
- Crear matricula individual y, si aplica, grupal.

### 4) Flujo crear Curso
- Abrir pantalla Cursos.
- Abrir modal "Nuevo curso".
- Verificar centrado y marco del modal.
- Crear curso con horario valido.

### 5) Flujo notas internas en Dashboard
- Seleccionar tutor en dashboard.
- Crear nota interna.
- Editar nota.
- Marcar nota hecha y reabrir.
- Eliminar nota.
- Ver historial y actor.
- Resultado esperado: cambios visibles en realtime y auditables.

### 6) Permisos de notas (roles)
- Validar acceso con rol empleado permitido.
- Validar denegacion con rol no permitido.

## Riesgos abiertos / observaciones
- Hay cambios amplios en Dashboard y Hooks; requiere prueba manual de regresion de navegacion y rendimiento.
- El archivo eliminado `LInguistika-Studio/views/Importaciones.tsx` debe validarse funcionalmente contra menu/rutas vigentes para confirmar que no era requerido en esta version.

## Comandos utiles para retomar
- Frontend typecheck:
  - `cd LInguistika-Studio`
  - `npm run typecheck`
- Backend smoke (módulos dashboard):
  - `cd backend`
  - `node -r dotenv/config -e "await import('./src/features/dashboard/dashboard.routes.mjs'); await import('./src/features/dashboard/dashboard.controller.mjs'); await import('./src/features/dashboard/dashboard.repository.mjs'); console.log('backend dashboard modules ok')"`

## Criterio de cierre de esta pendiente
Se considera cerrada cuando los 6 bloques de revision manual se validen sin errores de negocio ni de UI.
