# Guia de Testing: Roundtrip (API end-to-end)

Esta guia valida un flujo realista de punta a punta usando el script `roundtrip.ps1`:
- Auth (login)
- Creacion de tutor/estudiantes/curso
- Matriculas
- Grupo (matriculas_grupo) + asignacion de estudiantes manuales
- Completar sesion (genera `sesiones_clases` y `movimientos_dinero`)
- (Opcional) Borrado cascade del curso
- Preparacion para fase de pagos (endpoints /pagos y /finanzas)

## Prerrequisitos

- Backend corriendo en `http://localhost:5000`
- Usuario con rol `admin` o `contador` creado en `public.usuarios`
  - Sugerido: `cd backend` y correr:
    - `npm run bootstrap-admin -- --email "<email>" --password "<password>" --nombre "Admin" --telefono "+506 8888-8888"`

## Ejecutar roundtrip

Desde `backend\`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CheckPagoPhase
```

### Que hace

- Genera un `RunTag` y prefija datos creados con `RT-<RunTag>`.
- Deja los datos creados por defecto (para que puedas probar UI y pagos).
- Guarda state en `.roundtrip-state.json` (no debe subirse a Git).

## Limpieza (CleanupOnly)

Cuando termines de probar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CleanupOnly
```

Orden de limpieza:
1) Grupo
2) Curso con `?cascade=1`
3) Estudiantes
4) Tutor

### Limpieza de datos legacy (opcional)

Si tenias datos de pruebas viejos con emails fijos (maria@example.com, juan@example.com, ana@example.com):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -CleanupOnly -CleanupLegacyTestData
```

## Borrado cascade (opcional)

Si queres probar el flujo de borrado dentro del script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl "http://localhost:5000/api" -Email "<email>" -Password "<password>" -TestCascadeDelete
```

## Siguiente fase: Pagos

- El modulo `pagos` y `finanzas` esta protegido por roles `admin/contador`.
- `GET /api/pagos` debe responder.
- `GET /api/finanzas/movimientos` puede requerir `SUPABASE_SERVICE_KEY` configurado en el backend.

Sugerencia de validacion rapida:
- Entrar a la vista de Pagos en el frontend y confirmar que carga sin 403/401.
- Verificar que existen movimientos para el curso/tutor del run.
