/**
 * bulk.repository.mjs
 *
 * Contiene TODO el parsing de Excel (XLSX / ExcelJS), resolvers de nombres,
 * operaciones de lectura (grupos, estudiantes_bulk) y operaciones de escritura
 * (upload, templates).
 *
 * Regla: ÚNICO módulo que importa supabaseAdmin / supabaseForToken.
 */

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabaseAdmin, supabaseForToken } from '../../shared/config/supabaseClient.mjs';
import { validateTutorCourseSchedule } from '../../shared/utils/scheduleValidator.mjs';
import { schemaErrorPayload } from '../../shared/utils/schemaErrors.mjs';

/* ─── helpers BD ────────────────────────────────────────────────────────── */

function getDb(token) {
  return supabaseAdmin ?? supabaseForToken(token);
}

function isMissingColumnError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function isMissingRelationError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema'));
}

/* ─── helpers normalización ─────────────────────────────────────────────── */

export function normalizeEmail(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s || null;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function uniq(arr) {
  return Array.from(new Set((arr ?? []).filter(Boolean)));
}

function normalizeBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return ['si', 'sí', 's', 'yes', 'y', 'true', '1'].includes(s);
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

function normalizeNumericIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => Number(String(x).trim())).filter((x) => Number.isFinite(x));
}

function normalizeTurno(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'tarde') return 'Tarde';
  if (s === 'noche') return 'Noche';
  return null;
}

/* ─── helpers de tiempo ─────────────────────────────────────────────────── */

