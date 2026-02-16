# 📦 Changelog - Versión 0.2.0-alpha

**Fecha de lanzamiento:** 16 de febrero de 2026  
**Rama:** `pago` → `master`  
**Estado:** Alpha - En desarrollo activo

---

## 🎯 Cambios Principales

### ✨ Nueva Funcionalidad: Tesorería

#### Módulo de Tesorería v2 (Trabajo en Progreso)
- **Pantalla principal de Tesorería** con 4 secciones:
  - **Totales rápidos**: Dinero actual, deuda pendiente, saldo a favor, por pagar a tutores
  - **Libro auxiliar**: Historial completo de movimientos con filtros por fecha
  - **Cobros grupales**: Registro de deuda por grupo sin procesar pagos
  - **Bolsa real**: Visualización del flujo de efectivo real

#### Sistema de Cobro Grupal Simplificado
- ✅ Modal simplificado para registrar deuda de grupos completos
- ✅ Muestra precio por estudiante y total del grupo
- ✅ Registra deuda con estado `pendiente` (NO completado)
- ✅ Compatible con estudiantes bulk (sin encargado/perfil completo)
- ✅ Actualización automática de totales tras cobro exitoso

#### Backend de Tesorería
- **Nuevas tablas**:
  - `tesoreria_cuentas_corrientes`: Cuentas por encargado/tutor
  - `tesoreria_obligaciones`: Deudas esperadas por sesión
  - `tesoreria_pagos`: Pagos reales con evidencia
  - `tesoreria_aplicaciones`: Vinculación obligación-pago
- **Nuevas vistas**:
  - `tesoreria_saldos_encargados_v1`: Deuda y saldo por encargado
  - `tesoreria_saldos_tutores_v1`: Deuda pendiente a tutores
  - `tesoreria_libro_diario_v1`: Movimientos con detalle completo
- **Endpoints implementados**:
  - `GET /tesoreria/bolsa`: Dinero real en bolsa
  - `GET /tesoreria/resumen`: Totales rápidos (deuda, saldo, por pagar)
  - `GET /tesoreria/libro`: Libro auxiliar con filtros de fecha
  - `POST /tesoreria/grupos/:id/cobro`: Cobro grupal simplificado
  - `GET /bulk/grupos`: Lista grupos con precios de curso

#### Correcciones Críticas
- ✅ **Dinero actual** ahora usa `tesoreria_pagos` (antes usaba `movimientos_dinero`)
- ✅ Cobros grupales suman correctamente a deuda pendiente
- ✅ Eliminado FK `matricula_id` de cobro grupal (causaba error 500)
- ✅ Vista encargados ahora incluye deudas de cobro grupal
- ✅ Modal de detalle centrado con backdrop (ya no se solapa)
- ✅ Removida columna "Saldo" innecesaria del libro auxiliar
- ✅ Enlaces de PDF/imagen abren directamente (sin redirect a Google)

---

### 🔐 Mejoras en Login

- ✅ **Dropdown de correos guardados** con contraste mejorado (gradiente azul)
- ✅ Eliminado llamado a API que causaba error 401 en login
- ✅ Emails ahora se cargan solo de `localStorage`
- ✅ Autocompletado mejorado para usuarios recurrentes

---

### 👥 Mejoras en Empleados

- ✅ Lista de empleados ahora muestra **correos** en vez de UUIDs
- ✅ Backend incluye mapeo de `user_id → email` desde `auth.users`
- ✅ Filtros y búsqueda mejorados en pantalla de empleados

---

### 📊 Ajustes en Backend

#### Rutas actualizadas
- `backend/routes/tesoreria.js`: Nueva ruta completa para tesorería
- `backend/routes/bulk.js`: Endpoints actualizados con `costo_curso` y `pago_tutor`
- `backend/routes/admin.js`: Incluye email mapping para usuarios

#### Migraciones SQL
- `017_tesoreria_v2_cuentas_obligaciones_pagos.sql`: Base del sistema v2
- `018_tesoreria_v2_pago_tutor_bolsa_y_esperado.sql`: Lógica de tutores
- `019_tesoreria_cierres_mensuales.sql`: Cierre mensual de cursos
- `020-022`: Funciones avanzadas (adelantos, recuperos, selección de fuente)
- `UPDATE_VISTA_DEUDAS_MOVIMIENTOS.sql`: Fix para incluir cobros grupales

#### Middleware
- `activityLog.js`: Registro de actividad de usuarios (framework para auditoría)

---

### 🐛 Correcciones de Bugs

1. **Campo `tipo_movimiento` → `tipo`**: Corregido en queries de `movimientos_dinero`
2. **Modal overlapping**: Centrado con `backdrop` para no solaparse con tabla
3. **FK violation en cobro grupal**: Eliminado `matricula_id` que no aplica a bulk
4. **Precios en ₡0**: Cambio de `precio_mensual/precio_hora` a `costo_curso/pago_tutor`
5. **Deuda no actualizando**: Vista ahora lee cobros grupales de `movimientos_dinero`

