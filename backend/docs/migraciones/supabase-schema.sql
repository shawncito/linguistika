-- ============================================
-- SCHEMA SQL COMPLETO PARA SUPABASE
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Usuarios (autenticación y auditoría)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    rol TEXT NOT NULL DEFAULT 'admin',
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Tabla de Tutores
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

-- Tabla de Horarios de Tutores (nueva)
CREATE TABLE IF NOT EXISTS horarios_tutores (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    dias TEXT NOT NULL, -- JSON: ["lunes", "martes", ...] 
    turno TEXT NOT NULL, -- 'tarde_libre', 'noche_libre', o custom
    hora_inicio TEXT, -- Si es custom
    hora_fin TEXT, -- Si es custom
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tutor_id, dias, turno)
);

-- Tabla de Estudiantes
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

-- Tabla de Matrículas
CREATE TABLE IF NOT EXISTS matriculas (
    id BIGSERIAL PRIMARY KEY,
    estudiante_id BIGINT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Clases Programadas
CREATE TABLE IF NOT EXISTS clases (
    id BIGSERIAL PRIMARY KEY,
    matricula_id BIGINT NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    estado TEXT DEFAULT 'programada',
    notas TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
    cantidad_clases INTEGER,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT DEFAULT 'pendiente',
    descripcion TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Horas Trabajadas
CREATE TABLE IF NOT EXISTS horas_trabajo (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    horas DECIMAL(10,2) NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    notas TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tutores_estado ON tutores(estado);
CREATE INDEX IF NOT EXISTS idx_tutores_especialidad ON tutores(especialidad);
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_estado ON estudiantes(estado);
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
CREATE INDEX IF NOT EXISTS idx_horas_trabajo_estado ON horas_trabajo(estado);

-- Datos de ejemplo (opcional - comentar si no los necesitas)
INSERT INTO tutores (nombre, email, telefono, especialidad, tarifa_por_hora, horario_preferido) VALUES
('Ana García', 'ana@linguistika.com', '+506 8888-1111', 'Inglés', 25.00, 'L-V 9am-5pm'),
('Marc Dubois', 'marc@linguistika.com', '+506 8888-2222', 'Francés', 30.00, 'L-V 10am-6pm')
ON CONFLICT DO NOTHING;

INSERT INTO cursos (nombre, descripcion, nivel, max_estudiantes) VALUES
('Inglés Avanzado C1', 'Preparación para certificación Cambridge C1 Advanced', 'C1', 12),
('Francés Básico A1', 'Introducción al idioma francés desde cero', 'A1', 10),
('Alemán Intermedio B1', 'Consolidación de gramática y conversación', 'B1', 8)
ON CONFLICT DO NOTHING;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
-- Puedes habilitar RLS si quieres control de acceso a nivel de fila

-- Habilitar RLS en tablas principales (opcional)
-- ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

-- Crear políticas (ejemplo básico - permite todo a usuarios autenticados)
-- CREATE POLICY "Permitir lectura a todos" ON tutores FOR SELECT USING (true);
-- CREATE POLICY "Permitir escritura a admin" ON tutores FOR ALL USING (true);

COMMENT ON TABLE usuarios IS 'Usuarios del sistema para autenticación';
COMMENT ON TABLE tutores IS 'Docentes/Profesores de la academia';
COMMENT ON TABLE cursos IS 'Programas académicos ofrecidos';
COMMENT ON TABLE estudiantes IS 'Alumnos matriculados';
COMMENT ON TABLE matriculas IS 'Inscripciones de estudiantes en cursos';
COMMENT ON TABLE clases IS 'Sesiones programadas';
COMMENT ON TABLE pagos IS 'Registro de pagos a tutores';
COMMENT ON TABLE horas_trabajo IS 'Control de horas trabajadas por tutores';
