## 📋 ACTUALIZACIÓN DE BASE DE DATOS - CAMBIOS REALIZADOS

### 🔄 SQL PARA EJECUTAR EN SUPABASE

Ejecuta este SQL en el editor de Supabase para actualizar el esquema:

```sql
-- 1. Eliminar tablas antiguas (si existen)
DROP TABLE IF EXISTS horas_trabajo CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS clases CASCADE;
DROP TABLE IF EXISTS matriculas CASCADE;
DROP TABLE IF EXISTS horarios_tutores CASCADE;
DROP TABLE IF EXISTS estudiantes CASCADE;
DROP TABLE IF EXISTS cursos CASCADE;
DROP TABLE IF EXISTS tutores CASCADE;

-- 2. Crear tabla TUTORES con nuevo campo horario_tipo
CREATE TABLE IF NOT EXISTS tutores (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE,
    telefono TEXT,
    especialidad TEXT NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    horario_tipo TEXT DEFAULT 'predefinido', -- 'predefinido' o 'custom'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla HORARIOS_TUTORES (nuevo modelo)
CREATE TABLE IF NOT EXISTS horarios_tutores (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    dias TEXT NOT NULL, -- JSON: ["lunes", "martes", ...]
    turno TEXT NOT NULL, -- 'tarde_libre', 'noche_libre', 'custom'
    hora_inicio TEXT, -- Si es custom
    hora_fin TEXT, -- Si es custom
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tutor_id, dias, turno)
);

-- 4. Crear tabla CURSOS con nuevos campos
CREATE TABLE IF NOT EXISTS cursos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    nivel TEXT, -- 'None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    tipo_clase TEXT NOT NULL DEFAULT 'grupal', -- 'grupal' o 'tutoria'
    max_estudiantes INTEGER, -- NULL si es tutoría (infinito)
    dias TEXT, -- JSON: ["lunes", "martes", ...]
    turno TEXT, -- 'tarde' o 'noche'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Crear tabla ESTUDIANTES con nuevos campos
CREATE TABLE IF NOT EXISTS estudiantes (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT,
    email_encargado TEXT,
    telefono_encargado TEXT,
    grado TEXT, -- '1ro' a '11mo'
    dias TEXT, -- JSON: ["lunes", "martes", ...] - opcional
    turno TEXT, -- 'tarde' o 'noche' - opcional
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Crear tabla MATRICULAS
CREATE TABLE IF NOT EXISTS matriculas (
    id BIGSERIAL PRIMARY KEY,
    estudiante_id BIGINT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    estado TEXT DEFAULT 'activa', -- 'activa', 'pausada', 'cancelada'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Crear tabla CLASES
CREATE TABLE IF NOT EXISTS clases (
    id BIGSERIAL PRIMARY KEY,
    matricula_id BIGINT NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    estado TEXT DEFAULT 'programada', -- 'programada', 'completada', 'cancelada'
    notas TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Crear tabla PAGOS
CREATE TABLE IF NOT EXISTS pagos (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
    cantidad_clases INTEGER,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagado', 'cancelado'
    descripcion TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Crear tabla HORAS_TRABAJO
CREATE TABLE IF NOT EXISTS horas_trabajo (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    horas DECIMAL(10,2) NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'aprobado'
    notas TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 10. Crear tabla USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    rol TEXT NOT NULL DEFAULT 'admin',
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 11. Crear índices
CREATE INDEX IF NOT EXISTS idx_tutores_estado ON tutores(estado);
CREATE INDEX IF NOT EXISTS idx_tutores_especialidad ON tutores(especialidad);
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_tipo ON cursos(tipo_clase);
CREATE INDEX IF NOT EXISTS idx_estudiantes_estado ON estudiantes(estado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_grado ON estudiantes(grado);
CREATE INDEX IF NOT EXISTS idx_matriculas_estado ON matriculas(estado);
CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante ON matriculas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_tutor ON matriculas(tutor_id);
CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases(fecha);
CREATE INDEX IF NOT EXISTS idx_clases_matricula ON clases(matricula_id);
CREATE INDEX IF NOT EXISTS idx_pagos_tutor ON pagos(tutor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_horas_trabajo_tutor ON horas_trabajo(tutor_id);
CREATE INDEX IF NOT EXISTS idx_horas_trabajo_fecha ON horas_trabajo(fecha);

-- 12. Datos de ejemplo
INSERT INTO tutores (nombre, email, telefono, especialidad, tarifa_por_hora) VALUES
('Ana García', 'ana@linguistika.com', '+506 8888-1111', 'Inglés', 25000),
('Marc Dubois', 'marc@linguistika.com', '+506 8888-2222', 'Francés', 30000)
ON CONFLICT DO NOTHING;

INSERT INTO cursos (nombre, descripcion, nivel, tipo_clase, max_estudiantes) VALUES
('Inglés Avanzado', 'C1 Advanced', 'C1', 'grupal', 12),
('Francés Básico', 'A1 Intro', 'A1', 'grupal', 10),
('Tutoría Personalizada', 'Clases 1 a 1', 'None', 'tutoria', NULL)
ON CONFLICT DO NOTHING;
```

