## SCHEMA LINGUISTIKA v3.0 - Documentación

### 📋 Resumen de Cambios

La reestructuración permite **dos tipos de cobro independientes**:
1. **Cursos por Clase/Hora**: Cobro por sesión marcada como "dada"
2. **Cursos Mensuales**: Cobro fijo que no depende de asistencia

Y **tres roles de usuario** con permisos diferenciados:
- **admin**: Acceso total a todo
- **contador**: Acceso a finanzas, pagos, pero NO crear estudiantes/tutores
- **tutor_view_only**: Solo lectura, sin acceso a pagos

---

### 🗂️ Tablas Nueva/Modificadas

#### **Tabla: cursos** (MODIFICADA)

**Campos agregados:**
```sql
tipo_cobro tipo_cobro_enum DEFAULT 'por_clase'  -- 'por_clase' o 'mensual'
precio_hora numeric                               -- Costo por hora (cursos por_clase)
precio_mensual numeric                            -- Costo mensual (cursos mensual)
pago_tutor_por_clase numeric                      -- Qué recibe el tutor por clase
pago_tutor_mensual numeric                        -- Qué recibe el tutor mensualmente
requiere_perfil_completo boolean DEFAULT true     -- Si estudiantes necesitan perfil completo
activo_para_matricula boolean DEFAULT true        -- Si puede aceptar nuevas matrículas
```

**Ejemplo:**
```sql
INSERT INTO cursos (
  nombre, tipo_cobro, precio_hora, pago_tutor_por_clase, requiere_perfil_completo
) VALUES (
  'Tutoría Matemáticas ATM',
  'por_clase',
  10000,  -- $10,000 por clase
  5000,   -- Tutor recibe $5,000
  true    -- Requiere perfil completo del estudiante
);

INSERT INTO cursos (
  nombre, tipo_cobro, precio_mensual, pago_tutor_mensual, requiere_perfil_completo
) VALUES (
  'Curso English Adults',
  'mensual',
  40000,  -- $40,000 mensuales
  200000, -- Tutor recibe $200,000 mensuales
  false   -- Solo necesita nombre + teléfono
);
```

---

#### **Tabla: usuarios** (MODIFICADA)

**Campos modificados:**
```sql
id uuid PRIMARY KEY (referencia a auth.users)
rol rol_usuario_enum DEFAULT 'admin'              -- 'admin', 'contador', 'tutor_view_only'
nombre_completo text
telefono text
estado boolean DEFAULT true
created_at, updated_at
```

**Roles y Permisos:**

| Acción | Admin | Contador | Tutor View |
|--------|-------|----------|-----------|
| Ver estudiantes | ✅ | ✅ | ✅ |
| Crear estudiantes | ✅ | ❌ | ❌ |
| Ver tutores | ✅ | ✅ | ✅ |
| Crear tutores | ✅ | ❌ | ❌ |
| Ver cursos | ✅ | ✅ | ✅ |
| Crear cursos | ✅ | ❌ | ❌ |
| Ver matrículas | ✅ | ✅ | ✅ |
| Crear matrículas | ✅ | ✅ | ❌ |
| Ver finanzas | ✅ | ✅ | ❌ |
| Crear/editar pagos | ✅ | ✅ | ❌ |
| Ver logs auditoría | ✅ | ✅ | ❌ |
| Crear empleados | ✅ | ❌ | ❌ |

---

#### **Tabla NUEVA: estudiantes_bulk**

Para estudiantes de **cursos regulares/mensuales** sin perfil completo.

```sql
id bigint PRIMARY KEY
nombre text NOT NULL
telefono text                          -- Mínimo requerido
correo text                            -- Opcional
requiere_perfil_completo boolean       -- Si luego necesita completar datos
estado boolean
created_by uuid, updated_by uuid
created_at, updated_at
```

**Uso:**
```sql
-- Crear estudiante mínimo para curso mensual
INSERT INTO estudiantes_bulk (nombre, telefono, requiere_perfil_completo)
VALUES ('Juan Pérez', '+506 8765 4321', false);
```

---

#### **Tabla NUEVA: matriculas_grupo**

Reemplaza matrículas individuales. Agrupa N estudiantes en 1 matrícula para un curso.

```sql
id bigint PRIMARY KEY
curso_id bigint NOT NULL (fk → cursos)
tutor_id bigint NOT NULL (fk → tutores)
nombre_grupo text                      -- "Grupo A Curso English", etc.
cantidad_estudiantes_esperados int
estado text                            -- 'activa', 'completada', 'cancelada'
fecha_inicio date
fecha_fin date
notas text
created_by uuid, updated_by uuid
created_at, updated_at
```

**Uso:**
```sql
-- Crear grupo para curso mensual
INSERT INTO matriculas_grupo (curso_id, tutor_id, nombre_grupo, cantidad_estudiantes_esperados, estado)
VALUES (5, 3, 'Grupo English Adults - Enero', 10, 'activa');
```

