# Roundtrip / Stress Suite (E2E)

Este repo incluye un script de roundtrip que crea datos, simula un mes de operación y valida reglas duras (Tesorería v2), incluyendo: cancelaciones, movimientos de estudiantes en grupos, evidencias obligatorias, pagos exactos/faltantes/sobrantes, pago a tutor con validación de bolsa y cierres mensuales (lock).

## Prerrequisitos

- Backend corriendo (por defecto `http://localhost:5000/api`).
- Usuario **empleado** con rol `admin` o `contador` (Tesorería requiere este rol).
- Migración de cierres aplicada en Supabase: `backend/migrations/019_tesoreria_cierres_mensuales.sql`.
- Tesorería v2 (vistas/RPCs) instalada.

## Ejecutar (Tesorería v2)

Desde la raíz del repo:

```powershell
npm run dev:backend
```

En otra consola:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\roundtrip.ps1 `
  -BaseUrl "http://localhost:5000/api" `
  -Email "TU_EMAIL" `
  -PasswordFile ".\mi-pass.txt" `
  -TesoreriaMode v2 `
  -TipoPago mensual `
  -SimulateMonth `
  -SimDays 30 `
  -StressSuite `
  -CheckPagoPhase
```

Notas:
- Si no usas `-PasswordFile`, el script te pedirá la contraseña.
- Si quieres simular menos días: `-SimDays 14`.

## Qué valida el script

### Operación académica
- Crea tutor + (opcional) tutor2 para pruebas negativas.
- Crea estudiantes, curso, matrículas, grupo y matrícula grupal.
- Simula días: completa sesiones en días hábiles del horario.
- Stress: cancela algunos días y mueve un estudiante fuera/dentro del grupo.
- Stress: intenta crear una clase fuera del horario permitido (debe fallar).

### Tesorería v2 (contabilidad estricta)
- Consulta resumen y bolsa.
- Registra pagos de encargados en 3 variantes:
  - Exacto
  - Faltante
  - Sobrante
- Obliga evidencia para pagos no-efectivo:
  - Intento de completar/verificar sin evidencia => **falla** (HTTP 400)
  - Upload de PDF + datos => **ok**
- Consulta aplicaciones FIFO por pago.
- Paga tutor:
  - Intenta pagar más que `bolsa_real` => **falla** (HTTP 400)
  - Pago válido con evidencia => **ok**
- Exporta XLSX (diario y cuenta tutor si aplica).
- Anti-bypass: valida que mutaciones legacy en `/api/pagos` estén bloqueadas (HTTP 410) cuando el legacy está deshabilitado.

## Limpieza

El script guarda IDs creados en `.roundtrip-state.json`. Para limpiar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "TU_EMAIL" -CleanupOnly
```

Para limpieza por prefijo (más agresiva):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "TU_EMAIL" -CleanupOnly -CleanupByPrefix -CleanupPrefix RT- -CleanupByPrefixApply
```

## Empaquetado Desktop

Para generar instaladores/artefactos:

```powershell
npm run desktop:build
```

Salida esperada en `release/`.
