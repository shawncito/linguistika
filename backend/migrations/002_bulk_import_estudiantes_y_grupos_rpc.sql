  -- Bulk import transaccional para plantilla_estudiantes_y_grupos_v1
  --
  -- Crea una función RPC que inserta:
  -- 1) matriculas_grupo
  -- 2) estudiantes_bulk
  -- 3) estudiantes_en_grupo
  -- en una sola transacción.
  --
  -- Nota: Esta función asume que nombre_grupo es único dentro del payload.

  create or replace function public.bulk_import_estudiantes_y_grupos_v1(
    p_user_id uuid,
    p_grupos jsonb,
    p_estudiantes jsonb
  )
  returns jsonb
  language plpgsql
  as $$
  declare
    result jsonb;
  begin
    with
    grupos_in as (
      select * from jsonb_to_recordset(p_grupos) as g(
        curso_id bigint,
        tutor_id bigint,
        nombre_grupo text,
        cantidad_estudiantes_esperados int,
        fecha_inicio text,
        turno text
      )
    ),
    ins_grupos as (
      insert into public.matriculas_grupo (
        curso_id,
        tutor_id,
        nombre_grupo,
        cantidad_estudiantes_esperados,
        estado,
        fecha_inicio,
        turno,
        created_by,
        updated_by,
        updated_at
      )
      select
        g.curso_id,
        g.tutor_id,
        g.nombre_grupo,
        g.cantidad_estudiantes_esperados,
        'activa',
        nullif(g.fecha_inicio, '')::date,
        nullif(g.turno, ''),
        p_user_id,
        p_user_id,
        now()
      from grupos_in g
      returning id, nombre_grupo
    ),
    est_in as (
      select
        nullif(e.elem->>'nombre', '') as nombre,
        nullif(e.elem->>'telefono', '') as telefono,
        nullif(e.elem->>'correo', '') as correo,
        nullif(e.elem->>'email_encargado', '') as email_encargado,
        nullif(e.elem->>'telefono_encargado', '') as telefono_encargado,
        nullif(e.elem->>'grado', '') as grado,
        e.elem->'dias' as dias,
        e.elem->'dias_turno' as dias_turno,
        coalesce((e.elem->>'requiere_perfil_completo')::boolean, false) as requiere_perfil_completo,
        nullif(e.elem->>'grupo_nombre', '') as grupo_nombre,
        e.ordinality as ordinality
      from jsonb_array_elements(p_estudiantes) with ordinality as e(elem, ordinality)
    ),
    ins_est as (
      insert into public.estudiantes_bulk (
        nombre,
        telefono,
        correo,
        email_encargado,
        telefono_encargado,
        grado,
        dias,
        dias_turno,
        requiere_perfil_completo,
        estado,
        created_by,
        updated_by,
        updated_at
      )
      select
        e.nombre,
        e.telefono,
        e.correo,
        e.email_encargado,
        e.telefono_encargado,
        e.grado,
        case when e.dias is null then null else e.dias::text end,
        case when e.dias_turno is null then null else e.dias_turno::text end,
        coalesce(e.requiere_perfil_completo, false),
        true,
        p_user_id,
        p_user_id,
        now()
      from est_in e
      order by e.ordinality
      returning id
    ),
    ins_est_indexed as (
      select id, row_number() over () as ordinality
      from ins_est
    ),
    ins_links as (
      insert into public.estudiantes_en_grupo (matricula_grupo_id, estudiante_bulk_id)
      select g.id, e.id
      from ins_est_indexed e
      join est_in s on s.ordinality = e.ordinality
      join ins_grupos g on g.nombre_grupo = s.grupo_nombre
      where s.grupo_nombre is not null and s.grupo_nombre <> ''
      returning 1
    )
    select jsonb_build_object(
      'created_grupos', (select count(*) from ins_grupos),
      'inserted_estudiantes_bulk', (select count(*) from ins_est),
      'linked', (select count(*) from ins_links)
    ) into result;

    return result;
  end;
  $$;
