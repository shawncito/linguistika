import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const manualsDir = path.join(publicDir, 'manuales');
const logoPath = path.join(publicDir, 'favicon.png');

const page = {
  width: 595.28,
  height: 841.89,
  margin: 42,
};

const palette = {
  navy: [5, 16, 38],
  blue: [0, 174, 239],
  yellow: [255, 200, 0],
  slate900: [15, 23, 42],
  slate700: [51, 65, 85],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  slate200: [226, 232, 240],
  slate100: [241, 245, 249],
  white: [255, 255, 255],
};

const hasLogo = fs.existsSync(logoPath);
const logoBase64 = hasLogo ? fs.readFileSync(logoPath).toString('base64') : null;

function ensureOutputDir() {
  fs.mkdirSync(manualsDir, { recursive: true });
}

function drawTopBand(doc, title, subtitle) {
  doc.setFillColor(...palette.navy);
  doc.rect(0, 0, page.width, 102, 'F');

  doc.setFillColor(...palette.blue);
  doc.rect(0, 100, page.width, 4, 'F');

  doc.setFillColor(...palette.yellow);
  doc.circle(page.width - 70, 36, 24, 'F');
  doc.setFillColor(...palette.blue);
  doc.circle(page.width - 44, 58, 18, 'F');

  if (logoBase64) {
    doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', page.margin, 24, 42, 42);
  }

  doc.setTextColor(...palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, page.margin + 52, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 214, 235);
  doc.text(subtitle, page.margin + 52, 62);

  doc.setDrawColor(255, 255, 255, 0.18);
  doc.line(page.margin, 77, page.width - page.margin, 77);
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.setDrawColor(...palette.slate200);
  doc.line(page.margin, page.height - 28, page.width - page.margin, page.height - 28);

  doc.setTextColor(...palette.slate500);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Linguistika Studio - Manual de Usuario', page.margin, page.height - 14);
  doc.text(`Pagina ${pageNumber} de ${totalPages}`, page.width - page.margin, page.height - 14, { align: 'right' });
}

function writeParagraph(doc, text, x, y, width, fontSize = 10, lineHeight = 14, tone = 'body') {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...(tone === 'muted' ? palette.slate500 : palette.slate700));

  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function writeHeading(doc, text, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...palette.slate900);
  doc.text(text, x, y);
  return y + 14;
}

function writeBullets(doc, items, x, y, width) {
  let cursor = y;
  items.forEach((item) => {
    doc.setFillColor(...palette.blue);
    doc.circle(x + 3, cursor - 4, 2, 'F');
    cursor = writeParagraph(doc, item, x + 12, cursor, width - 12, 10, 14, 'body') + 4;
  });
  return cursor;
}

function drawPanel(doc, x, y, w, h, title, lines = []) {
  doc.setFillColor(...palette.white);
  doc.setDrawColor(...palette.slate200);
  doc.roundedRect(x, y, w, h, 10, 10, 'FD');

  doc.setFillColor(...palette.slate100);
  doc.roundedRect(x + 1, y + 1, w - 2, 26, 9, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...palette.slate900);
  doc.text(title, x + 10, y + 17);

  let cursor = y + 44;
  lines.forEach((line) => {
    doc.setDrawColor(...palette.slate300);
    doc.line(x + 12, cursor + 2, x + w - 12, cursor + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...palette.slate700);
    doc.text(line, x + 12, cursor);
    cursor += 18;
  });
}

