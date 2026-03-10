---
name: db-schema-guardian
description: "Validates database schema before any DB change. Use when: creating migrations, adding columns, modifying tables, writing repository queries, adding new Supabase .from() calls, or reviewing database-related code. Loads the current schema to prevent referencing non-existent tables/columns and avoid redundancy."
argument-hint: "Describe the DB change you want to make"
---

# Database Schema Guardian

## When to Use

- Before writing or modifying any `*.repository.mjs` file
- Before creating a new SQL migration
- When adding a `.from('table_name')` Supabase call
- When a user reports a 500 error on a database query
- When adding columns to existing tables
- When reviewing if a table/column is still in use

## Procedure

### 1. Load Current Schema

Read the [schema reference](./references/schema.md) to understand all existing tables, columns, types, and relationships.

### 2. Validate the Change

Before making any database-related code change:

1. **Verify table names**: Confirm the table referenced in `.from('...')` exists in the schema. Known alias issues:
   - `tesoreria_cuentas_corrientes` is the real table (NOT `tesoreria_cuentas`)
   - `activity_logs` replaced `logs_auditoria`
   - `tipo_pago` replaced `tipo_cobro` in `cursos`

2. **Verify column names**: Ensure every column in `.select()`, `.insert()`, `.update()`, or `.eq()` exists in that table.

3. **Check for redundancy**: Before adding a new column, check if an equivalent already exists:
   - `cursos` has overlapping schedule fields: `dias`, `turno`, `dias_turno`, `dias_schedule`, `dias_horario`
   - `cursos` has overlapping price fields: `costo_curso` vs `precio_hora`/`precio_mensual`; `pago_tutor` vs `pago_tutor_por_clase`/`pago_tutor_mensual`
   - `estudiantes` has `email_encargado`/`telefono_encargado` (legacy) AND the `encargados` table (new)

4. **Check for boolean→number conversion**: `estado` fields in `cursos`, `tutores`, `estudiantes` are stored as `boolean` in PostgreSQL but the frontend expects `0`/`1`. Any new repository that returns these must include conversion: `estado: row.estado ? 1 : 0`

### 3. If Schema Change Is Needed

1. Create a numbered migration file in `backend/migrations/` following the pattern `NNN_description.sql`
2. Use `IF NOT EXISTS` / `IF EXISTS` for safety
3. Wrap in `BEGIN`/`COMMIT` transaction
4. Update this skill's [schema reference](./references/schema.md) to reflect the new state
5. Update the repo memory at `/memories/repo/db-schema.md`

### 4. Common Patterns

```sql
-- Adding a column
ALTER TABLE public.table_name ADD COLUMN IF NOT EXISTS col_name type;

-- Dropping unused columns (always verify 0 code references first)
ALTER TABLE public.table_name DROP COLUMN IF EXISTS col_name;

-- Adding an index
CREATE INDEX IF NOT EXISTS idx_name ON public.table_name (col_name);
```

## Tables That Are NOT In Use (already removed or pending removal)

- `configuracion` — never implemented
- `logs_auditoria` — replaced by `activity_logs`
- `tesoreria_cierres_mensuales` — 0 code references
- `tesoreria_pagos_tutor_fuentes` — 0 code references

## Views Available

| View | Purpose |
|------|---------|
| `tesoreria_libro_diario_v1` | Joins pagos + cuentas_corrientes |
| `tesoreria_saldos_encargados_v1` | deuda_pendiente, saldo_a_favor per encargado |
| `tesoreria_saldos_tutores_v1` | por_pagar per tutor |
| `tesoreria_bolsa_v1` | debe_real, haber_real, bolsa_real |
| `tesoreria_porcentaje_encargados_v1/v2` | Encargado % of pool |
| `tesoreria_esperado_diario_v1` | Daily expected from obligaciones |

## Key Relationships

```
tutores ←—— cursos.tutor_id
cursos  ←—— matriculas.curso_id
cursos  ←—— matriculas_grupo.curso_id
estudiantes ←—— matriculas.estudiante_id
estudiantes ←—— encargados.id (via estudiantes.encargado_id)
matriculas_grupo ←—— estudiantes_en_grupo.matricula_grupo_id
estudiantes_bulk ←—— estudiantes_en_grupo.estudiante_bulk_id
encargados ←—— tesoreria_cuentas_corrientes.encargado_id
tutores    ←—— tesoreria_cuentas_corrientes.tutor_id
tesoreria_cuentas_corrientes ←—— tesoreria_obligaciones.cuenta_id
tesoreria_cuentas_corrientes ←—— tesoreria_pagos.cuenta_id
tesoreria_pagos ←—— tesoreria_aplicaciones.pago_id
tesoreria_obligaciones ←—— tesoreria_aplicaciones.obligacion_id
```
