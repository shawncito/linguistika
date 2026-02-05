import { supabase, supabaseAdmin } from '../supabase.js';

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter((v) => v !== null && v !== undefined)));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeSelectIn(client, table, select, column, ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await client.from(table).select(select).in(column, ids);
  if (error) throw error;
  return data || [];
}

async function safeSelectIlike(client, table, select, column, pattern) {
  const { data, error } = await client.from(table).select(select).ilike(column, pattern);
  if (error) throw error;
  return data || [];
}

async function safeDeleteIn(client, table, column, ids) {
  if (!ids || ids.length === 0) return 0;
  let deleted = 0;
  for (const part of chunk(ids, 200)) {
    const { error, count } = await client
      .from(table)
      .delete({ count: 'exact' })
      .in(column, part);
    if (error) throw error;
    deleted += count ?? part.length;
  }
  return deleted;
}

async function tryDeleteIn(client, table, column, ids, label) {
  try {
    const deleted = await safeDeleteIn(client, table, column, ids);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, step: label, table, deleted }, null, 2));
    return deleted;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ ok: false, step: label, table, error: err?.message || String(err) }, null, 2));
    return 0;
  }
}

async function main() {
  const runTag = getArg('runTag');
  const prefixArg = getArg('prefix');
  const apply = hasFlag('apply');

  const prefix = runTag ? `RT-${runTag}` : (prefixArg || 'RT-');
  const client = supabaseAdmin || supabase;

  if (!supabaseAdmin) {
    // eslint-disable-next-line no-console
    console.warn('⚠️  SUPABASE_SERVICE_KEY no está configurado. Intentaré con SUPABASE_ANON_KEY (puede fallar si hay RLS).');
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', prefix, usingServiceKey: !!supabaseAdmin }, null, 2));

  // 1) Descubrir entidades por prefijo
  const tutores = await safeSelectIlike(client, 'tutores', 'id,nombre,email', 'nombre', `${prefix}%`);
  const cursos = await safeSelectIlike(client, 'cursos', 'id,nombre,tutor_id', 'nombre', `${prefix}%`);

  // Matriculas_grupo puede llamarse matriculas_grupo en este proyecto
  let grupos = [];
  try {
    grupos = await safeSelectIlike(client, 'matriculas_grupo', 'id,nombre_grupo,curso_id,tutor_id', 'nombre_grupo', `${prefix}%`);
  } catch {
    grupos = [];
  }

  const estudiantesByName = await safeSelectIlike(client, 'estudiantes', 'id,nombre,email,email_encargado', 'nombre', `${prefix}%`);

  const tutorIds = uniq(tutores.map((t) => t.id));
  const cursoIds = uniq(cursos.map((c) => c.id));
  const grupoIds = uniq(grupos.map((g) => g.id));
  const estudianteIds = uniq(estudiantesByName.map((e) => e.id));

  // 2) Descubrir referencias (matriculas / clases / sesiones / movimientos / pagos)
  let matriculas = [];
  try {
    const byCurso = await safeSelectIn(client, 'matriculas', 'id,estudiante_id,tutor_id,curso_id', 'curso_id', cursoIds);
    const byTutor = await safeSelectIn(client, 'matriculas', 'id,estudiante_id,tutor_id,curso_id', 'tutor_id', tutorIds);
    const byEst = await safeSelectIn(client, 'matriculas', 'id,estudiante_id,tutor_id,curso_id', 'estudiante_id', estudianteIds);
    matriculas = uniq([...byCurso, ...byTutor, ...byEst].map((m) => JSON.stringify(m))).map((s) => JSON.parse(s));
  } catch {
    matriculas = [];
  }

  const matriculaIds = uniq(matriculas.map((m) => m.id));

  let clases = [];
  try {
    const cByCurso = await safeSelectIn(client, 'clases', 'id,matricula_id,curso_id,tutor_id', 'curso_id', cursoIds);
    const cByTutor = await safeSelectIn(client, 'clases', 'id,matricula_id,curso_id,tutor_id', 'tutor_id', tutorIds);
    const cByMat = await safeSelectIn(client, 'clases', 'id,matricula_id,curso_id,tutor_id', 'matricula_id', matriculaIds);
    clases = uniq([...cByCurso, ...cByTutor, ...cByMat].map((c) => JSON.stringify(c))).map((s) => JSON.parse(s));
  } catch {
    clases = [];
  }
  const claseIds = uniq(clases.map((c) => c.id));

  let sesiones = [];
  try {
    const sByCurso = await safeSelectIn(client, 'sesiones_clases', 'id,curso_id,tutor_id,matricula_id,fecha,estado', 'curso_id', cursoIds);
    const sByTutor = await safeSelectIn(client, 'sesiones_clases', 'id,curso_id,tutor_id,matricula_id,fecha,estado', 'tutor_id', tutorIds);
    const sByMat = await safeSelectIn(client, 'sesiones_clases', 'id,curso_id,tutor_id,matricula_id,fecha,estado', 'matricula_id', matriculaIds);
    sesiones = uniq([...sByCurso, ...sByTutor, ...sByMat].map((c) => JSON.stringify(c))).map((s) => JSON.parse(s));
  } catch {
    sesiones = [];
  }
  const sesionIds = uniq(sesiones.map((s) => s.id));

  let movimientos = [];
  try {
    const mByCurso = await safeSelectIn(client, 'movimientos_dinero', 'id,curso_id,tutor_id,matricula_id,tipo,fecha_pago,monto', 'curso_id', cursoIds);
    const mByTutor = await safeSelectIn(client, 'movimientos_dinero', 'id,curso_id,tutor_id,matricula_id,tipo,fecha_pago,monto', 'tutor_id', tutorIds);
    const mByMat = await safeSelectIn(client, 'movimientos_dinero', 'id,curso_id,tutor_id,matricula_id,tipo,fecha_pago,monto', 'matricula_id', matriculaIds);
    movimientos = uniq([...mByCurso, ...mByTutor, ...mByMat].map((c) => JSON.stringify(c))).map((s) => JSON.parse(s));
  } catch {
    movimientos = [];
  }
  const movimientoIds = uniq(movimientos.map((m) => m.id));

  let pagos = [];
  try {
    const pByTutor = await safeSelectIn(client, 'pagos', 'id,tutor_id,monto,descripcion,fecha_pago,estado', 'tutor_id', tutorIds);
    // filtro extra por descripcion con RunTag si viene
    if (runTag) {
      const { data, error } = await client.from('pagos').select('id,tutor_id,monto,descripcion,fecha_pago,estado').ilike('descripcion', `%${runTag}%`);
      if (!error) pagos = uniq([...pByTutor, ...(data || [])].map((p) => JSON.stringify(p))).map((s) => JSON.parse(s));
      else pagos = pByTutor;
    } else {
      pagos = pByTutor;
    }
  } catch {
    pagos = [];
  }
  const pagoIds = uniq(pagos.map((p) => p.id));

  let horarios = [];
  try {
    horarios = await safeSelectIn(client, 'horarios_tutores', 'id,tutor_id', 'tutor_id', tutorIds);
  } catch {
    horarios = [];
  }
  const horarioIds = uniq(horarios.map((h) => h.id));

  let linksGrupo = [];
  try {
    linksGrupo = await safeSelectIn(client, 'estudiantes_en_grupo', 'id,matricula_grupo_id', 'matricula_grupo_id', grupoIds);
  } catch {
    linksGrupo = [];
  }
  const linkIds = uniq(linksGrupo.map((l) => l.id));

  const summary = {
    tutores: tutores.length,
    cursos: cursos.length,
    grupos: grupos.length,
    estudiantes: estudiantesByName.length,
    matriculas: matriculas.length,
    clases: clases.length,
    sesiones_clases: sesiones.length,
    movimientos_dinero: movimientos.length,
    pagos: pagos.length,
    horarios_tutores: horarios.length,
    estudiantes_en_grupo: linksGrupo.length,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ discovered: summary }, null, 2));

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log('DRY_RUN: usa --apply para borrar.');
    return;
  }

  // 3) Borrado en orden (hijos -> padres)
  await tryDeleteIn(client, 'estudiantes_en_grupo', 'id', linkIds, 'delete estudiantes_en_grupo');
  await tryDeleteIn(client, 'clases', 'id', claseIds, 'delete clases');
  await tryDeleteIn(client, 'sesiones_clases', 'id', sesionIds, 'delete sesiones_clases');
  await tryDeleteIn(client, 'movimientos_dinero', 'id', movimientoIds, 'delete movimientos_dinero');
  await tryDeleteIn(client, 'pagos', 'id', pagoIds, 'delete pagos');
  await tryDeleteIn(client, 'matriculas', 'id', matriculaIds, 'delete matriculas');
  await tryDeleteIn(client, 'horarios_tutores', 'id', horarioIds, 'delete horarios_tutores');
  await tryDeleteIn(client, 'matriculas_grupo', 'id', grupoIds, 'delete matriculas_grupo');
  await tryDeleteIn(client, 'cursos', 'id', cursoIds, 'delete cursos');
  await tryDeleteIn(client, 'estudiantes', 'id', estudianteIds, 'delete estudiantes');
  await tryDeleteIn(client, 'tutores', 'id', tutorIds, 'delete tutores');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, message: 'Cleanup finalizado' }, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ cleanupRoundtrip falló:', err?.message || err);
  process.exit(1);
});
