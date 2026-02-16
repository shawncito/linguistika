# Guía de Usuario (Completa) — Linguistika

Esta guía explica **cómo usar Linguistika de punta a punta**: operación académica (tutores/horarios/clases), Tesorería v2 (cobros/pagos/evidencias), auditoría, cierres mensuales y exportaciones.

> Alcance: guía para uso diario + puesta en marcha básica. Para detalles técnicos profundos ver el índice de documentación.

---

## 1) Conceptos clave

### Roles
- **admin**: acceso completo.
- **contador**: acceso a Tesorería y reportes contables.

> Nota: el módulo de Tesorería v2 está protegido por rol (admin/contador).

### Entidades principales (académico)
- **Tutor**: persona que imparte tutorías.
- **Curso**: materia/nivel.
- **Estudiante**: persona matriculada.
- **Matrícula**: vínculo estudiante–curso–tutor (y/o grupos, según configuración).
- **Sesión de clase**: ocurrencia concreta de una tutoría en una fecha/hora.

### Entidades principales (Tesorería v2)
- **Encargado**: entidad responsable de pago (contacto/cliente). En BD: `encargados`.
- **Cuenta corriente**: una por encargado y una por tutor. En BD: `tesoreria_cuentas_corrientes`.
- **Obligación (esperado)**: lo que se **debe cobrar** o **se debe pagar** (por sesión, ajustes, etc.). En BD: `tesoreria_obligaciones`.
- **Pago (real)**: movimiento de dinero registrado (entrada o salida). En BD: `tesoreria_pagos`.
- **Aplicación**: cómo un pago se aplica a obligaciones (FIFO o selección). En BD: `tesoreria_aplicaciones`.

---

## 2) Primer arranque (usuario)

### Acceder a la aplicación
- En modo desarrollo, se usa el Desktop (Electron) o el frontend web.
- Inicia sesión con un **usuario empleado** que tenga rol `admin` o `contador` para Tesorería.

### Navegación básica
- **Academia**: tutores, cursos, estudiantes, matrículas y horarios.
- **Dashboard**: sesiones del día y acciones rápidas (marcar sesión como “dada”, etc.).
- **Pagos / Tesorería**: libro diario, resumen por cuentas y registro de pagos con evidencia.

---

## 3) Flujo diario recomendado (operación)

1. **Ver el Dashboard del día**
   - Revisa sesiones programadas.
   - Confirma cambios/cancelaciones.

2. **Marcar sesión como “dada”**
   - Al completar una sesión, el sistema intenta **generar obligaciones** en Tesorería v2 de forma **idempotente**.
   - Importante: para que la sesión aparezca correctamente en Tesorería, el estudiante debe quedar vinculado a un `encargado_id`.

3. **Registrar cobros de encargados (Tesorería)**
   - El pago entra como **entrada** y se aplica **FIFO** a las obligaciones de cobro.

4. **Registrar pagos de tutor (Tesorería)**
   - El pago sale como **salida** y se aplica a obligaciones de pago de tutor.
   - Puede requerir seleccionar sesiones/obligaciones específicas dependiendo del modo.

5. **Adjuntar evidencia (si no es efectivo)**
   - Si el método no es efectivo, al pasar el estado a completado/verificado se requiere evidencia (número, fecha y archivo).

---

## 4) Operación académica (paso a paso)

### A) Crear tutor
- Registra nombre, contacto y tarifa (según UI).
- Define disponibilidad/horarios si el sistema lo requiere.

### B) Crear curso
- Define idioma/nivel y propiedades necesarias.

### C) Registrar estudiante
- Completa datos del estudiante.
- Completa datos del encargado (nombre/email/teléfono) si el formulario lo incluye.

### D) Matricular
- Vincula estudiante con curso y tutor.
- Verifica que aparezca en el Dashboard según horario.

### E) Sesiones
- En el Dashboard:
  - Marca la sesión como **dada** cuando se imparta.
  - Si una sesión ya estaba “dada” y se reintenta, el sistema debe mantener idempotencia (no duplicar cobros/pagos).

---

## 5) Tesorería v2 (uso completo)

### 5.1 Resumen por encargados
Ruta backend: `GET /api/tesoreria/encargados/resumen`
- **deuda_pendiente**: obligaciones de cobro que aún no se cubren.
- **saldo_a_favor**: pagos realizados que exceden lo aplicado a obligaciones.

Acciones típicas:
- Revisar quién debe y cuánto.
- Identificar encargados con saldo a favor.

### 5.2 Resumen por tutores
Ruta backend: `GET /api/tesoreria/tutores/resumen`
- **por_pagar**: obligaciones pendientes al tutor.
- **pagado**: acumulado pagado (salidas completado/verificado).

