# Tesorería v2 (nuevo módulo)

Este proyecto está migrando el módulo de Pagos/Tesorería a un sistema profesional basado en:

- **Cuentas corrientes** por **encargado** y por **tutor**
- **Obligaciones** (lo esperado) separadas de **Pagos** (lo real)
- **Aplicación FIFO**: los pagos de un encargado se aplican automáticamente a las obligaciones más antiguas
- **Evidencia obligatoria** para pagos no en efectivo (número, fecha y archivo)
- **Libro diario** con debe/haber y saldo acumulado

## 1) Migración DB

Ejecutar en Supabase el script:

- backend/migrations/017_tesoreria_v2_cuentas_obligaciones_pagos.sql

Qué crea:

- `encargados` + `estudiantes.encargado_id`
- `tesoreria_cuentas_corrientes`
- `tesoreria_obligaciones` (esperado)
- `tesoreria_pagos` (real)
- `tesoreria_aplicaciones`
- vistas: `tesoreria_libro_diario_v1`, `tesoreria_saldos_encargados_v1`, `tesoreria_saldos_tutores_v1`
- RPC: `tesoreria_registrar_pago_encargado_v1` (pago + FIFO)

## 2) Backend

Rutas nuevas (admin/contador):

- `GET /api/tesoreria/encargados/resumen`
- `GET /api/tesoreria/tutores/resumen`
- `GET /api/tesoreria/diario?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD&incluir_pendientes=0|1`
- `POST /api/tesoreria/encargados/:encargadoId/pagos` (registra pago + aplica FIFO)
- `POST /api/tesoreria/pagos/:pagoId/comprobante` (multipart `file`)
- `PATCH /api/tesoreria/pagos/:pagoId` (completa evidencia/estado)

Además, al completar una sesión (ruta Dashboard), se intenta generar obligaciones v2 de forma **idempotente**.

## 3) Frontend

El path `#/pagos` ahora muestra la vista **Tesorería** (v2), con:

- Resumen por encargado (deuda pendiente + saldo a favor)
- Resumen por tutor (por pagar + pagado)
- Libro diario
- Registro de pagos con evidencia
- Calculadora básica (Debe − Haber)

## 4) Estado actual

- Tesorería v2 convive temporalmente con el sistema anterior (movimientos_dinero).
- Próximas fases: pago a tutores desde v2 (salida FIFO), porcentajes por encargado, y reportes esperados vs reales.
