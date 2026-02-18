# Release 0.3.0-alpha

Fecha: 2026-02-17

Resumen corto:
- Nueva funcionalidad: `Desglose de clases` integrado en la tarjeta principal de Tesorería y botón colocado junto a `Registrar pago`.
- Datos de obligaciones se cargan automáticamente al seleccionar un encargado (no requiere abrir el modal).
- Historial de clases en la tarjeta principal muestra: profesor/tutor, hora de marcado y empleado que registró la clase.
- Mejoras en la determinación del estado de la obligación (Pagada / Parcial / Pendiente).
- Normalización de la respuesta de la API `/tesoreria/bolsa` para aceptar formatos distintos.
- Correcciones menores: inicialización de `PagoFormState` en formulario grupal y protecciones en `window.open` para URLs nulas.

Archivos principales modificados:
- LInguistika-Studio/views/Tesoreria.tsx

Detalles técnicos:
- Se añadió un `useEffect` para cargar obligaciones cuando cambia `selectedEncargadoId`.
- Se copió/armonizó la UI del modal de desglose para renderizar inline en la tarjeta principal.
- Se agregó `console.debug('TESORERIA: getBolsa response', res)` temporalmente en `loadBolsa()` para depuración.
- Se normaliza `res` de `getBolsa()` tanto si viene en `{ bolsa: { ... } }` como en `{ bolsa_real, debe_real, haber_real }`.
- Se corrigió inicialización de `grupoCobroForm` para cumplir con el tipo `PagoFormState`.
- Se añadieron guardas antes de `window.open(...)` para evitar pasar `null`.

Qué falta / recomendaciones antes de publicar como estable:
- Ejecutar un `npm run build` / `pnpm build` y `tsc` para detectar advertencias o errores transversales.
- Probar la UI en el frontend corriendo el servidor de desarrollo y verificar:
  - que al seleccionar distintos encargados el `Desglose de clases` se actualiza correctamente sin abrir modal;
  - que las etiquetas Pagada/Parcial/Pendiente coinciden con los datos reales del backend (especialmente campos `ya_aplicado`, `restante`, `estado`);
  - que `Dinero actual` (bolsa_real) muestra el mismo valor que el dashboard; si hay discrepancias, revisar la respuesta impresa por el `console.debug`.
- Remover o convertir a logging controlado (`debug`/logger) el `console.debug` cuando se confirme el formato correcto.
- Añadir pruebas unitarias o integración para flujos críticos (registro de pago, aplicaciones, exportes XLSX) si es necesario.

Versionado y pasos de release sugeridos:
1. Taggear el commit con `v0.3.0-alpha` y pushear el tag.
2. Subir release notes a GitHub (usar este archivo como plantilla).

Contacto:
Si quieres, hago el push y creo el tag; indica si debo crear el tag `v0.3.0-alpha` automáticamente.