---

## 📝 CAMBIOS EN CÓDIGO

### ✅ Completado:
1. **Esquema BD**: Actualizado con campos para horarios estandarizados
2. **Navegación**: Reordenada (Dashboard → Estudiantes → Tutores → Cursos → Matrículas → Pagos)
3. **Formulario Tutores**: 
   - ✅ Validación de teléfono (formato: +506 8888-8888)
   - ✅ Selección de días hábiles (checkbox múltiples)
   - ✅ Turnos predefinidos (Tarde libre, Noche libre, Custom)
   - ✅ Horas personalizadas si selecciona Custom

### ⏳ Por Hacer:

#### 1. **Formulario Cursos**
```tsx
- Cambiar nivel a: 'None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
- Tipo de clase: 'Grupal' o 'Tutoría'
- Si es Tutoría → max_estudiantes = NULL (infinito)
- Agregar selección de días y turno (como tutores)
```

#### 2. **Formulario Estudiantes**
```tsx
- Email del estudiante + Email del encargado
- Teléfono del encargado
- Grado: select con opciones 1ro a 11mo
- Horario preferido: opcional, con días + turno
```

#### 3. **Vista Matrículas**
```tsx
- Permitir editar matrículas (cambiar tutor, curso, estudiante)
- Botón CANCELAR en rojo oscuro (#991b1b)
- Calcular compatibilidad:
  - Verificar días hábiles del estudiante
  - Verificar días hábiles del tutor
  - Verificar días hábiles del curso
  - Solo permitir matrícula si hay coincidencia
```

#### 4. **Dashboard Mejorado**
```tsx
- Cards con conteos dinámicos:
  - Total Tutores (actualizar en tiempo real)
  - Total Estudiantes
  - Total Matrículas
  - Total Cursos
  - Sesiones de hoy

- Sección "Agenda del Día":
  - Selector de fecha
  - Mostrar matrículas/sesiones del día seleccionado
  
- Sección "Hoy":
  - Lo que está programado para HOY
  
- Sección "Carga de Trabajo":
  - Resumen de tutores activos
  - Estudiantes que reciben clases HOY
  - Actividad por tutor
```

#### 5. **Backend - Nuevas Rutas**
```javascript
// horarios.js
POST   /api/horarios/tutores/:id        - Guardar horarios tutor
GET    /api/horarios/tutores/:id        - Obtener horarios tutor
POST   /api/horarios/estudiantes/:id    - Guardar horarios estudiante
GET    /api/horarios/estudiantes/:id    - Obtener horarios estudiante

// dashboard.js (mejorado)
GET    /api/dashboard/stats             - Conteos dinámicos
GET    /api/dashboard/agenda/:fecha     - Sesiones del día
GET    /api/dashboard/today             - Sesiones de hoy
GET    /api/dashboard/workload          - Carga de trabajo

// matriculas.js (nuevo)
GET    /api/matriculas/:id/compatible   - Verificar compatibilidad
```

#### 6. **Función de Compatibilidad** (Backend)
```javascript
function checkScheduleCompatibility(estudianteId, tutorId, cursoId) {
  // 1. Obtener días/turno del estudiante
  // 2. Obtener días/turno del tutor
  // 3. Obtener días/turno del curso
  // 4. Calcular intersección
  // 5. Retornar si es compatible (true/false)
}
```

---

## 🗂️ ESTRUCTURA DE DATOS - HORARIOS

### Tutores - Horarios
```json
{
  "id": 1,
  "tutor_id": 1,
  "dias": ["Lunes", "Martes", "Miércoles"],
  "turno": "tarde_libre",
  "hora_inicio": null,
  "hora_fin": null
}
```

### Estudiantes - Horarios
```json
{
  "id": 1,
  "nombre": "Juan",
  "dias": ["Lunes", "Miércoles", "Viernes"],
  "turno": "tarde"
}
```

### Cursos - Horarios
```json
{
  "id": 1,
  "nombre": "Inglés",
  "dias": ["Martes", "Jueves"],
  "turno": "noche",
  "tipo_clase": "grupal"
}
```

---

## 📞 PRÓXIMOS PASOS

1. Ejecutar SQL en Supabase
2. Crear nuevas rutas en backend
3. Implementar formularios mejorados
4. Agregar función de compatibilidad
5. Mejorar dashboard

¿Necesitas ayuda con algún paso específico?