---

## 📁 Archivos Nuevos

### Frontend
- `LInguistika-Studio/views/Tesoreria.tsx`: Pantalla completa de tesorería
- `LInguistika-Studio/components/ActivityLogDrawer.tsx`: Drawer de logs (WIP)
- `LInguistika-Studio/components/PasswordConfirmDialog.tsx`: Diálogo de confirmación
- `LInguistika-Studio/lib/usePersistentState.ts`: Hook personalizado para estado persistente

### Backend
- `backend/routes/tesoreria.js`: API completa de tesorería
- `backend/routes/activity.js`: Endpoint para logs de actividad
- `backend/middleware/activityLog.js`: Middleware de auditoría
- `backend/utils/tesoreria/`: Utilidades de tesorería (registros, cálculos)
- `backend/UPDATE_VISTA_DEUDAS_MOVIMIENTOS.sql`: Actualización crítica de vista

### Documentación
- `docs/TESORERIA_V2.md`: Especificación completa del sistema
- `docs/TESORERIA_V2_CONTABILIDAD_ESTRICTA.md`: Reglas de contabilidad
- `docs/GUIA_USUARIO_COMPLETA.md`: Manual de usuario actualizado
- `docs/ROUNDTRIP_STRESS_SUITE.md`: Suite de pruebas de estrés

---

## 🔧 Archivos Modificados

### Frontend (17 archivos)
- `App.tsx`, `types.ts`, `services/api.ts`: Nuevos tipos y endpoints
- Todas las vistas principales actualizadas con tipos TypeScript mejorados
- `Login.tsx`: Mejoras en UX y corrección de error 401
- `components/UI.tsx`: Componentes reutilizables actualizados

### Backend (10 archivos)
- `server.js`, `supabase.js`: Configuración actualizada
- `routes/*.js`: 8 rutas actualizadas con nuevos endpoints
- `middleware/auth.js`: Mejoras en autenticación

### Configuración
- `package.json`: Scripts de desarrollo y build actualizados
- `desktop/main.cjs`, `desktop/preload.cjs`: Configuración Electron
- `roundtrip.ps1`: Script de pruebas de stress actualizado

---

## ⚠️ Limitaciones Conocidas (Alpha)

1. **Tesorería incompleta**: 
   - Falta módulo de pagos individuales
   - No hay reconciliación de pagos con deudas
   - Dashboard no integra tesorería v2
   
2. **Validaciones pendientes**:
   - No hay validación de duplicados en cobro grupal
   - Falta manejo de errores en conciliación
   
3. **Performance**:
   - Libro auxiliar sin paginación (potencial lentitud con muchos registros)
   - Vistas SQL pueden requerir optimización con datos reales

---

## 🚀 Próximos Pasos (v0.3.0)

### Prioridad Alta
- [ ] Completar módulo de pagos individuales
- [ ] Implementar aplicación de pagos a deudas
- [ ] Integrar métricas de tesorería en Dashboard
- [ ] Paginación en libro auxiliar

### Prioridad Media
- [ ] Reportes de tesorería (PDF/Excel)
- [ ] Notificaciones de deudas vencidas
- [ ] Calculadora de cambio en cobros

### Prioridad Baja
- [ ] Histórico de cambios en deudas
- [ ] Reconciliación bancaria
- [ ] Multi-moneda

---

## 📝 Notas Técnicas

### Base de Datos
- Se mantiene compatibilidad con `movimientos_dinero` (legacy)
- Sistema v2 usa `tesoreria_*` tables (nuevo)
- Transición gradual: ambos sistemas coexisten

### Migraciones
- **Crítico**: Ejecutar migraciones 017-023 en orden
- **Opcional**: `UPDATE_VISTA_DEUDAS_MOVIMIENTOS.sql` para fix de deuda grupal

### Build
- Versión Electron: 34.1.1
- Vite: 6.4.1
- Node requerido: >=18.0.0

---

## 🏗️ Instalación

### Desarrollo
```powershell
# Instalar dependencias
npm install
cd backend && npm install
cd ../LInguistika-Studio && npm install

# Ejecutar en modo desarrollo
npm run desktop:dev
```

### Producción
```powershell
# Generar instalador
npm run desktop:build

# Resultado en: release/Linguistika Setup 0.2.0-alpha.exe
```

---

## 👥 Contribución

**Desarrollador principal**: Copilot AI + Usuario  
**Framework**: Electron + React + Express + Supabase  
**Estado del proyecto**: Alpha - En desarrollo activo  

---

**Última actualización**: 16 de febrero de 2026  
**Siguiente hito**: v0.3.0 - Tesorería completa + Dashboard integrado
