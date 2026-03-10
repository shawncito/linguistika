# Linguistika — Database Schema Reference

> Last updated: 2025-03-10
> Source: Supabase PostgreSQL

## Core Tables

### tutores
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| nombre | text NOT NULL | |
| email | text UNIQUE | |
| telefono | text | |
| especialidad | text | |
| tarifa_por_hora | numeric(10,2) | |
| estado | boolean DEFAULT true | Backend converts to 0/1 |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| color | text | |
| niveles_apto | jsonb DEFAULT '[]' | |
| es_especializado | boolean DEFAULT false | |
| dias_horarios | jsonb DEFAULT '[]' | Active: structured schedule data |
| dias | text | Legacy: still read by bulk |
| turno | text | Legacy: still read by bulk |
| dias_turno | text | Legacy: still read by bulk |
| ~~horario_tipo~~ | ~~text~~ | **REMOVED** (023 migration) |

### cursos
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| nombre | text NOT NULL | |
| descripcion | text | |
| nivel | text | |
| tipo_clase | text | 'individual'/'grupal' |
| tutor_id | bigint FK→tutores | |
| estado | boolean DEFAULT true | Backend converts to 0/1 |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| dias_horario | text | Active: used in repository payloads |
| hora_inicio | text | |
| hora_fin | text | |
| capacidad_maxima | integer | |
| activo_para_matricula | boolean DEFAULT true | |
| tipo_pago | text | 'sesion' or 'mensual' |
| metodo | text | 'Virtual'/'Presencial'/null |
| precio_hora | numeric(10,2) | |
| precio_mensual | numeric(10,2) | |
| pago_tutor_por_clase | numeric(10,2) | |
| pago_tutor_mensual | numeric(10,2) | |
| dias | text | Legacy: still read by bulk/dashboard |
| turno | text | Legacy: still read by bulk |
| dias_turno | text | Legacy: read by matriculas |
| dias_schedule | jsonb | Legacy: read by dashboard/matriculas |
| costo_curso | numeric(10,2) | Legacy: still read by bulk (curso pricing) |
| pago_tutor | numeric(10,2) | Legacy: still read by bulk (tutor payment) |
| max_estudiantes | integer | Legacy: read by dashboard/matriculas |
| grado_activo | boolean | Legacy: read by dashboard/matriculas |
| grado_nombre | text | Legacy: read by dashboard/matriculas |
| grado_color | text | Legacy: read by dashboard/matriculas |
| requiere_perfil_completo | boolean | Legacy: read by bulk |
| ~~tipo_cobro~~ | ~~text~~ | **REMOVED** (023 migration) |

### estudiantes
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| nombre | text NOT NULL | |
| email | text | |
| telefono | text | |
| estado | boolean DEFAULT true | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| matricula_grupo_id | bigint FK→matriculas_grupo | |
| encargado_id | bigint FK→encargados | Preferred: use this + encargados table |
| nombre_encargado | text | |
| email_encargado | text | Legacy: read by bulk.repository line 490 |
| telefono_encargado | text | Legacy: read by bulk.repository line 490 |
| grado | text | Legacy: read by bulk |
| dias | text | Legacy |
| turno | text | Legacy |
| dias_turno | text | Legacy |

### estudiantes_bulk
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | Pre-enrolled students |
| nombre | text NOT NULL | |
| telefono | text | |
| correo | text | |
| requiere_perfil_completo | boolean DEFAULT false | |
| estado | boolean DEFAULT true | |
| nombre_encargado | text | |
| email_encargado | text | Active: used in CRUD |
| telefono_encargado | text | Active: used in CRUD |
| grado | text | Active: read/written |
| dias | text | Active: read by listing |
| dias_turno | text | Active: read by listing |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| created_by | uuid | |
| updated_by | uuid | |

