import { supabase, supabaseAdmin } from '../supabase.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_COMPROBANTES_DIR = path.resolve(__dirname, '..', 'uploads', 'comprobantes');

function safeUnlinkLocalComprobante(url) {
  try {
    if (!url) return false;
    const str = String(url);
    const marker = '/uploads/comprobantes/';
    const idx = str.indexOf(marker);
    if (idx === -1) return false;
    const fileName = str.slice(idx + marker.length).split('?')[0].split('#')[0];
    if (!fileName) return false;
    const filePath = path.join(UPLOADS_COMPROBANTES_DIR, decodeURIComponent(fileName));
    if (!filePath.startsWith(UPLOADS_COMPROBANTES_DIR)) return false;
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
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

async function safeSelectOrIlike(client, table, select, pairs) {
  // pairs: [{ column, pattern }, ...]
  if (!pairs || pairs.length === 0) return [];
  const or = pairs
    .filter((p) => p?.column && p?.pattern)
    .map((p) => `${p.column}.ilike.${p.pattern}`)
    .join(',');
  if (!or) return [];
  const { data, error } = await client.from(table).select(select).or(or);
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
  const legacy = hasFlag('legacy');

  const prefix = legacy ? 'LEGACY' : (runTag ? `RT-${runTag}` : (prefixArg || 'RT-'));
  const client = supabaseAdmin || supabase;

  if (!supabaseAdmin) {
    // eslint-disable-next-line no-console
    console.warn('⚠️  SUPABASE_SERVICE_KEY no está configurado. Intentaré con SUPABASE_ANON_KEY (puede fallar si hay RLS).');
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', prefix, legacy, usingServiceKey: !!supabaseAdmin }, null, 2));

  // 1) Descubrir entidades por prefijo
  const legacyTutorEmails = ['maria@example.com'];
  const legacyStudentEmails = ['juan@example.com', 'ana@example.com'];
  const legacyCourseNames = ['Frances Avanzado A1', 'Francés Avanzado A1'];

  const tutores = legacy
    ? await safeSelectIn(client, 'tutores', 'id,nombre,email', 'email', legacyTutorEmails)
    : await safeSelectOrIlike(client, 'tutores', 'id,nombre,email', [
      { column: 'nombre', pattern: `${prefix}%` },
      ...(runTag ? [{ column: 'email', pattern: `%${runTag}%@example.com` }] : []),
    ]);

  const cursos = legacy
    ? await safeSelectIn(client, 'cursos', 'id,nombre,tutor_id', 'nombre', legacyCourseNames)
    : await safeSelectIlike(client, 'cursos', 'id,nombre,tutor_id', 'nombre', `${prefix}%`);

  // Matriculas_grupo puede llamarse matriculas_grupo en este proyecto
  let grupos = [];
  try {
    grupos = await safeSelectIlike(client, 'matriculas_grupo', 'id,nombre_grupo,curso_id,tutor_id', 'nombre_grupo', `${prefix}%`);
  } catch {
    grupos = [];
  }

  const estudiantesByName = legacy
    ? await safeSelectIn(
      client,
      'estudiantes',
      'id,nombre,email,email_encargado,encargado_id,nombre_encargado,telefono_encargado',
      'email',
      legacyStudentEmails
    )
    : await safeSelectOrIlike(
      client,
      'estudiantes',
      'id,nombre,email,email_encargado,encargado_id,nombre_encargado,telefono_encargado',
      [
        { column: 'nombre', pattern: `${prefix}%` },
        ...(runTag ? [{ column: 'email', pattern: `%${runTag}%@example.com` }] : []),
        ...(runTag ? [{ column: 'email_encargado', pattern: `%${runTag}%@example.com` }] : []),
      ]
    );

  let encargadosByEmail = [];
  try {
    if (legacy) {
      // Para legacy no tenemos un set confiable de emails de encargados. Se limpiará por referencias (cuentas/obligaciones).
      encargadosByEmail = [];
    } else {
      encargadosByEmail = runTag
        ? await safeSelectIlike(client, 'encargados', 'id,email,telefono,nombre', 'email', `%${runTag}%@example.com`)
        : [];
    }
  } catch {
    encargadosByEmail = [];
  }

  const tutorIds = uniq(tutores.map((t) => t.id));
  const cursoIds = uniq(cursos.map((c) => c.id));
  const grupoIds = uniq(grupos.map((g) => g.id));
  const estudianteIds = uniq(estudiantesByName.map((e) => e.id));
  const encargadoIdsFromStudents = uniq(estudiantesByName.map((e) => e.encargado_id));
  const encargadoIdsFromEncargados = uniq(encargadosByEmail.map((e) => e.id));
  const encargadoIds = uniq([...encargadoIdsFromStudents, ...encargadoIdsFromEncargados]);

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

  // 2.1) Tesorería v2 (opcional): obligaciones/pagos/cuentas corrientes
  let tesObligaciones = [];
  try {
    const bySesion = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'sesion_id', sesionIds);
    const byMat = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'matricula_id', matriculaIds);
    const byCurso = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'curso_id', cursoIds);
    const byTutor = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'tutor_id', tutorIds);
    const byEst = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'estudiante_id', estudianteIds);
    tesObligaciones = uniq([...bySesion, ...byMat, ...byCurso, ...byTutor, ...byEst].map((o) => JSON.stringify(o))).map((s) => JSON.parse(s));
  } catch {
    tesObligaciones = [];
  }
  let tesObligacionIds = uniq(tesObligaciones.map((o) => o.id));
  let tesCuentaIdsFromOblig = uniq(tesObligaciones.map((o) => o.cuenta_id));

  let tesCuentas = [];
  try {
    const byTutor = await safeSelectIn(client, 'tesoreria_cuentas_corrientes', 'id,tipo,encargado_id,tutor_id', 'tutor_id', tutorIds);
    const byEnc = await safeSelectIn(client, 'tesoreria_cuentas_corrientes', 'id,tipo,encargado_id,tutor_id', 'encargado_id', encargadoIds);
    tesCuentas = uniq([...byTutor, ...byEnc].map((c) => JSON.stringify(c))).map((s) => JSON.parse(s));
  } catch {
    tesCuentas = [];
  }
  const tesCuentaIds = uniq([...tesCuentaIdsFromOblig, ...tesCuentas.map((c) => c.id)]);

  // Algunas obligaciones pueden no tener tutor_id/curso_id pero sí cuenta_id (FK).
  // Expandimos el set por cuenta_id para poder eliminarlas y destrabar el borrado de cuentas.
  try {
    const byCuenta = await safeSelectIn(client, 'tesoreria_obligaciones', 'id,sesion_id,matricula_id,curso_id,tutor_id,estudiante_id,cuenta_id', 'cuenta_id', tesCuentaIds);
    const merged = uniq([...tesObligaciones, ...byCuenta].map((o) => JSON.stringify(o))).map((s) => JSON.parse(s));
    tesObligaciones = merged;
    tesObligacionIds = uniq(merged.map((o) => o.id));
    tesCuentaIdsFromOblig = uniq(merged.map((o) => o.cuenta_id));
  } catch {
    // ignorar
  }

  let tesPagos = [];
  try {
    const byCuenta = await safeSelectIn(client, 'tesoreria_pagos', 'id,cuenta_id,referencia,numero_comprobante,comprobante_url', 'cuenta_id', tesCuentaIds);
    let byRunTag = [];
    if (runTag) {
      byRunTag = await safeSelectOrIlike(client, 'tesoreria_pagos', 'id,cuenta_id,referencia,numero_comprobante,comprobante_url', [
        { column: 'numero_comprobante', pattern: `RT-${runTag}%` },
        { column: 'detalle', pattern: `%${runTag}%` },
      ]);
    }
    tesPagos = uniq([...byCuenta, ...byRunTag].map((p) => JSON.stringify(p))).map((s) => JSON.parse(s));
  } catch {
    tesPagos = [];
  }
  const tesPagoIds = uniq(tesPagos.map((p) => p.id));

  let tesAplicaciones = [];
  try {
    const aByOb = await safeSelectIn(client, 'tesoreria_aplicaciones', 'id,obligacion_id,pago_id', 'obligacion_id', tesObligacionIds);
    let aByPago = [];
    try {
      aByPago = await safeSelectIn(client, 'tesoreria_aplicaciones', 'id,obligacion_id,pago_id', 'pago_id', tesPagoIds);
    } catch {
      aByPago = [];
    }
    tesAplicaciones = uniq([...aByOb, ...aByPago].map((a) => JSON.stringify(a))).map((s) => JSON.parse(s));
  } catch {
    tesAplicaciones = [];
  }
  const tesAplicacionIds = uniq(tesAplicaciones.map((a) => a.id));

  let activityLogs = [];
  try {
    activityLogs = runTag
      ? await safeSelectIlike(client, 'activity_logs', 'id,summary', 'summary', `%${prefix}%`)
      : [];
  } catch {
    activityLogs = [];
  }
  const activityLogIds = uniq(activityLogs.map((a) => a.id));

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
    legacy,
    tutores: tutores.length,
    cursos: cursos.length,
    grupos: grupos.length,
    estudiantes: estudiantesByName.length,
    encargados: encargadosByEmail.length,
    matriculas: matriculas.length,
    clases: clases.length,
    sesiones_clases: sesiones.length,
    movimientos_dinero: movimientos.length,
    pagos: pagos.length,
    horarios_tutores: horarios.length,
    estudiantes_en_grupo: linksGrupo.length,
    tesoreria_obligaciones: tesObligaciones.length,
    tesoreria_aplicaciones: tesAplicaciones.length,
    tesoreria_pagos: tesPagos.length,
    tesoreria_cuentas_corrientes: tesCuentas.length,
    activity_logs: activityLogs.length,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ discovered: summary }, null, 2));

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log('DRY_RUN: usa --apply para borrar.');
    return;
  }

  // 3) Borrado en orden (hijos -> padres)
  // Tesorería v2
  await tryDeleteIn(client, 'tesoreria_aplicaciones', 'id', tesAplicacionIds, 'delete tesoreria_aplicaciones');
  await tryDeleteIn(client, 'tesoreria_obligaciones', 'id', tesObligacionIds, 'delete tesoreria_obligaciones');
  // Antes de borrar pagos: intentar borrar comprobantes locales (si son /uploads/comprobantes/)
  if (tesPagos.length > 0) {
    let filesDeleted = 0;
    for (const p of tesPagos) {
      if (safeUnlinkLocalComprobante(p.comprobante_url)) filesDeleted += 1;
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, step: 'delete local comprobantes', deletedFiles: filesDeleted }, null, 2));
  }
  await tryDeleteIn(client, 'tesoreria_pagos', 'id', tesPagoIds, 'delete tesoreria_pagos');
  await tryDeleteIn(client, 'activity_logs', 'id', activityLogIds, 'delete activity_logs');

  // Tablas legacy / core
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

  // Tesorería v2 - cuentas corrientes (antes de tutores por FK tutor_id)
  await tryDeleteIn(client, 'tesoreria_cuentas_corrientes', 'id', tesCuentaIds, 'delete tesoreria_cuentas_corrientes');

  await tryDeleteIn(client, 'tutores', 'id', tutorIds, 'delete tutores');

  // Encargados: solo si no hay estudiantes fuera del set de roundtrip que los referencien
  if (encargadoIds.length > 0) {
    let otros = [];
    try {
      const { data, error } = await client
        .from('estudiantes')
        .select('id,encargado_id')
        .in('encargado_id', encargadoIds);
      if (!error) {
        otros = (data || []).filter((e) => !estudianteIds.includes(e.id));
      }
    } catch {
      otros = [];
    }

    const bloqueados = new Set((otros || []).map((e) => e.encargado_id));
    const safeEncIds = encargadoIds.filter((id) => !bloqueados.has(id));

    if (bloqueados.size > 0) {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ ok: false, step: 'skip encargados with external references', blockedEncargadoIds: Array.from(bloqueados) }, null, 2));
    }

    await tryDeleteIn(client, 'encargados', 'id', safeEncIds, 'delete encargados');
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, message: 'Cleanup finalizado' }, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ cleanupRoundtrip falló:', err?.message || err);
  process.exit(1);
});
