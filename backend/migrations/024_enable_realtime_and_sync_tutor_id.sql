-- ============================================================
-- 024: Enable Supabase Realtime + Sync tutor_id cursos→matriculas
-- ============================================================

-- ── 1. Enable Supabase Realtime on active tables ──
-- Without this, postgres_changes subscriptions receive no events.
DO $$
BEGIN
  -- Core tables
  ALTER PUBLICATION supabase_realtime ADD TABLE estudiantes;
  ALTER PUBLICATION supabase_realtime ADD TABLE tutores;
  ALTER PUBLICATION supabase_realtime ADD TABLE cursos;
  ALTER PUBLICATION supabase_realtime ADD TABLE matriculas;
  ALTER PUBLICATION supabase_realtime ADD TABLE matriculas_grupo;
  ALTER PUBLICATION supabase_realtime ADD TABLE clases;
  ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_clases;

  -- Financial tables
  ALTER PUBLICATION supabase_realtime ADD TABLE pagos;
  ALTER PUBLICATION supabase_realtime ADD TABLE movimientos_dinero;
  ALTER PUBLICATION supabase_realtime ADD TABLE tesoreria_pagos;
  ALTER PUBLICATION supabase_realtime ADD TABLE tesoreria_obligaciones;

  -- Other
  ALTER PUBLICATION supabase_realtime ADD TABLE horas_trabajo;
  ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
  ALTER PUBLICATION supabase_realtime ADD TABLE estudiantes_bulk;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- table already in publication
END $$;


-- ── 2. Trigger: When cursos.tutor_id changes, update all active matriculas ──
CREATE OR REPLACE FUNCTION sync_curso_tutor_to_matriculas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tutor_id IS DISTINCT FROM OLD.tutor_id THEN
    UPDATE matriculas
       SET tutor_id = NEW.tutor_id
     WHERE curso_id = NEW.id
       AND estado = true;

    UPDATE matriculas_grupo
       SET tutor_id = NEW.tutor_id
     WHERE curso_id = NEW.id
       AND estado = 'activa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_curso_tutor ON cursos;
CREATE TRIGGER trg_sync_curso_tutor
  AFTER UPDATE OF tutor_id ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION sync_curso_tutor_to_matriculas();


-- ── 3. Backfill: Fix existing matriculas with stale tutor_id ──
-- Set matricula.tutor_id = curso.tutor_id for all active matriculas
-- where the tutor_id doesn't match.
UPDATE matriculas m
   SET tutor_id = c.tutor_id
  FROM cursos c
 WHERE m.curso_id = c.id
   AND m.estado = true
   AND m.tutor_id IS DISTINCT FROM c.tutor_id;

UPDATE matriculas_grupo mg
   SET tutor_id = c.tutor_id
  FROM cursos c
 WHERE mg.curso_id = c.id
   AND mg.estado = 'activa'
   AND mg.tutor_id IS DISTINCT FROM c.tutor_id;
