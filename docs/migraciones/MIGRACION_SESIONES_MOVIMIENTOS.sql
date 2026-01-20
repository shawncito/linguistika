-- ===================================================================
-- MIGRACIONES PARA SESIONES DE CLASES Y MOVIMIENTOS DE DINERO
-- Ejecutar en Supabase SQL Editor
-- ===================================================================

-- 1. Tabla para Sesiones de Clases
CREATE TABLE sesiones_clases (
  id BIGSERIAL PRIMARY KEY,
  curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  dia_semana TEXT NOT NULL, -- "Lunes", "Martes", etc
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_horas DECIMAL(5,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'programada', -- 'programada', 'dada', 'cancelada'
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para sesiones
CREATE INDEX idx_sesiones_curso ON sesiones_clases(curso_id);
CREATE INDEX idx_sesiones_tutor ON sesiones_clases(tutor_id);
CREATE INDEX idx_sesiones_fecha ON sesiones_clases(fecha);
CREATE INDEX idx_sesiones_estado ON sesiones_clases(estado);

-- 2. Tabla para Movimientos de Dinero
CREATE TABLE movimientos_dinero (
  id BIGSERIAL PRIMARY KEY,
  curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  matricula_id BIGINT REFERENCES matriculas(id) ON DELETE SET NULL,
  tutor_id BIGINT REFERENCES tutores(id) ON DELETE SET NULL,
  sesion_id BIGINT REFERENCES sesiones_clases(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- 'ingreso_estudiante', 'pago_tutor', 'pago_tutor_pendiente'
  monto NUMERIC(10,2) NOT NULL,
  factura_numero TEXT,
  fecha_pago DATE NOT NULL,
  fecha_comprobante DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'completado', 'verificado'
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para movimientos
CREATE INDEX idx_movimientos_curso ON movimientos_dinero(curso_id);
CREATE INDEX idx_movimientos_matricula ON movimientos_dinero(matricula_id);
CREATE INDEX idx_movimientos_tutor ON movimientos_dinero(tutor_id);
CREATE INDEX idx_movimientos_tipo ON movimientos_dinero(tipo);
CREATE INDEX idx_movimientos_estado ON movimientos_dinero(estado);
CREATE INDEX idx_movimientos_fecha ON movimientos_dinero(fecha_pago);

-- 3. Actualizar tabla cursos para agregar dias_schedule
ALTER TABLE cursos
ADD COLUMN IF NOT EXISTS dias_schedule JSONB DEFAULT NULL;

-- Comentario: dias_schedule debe tener este formato:
-- {
--   "Lunes": {
--     "turno": "Tarde",
--     "hora_inicio": "14:00",
--     "hora_fin": "17:00",
--     "duracion_horas": 3
--   },
--   "Martes": {
--     "turno": "Noche",
--     "hora_inicio": "19:00",
--     "hora_fin": "21:00",
--     "duracion_horas": 2
--   }
-- }

-- 4. Actualizar tabla tutores para agregar dias_horarios (opcional - para múltiples rangos)
ALTER TABLE tutores
ADD COLUMN IF NOT EXISTS dias_horarios JSONB DEFAULT NULL;

-- Comentario: dias_horarios puede tener este formato para máxima flexibilidad:
-- {
--   "Lunes": [
--     {"hora_inicio": "14:00", "hora_fin": "17:00"},
--     {"hora_inicio": "19:00", "hora_fin": "21:00"}
--   ],
--   "Martes": [
--     {"hora_inicio": "15:00", "hora_fin": "18:00"}
--   ]
-- }

-- 5. RLS Policies para sesiones_clases
ALTER TABLE sesiones_clases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for sesiones_clases"
  ON sesiones_clases FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users on sesiones_clases"
  ON sesiones_clases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users on sesiones_clases"
  ON sesiones_clases FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 6. RLS Policies para movimientos_dinero
ALTER TABLE movimientos_dinero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for movimientos_dinero"
  ON movimientos_dinero FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users on movimientos_dinero"
  ON movimientos_dinero FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users on movimientos_dinero"
  ON movimientos_dinero FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 7. Comentarios de índices
COMMENT ON INDEX idx_sesiones_curso IS 'Para búsquedas rápidas de sesiones por curso';
COMMENT ON INDEX idx_sesiones_tutor IS 'Para búsquedas rápidas de sesiones por tutor';
COMMENT ON INDEX idx_movimientos_curso IS 'Para búsquedas rápidas de movimientos por curso';
COMMENT ON INDEX idx_movimientos_tipo IS 'Para filtrar ingresos vs pagos';