function drawFlow(doc, steps, x, y, width) {
  const gap = 10;
  const cardWidth = (width - gap * (steps.length - 1)) / steps.length;

  steps.forEach((step, index) => {
    const stepX = x + index * (cardWidth + gap);

    doc.setFillColor(245, 250, 255);
    doc.setDrawColor(...palette.blue);
    doc.roundedRect(stepX, y, cardWidth, 74, 12, 12, 'FD');

    doc.setFillColor(...palette.blue);
    doc.circle(stepX + 16, y + 17, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...palette.white);
    doc.text(String(index + 1), stepX + 16, y + 20, { align: 'center' });

    doc.setTextColor(...palette.slate900);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(step.title, stepX + 30, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.slate700);
    const descLines = doc.splitTextToSize(step.detail, cardWidth - 18);
    doc.text(descLines, stepX + 10, y + 40);

    if (index < steps.length - 1) {
      const arrowY = y + 37;
      doc.setDrawColor(...palette.slate500);
      doc.line(stepX + cardWidth + 3, arrowY, stepX + cardWidth + 7, arrowY);
      doc.line(stepX + cardWidth + 5, arrowY - 2, stepX + cardWidth + 7, arrowY);
      doc.line(stepX + cardWidth + 5, arrowY + 2, stepX + cardWidth + 7, arrowY);
    }
  });
}

function applyFooters(doc) {
  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex);
    drawFooter(doc, pageIndex, totalPages);
  }
}

function writePdf(doc, filename) {
  const data = doc.output('arraybuffer');
  fs.writeFileSync(path.join(manualsDir, filename), Buffer.from(data));
}

