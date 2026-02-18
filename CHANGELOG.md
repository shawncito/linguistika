# Changelog - Sistema Linguistika

## [2026-01-26] - Mejoras UI - Logos, Calendarios y Refactorización de Layouts

### 🎯 Resumen
Implementación de logos personalizados, calendario interactivo en Dashboard, reorganización de sidebars y corrección de errores de JSX/TypeScript en todas las vistas principales.

---

### ✨ Nuevas Funcionalidades

#### 1. **Logos SVG Personalizados**
- **Archivos**:
  - `public/logo-icon.svg` - Icono con sonrisa dividida (amarillo/cyan)
  - `public/logo-horizontal.svg` - Logo completo con branding "Linguistika UNADECA Language Center"
- **Integración**:
  - Login: Logo 24x24
  - App Header: Logo 12x12 con texto "Lingüistika" en text-lg
  - Mejor espaciado y presentación visual

#### 2. **Calendario Mensual en Dashboard**
- **Características**:
  - Widget de calendario interactivo con grid mensual
  - Indicadores visuales:
    - Día actual: fondo cyan
    - Día seleccionado: fondo amarillo
    - Días con clases: punto verde (Lunes-Sábado)
  - Función `getDiaSemana()` para calcular nombres de días
  - Selección de fechas para filtrar sesiones

#### 3. **Tipo TypeScript Extendido**
- `MatriculaConGrupo` en Matriculas.tsx:
  ```typescript
  type MatriculaConGrupo = Matricula & { 
    students?: { id: number; nombre: string }[] 
  };
  ```

---

### 🎨 Mejoras de UI/UX

#### Dashboard
- **Sesiones de Hoy** movidas a sidebar derecho
- Diseño compacto en cards con scroll
- Calendario prominente antes de estadísticas generales
- Botones "Marcar Dada" y "Cancelar Hoy" en cada sesión

#### Estudiantes
- **Sidebar reposicionado a la izquierda**
- Layout: sidebar 30% + contenido flex-1
- Mejor flujo visual de izquierda a derecha

#### Tutores
- Sidebar izquierdo con filtros y resumen rápido
- **Resumen docente eliminado** del sidebar derecho
- Márgenes ajustados: `space-y-6` en sidebar, `space-y-10` en contenido
- Aside vacío eliminado

#### Cursos
- Filtros y KPIs en sidebar izquierdo
- Tema oscuro: `bg-[#0F2445]`, `border-white/10`
- Cards con métricas en grid 2 columnas

#### Matriculas
- Sidebar con 5 KPIs en grid 2 columnas
- Layout responsivo: `flex-col lg:flex-row`
- Componentes Card importados correctamente

---

### 🐛 Correcciones de Errores

#### JSX/Sintaxis
- **Cursos.tsx**: Error "Unterminated JSX contents"
  - Eliminado fragmento `<>` huérfano
  - Reestructurado condicional `viewMode` con cierre correcto

#### TypeScript
- **Tutores.tsx**: 
  - Tipo `horario_tipo` cambiado a `"personalizado" | "predefinido"`
  - Eliminado `</div>` extra (línea 810)
  
- **Matriculas.tsx**:
  - Creado tipo `MatriculaConGrupo` para propiedad `students`
  - Agregados imports: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
  - Cast de `displayMatriculas` a tipo correcto

#### Espaciado y Márgenes
- Tutores: `lg:w-[32%]` → `w-[30%]`
- Tutores: `space-y-4` → `space-y-6` en sidebar
- Consistencia en gaps: `flex gap-6` en todas las vistas

---

### 📐 Patrones de Diseño Establecidos

#### Paleta de Colores
- Canvas: `#051026`
- Surface: `#0F2445`
- Primary: `#00AEEF` (cyan)
- Accent: `#FFC800` (amarillo)
- Borders: `white/10`

#### Layout Standard
```tsx
<div className="flex gap-6">
  <aside className="w-[30%] space-y-6 sticky top-24 self-start">
    {/* Filtros y métricas */}
  </aside>
  <div className="flex-1 space-y-10">
    {/* Contenido principal */}
  </div>
</div>
```

