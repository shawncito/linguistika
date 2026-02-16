# Tesorería v2 — Contabilidad estricta (Feb 2026)

## Objetivo
Evitar ajustes manuales de saldos y asegurar auditabilidad:
- El saldo/bolsa se calcula desde el libro diario (no se edita).
- Pagos no-efectivo requieren evidencia.
- Libro auxiliar por cuenta + exportación XLSX.
- Cierres mensuales bloquean cambios históricos.

## UI (LInguistika-Studio)
- Vista Tesorería: [LInguistika-Studio/views/Tesoreria.tsx](../LInguistika-Studio/views/Tesoreria.tsx)
  - Removido el botón de “Actualizar dinero” (no existe saldo manual).
  - “Totales rápidos” vienen del backend (`/api/tesoreria/resumen`).
  - “Ver historial” por Encargado/Tutor abre libro auxiliar.
  - Exportar XLSX en Diario y en Libro auxiliar.
  - Sección “Cierres mensuales” para registrar y listar cierres.

## Backend (Express + Supabase)
- Rutas Tesorería v2: [backend/routes/tesoreria.js](../backend/routes/tesoreria.js)
  - Resumen: `GET /api/tesoreria/resumen`
  - Libro auxiliar:
    - `GET /api/tesoreria/cuentas/encargado/:encargadoId/movimientos`
    - `GET /api/tesoreria/cuentas/tutor/:tutorId/movimientos`
  - Export XLSX:
    - `GET /api/tesoreria/export/diario`
    - `GET /api/tesoreria/export/cuenta/:cuentaId`
  - Cierres mensuales:
    - `GET /api/tesoreria/cierres`
    - `POST /api/tesoreria/cierres` (requiere `{ mes: "YYYY-MM", cerrado_hasta: "YYYY-MM-DD" }`)

- Servicio central (reglas duras): [backend/utils/tesoreria/registrarMovimiento.js](../backend/utils/tesoreria/registrarMovimiento.js)
  - Bloquea mutaciones con fecha `<= cerrado_hasta`.
  - Bloquea pago a tutor si `monto > bolsa_real`.
  - Evidencia obligatoria para pagos no-efectivo al completar/verificar.

## Migración requerida
- Crear tabla de cierres:
  - [backend/migrations/019_tesoreria_cierres_mensuales.sql](../backend/migrations/019_tesoreria_cierres_mensuales.sql)

## Legacy /api/pagos
Para evitar bypass del sistema nuevo, las mutaciones del router legacy se deshabilitan por defecto.
- Archivo: [backend/routes/pagos.js](../backend/routes/pagos.js)
- Para reactivar temporalmente (no recomendado):
  - `ALLOW_LEGACY_PAGOS=1`