### 5.3 Desglose de obligaciones (por cuenta)
- Para encargados: obligaciones tipo `cobro_sesion` (y opcionalmente `ajuste`).
- Para tutores: obligaciones tipo `pago_tutor_sesion`.

Regla importante:
- En modo “pendiente”, el backend filtra obligaciones cuya **restante = 0** para no seguir mostrándolas como pendientes.

### 5.4 Registrar pago de encargado
Ruta backend: `POST /api/tesoreria/encargados/:encargadoId/pagos`

Campos típicos:
- `monto`, `fecha_pago`, `metodo` (opcional), `referencia` (opcional), `detalle` (opcional)
- Para no-efectivo (si se completa/verifica): `numero_comprobante`, `fecha_comprobante`, `comprobante_url`

Comportamiento:
- Crea un pago de tipo **entrada**.
- Aplica automáticamente FIFO a obligaciones de cobro.
- Si hay excedente, queda como saldo a favor.

### 5.5 Registrar pago a tutor
Ruta backend: `POST /api/tesoreria/tutores/:tutorId/pagos`

Reglas fuertes:
- No permite pagar más que `bolsa_real` (calculada desde el libro diario).
- Maneja modos de “fuente” para auditabilidad (según migraciones instaladas).

Campos típicos:
- `monto`, `fecha_pago`, `metodo`...
- Opcional: `funding_mode`, `source_encargado_id`, `obligacion_ids`

### 5.6 Evidencias (no-efectivo)
- Subida de archivo:
  - `POST /api/tesoreria/pagos/:pagoId/comprobante` (multipart `file`)
- Actualización de datos/estado:
  - `PATCH /api/tesoreria/pagos/:pagoId`

Regla:
- Si `metodo != efectivo` y `estado` es `completado/verificado`, se exige:
  - `numero_comprobante`, `fecha_comprobante`, `comprobante_url`

### 5.7 Libro diario y exportaciones
- Libro diario:
  - `GET /api/tesoreria/diario?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD`
- Export XLSX:
  - `GET /api/tesoreria/export/diario`
  - `GET /api/tesoreria/export/cuenta/:cuentaId`

### 5.8 Cierres mensuales
- Ver cierres:
  - `GET /api/tesoreria/cierres`
- Crear cierre:
  - `POST /api/tesoreria/cierres` con `{ mes: "YYYY-MM", cerrado_hasta: "YYYY-MM-DD" }`

Efecto:
- Bloquea modificaciones a movimientos con fecha `<= cerrado_hasta` (responde 409).

---

## 6) Auditoría / Actividad

Si está habilitado el log de actividad, se puede consultar:
- `GET /api/activity?limit=200&offset=0&q=texto`

Uso:
- Buscar acciones por usuario, ruta, entidad, etc.

---

## 7) Mantenimiento (roundtrip y limpieza)

### Roundtrip / Stress Suite
Sirve para:
- Crear datos de prueba
- Simular operación (p.ej. 30 días)
- Validar reglas duras de Tesorería v2

Ver: `docs/ROUNDTRIP_STRESS_SUITE.md`

### Limpieza de datos de prueba
- Limpieza por prefijo RT-* (roundtrips)
- Limpieza de datos legacy (correos fijos de prueba)

Esto se realiza con los scripts de limpieza documentados en el repo.

---

## 8) Solución de problemas (FAQ)

### “No aparecen sesiones en Pagos/Tesorería”
Causas comunes:
- El estudiante no tiene `encargado_id` vinculado.
- No se generaron obligaciones al marcar sesión como “dada”.

Acciones:
- Revisar datos del encargado (email/teléfono) del estudiante.
- Reintentar marcar sesión como dada (idempotente).

### “No me deja editar un pago: Periodo cerrado (409)”
- Existe un cierre con `cerrado_hasta` que cubre esa fecha.
- Solución: registrar correcciones en el periodo abierto (o ajustar política de cierres, si procede).

### “Pago no-efectivo no se puede completar/verificar”
- Falta evidencia: número/fecha/archivo.
- Solución: subir comprobante y completar datos.

---

## 9) Referencias rápidas

- Índice de documentación: `docs/INDICE_DOCUMENTACION.md`
- Tesorería v2 (visión): `docs/TESORERIA_V2.md`
- Tesorería v2 (contabilidad estricta): `docs/TESORERIA_V2_CONTABILIDAD_ESTRICTA.md`
- Roundtrip/Stress Suite: `docs/ROUNDTRIP_STRESS_SUITE.md`