function buildShortManual() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  drawTopBand(doc, 'Manual Rapido - Linguistika', 'Guia corta para operar el sistema en menos de 10 minutos');

  let y = 132;
  y = writeHeading(doc, '1) Ingreso y orientacion inicial', page.margin, y);
  y = writeParagraph(
    doc,
    'Este manual resume las acciones minimas para iniciar sesion, revisar pendientes y completar sesiones del dia sin errores de registro.',
    page.margin,
    y,
    page.width - page.margin * 2,
    10,
    14,
    'body'
  ) + 8;

  y = writeBullets(
    doc,
    [
      'Inicia sesion con tu usuario y revisa el rol visible en la esquina superior derecha.',
      'Usa el buscador superior para filtrar cursos, estudiantes o tutores en segundos.',
      'Ajusta el zoom si trabajas en pantalla pequena para mantener la lectura clara.',
    ],
    page.margin,
    y,
    page.width - page.margin * 2
  ) + 8;

  drawPanel(doc, page.margin, y, 250, 170, 'Vista recomendada al iniciar', [
    'Dashboard: sesiones de hoy y pendientes',
    'Botones de accion rapida por tarjeta',
    'Indicadores de estado por color',
    'Avisos de Tika para feedback inmediato',
  ]);

  drawPanel(doc, page.margin + 266, y, 246, 170, 'Atajos operativos', [
    'Confirmar asistencia',
    'Marcar sesion dada',
    'Programar nueva fecha',
    'Cancelar con motivo',
  ]);

  y += 196;
  y = writeHeading(doc, '2) Flujo diario recomendado', page.margin, y);
  drawFlow(
    doc,
    [
      { title: 'Revisar', detail: 'Valida sesiones del dia y alertas pendientes.' },
      { title: 'Confirmar', detail: 'Marca estado de contacto con estudiante o encargado.' },
      { title: 'Ejecutar', detail: 'Registra sesion dada al terminar la clase.' },
      { title: 'Cerrar', detail: 'Verifica tesoreria y deja observaciones.' },
    ],
    page.margin,
    y + 6,
    page.width - page.margin * 2
  );

  doc.addPage();
  drawTopBand(doc, 'Manual Rapido - Linguistika', 'Checklist de uso por modulo principal');

  y = 132;
  y = writeHeading(doc, '3) Que hacer en cada modulo', page.margin, y);

  autoTable(doc, {
    startY: y + 4,
    margin: { left: page.margin, right: page.margin },
    head: [['Modulo', 'Objetivo', 'Accion rapida recomendada']],
    body: [
      ['Dashboard', 'Control operativo del dia', 'Completar sesiones y revisar pendientes.'],
      ['Estudiantes', 'Datos academicos y contacto', 'Actualizar telefono y estado de matricula.'],
      ['Tutores', 'Seguimiento de disponibilidad', 'Activar/inactivar y validar especialidades.'],
      ['Cursos y Matriculas', 'Planificacion academica', 'Crear curso y vincular estudiante/tutor.'],
      ['Tesoreria', 'Control de pagos', 'Registrar pagos y revisar cierres mensuales.'],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 7,
      textColor: palette.slate700,
      lineColor: palette.slate200,
      lineWidth: 0.6,
    },
    headStyles: {
      fillColor: palette.navy,
      textColor: palette.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const tableY = doc.lastAutoTable.finalY + 16;
  y = writeHeading(doc, '4) Soporte y seguridad', page.margin, tableY);
  y = writeBullets(
    doc,
    [
      'Descarga este manual y el manual completo desde el menu del usuario.',
      'Si tienes bloqueo operativo, contacta soporte: +506 6126-8302.',
      'Antes de cerrar sesion, confirma que no existan sesiones pendientes sin estado.',
      'Evita borrar informacion sin respaldo y registra siempre el motivo del cambio.',
    ],
    page.margin,
    y,
    page.width - page.margin * 2
  );

  drawPanel(doc, page.margin, y + 10, page.width - page.margin * 2, 112, 'Checklist de cierre del dia', [
    '1. Todas las sesiones del dia tienen estado final.',
    '2. No hay cancelaciones sin motivo.',
    '3. Tesoreria revisada si hubo pagos o ajustes.',
    '4. Actividad relevante registrada para el equipo administrativo.',
  ]);

  applyFooters(doc);
  writePdf(doc, 'Manual_Rapido_Linguistika.pdf');
}

function buildFullManual() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  drawTopBand(doc, 'Manual Completo - Linguistika', 'Guia operativa profesional para administracion academica y tesoreria');

  let y = 136;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...palette.slate900);
  doc.text('Linguistika Studio', page.margin, y);

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...palette.slate700);
  doc.text('Version de referencia: 0.3.0-alpha', page.margin, y);
  y += 18;
  doc.text('Publico objetivo: Administracion, oficina, tutores y contabilidad.', page.margin, y);

  y += 28;
  drawPanel(doc, page.margin, y, page.width - page.margin * 2, 148, 'Proposito del manual', [
    'Estandarizar la operacion diaria del centro de idiomas.',
    'Reducir errores de registro academico y financiero.',
    'Acelerar entrenamiento de personal nuevo.',
    'Mantener trazabilidad con acciones claras en cada modulo.',
  ]);

  y += 168;
  y = writeHeading(doc, 'Mapa general de operacion', page.margin, y);
  drawFlow(
    doc,
    [
      { title: 'Planear', detail: 'Crear cursos, grupos y matriculas.' },
      { title: 'Ejecutar', detail: 'Confirmar clases y registrar resultados.' },
      { title: 'Cobrar', detail: 'Registrar pagos y conciliaciones.' },
      { title: 'Analizar', detail: 'Revisar indicadores y actividad.' },
    ],
    page.margin,
    y + 4,
    page.width - page.margin * 2
  );

  doc.addPage();
  drawTopBand(doc, '1) Navegacion y controles globales', 'Header, menu de usuario, busqueda, zoom y tema');

  y = 132;
  y = writeParagraph(
    doc,
    'El encabezado concentra controles de alto impacto: modulo activo, busqueda rapida, notificaciones de actividad, selector de tema y escalado visual.',
    page.margin,
    y,
    page.width - page.margin * 2,
    10,
    14,
    'body'
  ) + 10;

  drawPanel(doc, page.margin, y, 246, 214, 'Componente: Header principal', [
    'Logo + easter egg visual',
    'Notificaciones y actividad reciente',
    'Menu de usuario con manuales PDF',
    'Telefono de soporte visible',
    'Cambio de modo claro/oscuro',
  ]);

  drawPanel(doc, page.margin + 266, y, 246, 214, 'Componente: Barra de accion', [
    'Buscador global por texto',
    'Zoom de interfaz con porcentaje',
    'Acceso rapido por navegacion superior',
    'Feedback visual de foco y hover',
    'Persistencia local de preferencias',
  ]);

  y += 236;
  y = writeHeading(doc, 'Buenas practicas de navegacion', page.margin, y);
  writeBullets(
    doc,
    [
      'Mantener un flujo lineal por modulo evita duplicar registros.',
      'Usar filtros antes de exportar o editar en bloque.',
      'Validar rol de usuario antes de acciones sensibles en tesoreria.',
      'Utilizar el modo claro en ambientes con mucha luz natural.',
    ],
    page.margin,
    y,
    page.width - page.margin * 2
  );

  doc.addPage();
  drawTopBand(doc, '2) Dashboard y agenda diaria', 'Control de sesiones, pendientes y decisiones de ultima milla');

  y = 132;
  y = writeHeading(doc, 'Panel de sesiones del dia', page.margin, y);
  y = writeParagraph(
    doc,
    'Cada tarjeta muestra curso, horario, participante principal y estado actual. Desde aqui puedes programar, cancelar con motivo o marcar la sesion como dada al finalizar.',
    page.margin,
    y,
    page.width - page.margin * 2,
    10,
    14,
    'body'
  ) + 8;

  drawPanel(doc, page.margin, y, page.width - page.margin * 2, 210, 'Mock visual de tarjeta de sesion', [
    'Curso: Ingles Conversacional B1',
    'Horario: 5:00 PM - 6:00 PM',
    'Participante: Ana Gomez',
    'Tutor: Carlos Arias',
    'Estado: Confirmada / En espera / En curso',
    'Acciones: Marcar dada, Programar, Cancelar hoy',
  ]);

  y += 234;
  y = writeHeading(doc, 'Flujo de decision para una sesion', page.margin, y);
  drawFlow(
    doc,
    [
      { title: 'Antes', detail: 'Validar tutor, horario y contacto.' },
      { title: 'Durante', detail: 'Marcar en curso cuando aplique.' },
      { title: 'Despues', detail: 'Marcar dada o justificar cancelacion.' },
      { title: 'Cierre', detail: 'Verificar impactos en tesoreria.' },
    ],
    page.margin,
    y + 6,
    page.width - page.margin * 2
  );

  doc.addPage();
  drawTopBand(doc, '3) Modulos academicos', 'Estudiantes, tutores, cursos y matriculas');

  y = 132;
  y = writeHeading(doc, 'Matriz de responsabilidades', page.margin, y);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: page.margin, right: page.margin },
    head: [['Modulo', 'Datos clave', 'Operacion diaria', 'Riesgo si se omite']],
    body: [
      ['Estudiantes', 'Nombre, contacto, estado', 'Actualizar ficha y verificar grupo', 'Perdida de trazabilidad de comunicacion'],
      ['Tutores', 'Especialidad, estado, contacto', 'Activar disponibilidad real', 'Asignaciones a tutores inactivos'],
      ['Cursos', 'Tipo de pago, encargado, tutor', 'Crear/editar oferta academica', 'Errores en cobro y planeacion'],
      ['Matriculas', 'Vinculo estudiante-curso', 'Registrar alta y cambios', 'Sesiones sin referencia de pago'],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: palette.slate700,
      lineColor: palette.slate200,
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [9, 26, 58],
      textColor: palette.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  y = doc.lastAutoTable.finalY + 18;
  drawPanel(doc, page.margin, y, page.width - page.margin * 2, 160, 'Secuencia recomendada para nuevas matriculas', [
    '1. Crear o validar estudiante.',
    '2. Confirmar curso activo y tutor asignado.',
    '3. Registrar modalidad de pago (sesion o mensual).',
    '4. Guardar observaciones relevantes del encargado.',
    '5. Validar que aparezca en agenda y en tesoreria cuando corresponda.',
  ]);

  doc.addPage();
  drawTopBand(doc, '4) Tesoreria y control financiero', 'Pagos, comprobantes, cierres y control de obligaciones');

  y = 132;
  y = writeHeading(doc, 'Circuito financiero basico', page.margin, y);
  y = writeParagraph(
    doc,
    'El modulo de tesoreria permite registrar pagos, asociar comprobantes y controlar obligaciones de pago a tutores. Toda modificacion debe tener soporte y trazabilidad.',
    page.margin,
    y,
    page.width - page.margin * 2,
    10,
    14,
    'body'
  ) + 8;

  drawFlow(
    doc,
    [
      { title: 'Ingreso', detail: 'Registrar pago y metodo.' },
      { title: 'Validacion', detail: 'Asociar comprobante y periodo.' },
      { title: 'Distribucion', detail: 'Aplicar a curso o bolsa tutor.' },
      { title: 'Cierre', detail: 'Consolidar reporte mensual.' },
    ],
    page.margin,
    y,
    page.width - page.margin * 2
  );

  y += 102;
  drawPanel(doc, page.margin, y, 250, 250, 'Controles criticos', [
    'Monto y moneda correctos',
    'Tipo de pago coherente',
    'Periodo fiscal definido',
    'Comprobante vinculable',
    'Movimiento de dinero asociado',
    'Impacto en pago tutor revisado',
  ]);

  drawPanel(doc, page.margin + 266, y, 246, 250, 'Alertas comunes', [
    'Pago sin periodo de referencia',
    'Comprobante duplicado o incompleto',
    'Curso con modalidad inconsistente',
    'Pendientes sin conciliacion mensual',
    'Cambio manual sin nota operativa',
    'Desfase entre agenda y tesoreria',
  ]);

  doc.addPage();
  drawTopBand(doc, '5) Operacion segura y soporte', 'Checklist de calidad, auditoria y escalamiento');

  y = 132;
  y = writeHeading(doc, 'Checklist de control semanal', page.margin, y);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: page.margin, right: page.margin },
    head: [['Control', 'Frecuencia', 'Responsable', 'Evidencia esperada']],
    body: [
      ['Sesiones pendientes revisadas', 'Diario', 'Oficina', 'Dashboard sin atrasos antiguos'],
      ['Estados de tutores actualizados', 'Semanal', 'Coordinacion', 'Listado activo/inactivo consistente'],
      ['Pagos y comprobantes conciliados', 'Semanal', 'Contabilidad', 'Movimientos con soporte vinculado'],
      ['Cierres mensuales validados', 'Mensual', 'Admin/Contador', 'Reporte de cierre firmado'],
      ['Actividad relevante auditada', 'Semanal', 'Admin', 'Bitacora sin huecos de trazabilidad'],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: palette.slate700,
      lineColor: palette.slate200,
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [9, 26, 58],
      textColor: palette.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  y = doc.lastAutoTable.finalY + 18;
  y = writeHeading(doc, 'Escalamiento y soporte', page.margin, y);
  y = writeBullets(
    doc,
    [
      'Incidente critico (caida, bloqueo total): llamar de inmediato al soporte.',
      'Error de datos: documentar modulo, usuario y hora del hallazgo.',
      'Duda operativa: revisar primero el manual rapido y luego este manual completo.',
      'Canal de soporte oficial: +506 6126-8302.',
    ],
    page.margin,
    y,
    page.width - page.margin * 2
  );

  drawPanel(doc, page.margin, y + 8, page.width - page.margin * 2, 120, 'Cierre profesional recomendado', [
    'Guardar evidencia de ajustes importantes.',
    'Informar cambios sensibles al equipo administrativo.',
    'Evitar tareas pendientes abiertas para el siguiente turno.',
    'Mantener respaldo de reportes financieros clave.',
  ]);

  applyFooters(doc);
  writePdf(doc, 'Manual_Completo_Linguistika.pdf');
}

function main() {
  ensureOutputDir();
  buildShortManual();
  buildFullManual();
  process.stdout.write('Manuales PDF generados en public/manuales\n');
}

main();