## v0.3.0-alpha

- Fecha: 2026-02-17
- Resumen: Integración del `Desglose de clases` en la tarjeta principal de Tesorería, carga automática de obligaciones al seleccionar encargado, y normalización de la API de bolsa. Ver `RELEASE_v0.3.0-alpha.md` para detalles.


#### Cards Oscuras
- `bg-[#0F2445]`
- `border-white/10`
- `hover:border-[#00AEEF]/30`
- `hover:shadow-cyan-500/20`

---

### 📋 Pendiente

#### Alta Prioridad
- [ ] Validar responsividad en móviles
- [ ] Testing de calendario con datos reales
- [ ] Probar funciones "Marcar Dada" / "Cancelar Hoy"
- [ ] Verificar carga de logos en producción

#### Media Prioridad
- [ ] Optimizar rendimiento de filtros
- [ ] Animaciones de transición
- [ ] Estados de carga (skeletons)
- [ ] Documentación de componentes

#### Mejoras Técnicas
- [ ] Hook personalizado para calendario
- [ ] Tipos compartidos (evitar duplicación)
- [ ] Tests unitarios
- [ ] Code splitting

---

## [2026-01-22] - Herramienta de Migración y Mejoras de Dashboard

### 🎯 Resumen
Se implementó una herramienta completa de migración para modificar la base de datos directamente desde Node.js, junto con múltiples mejoras al sistema de sesiones del dashboard.

---

### ✨ Nuevas Funcionalidades

#### 1. **Herramienta de Migración (`migrate.js`)**
- **Archivo**: `backend/migrate.js`
- **Propósito**: Explorar y modificar la base de datos Supabase directamente
- **Funciones disponibles**:
  - `verEstructura()` - Ver estructura completa de todas las tablas
  - `verTabla(nombre, limite)` - Ver contenido de una tabla específica
  - `verFilasPor(tabla, columna, valor)` - Filtrar registros específicos
  - Operaciones CRUD directas con `supabase.from('tabla').insert/update/delete`

**Cómo usar**:
```bash
# 1. Descomentar operaciones en migrate.js
# 2. Ejecutar:
cd backend
node migrate.js
```

#### 2. **Sistema de Sesiones del Dashboard**
- **Endpoints de acciones**:
  - `POST /api/dashboard/sesion/:matriculaId/:fecha/completar` - Marcar sesión como dada
  - `POST /api/dashboard/sesion/:matriculaId/:fecha/cancelar-dia` - Cancelar sesión específica
  - `POST /api/dashboard/sesion/:matriculaId/cancelar-permanente` - Desactivar matrícula

- **Generación automática de movimientos financieros**:
  - Al completar una sesión, se generan 2 registros en `movimientos_dinero`:
    - `ingreso_estudiante` - Monto que debe pagar el estudiante
    - `pago_tutor_pendiente` - Monto que se le debe al tutor

#### 3. **Endpoints de Debug (Sin autenticación)**
- `GET /api/dashboard/debug/matriculas-cursos` - Ver matrículas activas con sus cursos
- `GET /api/dashboard/debug/cursos` - Listar todos los cursos con estado
- `GET /api/dashboard/debug/dia-semana/:fecha` - Calcular día de la semana
- `GET /api/dashboard/debug/sesiones-debug/:fecha` - Calcular sesiones detalladas
- `POST /api/dashboard/debug/fix-matriculas` - Corregir referencias de cursos

#### 4. **Endpoint de Fecha del Servidor**
- `GET /api/server-date` - Devuelve fecha actual en zona horaria de Costa Rica (UTC-6)
- Formato: `{ date: '2026-01-22', timestamp: 1737532800000, timezone: 'America/Costa_Rica (UTC-6)' }`

---

### 🔧 Mejoras Implementadas

#### **Backend**

