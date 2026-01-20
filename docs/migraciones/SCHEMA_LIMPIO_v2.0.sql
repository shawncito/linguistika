-- ============================================
-- SCHEMA LIMPIO - BORRAR TODO Y EMPEZAR DE CERO
-- LINGUISTIKA ACADEMY - Versión 2.0
-- ============================================
-- ADVERTENCIA: Este script ELIMINA todas las tablas existentes
-- ============================================

-- Deshabilitar RLS temporalmente para poder dropear
ALTER TABLE IF EXISTS tutores DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cursos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matriculas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS horas_trabajo DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las tablas existentes (CASCADE elimina dependencias)
DROP TABLE IF EXISTS horas_trabajo CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS clases CASCADE;
DROP TABLE IF EXISTS matriculas CASCADE;
DROP TABLE IF EXISTS estudiantes CASCADE;
DROP TABLE IF EXISTS cursos CASCADE;
DROP TABLE IF EXISTS tutores CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================
-- CREAR TABLAS NUEVAS LIMPIAS
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Usuarios (autenticación y auditoría)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    rol TEXT NOT NULL DEFAULT 'admin',
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ============================================
-- TABLA DE TUTORES
-- ============================================
CREATE TABLE tutores (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE,
    telefono TEXT,
    especialidad TEXT NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    horario_tipo TEXT DEFAULT 'predefinido',
    dias TEXT,
    turno TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA DE CURSOS
-- ============================================
CREATE TABLE cursos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    nivel TEXT NOT NULL DEFAULT 'None',
    tipo_clase TEXT DEFAULT 'grupal',
    max_estudiantes INTEGER,
    dias TEXT,
    turno TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA DE ESTUDIANTES
-- ============================================
CREATE TABLE estudiantes (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT,
    email_encargado TEXT,
    telefono TEXT,
    telefono_encargado TEXT,
    grado TEXT,
    dias TEXT,
    turno TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
    estado BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA DE MATRÍCULAS
-- ============================================
CREATE TABLE matriculas (
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

-- ============================================
-- TABLA DE CLASES PROGRAMADAS
-- ============================================
CREATE TABLE clases (
    id BIGSERIAL PRIMARY KEY,
    matricula_id BIGINT NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
    tutor_id BIGINT REFERENCES tutores(id) ON DELETE SET NULL,
    estudiante_id BIGINT REFERENCES estudiantes(id) ON DELETE SET NULL,
    curso_id BIGINT REFERENCES cursos(id) ON DELETE SET NULL,
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

-- ============================================
-- TABLA DE PAGOS
-- ============================================
CREATE TABLE pagos (
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

-- ============================================
-- TABLA DE HORAS DE TRABAJO
-- ============================================
CREATE TABLE horas_trabajo (
    id BIGSERIAL PRIMARY KEY,
    tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
    clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    horas DECIMAL(5,2) NOT NULL,
    tarifa_por_hora DECIMAL(10,2),
    monto DECIMAL(10,2),
    estado TEXT DEFAULT 'pendiente',
    notas TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREAR ÍNDICES
-- ============================================

-- Tutores
CREATE INDEX idx_tutores_estado ON tutores(estado);
CREATE INDEX idx_tutores_especialidad ON tutores(especialidad);
CREATE INDEX idx_tutores_email ON tutores(email);

-- Cursos
CREATE INDEX idx_cursos_estado ON cursos(estado);
CREATE INDEX idx_cursos_nivel ON cursos(nivel);
CREATE INDEX idx_cursos_tipo_clase ON cursos(tipo_clase);

-- Estudiantes
CREATE INDEX idx_estudiantes_estado ON estudiantes(estado);
CREATE INDEX idx_estudiantes_grado ON estudiantes(grado);
CREATE INDEX idx_estudiantes_email ON estudiantes(email);

-- Matrículas
CREATE INDEX idx_matriculas_estado ON matriculas(estado);
CREATE INDEX idx_matriculas_estudiante ON matriculas(estudiante_id);
CREATE INDEX idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX idx_matriculas_tutor ON matriculas(tutor_id);

-- Clases
CREATE INDEX idx_clases_fecha ON clases(fecha);
CREATE INDEX idx_clases_estado ON clases(estado);
CREATE INDEX idx_clases_matricula ON clases(matricula_id);
CREATE INDEX idx_clases_tutor ON clases(tutor_id);

-- Pagos
CREATE INDEX idx_pagos_tutor ON pagos(tutor_id);
CREATE INDEX idx_pagos_estado ON pagos(estado);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);

-- Horas de Trabajo
CREATE INDEX idx_horas_tutor ON horas_trabajo(tutor_id);
CREATE INDEX idx_horas_fecha ON horas_trabajo(fecha);
CREATE INDEX idx_horas_estado ON horas_trabajo(estado);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================

ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horas_trabajo ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREAR USUARIO ADMIN (después de crear en auth)
-- ============================================

INSERT INTO usuarios (id, username, rol, estado)
SELECT id, 'admin', 'admin', true
FROM auth.users
WHERE email = 'admin@linguistika.com'
ON CONFLICT DO NOTHING;

-- ============================================
-- FIN - SCHEMA LIMPIO CREADO
-- ============================================
-- Este schema está listo para producción
-- Próximas modificaciones: solo editar este archivo a partir de aquí
