-- ============================================
-- MIGRACIONES LINGUISTIKA v3.0
-- FASE 1: REESTRUCTURACIÓN DE BASE DE DATOS
-- ============================================
-- Ejecuta esto en orden en Supabase SQL Editor

-- ============================================
-- 1. ENUMS (Tipos de datos para nuevos campos)
-- ============================================

-- Tipo de cobro: por clase/hora o mensual
DO $$
BEGIN
  CREATE TYPE public.tipo_cobro_enum AS ENUM ('por_clase', 'mensual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Estado de movimiento financiero
DO $$
BEGIN
  CREATE TYPE public.estado_movimiento_enum AS ENUM ('pendiente', 'pagado', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de movimiento: debe (cliente paga) o haber (tutor recibe)
DO $$
BEGIN
  CREATE TYPE public.tipo_movimiento_enum AS ENUM ('debe', 'haber');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Estado de comprobante
DO $$
BEGIN
  CREATE TYPE public.estado_comprobante_enum AS ENUM ('pendiente_verificacion', 'verificado', 'rechazado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Rol de usuario
DO $$
BEGIN
  CREATE TYPE public.rol_usuario_enum AS ENUM ('admin', 'contador', 'tutor_view_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. ALTER TABLE: cursos (agregar campos de cobro)
-- ============================================

ALTER TABLE public.cursos
ADD COLUMN IF NOT EXISTS tipo_cobro tipo_cobro_enum DEFAULT 'por_clase',
ADD COLUMN IF NOT EXISTS precio_hora numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio_mensual numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pago_tutor_por_clase numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pago_tutor_mensual numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS requiere_perfil_completo boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS activo_para_matricula boolean DEFAULT true;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cursos_tipo_cobro ON public.cursos(tipo_cobro);
CREATE INDEX IF NOT EXISTS idx_cursos_activo ON public.cursos(activo_para_matricula);

-- ============================================
-- 3. ALTER TABLE: usuarios (mejorar roles y permisos)
-- ============================================

-- Primero, crear tipo enum si no existe
-- (Ya lo creamos arriba como rol_usuario_enum)

-- Agregar/modificar campos en usuarios
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS rol rol_usuario_enum DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS nombre_completo text,
ADD COLUMN IF NOT EXISTS telefono text,
ADD COLUMN IF NOT EXISTS estado boolean DEFAULT true,
DROP COLUMN IF EXISTS username;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON public.usuarios(estado);

-- ============================================
-- 4. CREAR SECUENCIAS PRIMERO
-- Antes de crear las tablas que las usan
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.estudiantes_bulk_id_seq INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS public.matriculas_grupo_id_seq INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS public.estudiantes_en_grupo_id_seq INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS public.movimientos_financieros_id_seq INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS public.comprobantes_ingresos_id_seq INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE IF NOT EXISTS public.logs_auditoria_id_seq INCREMENT BY 1 MINVALUE 1;

-- ============================================
-- 5. NUEVA TABLA: estudiantes_bulk
-- Para estudiantes de cursos regulares (nombre + teléfono mínimo)
-- ============================================

CREATE TABLE IF NOT EXISTS public.estudiantes_bulk (
  id bigint NOT NULL DEFAULT nextval('public.estudiantes_bulk_id_seq'),
  nombre text NOT NULL,
  telefono text,
  correo text,
  requiere_perfil_completo boolean DEFAULT false,
  estado boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estudiantes_bulk_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_bulk_nombre ON public.estudiantes_bulk(nombre);
CREATE INDEX IF NOT EXISTS idx_estudiantes_bulk_estado ON public.estudiantes_bulk(estado);

-- ============================================
-- 6. NUEVA TABLA: matriculas_grupo
-- Para agrupar estudiantes en un curso (reemplaza matrícula individual)
-- ============================================

CREATE TABLE IF NOT EXISTS public.matriculas_grupo (
  id bigint NOT NULL DEFAULT nextval('public.matriculas_grupo_id_seq'),
  curso_id bigint NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  tutor_id bigint NOT NULL REFERENCES public.tutores(id) ON DELETE RESTRICT,
  nombre_grupo text,
  cantidad_estudiantes_esperados integer,
  estado text DEFAULT 'activa',  -- 'activa', 'completada', 'cancelada'
  fecha_inicio date,
  fecha_fin date,
  notas text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT matriculas_grupo_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_grupo_curso ON public.matriculas_grupo(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_grupo_tutor ON public.matriculas_grupo(tutor_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_grupo_estado ON public.matriculas_grupo(estado);

-- ============================================
-- 7. NUEVA TABLA: estudiantes_en_grupo
-- Relaciona estudiantes_bulk con matriculas_grupo
-- ============================================

CREATE TABLE IF NOT EXISTS public.estudiantes_en_grupo (
  id bigint NOT NULL DEFAULT nextval('public.estudiantes_en_grupo_id_seq'),
  matricula_grupo_id bigint NOT NULL REFERENCES public.matriculas_grupo(id) ON DELETE CASCADE,
  estudiante_bulk_id bigint NOT NULL REFERENCES public.estudiantes_bulk(id) ON DELETE CASCADE,
  asistencia_mes_actual integer DEFAULT 0,  -- Contador de asistencias si aplica
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estudiantes_en_grupo_pkey PRIMARY KEY (id),
  CONSTRAINT estudiantes_en_grupo_unique UNIQUE (matricula_grupo_id, estudiante_bulk_id)
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_en_grupo_matricula ON public.estudiantes_en_grupo(matricula_grupo_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_en_grupo_estudiante ON public.estudiantes_en_grupo(estudiante_bulk_id);

-- ============================================
-- 8. NUEVA TABLA: movimientos_financieros
-- Reemplaza/complementa movimientos_dinero
-- Maneja deuda (cliente) y haber (tutor)
-- ============================================

CREATE TABLE IF NOT EXISTS public.movimientos_financieros (
  id bigint NOT NULL DEFAULT nextval('public.movimientos_financieros_id_seq'),
  tipo tipo_movimiento_enum NOT NULL,  -- 'debe' o 'haber'
  referencia_tabla text NOT NULL,  -- 'estudiantes_bulk', 'tutores'
  referencia_id bigint NOT NULL,
  monto numeric(12, 2) NOT NULL,
  concepto text,  -- Descripción del movimiento
  curso_id bigint REFERENCES public.cursos(id),
  matricula_grupo_id bigint REFERENCES public.matriculas_grupo(id),
  clase_id bigint REFERENCES public.clases(id),
  estado estado_movimiento_enum DEFAULT 'pendiente',
  fecha_movimiento timestamp with time zone DEFAULT now(),
  fecha_pago timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT movimientos_financieros_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_tipo ON public.movimientos_financieros(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_ref ON public.movimientos_financieros(referencia_tabla, referencia_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_estado ON public.movimientos_financieros(estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_fecha ON public.movimientos_financieros(fecha_movimiento);

-- ============================================
-- 9. NUEVA TABLA: comprobantes_ingresos
-- Registro de dinero que entra al sistema con evidencia
-- ============================================

CREATE TABLE IF NOT EXISTS public.comprobantes_ingresos (
  id bigint NOT NULL DEFAULT nextval('public.comprobantes_ingresos_id_seq'),
  numero_comprobante text UNIQUE NOT NULL,
  monto numeric(12, 2) NOT NULL,
  foto_url text,  -- URL en Supabase Storage
  pagador_nombre text NOT NULL,
  pagador_contacto text,
  detalle text,  -- Descripción del pago
  movimiento_financiero_id bigint REFERENCES public.movimientos_financieros(id),
  estado estado_comprobante_enum DEFAULT 'pendiente_verificacion',
  fecha_comprobante date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comprobantes_ingresos_pkey PRIMARY KEY (id),
  CONSTRAINT comprobantes_ingresos_numero_unique UNIQUE (numero_comprobante)
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_ingresos_numero ON public.comprobantes_ingresos(numero_comprobante);
CREATE INDEX IF NOT EXISTS idx_comprobantes_ingresos_estado ON public.comprobantes_ingresos(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_ingresos_fecha ON public.comprobantes_ingresos(fecha_comprobante);

-- ============================================
-- 10. NUEVA TABLA: logs_auditoria
-- Registro de TODAS las operaciones de dinero
-- ============================================

CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id bigint NOT NULL DEFAULT nextval('public.logs_auditoria_id_seq'),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  accion text NOT NULL,  -- 'crear_comprobante', 'marcar_dada', 'generar_pago_mensual', etc.
  tabla_afectada text,
  registro_id bigint,
  cambios jsonb,  -- JSON con antes/después
  ip_address inet,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON public.logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_accion ON public.logs_auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_tabla ON public.logs_auditoria(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_fecha ON public.logs_auditoria(created_at);

-- ============================================
-- 11. RLS (ROW LEVEL SECURITY)
-- Control de acceso por rol
-- ============================================

-- Habilitar RLS en tablas críticas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes_ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas_grupo ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo ven su propio perfil (excepto admin)
DROP POLICY IF EXISTS "usuarios_view_policy" ON public.usuarios;
CREATE POLICY "usuarios_view_policy" ON public.usuarios
FOR SELECT USING (
  auth.uid() = id
);

DROP POLICY IF EXISTS "usuarios_update_policy" ON public.usuarios;
CREATE POLICY "usuarios_update_policy" ON public.usuarios
FOR UPDATE USING (false)
WITH CHECK (false);

-- Policy: Movimientos financieros - admin y contador pueden ver todo
DROP POLICY IF EXISTS "movimientos_financieros_view" ON public.movimientos_financieros;
CREATE POLICY "movimientos_financieros_view" ON public.movimientos_financieros
FOR SELECT USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "movimientos_financieros_insert" ON public.movimientos_financieros;
CREATE POLICY "movimientos_financieros_insert" ON public.movimientos_financieros
FOR INSERT WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "movimientos_financieros_update" ON public.movimientos_financieros;
CREATE POLICY "movimientos_financieros_update" ON public.movimientos_financieros
FOR UPDATE USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
)
WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

-- Policy: Comprobantes - solo admin y contador
DROP POLICY IF EXISTS "comprobantes_view" ON public.comprobantes_ingresos;
CREATE POLICY "comprobantes_view" ON public.comprobantes_ingresos
FOR SELECT USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "comprobantes_insert" ON public.comprobantes_ingresos;
CREATE POLICY "comprobantes_insert" ON public.comprobantes_ingresos
FOR INSERT WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "comprobantes_update" ON public.comprobantes_ingresos;
CREATE POLICY "comprobantes_update" ON public.comprobantes_ingresos
FOR UPDATE USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
)
WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

-- Policy: Logs de auditoría - solo lectura para admin y contador
DROP POLICY IF EXISTS "logs_auditoria_view" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_view" ON public.logs_auditoria
FOR SELECT USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "logs_auditoria_insert" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_insert" ON public.logs_auditoria
FOR INSERT WITH CHECK (true);  -- Cualquier operación puede loguear

-- Policy: Matrículas grupo - admin y contador ven todo, tutor_view_only solo lectura
DROP POLICY IF EXISTS "matriculas_grupo_view" ON public.matriculas_grupo;
CREATE POLICY "matriculas_grupo_view" ON public.matriculas_grupo
FOR SELECT USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador', 'tutor_view_only')
);

DROP POLICY IF EXISTS "matriculas_grupo_insert" ON public.matriculas_grupo;
CREATE POLICY "matriculas_grupo_insert" ON public.matriculas_grupo
FOR INSERT WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

DROP POLICY IF EXISTS "matriculas_grupo_update" ON public.matriculas_grupo;
CREATE POLICY "matriculas_grupo_update" ON public.matriculas_grupo
FOR UPDATE USING (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
)
WITH CHECK (
  (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('admin', 'contador')
);

-- ============================================
-- 12. FUNCIÓN: crear_usuario_empleado
-- Para que admin cree nuevos empleados (tutor, contador, admin)
-- ============================================

CREATE OR REPLACE FUNCTION public.crear_usuario_empleado(
  email_usuario text,
  nombre_usuario text,
  rol_usuario rol_usuario_enum,
  telefono_usuario text DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  email text,
  error text
) AS $$
DECLARE
  v_user_id uuid;
  v_creator_rol rol_usuario_enum;
BEGIN
  -- Verificar que el creador es admin
  SELECT rol INTO v_creator_rol FROM public.usuarios WHERE id = auth.uid();
  
  IF v_creator_rol != 'admin' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'Solo admin puede crear empleados'::text;
    RETURN;
  END IF;

  -- Crear usuario en auth.users (esto debe hacerse desde backend con admin client)
  -- Por ahora, retornamos instrucción para backend
  RETURN QUERY SELECT 
    gen_random_uuid()::uuid,
    email_usuario,
    'Usar endpoint /api/admin/crear-empleado para crear en auth'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. FUNCIÓN: registrar_auditoria
-- Registra automáticamente cambios en operaciones financieras
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_accion text,
  p_tabla text,
  p_registro_id bigint,
  p_cambios jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, cambios)
  VALUES (auth.uid(), p_accion, p_tabla, p_registro_id, p_cambios);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. VERIFICACIÓN FINAL
-- ============================================

-- Listar todas las tablas creadas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Listar ENUMs creados
SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Contar registros en tablas principales
SELECT 'cursos' as tabla, COUNT(*) as registros FROM public.cursos
UNION ALL
SELECT 'usuarios', COUNT(*) FROM public.usuarios
UNION ALL
SELECT 'estudiantes', COUNT(*) FROM public.estudiantes
UNION ALL
SELECT 'tutores', COUNT(*) FROM public.tutores
UNION ALL
SELECT 'matriculas', COUNT(*) FROM public.matriculas;