##### `dashboard.js`
- ✅ **Cálculo de sesiones desde matrículas activas**: Las sesiones ahora se calculan dinámicamente desde matrículas con `estado=true`
- ✅ **Fallback inteligente**: Si no hay registros en `clases`, el sistema calcula sesiones desde los horarios del curso
- ✅ **Filtrado por día de la semana**: Solo muestra sesiones para el día correcto según `dias_schedule`
- ✅ **Normalización de horas**: Convierte formato HH:MM a HH:MM:SS para inserción en PostgreSQL
- ✅ **Cálculo de duración**: Computa `duracion_horas` automáticamente desde hora_inicio/hora_fin

##### `tutores.js`
- ✅ **Eliminado JSON.parse innecesario**: Las columnas `jsonb` ya llegan como objetos desde Supabase
- ✅ **Default para tarifa_por_hora**: Agrega valor por defecto (0) para cumplir constraint NOT NULL
- ✅ **Manejo nativo de jsonb**: Envía objetos directamente sin stringify

##### `server.js`
- ✅ **Endpoints de debug públicos**: Facilitan troubleshooting sin necesidad de autenticación
- ✅ **Endpoint de fecha del servidor**: Resuelve problemas de zona horaria

##### `.env`
- ✅ **SUPABASE_SERVICE_KEY agregada**: Permite operaciones de administrador en `migrate.js`

---

### 🐛 Correcciones

1. **Problema**: Matrícula 1 apuntaba a curso inactivo (ID 1)
   - **Solución**: Actualizada a curso activo (ID 3) vía endpoint de debug

2. **Problema**: JSON.parse de columnas jsonb causaba error en tutores
   - **Solución**: Eliminado parse; Supabase devuelve objetos nativos

3. **Problema**: Inserción de horas en formato HH:MM fallaba en PostgreSQL
   - **Solución**: Normalización automática a HH:MM:SS

4. **Problema**: Constraint NOT NULL en `tarifa_por_hora` causaba error 500
   - **Solución**: Agregado default value de 0

5. **Problema**: Sesiones no aparecían en dashboard
   - **Solución**: Implementado filtrado correcto por `matriculas.estado=true`

---

### 📊 Estado de la Base de Datos

**Tablas principales**:
- `tutores` (3 registros)
- `cursos` (7 registros: 4 activos, 3 inactivos)
- `matriculas` (5 registros: 4 activas, 1 inactiva)
- `estudiantes` (varios)
- `sesiones_clases` (registros dinámicos)
- `movimientos_dinero` (vacía → se generará con sesiones completadas)
- `horas_trabajo` (vacía)

---

### 🔐 Seguridad

- ⚠️ **Endpoints de debug NO tienen autenticación** - Solo para desarrollo
- ✅ Todos los endpoints principales protegidos con `requireAuth` middleware
- ✅ Service role key guardada en `.env` (no se sube a GitHub)

---

### 📝 Próximos Pasos Sugeridos

1. **Limpiar endpoints de debug** - Remover o proteger antes de producción
2. **Validar generación de movimientos** - Verificar que los montos sean correctos
3. **Implementar reportes financieros** - Usar tabla `movimientos_dinero`
4. **Dashboard de pagos a tutores** - Vista para administrar `pago_tutor_pendiente`

---

### 🛠️ Comandos Útiles

```bash
# Backend
cd backend
npm run dev

# Frontend
cd LInguistika-Studio
npm run dev

# Migración
cd backend
node migrate.js

# Ver estructura de BD
# (Descomentar en migrate.js: await verEstructura())
```

---

### 📚 Archivos Modificados

- `backend/.env` - Agregada SUPABASE_SERVICE_KEY
- `backend/migrate.js` - NUEVO - Herramienta de migración
- `backend/routes/dashboard.js` - Sesiones dinámicas + endpoints de acción
- `backend/routes/tutores.js` - Fix jsonb + NOT NULL constraint
- `backend/server.js` - Endpoints de debug + fecha del servidor
- `LInguistika-Studio/views/Dashboard.tsx` - (cambios previos, ya committeados)

---

**Desarrollado por**: Reyshawn Lawrence @ UNADECA  
**Fecha**: 22 de enero de 2026
