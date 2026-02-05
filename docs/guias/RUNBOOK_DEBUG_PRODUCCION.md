# Runbook: Debug y Preparación para Producción

Este documento es la guía práctica para **levantar**, **verificar**, **debuggear** y **dejar listo para producción** el proyecto Linguistika.

## 1) Prerrequisitos

- Node.js LTS instalado
- Acceso a un proyecto Supabase (URL + keys)
- En Windows: PowerShell

## 2) Variables de entorno

### Backend

- Archivo: `backend/.env`
- Plantilla: `backend/.env.example`

Variables mínimas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (requerida para scripts/admin)

### Frontend

- Archivo: `LInguistika-Studio/.env`
- Plantilla: `LInguistika-Studio/.env.example`

Variable mínima recomendada:
- `VITE_API_URL` (ej: `http://127.0.0.1:5000/api`)

## 3) Levantar el proyecto en local

### Backend

```bash
cd backend
npm install
npm run dev
```

Verificaciones rápidas:
- Salud: `GET http://127.0.0.1:5000/api/health`
- Fecha CR (para evitar problemas de zona horaria): `GET http://127.0.0.1:5000/api/server-date`

### Frontend

```bash
cd LInguistika-Studio
npm install
npm run dev
```

## 4) Checklist de “listo para producción” (mínimo)

- Frontend compila:
  - `cd LInguistika-Studio && npm run typecheck`
  - `cd LInguistika-Studio && npm run build`
- Backend arranca sin errores y conecta a Supabase
- `.env` nunca se sube al repo (solo `.env.example`)
- Rutas protegidas requieren token (validar login)
- RLS/policies revisadas en Supabase (si aplica)

## 5) Debug de problemas comunes

### A) El backend no levanta (puerto 5000 en uso)

Síntoma: `EADDRINUSE 127.0.0.1:5000`

Solución en PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

### B) “Marcar como dada” muestra éxito pero sigue apareciendo en “Sesiones de Hoy”

Causas típicas:
1) Estás pegándole a un backend viejo (no reiniciado).
2) Mismatch de fecha por zona horaria (UTC vs Costa Rica).

Qué validar:
- El frontend usa fecha en CR para completar (no UTC).
- El backend filtra sesiones ya `dada/cancelada` al construir la agenda.
- Reiniciar backend y refrescar el dashboard.

### C) Duplicación de cobros al marcar varias veces

Mitigación:
- El endpoint de completar debe ser **idempotente**: si ya existe sesión `dada`, no inserta otra ni duplica movimientos.

## 6) Señales útiles para soporte

- Logs del backend (terminal donde corre `npm run dev`)
- Request/response de la llamada `POST /api/dashboard/sesion/:matriculaId/:fecha/completar`
- Fecha usada por el frontend (la que manda en el request)

---

Última actualización: 2026-02-05