---

#### **Tabla NUEVA: estudiantes_en_grupo**

Relación many-to-many entre estudiantes_bulk y matriculas_grupo.

```sql
id bigint PRIMARY KEY
matricula_grupo_id bigint NOT NULL (fk → matriculas_grupo)
estudiante_bulk_id bigint NOT NULL (fk → estudiantes_bulk)
asistencia_mes_actual int DEFAULT 0
created_at
```

**Uso:**
```sql
-- Agregar 3 estudiantes al grupo
INSERT INTO estudiantes_en_grupo (matricula_grupo_id, estudiante_bulk_id)
VALUES 
  (1, 1),  -- Juan Pérez
  (1, 2),  -- María González
  (1, 3);  -- Carlos López
```

---

#### **Tabla NUEVA: movimientos_financieros**

Reemplaza/complementa `movimientos_dinero`. Maneja deuda (cliente) y haber (tutor).

```sql
id bigint PRIMARY KEY
tipo tipo_movimiento_enum              -- 'debe' (cliente paga) o 'haber' (tutor recibe)
referencia_tabla text                  -- 'estudiantes_bulk' o 'tutores'
referencia_id bigint                   -- ID del estudiante o tutor
monto numeric(12,2)
concepto text                          -- "Clase Tutoría - 2026-01-27", etc.
curso_id bigint (fk → cursos)
matricula_grupo_id bigint (fk → matriculas_grupo)
clase_id bigint (fk → clases)
estado estado_movimiento_enum          -- 'pendiente', 'pagado', 'cancelado'
fecha_movimiento timestamp
fecha_pago timestamp                   -- Cuando se pagó
created_by uuid, created_at
```

**Ejemplos:**

**Curso por clase:**
```sql
-- Al marcar clase como "dada", insertar automáticamente:

-- DEBE: Estudiante paga
INSERT INTO movimientos_financieros (tipo, referencia_tabla, referencia_id, monto, concepto, clase_id, estado)
VALUES ('debe', 'estudiantes', 42, 10000, 'Tutoría Matemáticas - 2026-01-27', 789, 'pendiente');

-- HABER: Tutor recibe
INSERT INTO movimientos_financieros (tipo, referencia_tabla, referencia_id, monto, concepto, clase_id, estado)
VALUES ('haber', 'tutores', 5, 5000, 'Pago Tutoría Matemáticas - 2026-01-27', 789, 'pendiente');
```

**Curso mensual (fin de mes):**
```sql
-- Al finalizar el mes, para cada estudiante en grupo:

-- DEBE: Cada estudiante paga cuota mensual
INSERT INTO movimientos_financieros (tipo, referencia_tabla, referencia_id, monto, concepto, matricula_grupo_id, estado)
VALUES ('debe', 'estudiantes_bulk', 1, 40000, 'Cuota English Course - Enero 2026', 5, 'pendiente');

-- HABER: Tutor recibe pago mensual (solo UNA vez por grupo)
INSERT INTO movimientos_financieros (tipo, referencia_tabla, referencia_id, monto, concepto, matricula_grupo_id, estado)
VALUES ('haber', 'tutores', 3, 200000, 'Pago English Course - Enero 2026', 5, 'pendiente');
```

---

#### **Tabla NUEVA: comprobantes_ingresos**

Registro de dinero que entra con evidencia visual.

```sql
id bigint PRIMARY KEY
numero_comprobante text UNIQUE         -- "SINPE-20260127-001", "CHQ-501", etc.
monto numeric(12,2)
foto_url text                          -- URL en Supabase Storage
pagador_nombre text                    -- "Gerencia Centro de Idiomas"
pagador_contacto text                  -- Teléfono/email de quien pagó
detalle text                           -- Descripción/concepto
movimiento_financiero_id bigint (fk)   -- Vincula a qué deuda corresponde
estado estado_comprobante_enum         -- 'pendiente_verificacion', 'verificado', 'rechazado'
fecha_comprobante date
created_by uuid, created_at, updated_at
```

**Uso:**
```sql
-- Admin ingresa comprobante de SINPE
INSERT INTO comprobantes_ingresos (
  numero_comprobante, monto, pagador_nombre, detalle, fecha_comprobante, estado
) VALUES (
  'SINPE-20260127-001',
  100000,
  'Jefe Administrativo',
  'Pago cuota estudiante Juan Pérez',
  '2026-01-27',
  'pendiente_verificacion'
);
```

---

#### **Tabla NUEVA: logs_auditoria**

Historial completo de operaciones financieras.

