-- Cierres mensuales de tesorería (bloqueo de edición histórica)
-- Regla: si un movimiento (tesoreria_pagos.fecha_pago) es <= cerrado_hasta, no debe modificarse.

create table if not exists public.tesoreria_cierres_mensuales (
  id bigserial primary key,
  mes date not null unique, -- normalmente el 1er día del mes
  cerrado_hasta date not null, -- última fecha incluida en el cierre
  nota text null,
  created_at timestamptz not null default now()
);

create index if not exists tesoreria_cierres_mensuales_cerrado_hasta_idx
  on public.tesoreria_cierres_mensuales (cerrado_hasta desc);
