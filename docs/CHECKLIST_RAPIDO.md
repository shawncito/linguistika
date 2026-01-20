# ✅ CHECKLIST RÁPIDO - QUÉ HACER AHORA

**Creado**: 19 de enero de 2026  
**Estado**: 🟡 Fase 1 - 80% completado

---

## 🚀 PRÓXIMOS 5 PASOS INMEDIATOS

### ✅ PASO 1: Ejecutar Migraciones SQL en Supabase (5 min)

```bash
Archivo: docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql

Acciones:
1. Abre: https://app.supabase.com → Tu Proyecto → SQL Editor
2. Copia TODO el contenido del archivo
3. Pega en el editor SQL
4. Click en "Run" (Ctrl+Enter)
5. Verifica que aparezcan nuevas tablas:
   - sesiones_clases
   - movimientos_dinero
```

**Resultado esperado**: Las tablas aparecen en el menú de Supabase

---

### ⏳ PASO 2: Actualizar Backend Cursos (10 min)

**NOTA**: Ya está parcialmente hecho. Solo verifica:

```bash
Archivo: backend/routes/cursos.js

Verificar que tenga:
- ✅ POST: acepta dias_schedule
- ✅ PUT: acepta dias_schedule  
- ✅ GET: parsea dias_schedule
- ✅ GET/:id: parsea dias_schedule
```

---

### ⏳ PASO 3: Crear Archivo de Sesiones (30 min)

**Crear**: `backend/routes/sesiones.js`

**Copiar código** de `docs/GUIA_IMPLEMENTACION_PAGOS.md` → sección "Crear Endpoint para Generar Sesiones"

**En `backend/server.js` agregar**:
```javascript
import sesionesRouter from './routes/sesiones.js';

app.use('/api/sesiones', requireAuth, sesionesRouter);
```

---

### ⏳ PASO 4: Probar Frontend (15 min)

```bash
# Terminal 1 - Frontend
cd LInguistika-Studio
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

**Pruebas**:
1. Crear curso con horarios (Lunes 14:00-17:00)
2. Ver que dura "3h"
3. Guardar sin errores

---

### ⏳ PASO 5: Actualizar Vista Pagos (30 min)

**Archivo**: `LInguistika-Studio/views/Pagos.tsx`

**Agregar secciones** (copia del documento guía):
1. Listar sesiones_clases
2. Botón "Marcar como Dada"
3. Sección "Entrar Factura"
4. Resumen ingresos/egresos

---

## 🎯 VERIFICACIÓN

Después de cada paso, verifica:

```bash
# 1. ¿Las nuevas tablas aparecen en Supabase?
✓ sesiones_clases visible
✓ movimientos_dinero visible

# 2. ¿El backend acepta dias_schedule?
curl -X POST http://localhost:5000/api/cursos \
  -d '{"nombre":"Test","dias_schedule":{"Lunes":{...}}}'
✓ No error 400

# 3. ¿El frontend muestra inputs de horas?
✓ Al crear curso, ver [14:00] [17:00]
✓ Ver duración calculada "3h"

# 4. ¿El backend crea sesiones?
curl -X POST http://localhost:5000/api/sesiones/generar
✓ Se crean sesiones automáticamente

# 5. ¿Puedo registrar facturas?
curl -X POST http://localhost:5000/api/sesiones/registrar-factura
✓ Se crean movimientos_dinero
```

---

## 📚 DOCUMENTOS DE REFERENCIA

| Documento | Ubicación | Propósito |
|-----------|-----------|-----------|
| Especificación Técnica | `docs/ESPECIFICACION_NUEVA_ESTRUCTURA.md` | Entender el diseño |
| Guía de Implementación | `docs/GUIA_IMPLEMENTACION_PAGOS.md` | Paso a paso con código |
| Resumen de Cambios | `docs/RESUMEN_CAMBIOS_2026-01-19.md` | Qué cambió y por qué |
| SQL Migrations | `docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql` | Crear tablas en DB |

---

## 🐛 ERRORES COMUNES

| Error | Causa | Solución |
|-------|-------|----------|
| `PGRST204: Unknown column` | No ejecutaste migraciones | Ejecuta SQL en Supabase |
| `días_schedule undefined` | Backend antiguo | Actualiza cursos.js |
| `Cannot read property 'duracion_horas'` | dias_schedule vacío | Verifica el formato JSON |
| `Auth token error` | requireAuth en endpoint | Verifica token JWT |

---

## 💾 CAMBIOS COMPLETADOS HASTA AHORA

✅ Frontend:
- Cursos.tsx: inputs de horas por día
- Tutores.tsx: removida tarifa/hora
- types.ts: nuevas interfaces

✅ Backend:
- tutores.js: removida tarifa
- cursos.js: ahora acepta dias_schedule

✅ Documentación:
- ESPECIFICACION_NUEVA_ESTRUCTURA.md
- GUIA_IMPLEMENTACION_PAGOS.md
- RESUMEN_CAMBIOS_2026-01-19.md

✅ Base de Datos:
- Migración SQL lista
- Tablas: sesiones_clases, movimientos_dinero

---

## ⏱️ ESTIMACIÓN DE TIEMPO

- Paso 1 (SQL): 5 minutos ⚡
- Paso 2 (Backend): ✅ YA HECHO
- Paso 3 (Sesiones): 30 minutos
- Paso 4 (Test): 15 minutos
- Paso 5 (Pagos UI): 30 minutos
- **Total**: ~1.5 horas

---

## 🆘 SOPORTE

Si algo no funciona:

1. **Lee el error** en la consola
2. **Busca en** `GUIA_IMPLEMENTACION_PAGOS.md`
3. **Verifica** que ejecutaste el Paso 1 (SQL)
4. **Revisa** que los cambios están en los archivos

---

**Siguiente checkpoint**: Paso 1 (SQL) ✓ Completado = ¡Listo para Paso 2!
