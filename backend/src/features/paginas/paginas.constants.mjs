export const DEFAULT_PAGINAS = Object.freeze([
  { slug: 'dashboard', nombre: 'Dashboard' },
  { slug: 'tutores', nombre: 'Tutores' },
  { slug: 'cursos', nombre: 'Cursos' },
  { slug: 'estudiantes', nombre: 'Estudiantes' },
  { slug: 'matriculas', nombre: 'Matrículas' },
  { slug: 'pagos', nombre: 'Tesorería' },
  { slug: 'empleados', nombre: 'Empleados' },
]);

const DEFAULT_BY_SLUG = new Map(DEFAULT_PAGINAS.map((page) => [page.slug, page]));

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPaginasTableMissingError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01'
    || (message.includes('relation') && message.includes('paginas_mantenimiento') && message.includes('does not exist'))
    || (message.includes('could not find') && message.includes('paginas_mantenimiento'))
  );
}

export function resolvePageName(slug) {
  const normalized = normalizeSlug(slug);
  return DEFAULT_BY_SLUG.get(normalized)?.nombre ?? normalized;
}

export function buildPublicPaginas(rows = []) {
  const dbBySlug = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => ({ ...row, slug: normalizeSlug(row?.slug) }))
      .filter((row) => row.slug)
      .map((row) => [row.slug, row])
  );

  return DEFAULT_PAGINAS.map((page) => {
    const row = dbBySlug.get(page.slug);
    return {
      slug: page.slug,
      nombre: row?.nombre || page.nombre,
      activa: row?.activa !== false,
      mensaje: row?.mensaje ?? null,
    };
  });
}

export function buildAdminPaginas(rows = []) {
  const dbBySlug = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => ({ ...row, slug: normalizeSlug(row?.slug) }))
      .filter((row) => row.slug)
      .map((row) => [row.slug, row])
  );

  return DEFAULT_PAGINAS.map((page) => {
    const row = dbBySlug.get(page.slug);
    return {
      slug: page.slug,
      nombre: row?.nombre || page.nombre,
      activa: row?.activa !== false,
      desactivada_por: row?.desactivada_por ?? null,
      desactivada_por_nombre: row?.desactivada_por_nombre ?? null,
      mensaje: row?.mensaje ?? null,
      updated_at: row?.updated_at ?? null,
    };
  });
}
