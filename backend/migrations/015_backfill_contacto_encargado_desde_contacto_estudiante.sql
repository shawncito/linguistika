-- 015_backfill_contacto_encargado_desde_contacto_estudiante.sql
--
-- Opcional/recomendado:
-- Si ya existían datos históricos en estudiantes.email/estudiantes.telefono (contacto del estudiante),
-- pero ahora la UI muestra solo el contacto del encargado, este script migra esos valores
-- hacia email_encargado/telefono_encargado cuando estén vacíos.
--
-- Es conservador: NO sobreescribe valores existentes del encargado.

-- Nota: Esta migración es "defensiva".
-- Si tu instancia todavía no tiene alguna columna (p.ej. estudiantes.telefono),
-- el bloque correspondiente se omite con un NOTICE en vez de fallar.

DO $$
DECLARE
  v_rows integer;
BEGIN
  -- 1) Estudiantes: mover email -> email_encargado si falta
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='email_encargado'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='email'
  ) THEN
    UPDATE public.estudiantes
    SET email_encargado = nullif(btrim(email), '')
    WHERE (email_encargado IS NULL OR btrim(email_encargado) = '')
      AND email IS NOT NULL
      AND btrim(email) <> '';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Backfill estudiantes.email -> estudiantes.email_encargado: % filas', v_rows;
  ELSE
    RAISE NOTICE 'Skip estudiantes.email -> email_encargado: columnas faltantes';
  END IF;

  -- 2) Estudiantes: mover telefono -> telefono_encargado si falta
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='telefono_encargado'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='telefono'
  ) THEN
    UPDATE public.estudiantes
    SET telefono_encargado = nullif(btrim(telefono), '')
    WHERE (telefono_encargado IS NULL OR btrim(telefono_encargado) = '')
      AND telefono IS NOT NULL
      AND btrim(telefono) <> '';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Backfill estudiantes.telefono -> estudiantes.telefono_encargado: % filas', v_rows;
  ELSE
    RAISE NOTICE 'Skip estudiantes.telefono -> telefono_encargado: columnas faltantes';
  END IF;

  -- 3) Estudiantes bulk: mover correo -> email_encargado si falta (compatibilidad legacy)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes_bulk' AND column_name='email_encargado'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes_bulk' AND column_name='correo'
  ) THEN
    UPDATE public.estudiantes_bulk
    SET email_encargado = nullif(btrim(correo), '')
    WHERE (email_encargado IS NULL OR btrim(email_encargado) = '')
      AND correo IS NOT NULL
      AND btrim(correo) <> '';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Backfill estudiantes_bulk.correo -> estudiantes_bulk.email_encargado: % filas', v_rows;
  ELSE
    RAISE NOTICE 'Skip estudiantes_bulk.correo -> email_encargado: columnas faltantes';
  END IF;

  -- 4) Estudiantes bulk: mover telefono -> telefono_encargado si falta (compatibilidad legacy)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes_bulk' AND column_name='telefono_encargado'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes_bulk' AND column_name='telefono'
  ) THEN
    UPDATE public.estudiantes_bulk
    SET telefono_encargado = nullif(btrim(telefono), '')
    WHERE (telefono_encargado IS NULL OR btrim(telefono_encargado) = '')
      AND telefono IS NOT NULL
      AND btrim(telefono) <> '';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Backfill estudiantes_bulk.telefono -> estudiantes_bulk.telefono_encargado: % filas', v_rows;
  ELSE
    RAISE NOTICE 'Skip estudiantes_bulk.telefono -> telefono_encargado: columnas faltantes';
  END IF;
END $$;