### encargados
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | Parent/guardian |
| nombre | text NOT NULL | |
| email | text | |
| telefono | text | |
| email_norm | text UNIQUE | Normalized for dedup |
| telefono_norm | text UNIQUE | Normalized for dedup |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### matriculas
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| estudiante_id | bigint FK→estudiantes | |
| curso_id | bigint FK→cursos | |
| tutor_id | bigint FK→tutores | |
| estado | boolean DEFAULT true | |
| es_grupo | boolean DEFAULT false | |
| grupo_id | uuid | |
| grupo_nombre | text | |
| estudiante_ids | jsonb | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### matriculas_grupo
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| curso_id | bigint FK→cursos | |
| tutor_id | bigint FK→tutores | |
| nombre_grupo | text NOT NULL | |
| cantidad_estudiantes_esperados | integer | |
| estado | text DEFAULT 'activa' | |
| fecha_inicio | date | |
| fecha_fin | date | |
| turno | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### estudiantes_en_grupo
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | Junction table |
| matricula_grupo_id | bigint FK→matriculas_grupo | |
| estudiante_bulk_id | bigint FK→estudiantes_bulk | |
| asistencia_mes_actual | jsonb | |
| created_at | timestamptz | |

### clases
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| matricula_id | bigint FK→matriculas | |
| tutor_id | bigint FK→tutores | |
| estudiante_id | bigint FK→estudiantes | |
| curso_id | bigint FK→cursos | |
| fecha | date | |
| hora_inicio | text | |
| hora_fin | text | |
| estado | text DEFAULT 'programada' | |
| avisado | boolean DEFAULT false | |
| confirmado | boolean DEFAULT false | |
| duracion_horas | numeric(5,2) | |
| motivo_cancelacion | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### sesiones_clases
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | Used by dashboard |
| curso_id | bigint FK→cursos | |
| tutor_id | bigint FK→tutores | |
| fecha | date | |
| dia_semana | text | |
| hora_inicio | time | Note: time type, not text |
| hora_fin | time | Note: time type, not text |
| duracion_horas | numeric(5,2) | |
| estado | text | 'dada'/'cancelada' |
| matricula_id | bigint FK→matriculas | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### movimientos_dinero
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | 16+ references in code |
| curso_id | bigint FK→cursos | |
| matricula_id | bigint FK→matriculas | |
| tutor_id | bigint FK→tutores | |
| sesion_id | bigint FK→sesiones_clases | |
| tipo | text | 'ingreso'/'egreso' |
| monto | numeric(10,2) | |
| estado | text | 'pendiente'/'completado' |
| fecha_pago | date | |
| origen | text | 'cobro_grupal'/etc. |
| pago_id | bigint FK→pagos | |
| periodo_inicio | date | |
| periodo_fin | date | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### movimientos_financieros
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | 3 code refs (bulk, finanzas, pagos) |
| tipo | text | |
| monto | numeric(10,2) | |
| estado | text | |
| matricula_grupo_id | bigint FK→matriculas_grupo | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| *Note* | | Potentially redundant with movimientos_dinero |

### pagos
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| tutor_id | bigint FK→tutores | |
| clase_id | bigint FK→clases | |
| cantidad_clases | integer | |
| monto | numeric(10,2) | |
| estado | text | 'pendiente'/'completado' |
| periodo_inicio | date | |
| periodo_fin | date | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### horarios_tutores
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| tutor_id | bigint FK→tutores | |
| dia_semana | text | |
| hora_inicio | time | |
| hora_fin | time | |
| estado | boolean DEFAULT true | |
| created_at | timestamptz | |

### horas_trabajo
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| tutor_id | bigint FK→tutores | |
| clase_id | bigint FK→clases | |
| fecha | date | |
| horas | numeric(5,2) | |
| tarifa_por_hora | numeric(10,2) | |
| monto | numeric(10,2) | |
| estado | text | |
| created_at | timestamptz | |

### comprobantes_ingresos
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| numero_comprobante | text UNIQUE | |
| monto | numeric(10,2) | |
| foto_url | text | |
| pagador_nombre | text | |
| movimiento_dinero_id | bigint FK→movimientos_dinero | |
| movimiento_financiero_id | bigint FK→movimientos_financieros | |
| created_at | timestamptz | |