```sql
id bigint PRIMARY KEY
usuario_id uuid (fk → auth.users)      -- Quién hizo la acción
accion text                            -- 'crear_comprobante', 'marcar_dada', 'generar_pago_mensual'
tabla_afectada text                    -- 'movimientos_financieros', 'comprobantes_ingresos'
registro_id bigint                     -- ID del registro que cambió
cambios jsonb                          -- {antes: {...}, despues: {...}}
ip_address inet                        -- IP de donde se hizo (opcional)
created_at timestamp
```

**Ejemplo:**
```sql
SELECT * FROM logs_auditoria 
WHERE accion = 'crear_comprobante' 
AND created_at >= '2026-01-01'
ORDER BY created_at DESC;
```

---

### 🔐 RLS (Row Level Security) - Políticas

Todas las tablas de finanzas (`movimientos_financieros`, `comprobantes_ingresos`, `logs_auditoria`, `matriculas_grupo`) tienen RLS habilitado.

**Reglas:**
- `admin`: Ve y edita todo
- `contador`: Ve y edita finanzas, pero NO puede crear estudiantes/tutores/cursos
- `tutor_view_only`: Solo lectura, NO acceso a finanzas ni pagos

---

### 📊 Flujo de Datos

#### **Curso por Clase/Hora**

```
1. Admin crea curso con tipo_cobro='por_clase', precio_hora=10000, pago_tutor_por_clase=5000
2. Admin crea matricula_grupo y agrega estudiantes_bulk
3. Sistema calcula clases automáticamente desde curso.dias_schedule
4. Tutor/Admin marca clase como "dada" (POST /api/dashboard/sesion/{id}/completar)
5. Sistema INSERT automático en movimientos_financieros:
   - DEBE: estudiante debe 10,000
   - HABER: tutor recibe 5,000
6. Admin verifica comprobantes de pago de estudiantes
7. Admin marca movimiento como "pagado"
8. Admin genera pago al tutor (consolidado por mes)
```

#### **Curso Mensual**

```
1. Admin crea curso con tipo_cobro='mensual', precio_mensual=40000, pago_tutor_mensual=200000
2. Admin crea matricula_grupo y agrega 10 estudiantes_bulk
3. Cada mes (28-31), admin presiona botón "Generar Cargos Mensuales"
4. Sistema INSERT automático en movimientos_financieros:
   - DEBE: 10 × 40,000 = 400,000 (deuda total de estudiantes)
   - HABER: 200,000 (pago al tutor - UNA vez)
5. Admin verifica comprobantes de pago de estudiantes
6. Admin marca movimientos como "pagado"
7. Admin genera pago consolidado al tutor (ya calculado en paso 4)
```

---

### 🎯 Endpoints Requeridos (Fase 2)

```
POST   /api/estudiantes/bulk              # Crear estudiantes en lote
POST   /api/matriculas-grupo              # Crear grupo
DELETE /api/matriculas-grupo/:id          # Cancelar grupo
POST   /api/matriculas-grupo/:id/estudiantes  # Agregar estudiantes
DELETE /api/matriculas-grupo/:id/estudiantes/:estId  # Remover estudiante

POST   /api/dashboard/sesion/{id}/completar    # Marcar clase como dada + generar deuda/haber
POST   /api/finanzas/generar-deuda-mensual     # Job: Fin de mes
GET    /api/finanzas/movimientos               # Dashboard deuda/haber
POST   /api/finanzas/marcar-pagado             # Cambiar estado a pagado
POST   /api/finanzas/generar-pago-tutor        # Consolidar pago tutor

POST   /api/comprobantes                       # Crear comprobante con foto
GET    /api/comprobantes                       # Listar comprobantes
PATCH  /api/comprobantes/:id                   # Cambiar estado (verificar/rechazar)

GET    /api/logs-auditoria                     # Ver historial de operaciones

POST   /api/admin/crear-empleado               # Crear usuario (admin solo)
```

---

### ✅ Verificación Post-Migración

Ejecuta estos queries después de aplicar migraciones:

```sql
-- 1. Verificar tablas nuevas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2. Verificar ENUMs
SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Verificar RLS en tablas
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- 4. Verificar índices
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;

-- 5. Verificar estructura cursos
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cursos' ORDER BY ordinal_position;

-- 6. Verificar estructura usuarios
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuarios' ORDER BY ordinal_position;
```

---

### 📝 Notas Importantes

1. **Secuencias**: Todas las tablas nuevas usan `nextval()`. Las secuencias se crean automáticamente.
2. **Índices**: Se crearon índices para campos frecuentemente consultados (tipo, estado, fecha, referencia).
3. **Integridad**: Foreign keys con `ON DELETE RESTRICT` o `CASCADE` según corresponda.
4. **RLS**: Habilitado en tablas sensibles. Otros usuarios pueden leer datos públicos.
5. **Auditoría**: TODOS los cambios en finanzas deben loguear automáticamente via triggers (implementar en Fase 2).
