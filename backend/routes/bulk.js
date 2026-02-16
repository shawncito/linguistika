import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabaseAdmin, supabaseForToken } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';
import { validateTutorCourseSchedule } from '../utils/scheduleValidator.js';
import { schemaErrorPayload } from '../utils/schemaErrors.js';

const router = express.Router();

// Cualquier empleado puede usar bulk (ajusta si quieres restringir)
router.use(requireRoles(['admin', 'contador', 'tutor_view_only']));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

function normalizeEmail(value) {
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
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

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

function detectBulkTypeFromWorkbook(workbook) {
  // 1) Preferimos __meta si existe
  const meta = getMetaBulkType(workbook);
  if (meta) return meta;

  // 2) Detección por hojas (Plantilla_Carga_Masiva_Estudiantes_y_Grupos.xlsx)
  const sheets = new Set((workbook.SheetNames || []).map((s) => String(s).trim().toUpperCase()));
  const hasEst = sheets.has('ESTUDIANTES');
  const hasGrupos = sheets.has('GRUPOS');
  const hasCursos = sheets.has('CURSOS');

  if (hasEst && hasGrupos) return 'plantilla_estudiantes_y_grupos_v1';
  if (hasEst) return 'plantilla_estudiantes_only_v1';
  if (hasCursos) return 'cursos_bulk_v1';
  return null;
}

function timeToMinutesSafe(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function normalizeDiaKey(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

    const aHorario = a[diaA];
    const bHorario = b[diaB];
    const aStart = timeToMinutesSafe(aHorario?.hora_inicio);
    const aEnd = timeToMinutesSafe(aHorario?.hora_fin);
    const bStart = timeToMinutesSafe(bHorario?.hora_inicio);
    const bEnd = timeToMinutesSafe(bHorario?.hora_fin);

    if (aStart == null || aEnd == null || bStart == null || bEnd == null) continue;
    const overlap = aStart < bEnd && aEnd > bStart;
    if (overlap) {
      conflicts.push({
        dia: diaA,
        a: { hora_inicio: aHorario?.hora_inicio, hora_fin: aHorario?.hora_fin },
        b: { hora_inicio: bHorario?.hora_inicio, hora_fin: bHorario?.hora_fin },
      });
    }
  }
  return conflicts;
}

function validateTutorAptitudeForCourse(tutor, cursoNivel) {
  const nivel = String(cursoNivel ?? '').trim();
  if (!nivel || nivel === 'None') return { ok: true };

  const niveles = Array.isArray(tutor?.niveles_apto) ? tutor.niveles_apto : [];
  const specialized = !!tutor?.es_especializado || niveles.length > 0;
  if (!specialized) return { ok: true };

  if (!niveles.includes(nivel)) {
    return { ok: false, reason: `El tutor no está marcado como apto para el nivel ${nivel}` };
  }
  return { ok: true };
}

async function validateTutorNoCourseConflicts(db, tutorId, nextSchedule, excludeCursoId = null) {
  const { data: cursos, error } = await db
    .from('cursos')
    .select('id,nombre,nivel,dias_schedule,estado')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const conflicts = [];
  for (const c of cursos ?? []) {
    if (excludeCursoId != null && String(c.id) === String(excludeCursoId)) continue;
    if (c?.estado === false) continue;
    const otherSchedule = parseJsonMaybe(c.dias_schedule);
    if (!otherSchedule || Object.keys(otherSchedule).length === 0) continue;

    const overlaps = scheduleOverlaps(nextSchedule, otherSchedule);
    if (overlaps.length > 0) {
      conflicts.push({
        curso_id: c.id,
        curso_nombre: c.nombre,
        curso_nivel: c.nivel,
        overlaps,
      });
    }
  }
  return conflicts;
}

async function buildTemplateCursosBulkExcelJS(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();

  // __meta para detección robusta
  const wsMeta = workbook.addWorksheet('__meta', { state: 'veryHidden' });
  wsMeta.addRow(['bulk_type', 'cursos_bulk_v1']);

  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE CURSOS']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['1) Descarga este template, complétalo y súbelo en Cursos.']);
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
  for (let i = 0; i < maxLen; i++) {
    wsListas.addRow([tutores[i]?.nombre ?? '', niveles[i] ?? '', tipoClase[i] ?? '', tipoPago[i] ?? '']);
  }
  wsListas.getColumn(1).width = 40;
  wsListas.getColumn(2).width = 14;
  wsListas.getColumn(3).width = 14;
  wsListas.getColumn(4).width = 14;

  const wsCursos = workbook.addWorksheet('CURSOS');
  setHeaderRow(wsCursos, [
    'Nombre*',
    'Descripción',
    'Nivel',
    'Tipo Clase',
    'Tipo Pago',
    'Max Estudiantes',
    'Costo Curso',
    'Pago Tutor',
    'Tutor (Nombre o ID)',
    'Lunes Inicio', 'Lunes Fin',
    'Martes Inicio', 'Martes Fin',
    'Miércoles Inicio', 'Miércoles Fin',
    'Jueves Inicio', 'Jueves Fin',
    'Viernes Inicio', 'Viernes Fin',
    'Sábado Inicio', 'Sábado Fin',
    'Domingo Inicio', 'Domingo Fin',
  ]);
  wsCursos.addRow(new Array(23).fill(''));
  wsCursos.views = [{ state: 'frozen', ySplit: 1 }];

  wsCursos.getColumn(1).width = 30;
  wsCursos.getColumn(2).width = 45;
  wsCursos.getColumn(3).width = 10;
  wsCursos.getColumn(4).width = 12;
  wsCursos.getColumn(5).width = 12;
  wsCursos.getColumn(6).width = 16;
  wsCursos.getColumn(7).width = 14;
  wsCursos.getColumn(8).width = 12;
  wsCursos.getColumn(9).width = 26;
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

function calcDuracionHoras(horaInicio, horaFin) {
  const a = timeToMinutesSafe(horaInicio);
  const b = timeToMinutesSafe(horaFin);
  if (a == null || b == null) return null;
  const diff = b - a;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return Math.round((diff / 60) * 100) / 100;
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
    let inicio = '';
    let fin = '';
    for (const k of d.start) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        inicio = String(row[k]).trim();
        break;
      }
    }
    for (const k of d.end) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        fin = String(row[k]).trim();
        break;
      }
    }

    if (!inicio && !fin) continue;
    if (!inicio || !fin) {
      return { error: `Horario incompleto en ${d.label} (requiere Inicio y Fin)` };
    }
    const dur = calcDuracionHoras(inicio, fin);
    if (dur == null) {
      return { error: `Horario inválido en ${d.label} (${inicio}-${fin})` };
    }
    dias.push(d.label);
    dias_schedule[d.label] = { hora_inicio: inicio, hora_fin: fin, duracion_horas: dur };
  }

  return {
    dias: dias.length ? dias : null,
    dias_schedule: Object.keys(dias_schedule).length ? dias_schedule : null,
  };
}

function buildTemplateEstudiantesBulkV1() {
  const wb = XLSX.utils.book_new();

  const leeme = [
    ['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES Y GRUPOS'],
    [''],
    ['Este archivo permite cargar estudiantes de forma masiva.'],
    [''],
    ['HOJA – ESTUDIANTES:'],
    ['- Completa las columnas.'],
    ['- "¿Perfil Completo?" acepta SI/NO.'],
    ['- "Grupo (Opcional)" se deja vacío si no aplica.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leeme), 'LEEME');

  const header = [['Nombre Completo', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', '¿Perfil Completo? (SI/NO)', 'Grupo (Opcional)']];
  const example = [['Juan Pérez', 'María Pérez', 'maria@email.com', '+506 8888-8888', 'SI', '']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...header, ...example]), 'ESTUDIANTES');

  return wb;
}

function buildTemplateGrupoMatriculaV1() {
  const wb = XLSX.utils.book_new();

  const leeme = [
    ['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES Y GRUPOS'],
    [''],
    ['Este archivo permite cargar estudiantes y matrículas de grupo de forma masiva.'],
    [''],
    ['HOJA 1 – ESTUDIANTES:'],
    ['- Completa estudiantes. "Grupo (Opcional)" debe coincidir con el nombre en GRUPOS (si aplica).'],
    [''],
    ['HOJA 2 – GRUPOS:'],
    ['- Define los grupos.'],
    ['- Curso puede ser ID o Nombre. Tutor es por Nombre.'],
    ['- Turno es opcional (ej: Tarde, Noche).'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leeme), 'LEEME');

  const estHeader = [['Nombre Completo', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', '¿Perfil Completo? (SI/NO)', 'Grupo (Opcional)']];
  const estExample = [['Juan Pérez', 'María Pérez', 'maria@email.com', '+506 8888-8888', 'NO', 'Grupo Matemáticas A']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...estHeader, ...estExample]), 'ESTUDIANTES');

  const gruposHeader = [['Nombre del Grupo', 'Curso (ID o Nombre)', 'Tutor (Nombre)', 'Estudiantes Esperados', 'Fecha Inicio (AAAA-MM-DD)', 'Turno']];
  const gruposExample = [['Grupo Matemáticas A', 'Álgebra I', 'Roberto Gómez', '15', '2026-02-01', 'Noche']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...gruposHeader, ...gruposExample]), 'GRUPOS');

  return wb;
}

function writeWorkbookToBuffer(workbook) {
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

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
    const cell = worksheet.getCell(r, columnNumber);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: 'warning',
      formulae: [formula],
    };
  }
}

function isMissingColumnError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
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

  const dias = [];
  const dias_turno = {};

  for (const d of dayKeys) {
    let raw = '';
    for (const k of d.keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        raw = row[k];
        break;
      }
    }
    const turno = normalizeTurno(raw);
    if (turno) {
      dias.push(d.label);
      dias_turno[d.label] = turno;
    }
  }

  return {
    dias: dias.length ? dias : null,
    dias_turno: Object.keys(dias_turno).length ? dias_turno : null,
  };
}