### activity_logs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| actor_user_id | uuid | |
| actor_email | text | |
| actor_role | text | |
| actor_name | text | |
| action | text | |
| summary | text | |
| entity_type | text | |
| entity_id | text | |
| method | text | HTTP method |
| route | text | |
| status | integer | HTTP status |
| meta | jsonb | |
| created_at | timestamptz | |

### usuarios
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK FK→auth.users | |
| rol | text | |
| estado | boolean DEFAULT true | |
| nombre_completo | text | |
| telefono | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## Tesorería Tables

### tesoreria_cuentas_corrientes
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| tipo | tipo_cuenta_corriente ENUM | 'encargado' or 'tutor' |
| encargado_id | bigint FK→encargados | |
| tutor_id | bigint FK→tutores | |
| created_at | timestamptz | |
| *IMPORTANT* | | Code must use `from('tesoreria_cuentas_corrientes')`, NOT `from('tesoreria_cuentas')` |

### tesoreria_obligaciones
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| tipo | tipo_obligacion ENUM | |
| cuenta_id | bigint FK→tesoreria_cuentas_corrientes | |
| monto | numeric(10,2) | |
| fecha_devengo | date | |
| estado | text | |
| estudiante_id | bigint | |
| tutor_id | bigint | |
| curso_id | bigint | |
| matricula_id | bigint | |
| sesion_id | bigint | |
| created_at | timestamptz | |

### tesoreria_pagos
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| cuenta_id | bigint FK→tesoreria_cuentas_corrientes | |
| direccion | tipo_direccion_pago ENUM | 'entrada' or 'salida' |
| monto | numeric(10,2) | |
| fecha_pago | date | |
| metodo | text | |
| referencia | text | |
| detalle | text | |
| estado | tipo_estado_pago ENUM | 'pendiente'/'completado'/'verificado'/'anulado' |
| numero_comprobante | text | |
| fecha_comprobante | date | |
| comprobante_url | text | |
| created_at | timestamptz | |

### tesoreria_aplicaciones
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | Maps pagos → obligaciones |
| pago_id | bigint FK→tesoreria_pagos | |
| obligacion_id | bigint FK→tesoreria_obligaciones | |
| monto | numeric(10,2) | |
| created_at | timestamptz | |

## Removed Tables (migration 023)

| Table | Reason |
|-------|--------|
| configuracion | Never implemented, 0 code references |
| logs_auditoria | Replaced by activity_logs, 0 code references |
| tesoreria_cierres_mensuales | 0 code references |
| tesoreria_pagos_tutor_fuentes | 0 code references |

## Views

| View | Key Columns | Used By |
|------|-------------|---------|
| tesoreria_libro_diario_v1 | fecha, tipo_movimiento, debe, haber, saldo_resultante | tesoreria.repository (getDiario) |
| tesoreria_saldos_encargados_v1 | encargado_id, cuenta_id, deuda_pendiente, saldo_a_favor | tesoreria.repository (getResumen), pagos.repository |
| tesoreria_saldos_tutores_v1 | tutor_id, cuenta_id, por_pagar | tesoreria.repository (getResumen) |
| tesoreria_bolsa_v1 | debe_real, haber_real, bolsa_real | (view exists but code calculates from tesoreria_pagos directly) |
| tesoreria_porcentaje_encargados_v1 | pct_participacion | tesoreria.repository (getPorcentajeEncargados) |
| tesoreria_porcentaje_encargados_v2 | pct_participacion | tesoreria.repository (getPorcentajeEncargados, preferred) |
| tesoreria_esperado_diario_v1 | date, expected_amount | tesoreria.repository (getEsperadoDiario) |

## Custom ENUM Types

| Type | Values |
|------|--------|
| tipo_cuenta_corriente | 'encargado', 'tutor' |
| tipo_direccion_pago | 'entrada', 'salida' |
| tipo_estado_pago | 'pendiente', 'completado', 'verificado', 'anulado' |
| tipo_obligacion | (various obligation types) |
