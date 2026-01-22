-- ============================================================================
-- Instrucciones para agregar columna tutor_id a tabla cursos en Supabase
-- ============================================================================
-- 
-- Copia y pega este SQL en Supabase SQL Editor:
-- 1. Ve a https://app.supabase.com
-- 2. Selecciona tu proyecto
-- 3. Ve a "SQL Editor" en el menú lateral
-- 4. Crea una nueva query
-- 5. Pega el código de abajo y ejecuta (Run)
-- ============================================================================

-- Agregar columna tutor_id si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cursos' 
    AND column_name = 'tutor_id'
  ) THEN 
    ALTER TABLE public.cursos 
    ADD COLUMN tutor_id INTEGER REFERENCES public.tutores(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_cursos_tutor_id ON public.cursos(tutor_id);
    
    RAISE NOTICE 'Columna tutor_id agregada exitosamente a tabla cursos';
  ELSE
    RAISE NOTICE 'Columna tutor_id ya existe en tabla cursos';
  END IF;
END $$;

-- Verificar que la columna se agregó correctamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'cursos' 
  AND column_name = 'tutor_id';

-- Ver los constraints y foreign keys
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'cursos'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'tutor_id';
