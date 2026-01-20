-- ============================================
-- SCRIPT DE MIGRACIÓN - AGREGAR COLUMNAS FALTANTES
-- LINGUISTIKA ACADEMY - Versión 2.0
-- ============================================
-- Este script agrega las columnas que faltaban a las tablas existentes
-- Ejecuta esto en el SQL Editor de Supabase si las tablas ya existen
-- ============================================

-- ============================================
-- TABLA: tutores - AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Agregar columna dias (si no existe)
ALTER TABLE tutores 
ADD COLUMN IF NOT EXISTS dias TEXT DEFAULT NULL;

-- Agregar columna turno (si no existe)
ALTER TABLE tutores 
ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT NULL;

-- Agregar columna horario_tipo (si no existe)
ALTER TABLE tutores 
ADD COLUMN IF NOT EXISTS horario_tipo TEXT DEFAULT 'predefinido';

-- ============================================
-- TABLA: cursos - AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Agregar columna tipo_clase (si no existe)
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS tipo_clase TEXT DEFAULT 'grupal';

-- Agregar columna dias (si no existe)
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS dias TEXT DEFAULT NULL;

-- Agregar columna turno (si no existe)
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT NULL;

-- Actualizar nivel default a 'None' (si es necesario)
ALTER TABLE cursos 
ALTER COLUMN nivel SET DEFAULT 'None';

-- ============================================
-- TABLA: estudiantes - AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Agregar columna email_encargado (si no existe)
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS email_encargado TEXT DEFAULT NULL;

-- Agregar columna telefono_encargado (si no existe)
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS telefono_encargado TEXT DEFAULT NULL;

-- Agregar columna grado (si no existe)
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS grado TEXT DEFAULT NULL;

-- Agregar columna dias (si no existe)
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS dias TEXT DEFAULT NULL;

-- Agregar columna turno (si no existe)
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT NULL;

-- ============================================
-- TABLA: clases - AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Agregar columna estado (si no existe)
ALTER TABLE clases 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'programada';

-- ============================================
-- TABLA: pagos - AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Agregar columna estado (si no existe)
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

-- ============================================
-- TABLA: matriculas - VERIFICAR COLUMNAS
-- ============================================

-- Agregar columna estado (si no existe)
ALTER TABLE matriculas 
ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT true;

-- ============================================
-- CREAR ÍNDICES (si no existen)
-- ============================================

-- Índices para tutores
CREATE INDEX IF NOT EXISTS idx_tutores_estado ON tutores(estado);
CREATE INDEX IF NOT EXISTS idx_tutores_especialidad ON tutores(especialidad);
CREATE INDEX IF NOT EXISTS idx_tutores_email ON tutores(email);

-- Índices para cursos
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_nivel ON cursos(nivel);
CREATE INDEX IF NOT EXISTS idx_cursos_tipo_clase ON cursos(tipo_clase);

-- Índices para estudiantes
CREATE INDEX IF NOT EXISTS idx_estudiantes_estado ON estudiantes(estado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_grado ON estudiantes(grado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_email ON estudiantes(email);

-- Índices para matrículas
CREATE INDEX IF NOT EXISTS idx_matriculas_estado ON matriculas(estado);
CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante ON matriculas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_tutor ON matriculas(tutor_id);

-- Índices para clases
CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases(fecha);
CREATE INDEX IF NOT EXISTS idx_clases_estado ON clases(estado);
CREATE INDEX IF NOT EXISTS idx_clases_matricula ON clases(matricula_id);
CREATE INDEX IF NOT EXISTS idx_clases_tutor ON clases(tutor_id);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_tutor ON pagos(tutor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);

-- Índices para horas_trabajo
CREATE INDEX IF NOT EXISTS idx_horas_tutor ON horas_trabajo(tutor_id);
CREATE INDEX IF NOT EXISTS idx_horas_fecha ON horas_trabajo(fecha);
CREATE INDEX IF NOT EXISTS idx_horas_estado ON horas_trabajo(estado);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horas_trabajo ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMENTARIOS SOBRE ESTE SCRIPT
-- ============================================

-- Este script utiliza "IF NOT EXISTS" para agregar columnas de forma segura
-- Si la columna ya existe, no hará nada
-- Si la columna no existe, la agregará con los valores por defecto

-- IMPORTANTE: Después de ejecutar este script:
-- 1. Verifica que todas las columnas se hayan agregado correctamente
-- 2. Revisa los datos existentes para asegurar consistencia
-- 3. Si hay datos problemáticos, ejecuta UPDATE para corregir

-- Ejemplo de verificación (ejecuta en otra sesión):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cursos';

-- ============================================
-- FIN DEL SCRIPT DE MIGRACIÓN
-- ============================================