function timeToMinutesSafe(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function calcDuracionHoras(horaInicio, horaFin) {
  const a = timeToMinutesSafe(horaInicio);
  const b = timeToMinutesSafe(horaFin);
  if (a == null || b == null) return null;
  const diff = b - a;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return Math.round((diff / 60) * 100) / 100;
}

function normalizeDiaKey(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function scheduleOverlaps(scheduleA, scheduleB) {
  const a = scheduleA ?? {};
  const b = scheduleB ?? {};
  const bKeyByNorm = {};
  for (const k of Object.keys(b)) {
    const nk = normalizeDiaKey(k);
    if (nk && !bKeyByNorm[nk]) bKeyByNorm[nk] = k;
  }
  const conflicts = [];
  for (const diaA of Object.keys(a)) {
    const diaNorm = normalizeDiaKey(diaA);
    const diaB = bKeyByNorm[diaNorm];
    if (!diaB) continue;
    const aH = a[diaA]; const bH = b[diaB];
    const aStart = timeToMinutesSafe(aH?.hora_inicio);
    const aEnd = timeToMinutesSafe(aH?.hora_fin);
    const bStart = timeToMinutesSafe(bH?.hora_inicio);
    const bEnd = timeToMinutesSafe(bH?.hora_fin);
    if (aStart == null || aEnd == null || bStart == null || bEnd == null) continue;
    if (aStart < bEnd && aEnd > bStart) {
      conflicts.push({ dia: diaA, a: { hora_inicio: aH?.hora_inicio, hora_fin: aH?.hora_fin }, b: { hora_inicio: bH?.hora_inicio, hora_fin: bH?.hora_fin } });
    }
  }
  return conflicts;
}

/* ─── helpers de Excel ──────────────────────────────────────────────────── */

function readWorkbook(buffer) {
  return XLSX.read(buffer, { type: 'buffer' });
}

function getMetaBulkType(workbook) {
  const metaName = workbook.SheetNames.find((n) => n === '__meta');
  if (!metaName) return null;
  const sheet = workbook.Sheets[metaName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const key = String(row[0] ?? '').trim();
    const val = String(row[1] ?? '').trim();
    if (key === 'bulk_type') return val || null;
  }
  return null;
}

export function detectBulkTypeFromWorkbook(workbook) {
  const meta = getMetaBulkType(workbook);
  if (meta) return meta;
  const sheets = new Set((workbook.SheetNames || []).map((s) => String(s).trim().toUpperCase()));
  const hasEst = sheets.has('ESTUDIANTES');
  const hasGrupos = sheets.has('GRUPOS');
  const hasCursos = sheets.has('CURSOS');
  if (hasEst && hasGrupos) return 'plantilla_estudiantes_y_grupos_v1';
  if (hasEst) return 'plantilla_estudiantes_only_v1';
  if (hasCursos) return 'cursos_bulk_v1';
  return null;
}

function sheetToObjectsWithRowNumber(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headers = (matrix?.[0] ?? []).map((h) => String(h ?? '').trim());
  const rows = [];
  for (let i = 1; i < (matrix?.length ?? 0); i++) {
    const arr = matrix[i] ?? [];
    const obj = {};
    let hasAny = false;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const val = arr[c];
      if (val !== null && val !== undefined && String(val).trim() !== '') hasAny = true;
      obj[key] = val;
    }
    rows.push({ rowNumber: i + 1, hasAny, row: obj });
  }
  return rows;
}

function extractDiasScheduleFromCursoRow(row) {
  const dayKeys = [
    { label: 'Lunes', start: ['Lunes Inicio', 'Lunes Hora Inicio', 'Lunes inicio'], end: ['Lunes Fin', 'Lunes Hora Fin', 'Lunes fin'] },
    { label: 'Martes', start: ['Martes Inicio', 'Martes Hora Inicio', 'Martes inicio'], end: ['Martes Fin', 'Martes Hora Fin', 'Martes fin'] },
    { label: 'Miércoles', start: ['Miércoles Inicio', 'Miercoles Inicio', 'Miércoles Hora Inicio', 'Miercoles Hora Inicio'], end: ['Miércoles Fin', 'Miercoles Fin', 'Miércoles Hora Fin', 'Miercoles Hora Fin'] },
    { label: 'Jueves', start: ['Jueves Inicio', 'Jueves Hora Inicio', 'Jueves inicio'], end: ['Jueves Fin', 'Jueves Hora Fin', 'Jueves fin'] },
    { label: 'Viernes', start: ['Viernes Inicio', 'Viernes Hora Inicio', 'Viernes inicio'], end: ['Viernes Fin', 'Viernes Hora Fin', 'Viernes fin'] },
    { label: 'Sábado', start: ['Sábado Inicio', 'Sabado Inicio', 'Sábado Hora Inicio', 'Sabado Hora Inicio'], end: ['Sábado Fin', 'Sabado Fin', 'Sábado Hora Fin', 'Sabado Hora Fin'] },
    { label: 'Domingo', start: ['Domingo Inicio', 'Domingo Hora Inicio', 'Domingo inicio'], end: ['Domingo Fin', 'Domingo Hora Fin', 'Domingo fin'] },
  ];
  const dias = [];
  const dias_schedule = {};
  for (const d of dayKeys) {
    let inicio = ''; let fin = '';
    for (const k of d.start) { if (row[k] !== undefined && String(row[k]).trim() !== '') { inicio = String(row[k]).trim(); break; } }
    for (const k of d.end) { if (row[k] !== undefined && String(row[k]).trim() !== '') { fin = String(row[k]).trim(); break; } }
    if (!inicio && !fin) continue;
    if (!inicio || !fin) return { error: `Horario incompleto en ${d.label} (requiere Inicio y Fin)` };
    const dur = calcDuracionHoras(inicio, fin);
    if (dur == null) return { error: `Horario inválido en ${d.label} (${inicio}-${fin})` };
    dias.push(d.label);
    dias_schedule[d.label] = { hora_inicio: inicio, hora_fin: fin, duracion_horas: dur };
  }
  return {
    dias: dias.length ? dias : null,
    dias_schedule: Object.keys(dias_schedule).length ? dias_schedule : null,
  };
}

function extractDiasTurnoFromRow(row) {
  const dayKeys = [
    { label: 'Lunes', keys: ['Lunes', 'lunes'] },
    { label: 'Martes', keys: ['Martes', 'martes'] },
    { label: 'Miércoles', keys: ['Miércoles', 'Miercoles', 'miércoles', 'miercoles'] },
    { label: 'Jueves', keys: ['Jueves', 'jueves'] },
    { label: 'Viernes', keys: ['Viernes', 'viernes'] },
    { label: 'Sábado', keys: ['Sábado', 'Sabado', 'sábado', 'sabado'] },
    { label: 'Domingo', keys: ['Domingo', 'domingo'] },
  ];
  const dias = []; const dias_turno = {};
  for (const d of dayKeys) {
    let raw = '';
    for (const k of d.keys) { if (row[k] !== undefined && String(row[k]).trim() !== '') { raw = row[k]; break; } }
    const turno = normalizeTurno(raw);
    if (turno) { dias.push(d.label); dias_turno[d.label] = turno; }
  }
  return { dias: dias.length ? dias : null, dias_turno: Object.keys(dias_turno).length ? dias_turno : null };
}

function validateTutorAptitudeForCourse(tutor, cursoNivel) {
  const nivel = String(cursoNivel ?? '').trim();
  if (!nivel || nivel === 'None') return { ok: true };
  const niveles = Array.isArray(tutor?.niveles_apto) ? tutor.niveles_apto : [];
  const specialized = !!tutor?.es_especializado || niveles.length > 0;
  if (!specialized) return { ok: true };
  if (!niveles.includes(nivel)) return { ok: false, reason: `El tutor no está marcado como apto para el nivel ${nivel}` };
  return { ok: true };
}

/* ─── resolvers ─────────────────────────────────────────────────────────── */

async function resolveCursoIdByNombre(db, nombre) {
  const n = String(nombre ?? '').trim();
  if (!n) return null;
  let { data, error } = await db.from('cursos').select('id, nombre, estado').eq('nombre', n).eq('estado', true).limit(2);
  if (error) throw error;
  if (!data || data.length === 0) {
    ({ data, error } = await db.from('cursos').select('id, nombre, estado').ilike('nombre', n).eq('estado', true).limit(2));
    if (error) throw error;
  }
  if (!data || data.length === 0) return null;
  if (data.length > 1) throw new Error(`Curso ambiguo: "${n}"`);
  return data[0].id;
}

async function resolveCursoIdByIdOrNombre(db, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const maybeId = parseInt(raw, 10);
  if (String(maybeId) === raw && Number.isFinite(maybeId)) {
    const { data, error } = await db.from('cursos').select('id, estado').eq('id', maybeId).eq('estado', true).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  return resolveCursoIdByNombre(db, raw);
}

async function resolveTutorIdByNombre(db, nombre) {
  const n = String(nombre ?? '').trim();
  if (!n) return null;
  let { data, error } = await db.from('tutores').select('id, nombre, estado').eq('nombre', n).eq('estado', true).limit(2);
  if (error) throw error;
  if (!data || data.length === 0) {
    ({ data, error } = await db.from('tutores').select('id, nombre, estado').ilike('nombre', n).eq('estado', true).limit(2));
    if (error) throw error;
  }
  if (!data || data.length === 0) return null;
  if (data.length > 1) throw new Error(`Tutor ambiguo: "${n}"`);
  return data[0].id;
}

async function resolveTutorIdByIdOrNombre(db, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const maybeId = parseInt(raw, 10);
  if (String(maybeId) === raw && Number.isFinite(maybeId)) {
    const { data, error } = await db.from('tutores').select('id, estado').eq('id', maybeId).eq('estado', true).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  return resolveTutorIdByNombre(db, raw);
}

async function validateTutorNoCourseConflicts(db, tutorId, nextSchedule, excludeCursoId = null) {
  const { data: cursos, error } = await db.from('cursos').select('id,nombre,nivel,dias_schedule,estado').eq('tutor_id', tutorId).order('created_at', { ascending: false });
  if (error) throw error;
  const conflicts = [];
  for (const c of cursos ?? []) {
    if (excludeCursoId != null && String(c.id) === String(excludeCursoId)) continue;
    if (c?.estado === false) continue;
    const otherSchedule = parseJsonMaybe(c.dias_schedule);
    if (!otherSchedule || Object.keys(otherSchedule).length === 0) continue;
    const overlaps = scheduleOverlaps(nextSchedule, otherSchedule);
    if (overlaps.length > 0) conflicts.push({ curso_id: c.id, curso_nombre: c.nombre, curso_nivel: c.nivel, overlaps });
  }
  return conflicts;
}

/* ─── helpers de plantilla ExcelJS ─────────────────────────────────────── */

async function fetchCatalogosForTemplate(db) {
  const [{ data: cursos, error: cErr }, { data: tutores, error: tErr }] = await Promise.all([
    db.from('cursos').select('id, nombre, estado').eq('estado', true).order('nombre', { ascending: true }),
    db.from('tutores').select('id, nombre, estado').eq('estado', true).order('nombre', { ascending: true }),
  ]);
  if (cErr) throw cErr;
  if (tErr) throw tErr;
  return {
    cursos: (cursos ?? []).map((c) => ({ id: c.id, nombre: c.nombre })),
    tutores: (tutores ?? []).map((t) => ({ id: t.id, nombre: t.nombre })),
  };
}

function setHeaderRow(worksheet, headers) {
  worksheet.addRow(headers);
  const row = worksheet.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 20;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function applyListValidation(worksheet, columnNumber, fromRow, toRow, formula) {
  for (let r = fromRow; r <= toRow; r++) {
    worksheet.getCell(r, columnNumber).dataValidation = {
      type: 'list', allowBlank: true, showErrorMessage: true, errorStyle: 'warning', formulae: [formula],
    };
  }
}

async function buildTemplateEstudiantesBulkExcelJS() {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(); workbook.modified = new Date();
  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES']);
  wsLeeme.addRow(['']); wsLeeme.addRow(['Este archivo permite cargar estudiantes de forma masiva.']);
  wsLeeme.addRow(['']); wsLeeme.addRow(['HOJA – ESTUDIANTES:']);
  wsLeeme.addRow(['- Completa las columnas.']);
  wsLeeme.addRow(['- "Grado*" es obligatorio.']);
  wsLeeme.addRow(['- Días: escribe Tarde/Noche en la columna del día. Deja vacío si no asiste ese día.']);
  wsLeeme.getColumn(1).width = 90;
  const wsEst = workbook.addWorksheet('ESTUDIANTES');
  setHeaderRow(wsEst, ['Nombre Completo*', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', 'Grado*', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  wsEst.addRow(['', '', '', '', '', '', '', '', '', '', '', '']);
  wsEst.getColumn(1).width = 28; wsEst.getColumn(2).width = 28; wsEst.getColumn(3).width = 28; wsEst.getColumn(4).width = 20; wsEst.getColumn(5).width = 14;
  for (let i = 6; i <= 12; i++) wsEst.getColumn(i).width = 12;
  applyListValidation(wsEst, 5, 2, 1000, '"1ro,2do,3ro,4to,5to,6to,7mo,8vo,9no,10mo,11mo,No aplica"');
  for (let col = 6; col <= 12; col++) applyListValidation(wsEst, col, 2, 1000, '"Tarde,Noche"');
  return workbook;
}

async function buildTemplateGrupoMatriculaExcelJS(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(); workbook.modified = new Date();
  const { cursos, tutores } = await fetchCatalogosForTemplate(db);
  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES Y GRUPOS']);
  wsLeeme.addRow(['']); wsLeeme.addRow(['HOJA 1 – ESTUDIANTES: "Grupo (Opcional)" debe coincidir con GRUPOS.']);
  wsLeeme.addRow(['HOJA 2 – GRUPOS: Curso/Tutor desde listas. Turno: Tarde / Noche.']);
  wsLeeme.getColumn(1).width = 90;
  const wsListas = workbook.addWorksheet('LISTAS', { state: 'veryHidden' });
  setHeaderRow(wsListas, ['Cursos (Nombre)', 'Tutores (Nombre)', 'Turnos', 'Grados']);
  const turnos = ['Tarde', 'Noche'];
  const grados = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo', 'No aplica'];
  const maxLen = Math.max(cursos.length, tutores.length, 2);
  for (let i = 0; i < maxLen; i++) wsListas.addRow([cursos[i]?.nombre ?? '', tutores[i]?.nombre ?? '', turnos[i] ?? '', grados[i] ?? '']);
  wsListas.getColumn(1).width = 40; wsListas.getColumn(2).width = 40; wsListas.getColumn(3).width = 18; wsListas.getColumn(4).width = 14;
  const wsEst = workbook.addWorksheet('ESTUDIANTES');
  setHeaderRow(wsEst, ['Nombre Completo*', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', 'Grado*', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Grupo (Opcional)']);
  wsEst.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '']);
  wsEst.getColumn(1).width = 28; wsEst.getColumn(2).width = 28; wsEst.getColumn(3).width = 28; wsEst.getColumn(4).width = 20; wsEst.getColumn(5).width = 14;
  for (let i = 6; i <= 12; i++) wsEst.getColumn(i).width = 12;
  wsEst.getColumn(13).width = 22;
  const wsGrupos = workbook.addWorksheet('GRUPOS');
  setHeaderRow(wsGrupos, ['Nombre del Grupo', 'Curso (ID o Nombre)', 'Tutor (Nombre)', 'Estudiantes Esperados', 'Fecha Inicio (AAAA-MM-DD)', 'Turno']);
  wsGrupos.addRow(['', '', '', '', '', '']);
  wsGrupos.getColumn(1).width = 28; wsGrupos.getColumn(2).width = 32; wsGrupos.getColumn(3).width = 32; wsGrupos.getColumn(4).width = 22; wsGrupos.getColumn(5).width = 22; wsGrupos.getColumn(6).width = 14;
  const cursosEnd = Math.max(2, cursos.length + 1);
  const tutoresEnd = Math.max(2, tutores.length + 1);
  const gradosEnd = Math.max(2, grados.length + 1);
  applyListValidation(wsGrupos, 2, 2, 1000, `'LISTAS'!$A$2:$A$${cursosEnd}`);
  applyListValidation(wsGrupos, 3, 2, 1000, `'LISTAS'!$B$2:$B$${tutoresEnd}`);
  applyListValidation(wsGrupos, 6, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 5, 2, 1000, `'LISTAS'!$D$2:$D$${gradosEnd}`);
  for (let col = 6; col <= 12; col++) applyListValidation(wsEst, col, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 13, 2, 1000, `'GRUPOS'!$A$2:$A$1000`);
  return workbook;
}

async function buildTemplateCursosBulkExcelJS(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(); workbook.modified = new Date();
  const wsMeta = workbook.addWorksheet('__meta', { state: 'veryHidden' });
  wsMeta.addRow(['bulk_type', 'cursos_bulk_v1']);
  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE CURSOS']);
  wsLeeme.addRow(['']); wsLeeme.addRow(['1) Descarga este template, complétalo y súbelo en Cursos.']);
  wsLeeme.addRow(['2) Si una fila tiene error, se omitirá y se reportará el motivo; las demás se insertan.']);
  wsLeeme.addRow(['3) Si asignas Tutor, debes definir horario (dias_schedule) con hora inicio/fin por día.']);
  wsLeeme.addRow(['4) Formato de hora: HH:mm (24 horas). Ej: 08:00, 17:30.']);
  wsLeeme.getColumn(1).width = 95;
  const { tutores } = await fetchCatalogosForTemplate(db);
  const wsListas = workbook.addWorksheet('LISTAS', { state: 'veryHidden' });
  setHeaderRow(wsListas, ['Tutores (Nombre)', 'Niveles', 'Tipo Clase', 'Tipo Pago']);
  const niveles = ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const tipoClase = ['grupal', 'tutoria'];
  const tipoPago = ['sesion', 'mensual'];
  const maxLen = Math.max(tutores.length, niveles.length, tipoClase.length, tipoPago.length, 2);
  for (let i = 0; i < maxLen; i++) wsListas.addRow([tutores[i]?.nombre ?? '', niveles[i] ?? '', tipoClase[i] ?? '', tipoPago[i] ?? '']);
  wsListas.getColumn(1).width = 40; wsListas.getColumn(2).width = 14; wsListas.getColumn(3).width = 14; wsListas.getColumn(4).width = 14;
  const wsCursos = workbook.addWorksheet('CURSOS');
  setHeaderRow(wsCursos, ['Nombre*', 'Descripción', 'Nivel', 'Tipo Clase', 'Tipo Pago', 'Max Estudiantes', 'Costo Curso', 'Pago Tutor', 'Tutor (Nombre o ID)', 'Lunes Inicio', 'Lunes Fin', 'Martes Inicio', 'Martes Fin', 'Miércoles Inicio', 'Miércoles Fin', 'Jueves Inicio', 'Jueves Fin', 'Viernes Inicio', 'Viernes Fin', 'Sábado Inicio', 'Sábado Fin', 'Domingo Inicio', 'Domingo Fin']);
  wsCursos.addRow(new Array(23).fill(''));
  wsCursos.views = [{ state: 'frozen', ySplit: 1 }];
  wsCursos.getColumn(1).width = 30; wsCursos.getColumn(2).width = 45; wsCursos.getColumn(3).width = 10; wsCursos.getColumn(4).width = 12; wsCursos.getColumn(5).width = 12; wsCursos.getColumn(6).width = 16; wsCursos.getColumn(7).width = 14; wsCursos.getColumn(8).width = 12; wsCursos.getColumn(9).width = 26;
  for (let col = 10; col <= 23; col++) wsCursos.getColumn(col).width = 14;
  const tutoresEnd = Math.max(2, tutores.length + 1);
  const nivelesEnd = Math.max(2, niveles.length + 1);
  const tipoClaseEnd = Math.max(2, tipoClase.length + 1);
  const tipoPagoEnd = Math.max(2, tipoPago.length + 1);
  applyListValidation(wsCursos, 3, 2, 1000, `'LISTAS'!$B$2:$B$${nivelesEnd}`);
  applyListValidation(wsCursos, 4, 2, 1000, `'LISTAS'!$C$2:$C$${tipoClaseEnd}`);
  applyListValidation(wsCursos, 5, 2, 1000, `'LISTAS'!$D$2:$D$${tipoPagoEnd}`);
  applyListValidation(wsCursos, 9, 2, 1000, `'LISTAS'!$A$2:$A$${tutoresEnd}`);
  return workbook;
}

/* ─── Lecturas administrativas ──────────────────────────────────────────── */

export async function getGrupos(token) {
  const db = getDb(token);
  const { data: grupos, error: gErr } = await db.from('matriculas_grupo').select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at');
  if (gErr) throw gErr;
  const cursoIds = Array.from(new Set((grupos ?? []).map((g) => g.curso_id).filter(Boolean)));
  const tutorIds = Array.from(new Set((grupos ?? []).map((g) => g.tutor_id).filter(Boolean)));
  const grupoIdsNum = normalizeNumericIds((grupos ?? []).map((g) => g.id));
  const [{ data: cursos, error: cErr }, { data: tutores, error: tErr }, { data: linksBulk, error: lErr }] = await Promise.all([
    cursoIds.length ? db.from('cursos').select('id, nombre, costo_curso, pago_tutor').in('id', cursoIds) : Promise.resolve({ data: [], error: null }),
    tutorIds.length ? db.from('tutores').select('id, nombre').in('id', tutorIds) : Promise.resolve({ data: [], error: null }),
    grupoIdsNum.length ? db.from('estudiantes_en_grupo').select('matricula_grupo_id').in('matricula_grupo_id', grupoIdsNum) : Promise.resolve({ data: [], error: null }),
  ]);
  if (cErr) throw cErr; if (tErr) throw tErr; if (lErr) throw lErr;
  let linksNormal = [];
  if (grupoIdsNum.length) {
    const { data, error } = await db.from('estudiantes').select('matricula_grupo_id').in('matricula_grupo_id', grupoIdsNum);
    if (error && !isMissingColumnError(error)) throw error;
    linksNormal = data ?? [];
  }
  const cursoMap = new Map((cursos ?? []).map((c) => [c.id, { nombre: c.nombre, costo_curso: c.costo_curso, pago_tutor: c.pago_tutor }]));
  const tutorMap = new Map((tutores ?? []).map((t) => [t.id, t.nombre]));
  const linkCount = new Map();
  for (const row of linksBulk ?? []) { const gid = row.matricula_grupo_id; linkCount.set(gid, (linkCount.get(gid) || 0) + 1); }
  for (const row of linksNormal ?? []) { const gid = row.matricula_grupo_id; linkCount.set(gid, (linkCount.get(gid) || 0) + 1); }
  return (grupos ?? []).map((g) => {
    const cursoData = cursoMap.get(g.curso_id) ?? {};
    return { ...g, curso_nombre: cursoData.nombre ?? null, tutor_nombre: tutorMap.get(g.tutor_id) ?? null, costo_curso: Number(cursoData.costo_curso) || 0, pago_tutor: Number(cursoData.pago_tutor) || 0, linked_count: linkCount.get(g.id) || 0 };
  }).sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
}

export async function getGrupoById(id, token) {
  const db = getDb(token);
  const { data: grupo, error: gErr } = await db.from('matriculas_grupo').select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at').eq('id', id).maybeSingle();
  if (gErr) throw gErr;
  if (!grupo) return null;
  const gidNum = Number(id);
  const [{ data: curso }, { data: tutor }, { data: links, error: lErr }] = await Promise.all([
    grupo.curso_id ? db.from('cursos').select('id, nombre, costo_curso, pago_tutor').eq('id', grupo.curso_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    grupo.tutor_id ? db.from('tutores').select('id, nombre').eq('id', grupo.tutor_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('estudiantes_en_grupo').select('estudiante_bulk_id').eq('matricula_grupo_id', grupo.id),
  ]);
  if (lErr) throw lErr;
  const bulkIds = (links ?? []).map((l) => l.estudiante_bulk_id);
  const { data: estudiantes, error: eErr } = bulkIds.length ? await db.from('estudiantes_bulk').select('id, nombre, correo, telefono, requiere_perfil_completo, estado, created_at, updated_at').in('id', bulkIds).order('created_at', { ascending: false }) : { data: [], error: null };
  if (eErr) throw eErr;
  let estudiantesNormales = [];
  if (Number.isFinite(gidNum)) {
    const { data, error } = await db.from('estudiantes').select('id, nombre, email, telefono, email_encargado, telefono_encargado, grado, estado, created_at, updated_at').eq('matricula_grupo_id', gidNum);
    if (error && !isMissingColumnError(error)) throw error;
    estudiantesNormales = data ?? [];
  }
  return {
    grupo: { ...grupo, curso_nombre: curso?.nombre ?? null, tutor_nombre: tutor?.nombre ?? null, costo_curso: Number(curso?.costo_curso) || 0, pago_tutor: Number(curso?.pago_tutor) || 0, linked_count: bulkIds.length + (estudiantesNormales?.length ?? 0) },
    estudiantes: { bulk: estudiantes ?? [], normales: estudiantesNormales ?? [] },
  };
}

export async function getEstudiantes(token) {
  const db = getDb(token);
  let estudiantes;
  const { data, error } = await db.from('estudiantes_bulk').select('id, nombre, nombre_encargado, correo, telefono, email_encargado, telefono_encargado, grado, dias, dias_turno, requiere_perfil_completo, estado, created_at, updated_at').order('created_at', { ascending: false });
  if (error) {
    if (isMissingColumnError(error)) {
      const fallback = await db.from('estudiantes_bulk').select('id, nombre, correo, telefono, requiere_perfil_completo, estado, created_at, updated_at').order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      estudiantes = (fallback.data ?? []).map((s) => ({ ...s, nombre_encargado: null, email_encargado: null, telefono_encargado: null, grado: null, dias: null, dias_turno: null }));
    } else { throw error; }
  } else { estudiantes = data ?? []; }
  const { data: links, error: lErr } = await db.from('estudiantes_en_grupo').select('estudiante_bulk_id, matricula_grupo_id');
  if (lErr) throw lErr;
  const estudianteToGrupo = new Map();
  for (const row of links ?? []) { if (!estudianteToGrupo.has(row.estudiante_bulk_id)) estudianteToGrupo.set(row.estudiante_bulk_id, row.matricula_grupo_id); }
  return (estudiantes ?? []).map((s) => ({ ...s, dias: s.dias ? JSON.parse(s.dias) : null, dias_turno: s.dias_turno ? JSON.parse(s.dias_turno) : null, matricula_grupo_id: estudianteToGrupo.get(s.id) ?? null }));
}

/* ─── CRUD grupos / estudiantes_bulk ───────────────────────────────────── */

export async function createGrupo({ curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, fecha_inicio, fecha_fin, turno, notas, estado = 'activa', userId, token }) {
  const db = getDb(token);
  const cursoId = parseInt(String(curso_id), 10);
  const tutorId = parseInt(String(tutor_id), 10);
  if (!Number.isFinite(cursoId) || !Number.isFinite(tutorId)) throw new Error('curso_id y tutor_id son requeridos y deben ser numéricos.');
  const cant = cantidad_estudiantes_esperados != null && String(cantidad_estudiantes_esperados).trim() !== '' ? parseInt(String(cantidad_estudiantes_esperados), 10) : null;
  const { data: grupo, error } = await db.from('matriculas_grupo').insert({ curso_id: cursoId, tutor_id: tutorId, nombre_grupo: nombre_grupo ? String(nombre_grupo).trim() : null, cantidad_estudiantes_esperados: Number.isFinite(cant) ? cant : null, estado: String(estado), fecha_inicio: fecha_inicio ? String(fecha_inicio).trim() : null, fecha_fin: fecha_fin ? String(fecha_fin).trim() : null, turno: turno ? String(turno).trim() : null, notas: notas ? String(notas).trim() : null, created_by: userId, updated_by: userId, updated_at: new Date().toISOString() }).select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at').single();
  if (error) throw error;
  return grupo;
}

export async function updateGrupo(id, body, token) {
  const db = getDb(token);
  const updateData = { updated_by: body.userId, updated_at: new Date().toISOString() };
  if (body.curso_id !== undefined) { const v = parseInt(String(body.curso_id), 10); if (!Number.isFinite(v)) throw new Error('curso_id debe ser numérico.'); updateData.curso_id = v; }
  if (body.tutor_id !== undefined) { const v = parseInt(String(body.tutor_id), 10); if (!Number.isFinite(v)) throw new Error('tutor_id debe ser numérico.'); updateData.tutor_id = v; }
  if (body.nombre_grupo !== undefined) updateData.nombre_grupo = body.nombre_grupo ? String(body.nombre_grupo).trim() : null;
  if (body.cantidad_estudiantes_esperados !== undefined) { const cant = body.cantidad_estudiantes_esperados != null && String(body.cantidad_estudiantes_esperados).trim() !== '' ? parseInt(String(body.cantidad_estudiantes_esperados), 10) : null; updateData.cantidad_estudiantes_esperados = Number.isFinite(cant) ? cant : null; }
  if (body.estado !== undefined) updateData.estado = body.estado ? String(body.estado) : null;
  if (body.fecha_inicio !== undefined) updateData.fecha_inicio = body.fecha_inicio ? String(body.fecha_inicio).trim() : null;
  if (body.fecha_fin !== undefined) updateData.fecha_fin = body.fecha_fin ? String(body.fecha_fin).trim() : null;
  if (body.turno !== undefined) updateData.turno = body.turno ? String(body.turno).trim() : null;
  if (body.notas !== undefined) updateData.notas = body.notas ? String(body.notas).trim() : null;
  const { data: grupo, error } = await db.from('matriculas_grupo').update(updateData).eq('id', id).select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at').single();
  if (error) throw error;
  return grupo;
}

export async function deleteGrupo(id, token) {
  const db = getDb(token);
  const gidNum = Number(id);
  if (Number.isFinite(gidNum)) {
    const { error } = await db.from('estudiantes').update({ matricula_grupo_id: null, updated_at: new Date().toISOString() }).eq('matricula_grupo_id', gidNum);
    if (error && !isMissingColumnError(error)) throw error;
    const { error: mfErr } = await db.from('movimientos_financieros').update({ matricula_grupo_id: null, updated_at: new Date().toISOString() }).eq('matricula_grupo_id', gidNum);
    if (mfErr) { const msg = String(mfErr?.message ?? '').toLowerCase(); if (!(msg.includes('relation') && msg.includes('does not exist'))) throw mfErr; }
  }
  const { error: delErr } = await db.from('matriculas_grupo').delete().eq('id', id);
  if (delErr) throw delErr;
  return { ok: true, id };
}

export async function createEstudianteBulk({ nombre, nombre_encargado, email_encargado, telefono_encargado, requiere_perfil_completo = false, estado = true, userId, token }) {
  const db = getDb(token);
  const n = String(nombre ?? '').trim();
  if (!n) throw new Error('nombre es requerido.');
  const { data, error } = await db.from('estudiantes_bulk').insert({ nombre: n, nombre_encargado: nombre_encargado ? String(nombre_encargado).trim() : null, email_encargado: email_encargado ? String(email_encargado).trim() : null, telefono_encargado: telefono_encargado ? String(telefono_encargado).trim() : null, requiere_perfil_completo: !!requiere_perfil_completo, estado: estado === true || estado === 1 || estado === '1', created_by: userId, updated_by: userId, updated_at: new Date().toISOString() }).select('id, nombre, nombre_encargado, email_encargado, telefono_encargado, requiere_perfil_completo, estado, created_at, updated_at').single();
  if (error) throw error;
  return data;
}

export async function updateEstudianteBulk(id, body, token) {
  const db = getDb(token);
  const updateData = { updated_by: body.userId, updated_at: new Date().toISOString() };
  if (body.nombre !== undefined) updateData.nombre = body.nombre ? String(body.nombre).trim() : null;
  if (body.nombre_encargado !== undefined) updateData.nombre_encargado = body.nombre_encargado ? String(body.nombre_encargado).trim() : null;
  if (body.email_encargado !== undefined) updateData.email_encargado = body.email_encargado ? String(body.email_encargado).trim() : null;
  if (body.telefono_encargado !== undefined) updateData.telefono_encargado = body.telefono_encargado ? String(body.telefono_encargado).trim() : null;
  if (body.requiere_perfil_completo !== undefined) updateData.requiere_perfil_completo = !!body.requiere_perfil_completo;
  if (body.estado !== undefined) updateData.estado = body.estado === true || body.estado === 1 || body.estado === '1';
  const { data, error } = await db.from('estudiantes_bulk').update(updateData).eq('id', id).select('id, nombre, nombre_encargado, email_encargado, telefono_encargado, requiere_perfil_completo, estado, created_at, updated_at').single();
  if (error) throw error;
  return data;
}

export async function deleteEstudianteBulk(id, token) {
  const db = getDb(token);
  const { error: linkErr } = await db.from('estudiantes_en_grupo').delete().eq('estudiante_bulk_id', id);
  if (linkErr) throw linkErr;
  const { error } = await db.from('estudiantes_bulk').delete().eq('id', id);
  if (error) throw error;
  return { ok: true, id };
}

export async function assignEstudiantesAGrupo({ gid, estudianteBulkIds, estudianteIds, token }) {
  const db = getDb(token);
  if (estudianteBulkIds.length) {
    const { error: delErr } = await db.from('estudiantes_en_grupo').delete().in('estudiante_bulk_id', estudianteBulkIds);
    if (delErr) throw delErr;
    const { error: insErr } = await db.from('estudiantes_en_grupo').insert(estudianteBulkIds.map((eid) => ({ matricula_grupo_id: gid, estudiante_bulk_id: eid })));
    if (insErr) throw insErr;
  }
  if (estudianteIds.length) {
    const gidNum = Number(gid);
    if (!Number.isFinite(gidNum)) throw new Error('id de grupo inválido');
    const { error: updErr } = await db.from('estudiantes').update({ matricula_grupo_id: gidNum, updated_at: new Date().toISOString() }).in('id', estudianteIds);
    if (updErr) { if (isMissingColumnError(updErr)) throw new Error('Tu base de datos aún no tiene la columna matricula_grupo_id en estudiantes. Aplica la migración 003_add_matricula_grupo_id_to_estudiantes.sql.'); throw updErr; }
  }
  return { ok: true, matricula_grupo_id: gid, assigned_bulk: estudianteBulkIds.length, assigned_normales: estudianteIds.length };
}

export async function unassignEstudiantes({ estudianteBulkIds, estudianteIds, token }) {
  const db = getDb(token);
  if (estudianteBulkIds.length) { const { error } = await db.from('estudiantes_en_grupo').delete().in('estudiante_bulk_id', estudianteBulkIds); if (error) throw error; }
  if (estudianteIds.length) { const { error } = await db.from('estudiantes').update({ matricula_grupo_id: null, updated_at: new Date().toISOString() }).in('id', estudianteIds); if (error && !isMissingColumnError(error)) throw error; }
  return { ok: true, unassigned_bulk: estudianteBulkIds.length, unassigned_normales: estudianteIds.length };
}

/* ─── Templates ─────────────────────────────────────────────────────────── */

export async function getTemplate(tipo, token) {
  const db = getDb(token);
  let wb; let filename;
  if (tipo === 'estudiantes_bulk') {
    wb = await buildTemplateEstudiantesBulkExcelJS();
    filename = 'template_estudiantes_bulk.xlsx';
  } else if (tipo === 'grupo_matricula') {
    wb = await buildTemplateGrupoMatriculaExcelJS(db);
    filename = 'template_grupo_matricula.xlsx';
  } else if (tipo === 'cursos_bulk') {
    wb = await buildTemplateCursosBulkExcelJS(db);
    filename = 'template_cursos_bulk.xlsx';
  } else {
    return null;
  }
  const buf = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buf), filename };
}

/* ─── Preview ───────────────────────────────────────────────────────────── */

export async function preview(buffer, token) {
  const { MAX_PREVIEW_ROWS } = await import('./bulk.schemas.mjs');
  const wb = readWorkbook(buffer);
  const bulkType = detectBulkTypeFromWorkbook(wb);
  if (!bulkType) return { error: 'No se pudo detectar el tipo de bulk. Asegúrate de usar el template descargado.' };
  const db = getDb(token);

  if (bulkType === 'cursos_bulk_v1') {
    const sheet = wb.Sheets['CURSOS'] || wb.Sheets['Cursos'] || wb.Sheets['cursos'];
    if (!sheet) return { error: 'Falta hoja "CURSOS"' };
    const rows = sheetToObjectsWithRowNumber(sheet);
    const attemptedRows = rows.filter((x) => x.hasAny);
    if (attemptedRows.length === 0) return { error: 'No hay filas con datos en la hoja CURSOS.' };
    const previewItems = []; const errors = [];
    for (const item of attemptedRows.slice(0, MAX_PREVIEW_ROWS)) {
      const row = item.row; const rowNumber = item.rowNumber;
      const nombre = String(row['Nombre*'] ?? row['Nombre'] ?? row['nombre'] ?? '').trim();
      const nivel = String(row['Nivel'] ?? 'None').trim() || 'None';
      const tutor_ref = String(row['Tutor (Nombre o ID)'] ?? row['Tutor'] ?? '').trim();
      let tutor_id = null; let schedule_error = null; let tutor_error = null;
      try {
        const { dias_schedule, error: scheduleErr } = extractDiasScheduleFromCursoRow(row);
        if (scheduleErr) schedule_error = scheduleErr;
        if (tutor_ref) {
          tutor_id = await resolveTutorIdByIdOrNombre(db, tutor_ref);
          if (!tutor_id) tutor_error = `Tutor no encontrado: ${tutor_ref}`;
          if (tutor_id && (!dias_schedule || Object.keys(dias_schedule).length === 0)) schedule_error = schedule_error || 'No se puede asignar tutor sin horario (dias_schedule) definido';
        }
      } catch (e) { errors.push({ rowNumber, nombre: nombre || null, error: String(e?.message ?? e) }); }
      previewItems.push({ rowNumber, nombre, nivel, tutor_ref: tutor_ref || null, tutor_id, schedule_error, tutor_error });
    }
    return { ok: true, bulkType, attempted: attemptedRows.length, returned: previewItems.length, truncated: attemptedRows.length > previewItems.length, preview: previewItems, errors };
  }

  if (bulkType === 'plantilla_estudiantes_only_v1' || bulkType === 'estudiantes_bulk_v1' || bulkType === 'estudiantes_bulk_v2') {
    const sheet = wb.Sheets['Estudiantes_Individuales'] || wb.Sheets['Estudiantes'] || wb.Sheets['ESTUDIANTES'];
    if (!sheet) return { error: 'Falta hoja "Estudiantes_Individuales"' };
    const { error: schemaErr } = await db.from('estudiantes_bulk').select('id, dias').limit(1);
    if (schemaErr && isMissingColumnError(schemaErr)) return { error: 'Tu base de datos no tiene la columna dias en estudiantes_bulk.', details: schemaErr.message };
    if (schemaErr) return { error: schemaErr.message };
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const payload = rows.map((r, idx) => ({ rowNumber: idx + 2, nombre: String(r['Nombre Completo*'] ?? r['nombre*'] ?? r['Nombre Completo'] ?? r['nombre'] ?? '').trim(), nombre_encargado: String(r['Nombre Encargado'] ?? '').trim() || null, email_encargado: normalizeEmail(r['Correo Encargado'] ?? r['Email Encargado'] ?? r['email_encargado'] ?? r['Correo Electrónico'] ?? r['Correo'] ?? r['correo'] ?? ''), telefono_encargado: String(r['Teléfono Encargado'] ?? r['Telefono Encargado'] ?? r['telefono_encargado'] ?? r['Teléfono'] ?? r['telefono'] ?? '').trim() || null, grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null })).filter((r) => r.nombre);
    if (payload.length === 0) return { error: 'No hay filas válidas (se requiere nombre).' };
    const dupNombreGradoInFile = uniq(payload.map((p) => `${String(p.nombre).trim().toLowerCase()}|${String(p.grado ?? '').trim().toLowerCase()}`).filter((k, i, arr) => k && arr.indexOf(k) !== i));
    const missingContacto = payload.filter((p) => !p.email_encargado && !p.telefono_encargado).slice(0, 50).map((p) => ({ rowNumber: p.rowNumber, nombre: p.nombre }));
    return { ok: true, bulkType, attempted: payload.length, returned: Math.min(payload.length, MAX_PREVIEW_ROWS), truncated: payload.length > MAX_PREVIEW_ROWS, preview: payload.slice(0, MAX_PREVIEW_ROWS), warnings: { duplicate_nombre_grado_in_file: dupNombreGradoInFile, missing_contacto_encargado: missingContacto } };
  }

  if (bulkType === 'plantilla_estudiantes_y_grupos_v1') {
    const sheetGrupos = wb.Sheets['GRUPOS'] || wb.Sheets['Grupos'];
    const sheetEst = wb.Sheets['ESTUDIANTES'] || wb.Sheets['Estudiantes'] || wb.Sheets['Estudiantes_Individuales'];
    if (!sheetGrupos) return { error: 'Falta hoja "GRUPOS"' };
    if (!sheetEst) return { error: 'Falta hoja "ESTUDIANTES"' };
    const [bulkSchemaRes, gruposSchemaRes] = await Promise.all([db.from('estudiantes_bulk').select('id, dias, dias_turno').limit(1), db.from('matriculas_grupo').select('id, fecha_inicio').limit(1)]);
    if (bulkSchemaRes.error) { const p = schemaErrorPayload(bulkSchemaRes.error); return p ? { schemaError: p } : { error: bulkSchemaRes.error.message }; }
    if (gruposSchemaRes.error) { const p = schemaErrorPayload(gruposSchemaRes.error); return p ? { schemaError: p } : { error: gruposSchemaRes.error.message }; }
    const gruposRows = XLSX.utils.sheet_to_json(sheetGrupos, { defval: '', raw: false });
    const grupos = gruposRows.map((r, idx) => ({ rowNumber: idx + 2, nombre_grupo: String(r['Nombre del Grupo'] ?? r['Nombre del Grupo*'] ?? '').trim(), curso_ref: String(r['Curso (ID o Nombre)'] ?? r['Curso* (Nombre)'] ?? r['Curso'] ?? '').trim(), tutor_nombre: String(r['Tutor (Nombre)'] ?? r['Tutor* (Nombre)'] ?? r['Tutor'] ?? '').trim(), cantidad_estudiantes_esperados: String(r['Estudiantes Esperados'] ?? '').trim(), fecha_inicio: String(r['Fecha Inicio (AAAA-MM-DD)'] ?? r['Fecha Inicio (YYYY-MM-DD)'] ?? '').trim(), turno: String(r['Turno'] ?? '').trim() })).filter((g) => g.nombre_grupo);
    if (grupos.length === 0) return { error: 'No hay grupos válidos (se requiere Nombre del Grupo).' };
    const gruposPreview = []; const gruposErrors = [];
    for (const g of grupos.slice(0, MAX_PREVIEW_ROWS)) {
      let curso_id = null; let tutor_id = null; let curso_error = null; let tutor_error = null;
      try { curso_id = await resolveCursoIdByIdOrNombre(db, g.curso_ref); tutor_id = await resolveTutorIdByNombre(db, g.tutor_nombre); if (!curso_id) curso_error = `Curso no encontrado: ${g.curso_ref}`; if (!tutor_id) tutor_error = `Tutor no encontrado: ${g.tutor_nombre}`; } catch (e) { gruposErrors.push({ rowNumber: g.rowNumber, nombre_grupo: g.nombre_grupo || null, error: String(e?.message ?? e) }); }
      gruposPreview.push({ ...g, curso_id, tutor_id, curso_error, tutor_error });
    }
    const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
    const estudiantesPayload = estRows.map((r, idx) => ({ rowNumber: idx + 2, nombre: String(r['Nombre Completo'] ?? r['Nombre Completo*'] ?? r['nombre*'] ?? r['nombre'] ?? '').trim(), nombre_encargado: String(r['Nombre Encargado'] ?? '').trim() || null, email_encargado: normalizeEmail(r['Correo Encargado'] ?? r['Email Encargado'] ?? r['email_encargado'] ?? r['Correo Electrónico'] ?? r['Correo'] ?? r['correo'] ?? ''), telefono_encargado: String(r['Teléfono Encargado'] ?? r['Telefono Encargado'] ?? r['telefono_encargado'] ?? r['Teléfono'] ?? r['telefono'] ?? '').trim() || null, grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null, grupo_nombre: String(r['Grupo (Opcional)'] ?? r['Grupo'] ?? '').trim() || null })).filter((r) => r.nombre);
    if (estudiantesPayload.length === 0) return { error: 'No hay estudiantes válidos (se requiere Nombre Completo).' };
    const dupNombreGradoInFile = uniq(estudiantesPayload.map((p) => `${String(p.nombre).trim().toLowerCase()}|${String(p.grado ?? '').trim().toLowerCase()}`).filter((k, i, arr) => k && arr.indexOf(k) !== i));
    const missingContacto = estudiantesPayload.filter((p) => !p.email_encargado && !p.telefono_encargado).slice(0, 50).map((p) => ({ rowNumber: p.rowNumber, nombre: p.nombre }));
    return { ok: true, bulkType, grupos: { attempted: grupos.length, returned: Math.min(grupos.length, MAX_PREVIEW_ROWS), truncated: grupos.length > MAX_PREVIEW_ROWS, preview: gruposPreview, errors: gruposErrors }, estudiantes: { attempted: estudiantesPayload.length, returned: Math.min(estudiantesPayload.length, MAX_PREVIEW_ROWS), truncated: estudiantesPayload.length > MAX_PREVIEW_ROWS, preview: estudiantesPayload.slice(0, MAX_PREVIEW_ROWS) }, warnings: { duplicate_nombre_grado_in_file: dupNombreGradoInFile, missing_contacto_encargado: missingContacto } };
  }

  return { ok: true, bulkType, message: 'Previsualización no implementada para este tipo. Usa Importar para procesar.' };
}

/* ─── Upload (importación) ──────────────────────────────────────────────── */

export async function upload(buffer, { token, userId }) {
  const wb = readWorkbook(buffer);
  const bulkType = detectBulkTypeFromWorkbook(wb);
  if (!bulkType) return { error: 'No se pudo detectar el tipo de bulk. Asegúrate de usar el template descargado.' };
  const db = getDb(token);

  /* ── cursos_bulk_v1 ── */
  if (bulkType === 'cursos_bulk_v1') {
    const sheet = wb.Sheets['CURSOS'] || wb.Sheets['Cursos'] || wb.Sheets['cursos'];
    if (!sheet) return { error: 'Falta hoja "CURSOS"' };
    const rows = sheetToObjectsWithRowNumber(sheet);
    const attemptedRows = rows.filter((x) => x.hasAny);
    if (attemptedRows.length === 0) return { error: 'No hay filas con datos en la hoja CURSOS.' };
    const { data: existingCursos, error: existingCursosErr } = await db.from('cursos').select('nombre');
    if (existingCursosErr) throw existingCursosErr;
    const existingNames = new Set((existingCursos ?? []).map((c) => normalizeName(c?.nombre)));
    const seenNames = new Set();
    const successes = []; const failures = [];
    for (const item of attemptedRows) {
      const row = item.row; const rowNumber = item.rowNumber;
      const nombre = String(row['Nombre*'] ?? row['Nombre'] ?? row['nombre'] ?? '').trim();
      const descripcion = String(row['Descripción'] ?? row['Descripcion'] ?? row['descripcion'] ?? '').trim() || null;
      const nivel = String(row['Nivel'] ?? 'None').trim() || 'None';
      const tipo_clase = String(row['Tipo Clase'] ?? row['tipo_clase'] ?? 'grupal').trim() || 'grupal';
      const tipo_pago = String(row['Tipo Pago'] ?? row['tipo_pago'] ?? 'sesion').trim() || 'sesion';
      const max_estudiantes_raw = String(row['Max Estudiantes'] ?? row['max_estudiantes'] ?? '').trim();
      const costo_curso_raw = String(row['Costo Curso'] ?? row['costo_curso'] ?? '').trim();
      const pago_tutor_raw = String(row['Pago Tutor'] ?? row['pago_tutor'] ?? '').trim();
      const tutor_ref = String(row['Tutor (Nombre o ID)'] ?? row['Tutor'] ?? row['tutor'] ?? '').trim();
      try {
        if (!nombre) throw new Error('Nombre requerido (columna Nombre*)');
        const nombreKey = normalizeName(nombre);
        if (existingNames.has(nombreKey)) throw new Error('Nombre duplicado: ya existe un curso con ese nombre');
        if (seenNames.has(nombreKey)) throw new Error('Nombre duplicado en el archivo');
        seenNames.add(nombreKey);
        const { dias, dias_schedule, error: scheduleErr } = extractDiasScheduleFromCursoRow(row);
        if (scheduleErr) throw new Error(scheduleErr);
        let tutor_id = null;
        if (tutor_ref) {
          tutor_id = await resolveTutorIdByIdOrNombre(db, tutor_ref);
          if (!tutor_id) throw new Error(`Tutor no encontrado: ${tutor_ref}`);
          if (!dias_schedule || Object.keys(dias_schedule).length === 0) throw new Error('No se puede asignar tutor sin horario (dias_schedule) definido');
          const { data: tutor, error: tErr } = await db.from('tutores').select('*').eq('id', tutor_id).maybeSingle();
          if (tErr || !tutor) throw new Error('Tutor no encontrado');
          const aptitude = validateTutorAptitudeForCourse(tutor, nivel);
          if (!aptitude.ok) throw new Error(aptitude.reason);
          const validation = validateTutorCourseSchedule({ ...tutor, dias_horarios: tutor.dias_horarios }, { dias_schedule, dias_turno: null });
          if (!validation.compatible) { const reason = (validation.issues ?? []).filter((x) => String(x).startsWith('❌')).join('; ') || 'Horarios incompatibles'; throw new Error(reason); }
          const scheduleConflicts = await validateTutorNoCourseConflicts(db, tutor_id, dias_schedule, null);
          if (scheduleConflicts.length > 0) { const first = scheduleConflicts[0]; const overlap = first?.overlaps?.[0]; const overlapMsg = overlap ? `${overlap.dia} ${overlap.a.hora_inicio}-${overlap.a.hora_fin}` : 'franja'; throw new Error(`Choque de horario con curso "${first.curso_nombre}" (${overlapMsg})`); }
        }
        const maxEstudiantes = tipo_clase === 'tutoria' ? null : (max_estudiantes_raw ? parseInt(max_estudiantes_raw, 10) : 10);
        const costo_curso = costo_curso_raw ? parseFloat(costo_curso_raw) : 0;
        const pago_tutor = pago_tutor_raw ? parseFloat(pago_tutor_raw) : 0;
        const { data: curso, error } = await db.from('cursos').insert({ nombre, descripcion, nivel: nivel || 'None', tipo_clase, tipo_pago, max_estudiantes: maxEstudiantes, dias: dias ? JSON.stringify(dias) : null, dias_schedule: dias_schedule ? JSON.stringify(dias_schedule) : null, costo_curso: Number.isFinite(costo_curso) ? costo_curso : 0, pago_tutor: Number.isFinite(pago_tutor) ? pago_tutor : 0, tutor_id, estado: true, created_by: userId }).select('id,nombre').single();
        if (error) throw error;
        successes.push({ rowNumber, id: curso?.id, nombre: curso?.nombre ?? nombre });
      } catch (err) { failures.push({ rowNumber, nombre: nombre || null, error: String(err?.message ?? err) }); }
    }
    return { ok: true, bulkType, attempted: attemptedRows.length, created: successes.length, failed: failures.length, successes, failures };
  }

  /* ── plantilla_estudiantes_only ── */
  if (bulkType === 'plantilla_estudiantes_only_v1' || bulkType === 'estudiantes_bulk_v1' || bulkType === 'estudiantes_bulk_v2') {
    const sheet = wb.Sheets['Estudiantes_Individuales'] || wb.Sheets['Estudiantes'] || wb.Sheets['ESTUDIANTES'];
    if (!sheet) return { error: 'Falta hoja "Estudiantes_Individuales"' };
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const payload = rows.map((r, idx) => { const { dias, dias_turno } = extractDiasTurnoFromRow(r); return { rowNumber: idx + 2, nombre: String(r['Nombre Completo*'] ?? r['nombre*'] ?? r['Nombre Completo'] ?? r['nombre'] ?? '').trim(), nombre_encargado: String(r['Nombre Encargado'] ?? '').trim() || null, email_encargado: normalizeEmail(r['Correo Encargado'] ?? r['Email Encargado'] ?? r['email_encargado'] ?? r['Correo Electrónico'] ?? r['Correo'] ?? r['correo'] ?? ''), telefono_encargado: String(r['Teléfono Encargado'] ?? r['Telefono Encargado'] ?? r['telefono_encargado'] ?? r['Teléfono'] ?? r['telefono'] ?? '').trim() || null, grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null, dias, dias_turno, requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)'] ?? r['requiere_perfil_completo']) }; }).filter((r) => r.nombre);
    if (payload.length === 0) return { error: 'No hay filas válidas (se requiere nombre).' };
    const [existingEst, existingBulk] = await Promise.all([db.from('estudiantes').select('nombre'), db.from('estudiantes_bulk').select('nombre')]);
    if (existingEst.error) throw existingEst.error; if (existingBulk.error) throw existingBulk.error;
    const existingNames = new Set([...(existingEst.data ?? []).map((e) => normalizeName(e?.nombre)), ...(existingBulk.data ?? []).map((e) => normalizeName(e?.nombre))]);
    const seenNames = new Set(); const failures = []; const insertRows = [];
    for (const r of payload) {
      const nombreKey = normalizeName(r.nombre);
      if (existingNames.has(nombreKey)) { failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado: ya existe un estudiante con ese nombre' }); continue; }
      if (seenNames.has(nombreKey)) { failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado en el archivo' }); continue; }
      seenNames.add(nombreKey);
      insertRows.push({ nombre: r.nombre, correo: null, telefono: null, nombre_encargado: r.nombre_encargado, email_encargado: r.email_encargado, telefono_encargado: r.telefono_encargado, grado: r.grado, dias: r.dias ? JSON.stringify(r.dias) : null, dias_turno: r.dias_turno ? JSON.stringify(r.dias_turno) : null, requiere_perfil_completo: !!r.requiere_perfil_completo, estado: true, created_by: userId, updated_by: userId, updated_at: new Date().toISOString() });
    }
    let data = [];
    if (insertRows.length > 0) {
      const insertRes = await db.from('estudiantes_bulk').insert(insertRows).select('id, nombre');
      if (insertRes.error) { if (isMissingColumnError(insertRes.error)) return { error: 'Tu base de datos no tiene las columnas nuevas. Aplica la migración 002_add_estudiantes_bulk_extra_fields.sql.', details: insertRes.error.message }; throw insertRes.error; }
      data = insertRes.data ?? [];
    }
    return { ok: true, bulkType, attempted: payload.length, created: data?.length ?? 0, failed: failures.length, inserted: data?.length ?? 0, failures };
  }

  /* ── plantilla_estudiantes_y_grupos_v1 ── */
  if (bulkType === 'plantilla_estudiantes_y_grupos_v1') {
    const sheetGrupos = wb.Sheets['GRUPOS'] || wb.Sheets['Grupos'] || wb.Sheets['Grupo'];
    const sheetEst = wb.Sheets['ESTUDIANTES'] || wb.Sheets['Estudiantes'] || wb.Sheets['Estudiantes_Individuales'];
    if (!sheetGrupos) return { error: 'Falta hoja "GRUPOS"' };
    if (!sheetEst) return { error: 'Falta hoja "ESTUDIANTES"' };
    const gruposRows = XLSX.utils.sheet_to_json(sheetGrupos, { defval: '', raw: false });
    const grupos = gruposRows.map((r) => ({ nombre_grupo: String(r['Nombre del Grupo'] ?? r['Nombre del Grupo*'] ?? '').trim(), curso_ref: String(r['Curso (ID o Nombre)'] ?? r['Curso* (Nombre)'] ?? r['Curso'] ?? '').trim(), tutor_nombre: String(r['Tutor (Nombre)'] ?? r['Tutor* (Nombre)'] ?? r['Tutor'] ?? '').trim(), cantidad_estudiantes_esperados: String(r['Estudiantes Esperados'] ?? '').trim(), fecha_inicio: String(r['Fecha Inicio (AAAA-MM-DD)'] ?? r['Fecha Inicio (YYYY-MM-DD)'] ?? '').trim(), turno: String(r['Turno'] ?? '').trim() })).filter((g) => g.nombre_grupo);
    if (grupos.length === 0) return { error: 'No hay grupos válidos (se requiere Nombre del Grupo).' };
    for (const g of grupos) {
      const cursoId = await resolveCursoIdByIdOrNombre(db, g.curso_ref);
      const tutorId = await resolveTutorIdByNombre(db, g.tutor_nombre);
      if (!cursoId) return { error: `Curso no encontrado: ${g.curso_ref}` };
      if (!tutorId) return { error: `Tutor no encontrado: ${g.tutor_nombre}` };
      g.curso_id = cursoId; g.tutor_id = tutorId;
    }
    const [existingEst, existingBulk] = await Promise.all([db.from('estudiantes').select('nombre'), db.from('estudiantes_bulk').select('nombre')]);
    if (existingEst.error) throw existingEst.error; if (existingBulk.error) throw existingBulk.error;
    const existingNames = new Set([...(existingEst.data ?? []).map((e) => normalizeName(e?.nombre)), ...(existingBulk.data ?? []).map((e) => normalizeName(e?.nombre))]);
    const groupNameToId = new Map();
    for (const g of grupos) {
      const cant = g.cantidad_estudiantes_esperados ? parseInt(String(g.cantidad_estudiantes_esperados), 10) : null;
      const { data: grupo, error: grupoErr } = await db.from('matriculas_grupo').insert({ curso_id: g.curso_id, tutor_id: g.tutor_id, nombre_grupo: g.nombre_grupo, cantidad_estudiantes_esperados: Number.isFinite(cant) ? cant : null, estado: 'activa', fecha_inicio: g.fecha_inicio || null, turno: g.turno || null, created_by: userId, updated_by: userId, updated_at: new Date().toISOString() }).select('id').single();
      if (grupoErr) throw grupoErr;
      groupNameToId.set(g.nombre_grupo, grupo.id);
    }
    const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
    const estudiantesPayload = estRows.map((r, idx) => { const { dias, dias_turno } = extractDiasTurnoFromRow(r); return { rowNumber: idx + 2, nombre: String(r['Nombre Completo'] ?? r['Nombre Completo*'] ?? r['nombre*'] ?? r['nombre'] ?? '').trim(), nombre_encargado: String(r['Nombre Encargado'] ?? '').trim() || null, email_encargado: normalizeEmail(r['Correo Encargado'] ?? r['Email Encargado'] ?? r['email_encargado'] ?? r['Correo Electrónico'] ?? r['Correo'] ?? r['correo'] ?? ''), telefono_encargado: String(r['Teléfono Encargado'] ?? r['Telefono Encargado'] ?? r['telefono_encargado'] ?? r['Teléfono'] ?? r['telefono'] ?? '').trim() || null, grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null, dias, dias_turno, requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)'] ?? r['requiere_perfil_completo']), grupo_nombre: String(r['Grupo (Opcional)'] ?? r['Grupo'] ?? '').trim() }; }).filter((r) => r.nombre);
    if (estudiantesPayload.length === 0) return { error: 'No hay estudiantes válidos (se requiere Nombre Completo).' };
    const failures = []; const seenNames = new Set(); const estudiantesToInsert = [];
    for (const r of estudiantesPayload) {
      const nombreKey = normalizeName(r.nombre);
      if (existingNames.has(nombreKey)) { failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado' }); continue; }
      if (seenNames.has(nombreKey)) { failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado en el archivo' }); continue; }
      seenNames.add(nombreKey); estudiantesToInsert.push(r);
    }
    let bulkRows = [];
    if (estudiantesToInsert.length > 0) {
      const insertRes = await db.from('estudiantes_bulk').insert(estudiantesToInsert.map((r) => ({ nombre: r.nombre, correo: null, telefono: null, nombre_encargado: r.nombre_encargado, email_encargado: r.email_encargado, telefono_encargado: r.telefono_encargado, grado: r.grado, dias: r.dias ? JSON.stringify(r.dias) : null, dias_turno: r.dias_turno ? JSON.stringify(r.dias_turno) : null, requiere_perfil_completo: r.requiere_perfil_completo, estado: true, created_by: userId, updated_by: userId, updated_at: new Date().toISOString() }))).select('id');
      if (insertRes.error) throw insertRes.error;
      bulkRows = insertRes.data ?? [];
    }
    const links = [];
    for (let i = 0; i < estudiantesToInsert.length; i++) {
      const grupoNombre = estudiantesToInsert[i].grupo_nombre;
      if (!grupoNombre) continue;
      const gid = groupNameToId.get(grupoNombre);
      if (!gid) return { error: `Grupo no encontrado en hoja GRUPOS: ${grupoNombre}` };
      links.push({ matricula_grupo_id: gid, estudiante_bulk_id: bulkRows[i].id });
    }
    if (links.length > 0) { const { error: linkErr } = await db.from('estudiantes_en_grupo').insert(links); if (linkErr) throw linkErr; }
    return { ok: true, bulkType, created_grupos: groupNameToId.size, attempted: estudiantesPayload.length, created: bulkRows?.length ?? 0, failed: failures.length, inserted_estudiantes_bulk: bulkRows?.length ?? 0, linked: links.length, failures };
  }

  return { ok: true, bulkType, message: 'Tipo de bulk no soportado para importación.' };
}

export { getDb, isMissingColumnError, normalizeNumericIds };
