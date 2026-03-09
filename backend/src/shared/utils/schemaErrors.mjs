export function schemaErrorPayload(error) {
  const msg = String(error?.message || '');
  const schemaCacheMatch = msg.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  const columnOnlyMatch = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);

  const column = schemaCacheMatch?.[1] || columnOnlyMatch?.[1] || null;
  const table = schemaCacheMatch?.[2] || null;

  if (!column) return null;

  const tableLabel = table ? ` en ${table}` : '';
  return {
    error: `Tu base de datos no tiene la columna ${column}${tableLabel}. Aplica las migraciones pendientes y vuelve a intentar.`,
    details: msg,
    code: 'SCHEMA_MISSING_COLUMN',
  };
}