async function buildTemplateEstudiantesBulkExcelJS() {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();

  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES Y GRUPOS']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['Este archivo permite cargar estudiantes de forma masiva.']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['HOJA – ESTUDIANTES:']);
  wsLeeme.addRow(['- Completa las columnas.']);
  wsLeeme.addRow(['- "Grado*" es obligatorio (igual que el formulario manual).']);
  wsLeeme.addRow(['- Días: escribe Tarde/Noche en la columna del día. Deja vacío si no asiste ese día.']);
  wsLeeme.addRow(['- Formato de hora (si aplica en otros templates): HH:mm (24 horas). Ej: 08:00, 17:30.']);
  wsLeeme.getColumn(1).width = 90;

  const wsEst = workbook.addWorksheet('ESTUDIANTES');
  setHeaderRow(wsEst, ['Nombre Completo*', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', 'Grado*', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  // Sin filas de ejemplo: evita que el usuario suba el template y se inserte un registro de muestra.
  wsEst.addRow(['', '', '', '', '', '', '', '', '', '', '', '']);
  wsEst.getColumn(1).width = 28;
  wsEst.getColumn(2).width = 28;
  wsEst.getColumn(3).width = 28;
  wsEst.getColumn(4).width = 20;
  wsEst.getColumn(5).width = 14;
  for (let i = 6; i <= 12; i++) {
    wsEst.getColumn(i).width = 12;
  }

  // Dropdown Grado en columna E
  applyListValidation(wsEst, 5, 2, 1000, '"1ro,2do,3ro,4to,5to,6to,7mo,8vo,9no,10mo,11mo,No aplica"');

  // Dropdown Tarde/Noche en columnas F..L (días)
  for (let col = 6; col <= 12; col++) {
    applyListValidation(wsEst, col, 2, 1000, '"Tarde,Noche"');
  }

  return workbook;
}

async function buildTemplateGrupoMatriculaExcelJS(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();

  const { cursos, tutores } = await fetchCatalogosForTemplate(db);

  const wsLeeme = workbook.addWorksheet('LEEME');
  wsLeeme.addRow(['INSTRUCCIONES – CARGA MASIVA DE ESTUDIANTES Y GRUPOS']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['Este archivo permite cargar estudiantes y matrículas de grupo de forma masiva.']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['HOJA 1 – ESTUDIANTES:']);
  wsLeeme.addRow(['- "Grupo (Opcional)" debe coincidir con el nombre en GRUPOS (si aplica).']);
  wsLeeme.addRow(['']);
  wsLeeme.addRow(['HOJA 2 – GRUPOS:']);
  wsLeeme.addRow(['- Curso se selecciona de la lista (o puedes escribir un ID).']);
  wsLeeme.addRow(['- Tutor se selecciona de la lista.']);
  wsLeeme.addRow(['- Turno se selecciona de la lista (Tarde / Noche).']);
  wsLeeme.addRow(['- Formato de hora (si aplica en otros templates): HH:mm (24 horas). Ej: 08:00, 17:30.']);
  wsLeeme.getColumn(1).width = 90;

  // Hoja oculta con catálogos
  const wsListas = workbook.addWorksheet('LISTAS', { state: 'veryHidden' });
  setHeaderRow(wsListas, ['Cursos (Nombre)', 'Tutores (Nombre)', 'Turnos', 'Grados']);
  const maxLen = Math.max(cursos.length, tutores.length, 2);
  const turnos = ['Tarde', 'Noche'];
  const grados = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo', 'No aplica'];
  for (let i = 0; i < maxLen; i++) {
    wsListas.addRow([cursos[i]?.nombre ?? '', tutores[i]?.nombre ?? '', turnos[i] ?? '', grados[i] ?? '']);
  }
  wsListas.getColumn(1).width = 40;
  wsListas.getColumn(2).width = 40;
  wsListas.getColumn(3).width = 18;
  wsListas.getColumn(4).width = 14;

  const wsEst = workbook.addWorksheet('ESTUDIANTES');
  setHeaderRow(wsEst, ['Nombre Completo*', 'Nombre Encargado', 'Correo Encargado', 'Teléfono Encargado', 'Grado*', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Grupo (Opcional)']);
  wsEst.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '']);
  wsEst.getColumn(1).width = 28;
  wsEst.getColumn(2).width = 28;
  wsEst.getColumn(3).width = 28;
  wsEst.getColumn(4).width = 20;
  wsEst.getColumn(5).width = 14;
  for (let i = 6; i <= 12; i++) {
    wsEst.getColumn(i).width = 12;
  }
  wsEst.getColumn(13).width = 22;

  const wsGrupos = workbook.addWorksheet('GRUPOS');
  setHeaderRow(wsGrupos, ['Nombre del Grupo', 'Curso (ID o Nombre)', 'Tutor (Nombre)', 'Estudiantes Esperados', 'Fecha Inicio (AAAA-MM-DD)', 'Turno']);
  wsGrupos.addRow(['', '', '', '', '', '']);
  wsGrupos.getColumn(1).width = 28;
  wsGrupos.getColumn(2).width = 32;
  wsGrupos.getColumn(3).width = 32;
  wsGrupos.getColumn(4).width = 22;
  wsGrupos.getColumn(5).width = 22;
  wsGrupos.getColumn(6).width = 14;

  // Dropdowns
  // Curso (nombre) y Tutor desde LISTAS
  const cursosEnd = Math.max(2, cursos.length + 1);
  const tutoresEnd = Math.max(2, tutores.length + 1);
  const turnosEnd = 3; // 2 items + header
  applyListValidation(wsGrupos, 2, 2, 1000, `'LISTAS'!$A$2:$A$${cursosEnd}`);
  applyListValidation(wsGrupos, 3, 2, 1000, `'LISTAS'!$B$2:$B$${tutoresEnd}`);
  applyListValidation(wsGrupos, 6, 2, 1000, `'LISTAS'!$C$2:$C$${turnosEnd}`);

  // Grado desde LISTAS
  const gradosEnd = Math.max(2, grados.length + 1);
  applyListValidation(wsEst, 5, 2, 1000, `'LISTAS'!$D$2:$D$${gradosEnd}`);

  // Turno por día (Tarde/Noche) - columnas F..L
  applyListValidation(wsEst, 6, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 7, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 8, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 9, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 10, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 11, 2, 1000, `'LISTAS'!$C$2:$C$3`);
  applyListValidation(wsEst, 12, 2, 1000, `'LISTAS'!$C$2:$C$3`);

  // Grupo (Opcional) -> nombres en GRUPOS
  applyListValidation(wsEst, 13, 2, 1000, `'GRUPOS'!$A$2:$A$1000`);

  return workbook;
}

function getDb(req) {
  return supabaseAdmin ?? supabaseForToken(req.accessToken);
}

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

// Descargar plantilla
router.get('/template/:tipo', async (req, res) => {
  try {
    const tipo = String(req.params.tipo || '').trim();

    const db = getDb(req);

    let wb;
    let filename;

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
      return res.status(400).json({ error: 'Tipo de template no soportado', allowed: ['estudiantes_bulk', 'grupo_matricula', 'cursos_bulk'] });
    }

    const buf = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buf));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =============================
// Lectura administrativa (ver lo subido)
// =============================

// Listar grupos creados (matriculas_grupo) + nombres curso/tutor + cantidad vinculados
router.get('/grupos', async (req, res) => {
  try {
    const db = getDb(req);

    const { data: grupos, error: gErr } = await db
      .from('matriculas_grupo')
      .select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at');

    if (gErr) return res.status(400).json({ error: gErr.message });

    const grupoIds = (grupos ?? []).map((g) => g.id);
    const grupoIdsNum = normalizeNumericIds(grupoIds);

    const cursoIds = Array.from(new Set((grupos ?? []).map((g) => g.curso_id).filter(Boolean)));
    const tutorIds = Array.from(new Set((grupos ?? []).map((g) => g.tutor_id).filter(Boolean)));

    const [{ data: cursos, error: cErr }, { data: tutores, error: tErr }, { data: linksBulk, error: lErr }] = await Promise.all([
      cursoIds.length ? db.from('cursos').select('id, nombre, costo_curso, pago_tutor').in('id', cursoIds) : Promise.resolve({ data: [], error: null }),
      tutorIds.length ? db.from('tutores').select('id, nombre').in('id', tutorIds) : Promise.resolve({ data: [], error: null }),
      grupoIdsNum.length
        ? db.from('estudiantes_en_grupo').select('matricula_grupo_id').in('matricula_grupo_id', grupoIdsNum)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (cErr) return res.status(400).json({ error: cErr.message });
    if (tErr) return res.status(400).json({ error: tErr.message });
    if (lErr) return res.status(400).json({ error: lErr.message });

    // Compat: estudiantes normales pueden estar vinculados por columna matricula_grupo_id (si existe)
    let linksNormal = [];
    if (grupoIdsNum.length) {
      const { data, error } = await db.from('estudiantes').select('matricula_grupo_id').in('matricula_grupo_id', grupoIdsNum);
      if (error && !isMissingColumnError(error)) return res.status(400).json({ error: error.message });
      linksNormal = data ?? [];
    }

    const cursoMap = new Map((cursos ?? []).map((c) => [c.id, { nombre: c.nombre, costo_curso: c.costo_curso, pago_tutor: c.pago_tutor }]));
    const tutorMap = new Map((tutores ?? []).map((t) => [t.id, t.nombre]));
    const linkCount = new Map();
    for (const row of linksBulk ?? []) {
      const gid = row.matricula_grupo_id;
      linkCount.set(gid, (linkCount.get(gid) || 0) + 1);
    }
    for (const row of linksNormal ?? []) {
      const gid = row.matricula_grupo_id;
      linkCount.set(gid, (linkCount.get(gid) || 0) + 1);
    }

    const result = (grupos ?? [])
      .map((g) => {
        const cursoData = cursoMap.get(g.curso_id) ?? {};
        return {
          ...g,
          curso_nombre: cursoData.nombre ?? null,
          tutor_nombre: tutorMap.get(g.tutor_id) ?? null,
          costo_curso: Number(cursoData.costo_curso) || 0,
          pago_tutor: Number(cursoData.pago_tutor) || 0,
          linked_count: linkCount.get(g.id) || 0,
        };
      })
      .sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dbt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dbt - da;
      });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Detalle de un grupo + estudiantes vinculados
router.get('/grupos/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });

    const gidNum = Number(id);

    const { data: grupo, error: gErr } = await db
      .from('matriculas_grupo')
      .select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (gErr) return res.status(400).json({ error: gErr.message });
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const [{ data: curso }, { data: tutor }, { data: links, error: lErr }] = await Promise.all([
      grupo.curso_id ? db.from('cursos').select('id, nombre, costo_curso, pago_tutor').eq('id', grupo.curso_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      grupo.tutor_id ? db.from('tutores').select('id, nombre').eq('id', grupo.tutor_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db
        .from('estudiantes_en_grupo')
        .select('estudiante_bulk_id')
        .eq('matricula_grupo_id', grupo.id),
    ]);

    if (lErr) return res.status(400).json({ error: lErr.message });

    const bulkIds = (links ?? []).map((l) => l.estudiante_bulk_id);
    const { data: estudiantes, error: eErr } = bulkIds.length
      ? await db
          .from('estudiantes_bulk')
          .select('id, nombre, correo, telefono, requiere_perfil_completo, estado, created_at, updated_at')
          .in('id', bulkIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (eErr) return res.status(400).json({ error: eErr.message });

    // Estudiantes normales asignados por columna matricula_grupo_id (si existe)
    let estudiantesNormales = [];
    if (Number.isFinite(gidNum)) {
      const { data, error } = await db
        .from('estudiantes')
        .select('id, nombre, email, telefono, email_encargado, telefono_encargado, grado, estado, created_at, updated_at')
        .eq('matricula_grupo_id', gidNum);
      if (error && !isMissingColumnError(error)) return res.status(400).json({ error: error.message });
      estudiantesNormales = data ?? [];
    }

    return res.json({
      grupo: {
        ...grupo,
        curso_nombre: curso?.nombre ?? null,
        tutor_nombre: tutor?.nombre ?? null,
        costo_curso: Number(curso?.costo_curso) || 0,
        pago_tutor: Number(curso?.pago_tutor) || 0,
        linked_count: bulkIds.length + (estudiantesNormales?.length ?? 0),
      },
      estudiantes: {
        bulk: estudiantes ?? [],
        normales: estudiantesNormales ?? [],
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Listar estudiantes_bulk (lo subido) + si requiere perfil completo
router.get('/estudiantes', async (req, res) => {
  try {
    const db = getDb(req);

    let estudiantes;
    {
      const { data, error } = await db
        .from('estudiantes_bulk')
        .select('id, nombre, nombre_encargado, correo, telefono, email_encargado, telefono_encargado, grado, dias, dias_turno, requiere_perfil_completo, estado, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        // Compat: si la BD todavía no tiene las columnas nuevas, degradamos a la lista básica.
        if (isMissingColumnError(error)) {
          const fallback = await db
            .from('estudiantes_bulk')
            .select('id, nombre, correo, telefono, requiere_perfil_completo, estado, created_at, updated_at')
            .order('created_at', { ascending: false });
          if (fallback.error) return res.status(400).json({ error: fallback.error.message });
          estudiantes = (fallback.data ?? []).map((s) => ({
            ...s,
            nombre_encargado: null,
            email_encargado: null,
            telefono_encargado: null,
            grado: null,
            dias: null,
            dias_turno: null,
          }));
        } else {
          return res.status(400).json({ error: error.message });
        }
      } else {
        estudiantes = data ?? [];
      }
    }

    const { data: links, error: lErr } = await db
      .from('estudiantes_en_grupo')
      .select('estudiante_bulk_id, matricula_grupo_id');
    if (lErr) return res.status(400).json({ error: lErr.message });

    // Nota: el esquema permite múltiples grupos por estudiante (no hay constraint global).
    // Para UI, tomamos el primer grupo encontrado.
    const estudianteToGrupo = new Map();
    for (const row of links ?? []) {
      if (!estudianteToGrupo.has(row.estudiante_bulk_id)) {
        estudianteToGrupo.set(row.estudiante_bulk_id, row.matricula_grupo_id);
      }
    }

    const result = (estudiantes ?? []).map((s) => ({
      ...s,
      dias: s.dias ? JSON.parse(s.dias) : null,
      dias_turno: s.dias_turno ? JSON.parse(s.dias_turno) : null,
      matricula_grupo_id: estudianteToGrupo.get(s.id) ?? null,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =============================
// CRUD mínimo para UI (grupos y estudiantes_bulk)
// =============================

// Crear grupo manualmente
router.post('/grupos', async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user?.id ?? null;

    const {
      curso_id,
      tutor_id,
      nombre_grupo = null,
      cantidad_estudiantes_esperados = null,
      fecha_inicio = null,
      fecha_fin = null,
      turno = null,
      notas = null,
      estado = 'activa',
    } = req.body ?? {};

    const cursoId = curso_id != null ? parseInt(String(curso_id), 10) : NaN;
    const tutorId = tutor_id != null ? parseInt(String(tutor_id), 10) : NaN;
    if (!Number.isFinite(cursoId) || !Number.isFinite(tutorId)) {
      return res.status(400).json({ error: 'curso_id y tutor_id son requeridos y deben ser numéricos.' });
    }

    const cant = cantidad_estudiantes_esperados != null && String(cantidad_estudiantes_esperados).trim() !== ''
      ? parseInt(String(cantidad_estudiantes_esperados), 10)
      : null;

    const { data: grupo, error } = await db
      .from('matriculas_grupo')
      .insert({
        curso_id: cursoId,
        tutor_id: tutorId,
        nombre_grupo: nombre_grupo ? String(nombre_grupo).trim() : null,
        cantidad_estudiantes_esperados: Number.isFinite(cant) ? cant : null,
        estado: estado ? String(estado) : 'activa',
        fecha_inicio: fecha_inicio ? String(fecha_inicio).trim() : null,
        fecha_fin: fecha_fin ? String(fecha_fin).trim() : null,
        turno: turno ? String(turno).trim() : null,
        notas: notas ? String(notas).trim() : null,
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(grupo);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Editar grupo
router.put('/grupos/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user?.id ?? null;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });

    const body = req.body ?? {};
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (body.curso_id !== undefined) {
      const cursoId = body.curso_id != null ? parseInt(String(body.curso_id), 10) : NaN;
      if (!Number.isFinite(cursoId)) return res.status(400).json({ error: 'curso_id debe ser numérico.' });
      updateData.curso_id = cursoId;
    }
    if (body.tutor_id !== undefined) {
      const tutorId = body.tutor_id != null ? parseInt(String(body.tutor_id), 10) : NaN;
      if (!Number.isFinite(tutorId)) return res.status(400).json({ error: 'tutor_id debe ser numérico.' });
      updateData.tutor_id = tutorId;
    }
    if (body.nombre_grupo !== undefined) updateData.nombre_grupo = body.nombre_grupo ? String(body.nombre_grupo).trim() : null;
    if (body.cantidad_estudiantes_esperados !== undefined) {
      const cant = body.cantidad_estudiantes_esperados != null && String(body.cantidad_estudiantes_esperados).trim() !== ''
        ? parseInt(String(body.cantidad_estudiantes_esperados), 10)
        : null;
      updateData.cantidad_estudiantes_esperados = Number.isFinite(cant) ? cant : null;
    }
    if (body.estado !== undefined) updateData.estado = body.estado ? String(body.estado) : null;
    if (body.fecha_inicio !== undefined) updateData.fecha_inicio = body.fecha_inicio ? String(body.fecha_inicio).trim() : null;
    if (body.fecha_fin !== undefined) updateData.fecha_fin = body.fecha_fin ? String(body.fecha_fin).trim() : null;
    if (body.turno !== undefined) updateData.turno = body.turno ? String(body.turno).trim() : null;
    if (body.notas !== undefined) updateData.notas = body.notas ? String(body.notas).trim() : null;

    const { data: grupo, error } = await db
      .from('matriculas_grupo')
      .update(updateData)
      .eq('id', id)
      .select('id, curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado, fecha_inicio, fecha_fin, turno, notas, created_at, updated_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(grupo);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Crear estudiante_bulk (básico)
router.post('/estudiantes', async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user?.id ?? null;

    const {
      nombre,
      nombre_encargado = null,
      email_encargado = null,
      telefono_encargado = null,
      requiere_perfil_completo = false,
      estado = true,
    } = req.body ?? {};

    const n = String(nombre ?? '').trim();
    if (!n) return res.status(400).json({ error: 'nombre es requerido.' });

    const { data, error } = await db
      .from('estudiantes_bulk')
      .insert({
        nombre: n,
        nombre_encargado: nombre_encargado ? String(nombre_encargado).trim() : null,
        email_encargado: email_encargado ? String(email_encargado).trim() : null,
        telefono_encargado: telefono_encargado ? String(telefono_encargado).trim() : null,
        requiere_perfil_completo: !!requiere_perfil_completo,
        estado: estado === true || estado === 1 || estado === '1',
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select('id, nombre, nombre_encargado, email_encargado, telefono_encargado, requiere_perfil_completo, estado, created_at, updated_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Editar estudiante_bulk (básico)
router.put('/estudiantes/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user?.id ?? null;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });

    const body = req.body ?? {};
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (body.nombre !== undefined) updateData.nombre = body.nombre ? String(body.nombre).trim() : null;
    if (body.nombre_encargado !== undefined) updateData.nombre_encargado = body.nombre_encargado ? String(body.nombre_encargado).trim() : null;
    if (body.email_encargado !== undefined) updateData.email_encargado = body.email_encargado ? String(body.email_encargado).trim() : null;
    if (body.telefono_encargado !== undefined) updateData.telefono_encargado = body.telefono_encargado ? String(body.telefono_encargado).trim() : null;
    if (body.requiere_perfil_completo !== undefined) updateData.requiere_perfil_completo = !!body.requiere_perfil_completo;
    if (body.estado !== undefined) updateData.estado = body.estado === true || body.estado === 1 || body.estado === '1';

    const { data, error } = await db
      .from('estudiantes_bulk')
      .update(updateData)
      .eq('id', id)
      .select('id, nombre, nombre_encargado, email_encargado, telefono_encargado, requiere_perfil_completo, estado, created_at, updated_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Eliminar estudiante_bulk
router.delete('/estudiantes/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });

    // Primero borrar vínculos (si existen)
    const { error: linkErr } = await db
      .from('estudiantes_en_grupo')
      .delete()
      .eq('estudiante_bulk_id', id);
    if (linkErr) return res.status(400).json({ error: linkErr.message });

    const { error } = await db
      .from('estudiantes_bulk')
      .delete()
      .eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true, id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Asignar (o mover) estudiantes_bulk a un grupo (borra vínculos previos y crea el nuevo)
router.post('/grupos/:id/estudiantes', async (req, res) => {
  try {
    const db = getDb(req);
    const gid = String(req.params.id || '').trim();
    if (!gid) return res.status(400).json({ error: 'id requerido' });

    const bulkIdsRaw = req.body?.estudiante_bulk_ids ?? req.body?.ids ?? [];
    const normalIdsRaw = req.body?.estudiante_ids ?? [];

    const estudianteBulkIds = normalizeNumericIds(bulkIdsRaw);
    const estudianteIds = normalizeNumericIds(normalIdsRaw);

    if (estudianteBulkIds.length === 0 && estudianteIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere estudiante_bulk_ids y/o estudiante_ids (array no vacío).' });
    }

    // 1) Bulk: borra vínculos previos y crea el nuevo
    if (estudianteBulkIds.length) {
      const { error: delErr } = await db
        .from('estudiantes_en_grupo')
        .delete()
        .in('estudiante_bulk_id', estudianteBulkIds);
      if (delErr) return res.status(400).json({ error: delErr.message });

      const links = estudianteBulkIds.map((eid) => ({ matricula_grupo_id: gid, estudiante_bulk_id: eid }));
      const { error: insErr } = await db
        .from('estudiantes_en_grupo')
        .insert(links);
      if (insErr) return res.status(400).json({ error: insErr.message });
    }

    // 2) Normales: asigna columna matricula_grupo_id (si existe)
    if (estudianteIds.length) {
      const gidNum = Number(gid);
      if (!Number.isFinite(gidNum)) return res.status(400).json({ error: 'id de grupo inválido' });
      const { error: updErr } = await db
        .from('estudiantes')
        .update({ matricula_grupo_id: gidNum, updated_at: new Date().toISOString() })
        .in('id', estudianteIds);
      if (updErr) {
        if (isMissingColumnError(updErr)) {
          return res.status(400).json({
            error: 'Tu base de datos aún no tiene la columna matricula_grupo_id en estudiantes. Aplica la migración 003_add_matricula_grupo_id_to_estudiantes.sql y vuelve a intentar.',
            details: updErr.message,
          });
        }
        return res.status(400).json({ error: updErr.message });
      }
    }

    return res.json({ ok: true, matricula_grupo_id: gid, assigned_bulk: estudianteBulkIds.length, assigned_normales: estudianteIds.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Desasignar estudiantes_bulk (quitar de cualquier grupo)
router.post('/estudiantes/unassign', async (req, res) => {
  try {
    const db = getDb(req);

    const bulkIdsRaw = req.body?.estudiante_bulk_ids ?? req.body?.ids ?? [];
    const normalIdsRaw = req.body?.estudiante_ids ?? [];

    const estudianteBulkIds = normalizeNumericIds(bulkIdsRaw);
    const estudianteIds = normalizeNumericIds(normalIdsRaw);

    if (estudianteBulkIds.length === 0 && estudianteIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere estudiante_bulk_ids y/o estudiante_ids (array no vacío).' });
    }

    if (estudianteBulkIds.length) {
      const { error } = await db
        .from('estudiantes_en_grupo')
        .delete()
        .in('estudiante_bulk_id', estudianteBulkIds);
      if (error) return res.status(400).json({ error: error.message });
    }

    if (estudianteIds.length) {
      const { error } = await db
        .from('estudiantes')
        .update({ matricula_grupo_id: null, updated_at: new Date().toISOString() })
        .in('id', estudianteIds);
      if (error && !isMissingColumnError(error)) return res.status(400).json({ error: error.message });
    }

    return res.json({ ok: true, unassigned_bulk: estudianteBulkIds.length, unassigned_normales: estudianteIds.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Eliminar grupo (limpia vínculos y desvincula movimientos financieros)
router.delete('/grupos/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });

    const gidNum = Number(id);

    // 1) Desvincular estudiantes normales (si columna existe)
    if (Number.isFinite(gidNum)) {
      const { error } = await db
        .from('estudiantes')
        .update({ matricula_grupo_id: null, updated_at: new Date().toISOString() })
        .eq('matricula_grupo_id', gidNum);
      if (error && !isMissingColumnError(error)) return res.status(400).json({ error: error.message });
    }

    // 2) Desvincular movimientos_financieros (para evitar FK restrict)
    if (Number.isFinite(gidNum)) {
      const { error } = await db
        .from('movimientos_financieros')
        .update({ matricula_grupo_id: null, updated_at: new Date().toISOString() })
        .eq('matricula_grupo_id', gidNum);
      // Compat: si la tabla no existe todavía, ignoramos.
      if (error) {
        const msg = String(error?.message ?? '').toLowerCase();
        if (!(msg.includes('relation') && msg.includes('does not exist'))) {
          return res.status(400).json({ error: error.message });
        }
      }
    }

    // 3) Eliminar el grupo (estudiantes_en_grupo se borra por ON DELETE CASCADE)
    const { error: delErr } = await db
      .from('matriculas_grupo')
      .delete()
      .eq('id', id);
    if (delErr) return res.status(400).json({ error: delErr.message });

    return res.json({ ok: true, id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Subir Excel y procesar (detecta tipo con __meta)
// Modo previsualización: valida y muestra lo que se va a insertar SIN escribir en BD.
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Archivo requerido (field: file)' });
    }

    const wb = readWorkbook(req.file.buffer);
    const bulkType = detectBulkTypeFromWorkbook(wb);

    if (!bulkType) {
      return res.status(400).json({ error: 'No se pudo detectar el tipo de bulk. Asegúrate de usar el template descargado.' });
    }

    const db = getDb(req);

    // Limitar cantidad de filas devueltas para evitar payloads enormes
    const MAX_ROWS = 200;

    if (bulkType === 'cursos_bulk_v1') {
      const sheet = wb.Sheets['CURSOS'] || wb.Sheets['Cursos'] || wb.Sheets['cursos'];
      if (!sheet) return res.status(400).json({ error: 'Falta hoja "CURSOS"' });

      const rows = sheetToObjectsWithRowNumber(sheet);
      const attemptedRows = rows.filter((x) => x.hasAny);
      if (attemptedRows.length === 0) {
        return res.status(400).json({ error: 'No hay filas con datos en la hoja CURSOS.' });
      }

      const preview = [];
      const errors = [];
      for (const item of attemptedRows.slice(0, MAX_ROWS)) {
        const row = item.row;
        const rowNumber = item.rowNumber;

        const nombre = String(row['Nombre*'] ?? row['Nombre'] ?? row['nombre'] ?? '').trim();
        const nivel = String(row['Nivel'] ?? 'None').trim() || 'None';
        const tutor_ref = String(row['Tutor (Nombre o ID)'] ?? row['Tutor'] ?? row['tutor'] ?? '').trim();

        let tutor_id = null;
        let scheduleErr = null;
        let tutorErr = null;

        try {
          const { dias_schedule, error: scheduleError } = extractDiasScheduleFromCursoRow(row);
          if (scheduleError) scheduleErr = scheduleError;
          if (tutor_ref) {
            tutor_id = await resolveTutorIdByIdOrNombre(db, tutor_ref);
            if (!tutor_id) tutorErr = `Tutor no encontrado: ${tutor_ref}`;
            // Validación básica de tutor/horario (sin crear)
            if (tutor_id && (!dias_schedule || Object.keys(dias_schedule).length === 0)) {
              scheduleErr = scheduleErr || 'No se puede asignar tutor sin horario (dias_schedule) definido';
            }
          }
        } catch (e) {
          const msg = e?.message ? String(e.message) : String(e);
          errors.push({ rowNumber, nombre: nombre || null, error: msg });
        }

        preview.push({
          rowNumber,
          nombre,
          nivel,
          tutor_ref: tutor_ref || null,
          tutor_id,
          schedule_error: scheduleErr,
          tutor_error: tutorErr,
        });
      }

      return res.json({
        ok: true,
        bulkType,
        attempted: attemptedRows.length,
        returned: preview.length,
        truncated: attemptedRows.length > preview.length,
        preview,
        errors,
      });
    }

    if (bulkType === 'estudiantes_bulk_v1' || bulkType === 'estudiantes_bulk_v2' || bulkType === 'plantilla_estudiantes_only_v1') {
      const sheet = wb.Sheets['Estudiantes_Individuales'] || wb.Sheets['Estudiantes'] || wb.Sheets['ESTUDIANTES'];
      if (!sheet) return res.status(400).json({ error: 'Falta hoja "Estudiantes_Individuales"' });

      const { error: schemaErr } = await db
        .from('estudiantes_bulk')
        .select('id, dias')
        .limit(1);
      if (schemaErr && isMissingColumnError(schemaErr)) {
        return res.status(400).json({
          error: 'Tu base de datos no tiene la columna dias en estudiantes_bulk. Aplica la migración 002_add_estudiantes_bulk_extra_fields.sql y vuelve a intentar.',
          details: schemaErr.message,
        });
      }
      if (schemaErr) return res.status(400).json({ error: schemaErr.message });

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      const payload = rows
        .map((r, idx) => {
          const nombre = String(r['Nombre Completo*'] ?? r['nombre*'] ?? r['Nombre Completo'] ?? r['nombre'] ?? '').trim();
          const nombre_encargado = String(r['Nombre Encargado'] ?? r['nombre_encargado'] ?? '').trim() || null;

          const email_encargado = normalizeEmail(
            r['Correo Encargado'] ??
            r['Email Encargado'] ??
            r['email_encargado'] ??
            // Compat: si alguien sube template viejo, lo tratamos como contacto del encargado
            r['Correo Electrónico'] ??
            r['Correo'] ??
            r['correo'] ??
            ''
          );
          const telefono_encargado =
            String(
              r['Teléfono Encargado'] ??
              r['Telefono Encargado'] ??
              r['telefono_encargado'] ??
              // Compat template viejo
              r['Teléfono'] ??
              r['telefono'] ??
              ''
            ).trim() || null;

          return {
            rowNumber: idx + 2,
            nombre,
            nombre_encargado,
            email_encargado,
            telefono_encargado,
            grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null,
          };
        })
        .filter((r) => r.nombre);

      if (payload.length === 0) {
        return res.status(400).json({ error: 'No hay filas válidas (se requiere nombre).' });
      }

      const dupNombreGradoInFile = uniq(
        payload
          .map((p) => `${String(p.nombre).trim().toLowerCase()}|${String(p.grado ?? '').trim().toLowerCase()}`)
          .filter((k, i, arr) => k && arr.indexOf(k) !== i)
      );
      const missingContacto = payload
        .filter((p) => !p.email_encargado && !p.telefono_encargado)
        .slice(0, 50)
        .map((p) => ({ rowNumber: p.rowNumber, nombre: p.nombre }));

      return res.json({
        ok: true,
        bulkType,
        attempted: payload.length,
        returned: Math.min(payload.length, MAX_ROWS),
        truncated: payload.length > MAX_ROWS,
        preview: payload.slice(0, MAX_ROWS),
        warnings: {
          duplicate_nombre_grado_in_file: dupNombreGradoInFile,
          missing_contacto_encargado: missingContacto,
        },
      });
    }

    if (bulkType === 'plantilla_estudiantes_y_grupos_v1') {
      const sheetGrupos = wb.Sheets['GRUPOS'] || wb.Sheets['Grupos'] || wb.Sheets['Grupo'];
      const sheetEst = wb.Sheets['ESTUDIANTES'] || wb.Sheets['Estudiantes'] || wb.Sheets['Estudiantes_Individuales'];
      if (!sheetGrupos) return res.status(400).json({ error: 'Falta hoja "GRUPOS"' });
      if (!sheetEst) return res.status(400).json({ error: 'Falta hoja "ESTUDIANTES"' });

      const [bulkSchemaRes, gruposSchemaRes] = await Promise.all([
        db.from('estudiantes_bulk').select('id, dias, dias_turno').limit(1),
        db.from('matriculas_grupo').select('id, fecha_inicio').limit(1),
      ]);

      if (bulkSchemaRes.error) {
        const payload = schemaErrorPayload(bulkSchemaRes.error);
        if (payload) return res.status(400).json(payload);
        return res.status(400).json({ error: bulkSchemaRes.error.message });
      }
      if (gruposSchemaRes.error) {
        const payload = schemaErrorPayload(gruposSchemaRes.error);
        if (payload) return res.status(400).json(payload);
        return res.status(400).json({ error: gruposSchemaRes.error.message });
      }

      const gruposRows = XLSX.utils.sheet_to_json(sheetGrupos, { defval: '', raw: false });
      const grupos = gruposRows
        .map((r, idx) => ({
          rowNumber: idx + 2,
          nombre_grupo: String(r['Nombre del Grupo'] ?? r['Nombre del Grupo*'] ?? '').trim(),
          curso_ref: String(r['Curso (ID o Nombre)'] ?? r['Curso* (Nombre)'] ?? r['Curso'] ?? '').trim(),
          tutor_nombre: String(r['Tutor (Nombre)'] ?? r['Tutor* (Nombre)'] ?? r['Tutor'] ?? '').trim(),
          cantidad_estudiantes_esperados: String(r['Estudiantes Esperados'] ?? '').trim(),
          fecha_inicio: String(r['Fecha Inicio (AAAA-MM-DD)'] ?? r['Fecha Inicio (YYYY-MM-DD)'] ?? '').trim(),
          turno: String(r['Turno'] ?? '').trim(),
        }))
        .filter((g) => g.nombre_grupo);

      if (grupos.length === 0) {
        return res.status(400).json({ error: 'No hay grupos válidos (se requiere Nombre del Grupo).' });
      }

      const gruposPreview = [];
      const gruposErrors = [];
      for (const g of grupos.slice(0, MAX_ROWS)) {
        let curso_id = null;
        let tutor_id = null;
        let curso_error = null;
        let tutor_error = null;
        try {
          curso_id = await resolveCursoIdByIdOrNombre(db, g.curso_ref);
          tutor_id = await resolveTutorIdByNombre(db, g.tutor_nombre);
          if (!curso_id) curso_error = `Curso no encontrado: ${g.curso_ref}`;
          if (!tutor_id) tutor_error = `Tutor no encontrado: ${g.tutor_nombre}`;
        } catch (e) {
          const msg = e?.message ? String(e.message) : String(e);
          gruposErrors.push({ rowNumber: g.rowNumber, nombre_grupo: g.nombre_grupo || null, error: msg });
        }

        gruposPreview.push({
          ...g,
          curso_id,
          tutor_id,
          curso_error,
          tutor_error,
        });
      }

      const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
      const estudiantesPayload = estRows
        .map((r, idx) => {
          const nombre = String(r['Nombre Completo'] ?? r['Nombre Completo*'] ?? r['nombre*'] ?? r['nombre'] ?? '').trim();
          const nombre_encargado = String(r['Nombre Encargado'] ?? r['nombre_encargado'] ?? '').trim() || null;
          const email_encargado = normalizeEmail(
            r['Correo Encargado'] ??
            r['Email Encargado'] ??
            r['email_encargado'] ??
            r['Correo Electrónico'] ??
            r['Correo'] ??
            r['correo'] ??
            ''
          );
          const telefono_encargado =
            String(
              r['Teléfono Encargado'] ??
              r['Telefono Encargado'] ??
              r['telefono_encargado'] ??
              r['Teléfono'] ??
              r['telefono'] ??
              ''
            ).trim() || null;
          return {
            rowNumber: idx + 2,
            nombre,
            nombre_encargado,
            email_encargado,
            telefono_encargado,
            grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null,
            grupo_nombre: String(r['Grupo (Opcional)'] ?? r['Grupo'] ?? '').trim() || null,
          };
        })
        .filter((r) => r.nombre);

      if (estudiantesPayload.length === 0) {
        return res.status(400).json({ error: 'No hay estudiantes válidos (se requiere Nombre Completo).' });
      }

      const dupNombreGradoInFile = uniq(
        estudiantesPayload
          .map((p) => `${String(p.nombre).trim().toLowerCase()}|${String(p.grado ?? '').trim().toLowerCase()}`)
          .filter((k, i, arr) => k && arr.indexOf(k) !== i)
      );
      const missingContacto = estudiantesPayload
        .filter((p) => !p.email_encargado && !p.telefono_encargado)
        .slice(0, 50)
        .map((p) => ({ rowNumber: p.rowNumber, nombre: p.nombre }));

      return res.json({
        ok: true,
        bulkType,
        grupos: {
          attempted: grupos.length,
          returned: Math.min(grupos.length, MAX_ROWS),
          truncated: grupos.length > MAX_ROWS,
          preview: gruposPreview,
          errors: gruposErrors,
        },
        estudiantes: {
          attempted: estudiantesPayload.length,
          returned: Math.min(estudiantesPayload.length, MAX_ROWS),
          truncated: estudiantesPayload.length > MAX_ROWS,
          preview: estudiantesPayload.slice(0, MAX_ROWS),
        },
        warnings: {
          duplicate_nombre_grado_in_file: dupNombreGradoInFile,
          missing_contacto_encargado: missingContacto,
        },
      });
    }

    // Para otros tipos devolvemos una vista mínima
    return res.json({ ok: true, bulkType, message: 'Previsualización no implementada a detalle para este tipo. Usa Importar para procesar.' });
  } catch (error) {
    const payload = schemaErrorPayload(error);
    if (payload) return res.status(400).json(payload);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Archivo requerido (field: file)' });
    }

    const wb = readWorkbook(req.file.buffer);
    const bulkType = detectBulkTypeFromWorkbook(wb);

    if (!bulkType) {
      return res.status(400).json({ error: 'No se pudo detectar el tipo de bulk. Asegúrate de usar el template descargado.' });
    }

    const db = getDb(req);
    const userId = req.user?.id ?? null;

    if (bulkType === 'cursos_bulk_v1') {
      const sheet = wb.Sheets['CURSOS'] || wb.Sheets['Cursos'] || wb.Sheets['cursos'];
      if (!sheet) return res.status(400).json({ error: 'Falta hoja "CURSOS"' });

      const rows = sheetToObjectsWithRowNumber(sheet);
      const attemptedRows = rows.filter((x) => x.hasAny);
      if (attemptedRows.length === 0) {
        return res.status(400).json({ error: 'No hay filas con datos en la hoja CURSOS.' });
      }

      const { data: existingCursos, error: existingCursosErr } = await db
        .from('cursos')
        .select('nombre');
      if (existingCursosErr) throw existingCursosErr;

      const existingNames = new Set((existingCursos ?? []).map((c) => normalizeName(c?.nombre)));
      const seenNames = new Set();

      const successes = [];
      const failures = [];

      for (const item of attemptedRows) {
        const row = item.row;
        const rowNumber = item.rowNumber;

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
          if (!nombre) {
            throw new Error('Nombre requerido (columna Nombre*)');
          }

          const nombreKey = normalizeName(nombre);
          if (existingNames.has(nombreKey)) {
            throw new Error('Nombre duplicado: ya existe un curso con ese nombre');
          }
          if (seenNames.has(nombreKey)) {
            throw new Error('Nombre duplicado en el archivo');
          }
          seenNames.add(nombreKey);

          const { dias, dias_schedule, error: scheduleErr } = extractDiasScheduleFromCursoRow(row);
          if (scheduleErr) throw new Error(scheduleErr);

          let tutor_id = null;
          if (tutor_ref) {
            tutor_id = await resolveTutorIdByIdOrNombre(db, tutor_ref);
            if (!tutor_id) throw new Error(`Tutor no encontrado: ${tutor_ref}`);
            if (!dias_schedule || Object.keys(dias_schedule).length === 0) {
              throw new Error('No se puede asignar tutor sin horario (dias_schedule) definido');
            }

            const { data: tutor, error: tErr } = await db.from('tutores').select('*').eq('id', tutor_id).maybeSingle();
            if (tErr || !tutor) throw new Error('Tutor no encontrado');

            const aptitude = validateTutorAptitudeForCourse(tutor, nivel);
            if (!aptitude.ok) throw new Error(aptitude.reason);

            const tutorObj = { ...tutor, dias_horarios: tutor.dias_horarios };
            const cursoObj = { dias_schedule, dias_turno: null };
            const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
            if (!validation.compatible) {
              const reason = (validation.issues ?? []).filter((x) => String(x).startsWith('❌')).join('; ') || 'Horarios incompatibles';
              throw new Error(reason);
            }

            const scheduleConflicts = await validateTutorNoCourseConflicts(db, tutor_id, dias_schedule, null);
            if (scheduleConflicts.length > 0) {
              const first = scheduleConflicts[0];
              const overlap = first?.overlaps?.[0];
              const overlapMsg = overlap ? `${overlap.dia} ${overlap.a.hora_inicio}-${overlap.a.hora_fin}` : 'franja';
              throw new Error(`Choque de horario con curso "${first.curso_nombre}" (${overlapMsg})`);
            }
          }

          const maxEstudiantes = tipo_clase === 'tutoria'
            ? null
            : (max_estudiantes_raw ? parseInt(max_estudiantes_raw, 10) : 10);

          const costo_curso = costo_curso_raw ? parseFloat(costo_curso_raw) : 0;
          const pago_tutor = pago_tutor_raw ? parseFloat(pago_tutor_raw) : 0;

          const { data: curso, error } = await db
            .from('cursos')
            .insert({
              nombre,
              descripcion,
              nivel: nivel || 'None',
              tipo_clase,
              tipo_pago,
              max_estudiantes: maxEstudiantes,
              dias: dias ? JSON.stringify(dias) : null,
              dias_schedule: dias_schedule ? JSON.stringify(dias_schedule) : null,
              costo_curso: Number.isFinite(costo_curso) ? costo_curso : 0,
              pago_tutor: Number.isFinite(pago_tutor) ? pago_tutor : 0,
              tutor_id,
              estado: true,
              created_by: userId,
            })
            .select('id,nombre')
            .single();

          if (error) throw error;
          successes.push({ rowNumber, id: curso?.id, nombre: curso?.nombre ?? nombre });
        } catch (err) {
          const msg = err?.message ? String(err.message) : String(err);
          failures.push({ rowNumber, nombre: nombre || null, error: msg });
        }
      }

      return res.json({
        ok: true,
        bulkType,
        attempted: attemptedRows.length,
        created: successes.length,
        failed: failures.length,
        successes,
        failures,
      });
    }

    if (bulkType === 'estudiantes_bulk_v1' || bulkType === 'estudiantes_bulk_v2' || bulkType === 'plantilla_estudiantes_only_v1') {
      const sheet = wb.Sheets['Estudiantes_Individuales'] || wb.Sheets['Estudiantes'] || wb.Sheets['ESTUDIANTES'];
      if (!sheet) return res.status(400).json({ error: 'Falta hoja "Estudiantes_Individuales"' });

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      const payload = rows
        .map((r, idx) => {
          const { dias, dias_turno } = extractDiasTurnoFromRow(r);
          return {
            rowNumber: idx + 2,
            nombre: String(r['Nombre Completo*'] ?? r['nombre*'] ?? r['Nombre Completo'] ?? r['nombre'] ?? '').trim(),
            nombre_encargado: String(r['Nombre Encargado'] ?? r['nombre_encargado'] ?? '').trim() || null,
            email_encargado: normalizeEmail(
              r['Correo Encargado'] ??
              r['Email Encargado'] ??
              r['email_encargado'] ??
              // Compat template viejo
              r['Correo Electrónico'] ??
              r['Correo'] ??
              r['correo'] ??
              ''
            ),
            telefono_encargado:
              String(
                r['Teléfono Encargado'] ??
                r['Telefono Encargado'] ??
                r['telefono_encargado'] ??
                // Compat template viejo
                r['Teléfono'] ??
                r['telefono'] ??
                ''
              ).trim() || null,
            grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null,
            dias,
            dias_turno,
            // Ya no usamos requiere_perfil_completo, pero mantenemos compat.
            requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)'] ?? r['requiere_perfil_completo']),
          };
        })
        .filter((r) => r.nombre);

      if (payload.length === 0) {
        return res.status(400).json({ error: 'No hay filas válidas (se requiere nombre).' });
      }

      const [existingEst, existingBulk] = await Promise.all([
        db.from('estudiantes').select('nombre'),
        db.from('estudiantes_bulk').select('nombre'),
      ]);

      if (existingEst.error) throw existingEst.error;
      if (existingBulk.error) throw existingBulk.error;

      const existingNames = new Set([
        ...(existingEst.data ?? []).map((e) => normalizeName(e?.nombre)),
        ...(existingBulk.data ?? []).map((e) => normalizeName(e?.nombre)),
      ]);
      const seenNames = new Set();
      const failures = [];

      const insertRows = [];
      for (const r of payload) {
        const nombreKey = normalizeName(r.nombre);
        if (existingNames.has(nombreKey)) {
          failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado: ya existe un estudiante con ese nombre' });
          continue;
        }
        if (seenNames.has(nombreKey)) {
          failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado en el archivo' });
          continue;
        }
        seenNames.add(nombreKey);
        insertRows.push({
          nombre: r.nombre,
          // Contacto del estudiante ya no se usa (UI guardian-only)
          correo: null,
          telefono: null,
          nombre_encargado: r.nombre_encargado,
          email_encargado: r.email_encargado,
          telefono_encargado: r.telefono_encargado,
          grado: r.grado,
          dias: r.dias ? JSON.stringify(r.dias) : null,
          dias_turno: r.dias_turno ? JSON.stringify(r.dias_turno) : null,
          requiere_perfil_completo: !!r.requiere_perfil_completo,
          estado: true,
          created_by: userId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
      }

      let data = [];
      if (insertRows.length > 0) {
        const insertRes = await db
          .from('estudiantes_bulk')
          .insert(insertRows)
          .select('id, nombre');

        if (insertRes.error) {
          if (isMissingColumnError(insertRes.error)) {
            return res.status(400).json({
              error: 'Tu base de datos no tiene las columnas nuevas para importar el formato actualizado. Aplica la migración 002_add_estudiantes_bulk_extra_fields.sql y vuelve a intentar.',
              details: insertRes.error.message,
            });
          }
          return res.status(400).json({ error: insertRes.error.message });
        }
        data = insertRes.data ?? [];
      }

      return res.json({
        ok: true,
        bulkType,
        attempted: payload.length,
        created: data?.length ?? 0,
        failed: failures.length,
        inserted: data?.length ?? 0,
        failures,
      });
    }

    if (bulkType === 'plantilla_estudiantes_y_grupos_v1') {
      const sheetGrupos = wb.Sheets['GRUPOS'] || wb.Sheets['Grupos'] || wb.Sheets['Grupo'];
      const sheetEst = wb.Sheets['ESTUDIANTES'] || wb.Sheets['Estudiantes'] || wb.Sheets['Estudiantes_Individuales'];
      if (!sheetGrupos) return res.status(400).json({ error: 'Falta hoja "GRUPOS"' });
      if (!sheetEst) return res.status(400).json({ error: 'Falta hoja "ESTUDIANTES"' });

      const gruposRows = XLSX.utils.sheet_to_json(sheetGrupos, { defval: '', raw: false });
      const grupos = gruposRows
        .map((r) => ({
          nombre_grupo: String(r['Nombre del Grupo'] ?? r['Nombre del Grupo*'] ?? '').trim(),
          curso_ref: String(r['Curso (ID o Nombre)'] ?? r['Curso* (Nombre)'] ?? r['Curso'] ?? '').trim(),
          tutor_nombre: String(r['Tutor (Nombre)'] ?? r['Tutor* (Nombre)'] ?? r['Tutor'] ?? '').trim(),
          cantidad_estudiantes_esperados: String(r['Estudiantes Esperados'] ?? '').trim(),
          fecha_inicio: String(r['Fecha Inicio (AAAA-MM-DD)'] ?? r['Fecha Inicio (YYYY-MM-DD)'] ?? '').trim(),
          turno: String(r['Turno'] ?? '').trim(),
        }))
        .filter((g) => g.nombre_grupo);

      if (grupos.length === 0) {
        return res.status(400).json({ error: 'No hay grupos válidos (se requiere Nombre del Grupo).' });
      }

      for (const g of grupos) {
        const cursoId = await resolveCursoIdByIdOrNombre(db, g.curso_ref);
        const tutorId = await resolveTutorIdByNombre(db, g.tutor_nombre);
        if (!cursoId) return res.status(400).json({ error: `Curso no encontrado: ${g.curso_ref}` });
        if (!tutorId) return res.status(400).json({ error: `Tutor no encontrado: ${g.tutor_nombre}` });
        g.curso_id = cursoId;
        g.tutor_id = tutorId;
      }

      const [existingEst, existingBulk] = await Promise.all([
        db.from('estudiantes').select('nombre'),
        db.from('estudiantes_bulk').select('nombre'),
      ]);

      if (existingEst.error) throw existingEst.error;
      if (existingBulk.error) throw existingBulk.error;

      const existingNames = new Set([
        ...(existingEst.data ?? []).map((e) => normalizeName(e?.nombre)),
        ...(existingBulk.data ?? []).map((e) => normalizeName(e?.nombre)),
      ]);

      // Intentar importación transaccional vía RPC (si existe en la BD)
      // Si no existe, caemos al flujo actual (inserts secuenciales).
      try {
        const estRowsPreview = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
        const estudiantesRaw = estRowsPreview
          .map((r, idx) => {
            const { dias, dias_turno } = extractDiasTurnoFromRow(r);
            return {
              rowNumber: idx + 2,
              nombre: String(r['Nombre Completo'] ?? r['Nombre Completo*'] ?? r['nombre*'] ?? r['nombre'] ?? '').trim(),
              nombre_encargado: String(r['Nombre Encargado'] ?? r['nombre_encargado'] ?? '').trim() || null,
              // Contacto del estudiante ya no se usa (UI guardian-only)
              telefono: null,
              correo: null,
              email_encargado: normalizeEmail(
                r['Correo Encargado'] ??
                r['Email Encargado'] ??
                r['email_encargado'] ??
                r['Correo Electrónico'] ??
                r['Correo'] ??
                r['correo'] ??
                ''
              ),
              telefono_encargado:
                String(
                  r['Teléfono Encargado'] ??
                  r['Telefono Encargado'] ??
                  r['telefono_encargado'] ??
                  r['Teléfono'] ??
                  r['telefono'] ??
                  ''
                ).trim() || null,
              grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null,
              dias: dias ?? null,
              dias_turno: dias_turno ?? null,
              requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)'] ?? r['requiere_perfil_completo']),
              grupo_nombre: String(r['Grupo (Opcional)'] ?? r['Grupo'] ?? '').trim() || null,
            };
          })
          .filter((r) => r.nombre);

        const failures = [];
        const seenNames = new Set();
        const estudiantesForRpc = [];
        for (const r of estudiantesRaw) {
          const nombreKey = normalizeName(r.nombre);
          if (existingNames.has(nombreKey)) {
            failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado: ya existe un estudiante con ese nombre' });
            continue;
          }
          if (seenNames.has(nombreKey)) {
            failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado en el archivo' });
            continue;
          }
          seenNames.add(nombreKey);
          estudiantesForRpc.push(r);
        }

        if (estudiantesForRpc.length > 0 && failures.length === 0) {
          const gruposForRpc = grupos.map((g) => ({
            curso_id: Number(g.curso_id),
            tutor_id: Number(g.tutor_id),
            nombre_grupo: g.nombre_grupo,
            cantidad_estudiantes_esperados: g.cantidad_estudiantes_esperados ? parseInt(String(g.cantidad_estudiantes_esperados), 10) : null,
            fecha_inicio: g.fecha_inicio || null,
            turno: g.turno || null,
          }));

          const { data: rpcData, error: rpcErr } = await db.rpc('bulk_import_estudiantes_y_grupos_v1', {
            p_user_id: userId,
            p_grupos: gruposForRpc,
            p_estudiantes: estudiantesForRpc.map((r) => ({
              nombre: r.nombre,
              nombre_encargado: r.nombre_encargado,
              telefono: r.telefono,
              correo: r.correo,
              email_encargado: r.email_encargado,
              telefono_encargado: r.telefono_encargado,
              grado: r.grado,
              dias: r.dias ?? null,
              dias_turno: r.dias_turno ?? null,
              requiere_perfil_completo: r.requiere_perfil_completo,
              grupo_nombre: r.grupo_nombre,
            })),
          });

          if (!rpcErr && rpcData) {
            return res.json({
              ok: true,
              bulkType,
              ...rpcData,
              mode: 'rpc',
            });
          }

          if (rpcErr) {
            const msg = String(rpcErr.message ?? '').toLowerCase();
            const isMissingFn = msg.includes('function') && msg.includes('does not exist');
            if (!isMissingFn) {
              // Si la función existe pero falló, es mejor reportar el error que seguir con inserts parciales.
              return res.status(400).json({ error: rpcErr.message, mode: 'rpc' });
            }
          }
        }
      } catch (e) {
        // Si algo falla en el intento de RPC, seguimos al flujo secuencial.
      }

      const groupNameToId = new Map();
      for (const g of grupos) {
        const cant = g.cantidad_estudiantes_esperados ? parseInt(String(g.cantidad_estudiantes_esperados), 10) : null;
        const { data: grupo, error: grupoErr } = await db
          .from('matriculas_grupo')
          .insert({
            curso_id: g.curso_id,
            tutor_id: g.tutor_id,
            nombre_grupo: g.nombre_grupo,
            cantidad_estudiantes_esperados: Number.isFinite(cant) ? cant : null,
            estado: 'activa',
            fecha_inicio: g.fecha_inicio || null,
            turno: g.turno || null,
            created_by: userId,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (grupoErr) return res.status(400).json({ error: grupoErr.message });
        groupNameToId.set(g.nombre_grupo, grupo.id);
      }

      const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
      const estudiantesPayload = estRows
        .map((r, idx) => {
          const { dias, dias_turno } = extractDiasTurnoFromRow(r);
          return {
            rowNumber: idx + 2,
            nombre: String(r['Nombre Completo'] ?? r['Nombre Completo*'] ?? r['nombre*'] ?? r['nombre'] ?? '').trim(),
            nombre_encargado: String(r['Nombre Encargado'] ?? r['nombre_encargado'] ?? '').trim() || null,
            telefono: null,
            correo: null,
            email_encargado: normalizeEmail(
              r['Correo Encargado'] ??
              r['Email Encargado'] ??
              r['email_encargado'] ??
              r['Correo Electrónico'] ??
              r['Correo'] ??
              r['correo'] ??
              ''
            ),
            telefono_encargado:
              String(
                r['Teléfono Encargado'] ??
                r['Telefono Encargado'] ??
                r['telefono_encargado'] ??
                r['Teléfono'] ??
                r['telefono'] ??
                ''
              ).trim() || null,
            grado: String(r['Grado*'] ?? r['Grado'] ?? r['grado'] ?? '').trim() || null,
            dias,
            dias_turno,
            requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)'] ?? r['requiere_perfil_completo']),
            grupo_nombre: String(r['Grupo (Opcional)'] ?? r['Grupo'] ?? '').trim(),
          };
        })
        .filter((r) => r.nombre);

      if (estudiantesPayload.length === 0) {
        return res.status(400).json({ error: 'No hay estudiantes válidos (se requiere Nombre Completo).' });
      }

      const failures = [];
      const seenNames = new Set();
      const estudiantesToInsert = [];
      for (const r of estudiantesPayload) {
        const nombreKey = normalizeName(r.nombre);
        if (existingNames.has(nombreKey)) {
          failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado: ya existe un estudiante con ese nombre' });
          continue;
        }
        if (seenNames.has(nombreKey)) {
          failures.push({ rowNumber: r.rowNumber, nombre: r.nombre || null, error: 'Nombre duplicado en el archivo' });
          continue;
        }
        seenNames.add(nombreKey);
        estudiantesToInsert.push(r);
      }

      let bulkRows = [];
      if (estudiantesToInsert.length > 0) {
        const insertRes = await db
          .from('estudiantes_bulk')
          .insert(
            estudiantesToInsert.map((r) => ({
              nombre: r.nombre,
              telefono: null,
              correo: null,
              nombre_encargado: r.nombre_encargado,
              email_encargado: r.email_encargado,
              telefono_encargado: r.telefono_encargado,
              grado: r.grado,
              dias: r.dias ? JSON.stringify(r.dias) : null,
              dias_turno: r.dias_turno ? JSON.stringify(r.dias_turno) : null,
              requiere_perfil_completo: r.requiere_perfil_completo,
              estado: true,
              created_by: userId,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            }))
          )
          .select('id');

        if (insertRes.error) return res.status(400).json({ error: insertRes.error.message });
        bulkRows = insertRes.data ?? [];
      }

      const links = [];
      for (let i = 0; i < estudiantesToInsert.length; i++) {
        const grupoNombre = estudiantesToInsert[i].grupo_nombre;
        if (!grupoNombre) continue;
        const gid = groupNameToId.get(grupoNombre);
        if (!gid) return res.status(400).json({ error: `Grupo no encontrado en hoja GRUPOS: ${grupoNombre}` });
        links.push({ matricula_grupo_id: gid, estudiante_bulk_id: bulkRows[i].id });
      }

      if (links.length > 0) {
        const { error: linkErr } = await db.from('estudiantes_en_grupo').insert(links);
        if (linkErr) return res.status(400).json({ error: linkErr.message });
      }

      return res.json({
        ok: true,
        bulkType,
        created_grupos: groupNameToId.size,
        attempted: estudiantesPayload.length,
        created: bulkRows?.length ?? 0,
        failed: failures.length,
        inserted_estudiantes_bulk: bulkRows?.length ?? 0,
        linked: links.length,
        failures,
      });
    }

    if (bulkType === 'grupo_matricula_v1' || bulkType === 'grupo_matricula_v2') {
      const sheetGrupos = wb.Sheets['Grupos'] || wb.Sheets['Grupo'];
      const sheetEst = wb.Sheets['Estudiantes'];
      if (!sheetGrupos) return res.status(400).json({ error: 'Falta hoja "Grupos"' });
      if (!sheetEst) return res.status(400).json({ error: 'Falta hoja "Estudiantes"' });

      const gruposRows = XLSX.utils.sheet_to_json(sheetGrupos, { defval: '', raw: false });

      // Compat v1: key/value
      if (bulkType === 'grupo_matricula_v1') {
        const kv = new Map();
        for (const r of gruposRows) {
          const k = String(r['campo'] ?? '').trim();
          const v = String(r['valor'] ?? '').trim();
          if (k) kv.set(k, v);
        }

        const cursoId = parseInt(kv.get('curso_id*') || kv.get('curso_id') || '', 10);
        const tutorId = parseInt(kv.get('tutor_id*') || kv.get('tutor_id') || '', 10);

        if (!Number.isFinite(cursoId) || !Number.isFinite(tutorId)) {
          return res.status(400).json({ error: 'curso_id* y tutor_id* son requeridos y deben ser números.' });
        }

        const nombreGrupo = kv.get('nombre_grupo') || null;
        const cantEsperadosRaw = kv.get('cantidad_estudiantes_esperados') || '';
        const cantidadEsperados = cantEsperadosRaw ? parseInt(cantEsperadosRaw, 10) : null;
        const fechaInicio = kv.get('fecha_inicio (YYYY-MM-DD)') || kv.get('fecha_inicio') || null;
        const fechaFin = kv.get('fecha_fin (YYYY-MM-DD)') || kv.get('fecha_fin') || null;
        const notas = kv.get('notas') || null;

        const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
        const estudiantesPayload = estRows
          .map((r) => ({
            nombre: String(r['nombre*'] ?? r['nombre'] ?? '').trim(),
            telefono: String(r['telefono'] ?? '').trim() || null,
            correo: String(r['correo'] ?? '').trim() || null,
            requiere_perfil_completo: normalizeBool(r['requiere_perfil_completo']),
          }))
          .filter((r) => r.nombre);

        if (estudiantesPayload.length === 0) {
          return res.status(400).json({ error: 'No hay estudiantes válidos (se requiere nombre).' });
        }

        const { data: grupo, error: grupoErr } = await db
          .from('matriculas_grupo')
          .insert({
            curso_id: cursoId,
            tutor_id: tutorId,
            nombre_grupo: nombreGrupo,
            cantidad_estudiantes_esperados: cantidadEsperados ?? estudiantesPayload.length,
            estado: 'activa',
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
            notas,
            created_by: userId,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (grupoErr) return res.status(400).json({ error: grupoErr.message });

        const { data: bulkRows, error: bulkErr } = await db
          .from('estudiantes_bulk')
          .insert(
            estudiantesPayload.map((r) => ({
              ...r,
              estado: true,
              created_by: userId,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            }))
          )
          .select('id');

        if (bulkErr) return res.status(400).json({ error: bulkErr.message });

        const links = (bulkRows ?? []).map((r) => ({
          matricula_grupo_id: grupo.id,
          estudiante_bulk_id: r.id,
        }));

        const { error: linkErr } = await db
          .from('estudiantes_en_grupo')
          .insert(links);

        if (linkErr) return res.status(400).json({ error: linkErr.message });

        return res.json({
          ok: true,
          bulkType,
          matricula_grupo_id: grupo.id,
          inserted_estudiantes_bulk: bulkRows?.length ?? 0,
        });
      }

      // v2: Grupos (tabla) + Estudiantes con columna Grupo*
      const grupos = gruposRows
        .map((r) => ({
          nombre_grupo: String(r['Nombre del Grupo*'] ?? r['Nombre del Grupo'] ?? '').trim(),
          curso_nombre: String(r['Curso* (Nombre)'] ?? r['Curso'] ?? '').trim(),
          tutor_nombre: String(r['Tutor* (Nombre)'] ?? r['Tutor'] ?? '').trim(),
          cantidad_estudiantes_esperados: String(r['Estudiantes Esperados'] ?? '').trim(),
          fecha_inicio: String(r['Fecha Inicio (YYYY-MM-DD)'] ?? '').trim(),
          fecha_fin: String(r['Fecha Fin (YYYY-MM-DD)'] ?? '').trim(),
          notas: String(r['Notas'] ?? '').trim(),
        }))
        .filter((g) => g.nombre_grupo);

      if (!grupos || grupos.length === 0) {
        return res.status(400).json({ error: 'No hay grupos válidos (se requiere Nombre del Grupo*).' });
      }

      // Resolver curso/tutor por nombre
      for (const g of grupos) {
        const cursoId = await resolveCursoIdByNombre(db, g.curso_nombre);
        const tutorId = await resolveTutorIdByNombre(db, g.tutor_nombre);
        if (!cursoId) return res.status(400).json({ error: `Curso no encontrado: ${g.curso_nombre}` });
        if (!tutorId) return res.status(400).json({ error: `Tutor no encontrado: ${g.tutor_nombre}` });
        g.curso_id = cursoId;
        g.tutor_id = tutorId;
      }

      // Crear grupos y mapear nombre -> id
      const groupNameToId = new Map();
      for (const g of grupos) {
        const cant = g.cantidad_estudiantes_esperados ? parseInt(String(g.cantidad_estudiantes_esperados), 10) : null;
        const { data: grupo, error: grupoErr } = await db
          .from('matriculas_grupo')
          .insert({
            curso_id: g.curso_id,
            tutor_id: g.tutor_id,
            nombre_grupo: g.nombre_grupo,
            cantidad_estudiantes_esperados: Number.isFinite(cant) ? cant : null,
            estado: 'activa',
            fecha_inicio: g.fecha_inicio || null,
            fecha_fin: g.fecha_fin || null,
            notas: g.notas || null,
            created_by: userId,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (grupoErr) return res.status(400).json({ error: grupoErr.message });
        groupNameToId.set(g.nombre_grupo, grupo.id);
      }

      const estRows = XLSX.utils.sheet_to_json(sheetEst, { defval: '', raw: false });
      const estudiantesPayload = estRows
        .map((r) => ({
          nombre: String(r['Nombre Completo*'] ?? r['Nombre Completo'] ?? '').trim(),
          telefono: String(r['Teléfono'] ?? '').trim() || null,
          correo: String(r['Correo Electrónico'] ?? '').trim() || null,
          requiere_perfil_completo: normalizeBool(r['¿Perfil Completo? (SI/NO)']),
          grupo_nombre: String(r['Grupo*'] ?? r['Grupo'] ?? '').trim(),
        }))
        .filter((r) => r.nombre);

      if (estudiantesPayload.length === 0) {
        return res.status(400).json({ error: 'No hay estudiantes válidos (se requiere Nombre Completo*).' });
      }

      const { data: bulkRows, error: bulkErr } = await db
        .from('estudiantes_bulk')
        .insert(
          estudiantesPayload.map((r) => ({
            nombre: r.nombre,
            telefono: r.telefono,
            correo: r.correo,
            requiere_perfil_completo: r.requiere_perfil_completo,
            estado: true,
            created_by: userId,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          }))
        )
        .select('id');

      if (bulkErr) return res.status(400).json({ error: bulkErr.message });

      const links = [];
      for (let i = 0; i < estudiantesPayload.length; i++) {
        const grupoNombre = estudiantesPayload[i].grupo_nombre;
        if (!grupoNombre) {
          return res.status(400).json({ error: 'Todos los estudiantes en bulk de grupo requieren Grupo*.' });
        }
        const gid = groupNameToId.get(grupoNombre);
        if (!gid) {
          return res.status(400).json({ error: `Grupo no encontrado en hoja Grupos: ${grupoNombre}` });
        }
        links.push({
          matricula_grupo_id: gid,
          estudiante_bulk_id: bulkRows[i].id,
        });
      }

      const { error: linkErr } = await db
        .from('estudiantes_en_grupo')
        .insert(links);

      if (linkErr) return res.status(400).json({ error: linkErr.message });

      return res.json({
        ok: true,
        bulkType,
        created_grupos: groupNameToId.size,
        inserted_estudiantes_bulk: bulkRows?.length ?? 0,
        linked: links.length,
      });
    }

    return res.status(400).json({ error: 'Tipo de bulk no soportado', bulkType });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
