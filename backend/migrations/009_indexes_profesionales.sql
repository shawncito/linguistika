-- 009_indexes_profesionales.sql
-- Objetivo: índices obvios para mejorar rendimiento de pantallas y filtros.

-- clases
CREATE INDEX IF NOT EXISTS idx_clases_matricula_id ON public.clases (matricula_id);
CREATE INDEX IF NOT EXISTS idx_clases_tutor_id ON public.clases (tutor_id);
CREATE INDEX IF NOT EXISTS idx_clases_curso_id ON public.clases (curso_id);
CREATE INDEX IF NOT EXISTS idx_clases_fecha ON public.clases (fecha);

-- horarios_tutores
CREATE INDEX IF NOT EXISTS idx_horarios_tutores_tutor_id ON public.horarios_tutores (tutor_id);
CREATE INDEX IF NOT EXISTS idx_horarios_tutores_tutor_dia ON public.horarios_tutores (tutor_id, dia_semana);

-- movimientos_dinero (libro diario/mensual)
CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_fecha_pago ON public.movimientos_dinero (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_tutor_fecha ON public.movimientos_dinero (tutor_id, fecha_pago);
CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_curso_fecha ON public.movimientos_dinero (curso_id, fecha_pago);

-- pagos
CREATE INDEX IF NOT EXISTS idx_pagos_tutor_fecha ON public.pagos (tutor_id, fecha_pago);

-- estudiantes: index de búsqueda por email (sin imponer UNIQUE todavía)
CREATE INDEX IF NOT EXISTS idx_estudiantes_email_norm ON public.estudiantes (lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';

-- estudiantes_bulk: index similar
CREATE INDEX IF NOT EXISTS idx_estudiantes_bulk_correo_norm ON public.estudiantes_bulk (lower(trim(correo))) WHERE correo IS NOT NULL AND trim(correo) <> '';
