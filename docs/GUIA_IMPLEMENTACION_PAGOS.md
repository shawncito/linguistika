# 🚀 Guía de Implementación - Fases Completadas y Pendientes

## 🧾 Actualización (rama `pago`): Liquidación desde `movimientos_dinero`

En la versión actual, el flujo primordial de pagos se apoya en lo que ya genera el sistema al completar sesiones:
- `movimientos_dinero.tipo = 'pago_tutor_pendiente'` (queda en `estado = 'pendiente'`)
- La “liquidación” consiste en agrupar esos pendientes por tutor y rango de fechas, crear un registro en `pagos` y marcar los movimientos como `completado`.

### Migraciones nuevas (recomendadas)

1) Vincular movimientos con el pago (evita doble-liquidación):
- `backend/migrations/004_add_pago_id_to_movimientos_dinero.sql`

2) Guardar el periodo en `pagos` (auditoría por rango):
- `backend/migrations/004_add_periodo_to_pagos.sql`

Nota: el backend tiene fallback si aún no ejecutas estas migraciones (funciona, pero sin `pago_id`/periodo no hay idempotencia perfecta).

### Endpoints agregados

- `GET /api/pagos/pendientes/resumen?tutor_id=...&fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD`
  - Devuelve cantidad y total de `pago_tutor_pendiente` en `estado=pendiente`.
- `POST /api/pagos/liquidar`
  - Crea un registro en `pagos` y actualiza los movimientos pendientes a `completado`.

## ✅ COMPLETADO

### Fase 1A: Remover Tarifa por Hora de Tutores
- ✅ Eliminado campo `tarifa_por_hora` de Tutores.tsx (UI)
- ✅ Eliminado campo `tarifa_por_hora` de backend tutores.js
- ✅ Actualizado interface Tutor en types.ts
- ✅ Las tarjetas de tutores ya NO muestran tarifa/hora

**Cambios visibles**:
- Formulario de Tutores: Ya no pide "Tarifa por Hora"
- Tarjetas de Tutores: Ya no muestra ₡/hora
- Backend: Ignora si intentas enviar tarifa_por_hora

---

### Fase 1B: Agregar Rango de Horas en Cursos
- ✅ Actualizado interface Curso en types.ts (agregado `dias_schedule`)
- ✅ Actualizado Cursos.tsx para mostrar inputs de horas
- ✅ Agregada función `calcularDuracionHoras()` automáticamente
- ✅ Diseño de UI: Cada día muestra turno + hora inicio + hora fin
- ✅ Cálculo automático de duración en horas

**Cambios visibles**:
```
Lunes [Tarde] [14:00] a [17:00] → 3h mostrado
Martes [Noche] [19:00] a [21:00] → 2h mostrado
```

### Fase 1C: Estructura Base de Datos
- ✅ Creado archivo MIGRACION_SESIONES_MOVIMIENTOS.sql con:
  - Tabla `sesiones_clases`
  - Tabla `movimientos_dinero`
  - Índices para búsqueda rápida
  - Políticas RLS

### Fase 1D: Especificación Técnica
- ✅ Creado documento ESPECIFICACION_NUEVA_ESTRUCTURA.md

---

## ⏳ PRÓXIMOS PASOS (En Orden)

### PASO 1: Ejecutar Migraciones en Supabase ⚠️ CRÍTICO

**Archivo**: `docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql`

**Acción**:
1. Abre Supabase → SQL Editor
2. Copia y pega todo el contenido del archivo
3. Ejecuta (Ctrl+Enter o botón "Run")

**Lo que hace**:
- Crea tabla `sesiones_clases` (registro de clases)
- Crea tabla `movimientos_dinero` (ingresos y pagos)
- Actualiza tabla `cursos` con columna `dias_schedule`
- Crea todos los índices necesarios

**Verificación**:
- En Supabase, verifica que veas las nuevas tablas en el menú izquierdo

---

### PASO 2: Actualizar Backend para Aceptar `dias_schedule`

**Archivos a actualizar**:
- `backend/routes/cursos.js`

**Cambios necesarios**:
```javascript
// En POST /cursos
router.post('/', async (req, res) => {
  const { 
    nombre, email, descripcion, nivel, tipo_clase, 
    max_estudiantes, dias, dias_turno, dias_schedule,  // ← AGREGAR
    costo_curso, pago_tutor  // ← AGREGAR
  } = req.body;

  const { data: curso, error } = await supabase
    .from('cursos')
    .insert({
      nombre,
      descripcion,
      nivel,
      tipo_clase,
      max_estudiantes,
      dias: JSON.stringify(dias),
      dias_turno: JSON.stringify(dias_turno),
      dias_schedule: JSON.stringify(dias_schedule),  // ← AGREGAR
      costo_curso,  // ← AGREGAR
      pago_tutor    // ← AGREGAR
    });
});

// Igual para PUT /cursos/:id
```

---

### PASO 3: Crear Endpoint para Generar Sesiones

**Nuevo archivo**: `backend/routes/sesiones.js`

```javascript
import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST - Generar sesiones automáticamente para una matrícula
router.post('/generar', async (req, res) => {
  try {
    const { matricula_id, curso_id, mes, año } = req.body;

    // 1. Obtener info del curso
    const { data: curso } = await supabase
      .from('cursos')
      .select('*')
      .eq('id', curso_id)
      .single();

    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    // Parse dias_schedule
    const diasSchedule = typeof curso.dias_schedule === 'string' 
      ? JSON.parse(curso.dias_schedule) 
      : curso.dias_schedule;

    // 2. Generar una sesión por cada día de la semana en el mes
    const sesiones = [];
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    for (let dia = 1; dia <= 31; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      if (fecha.getMonth() + 1 !== mes) break; // Salir si es otro mes

      const nombreDia = diasSemana[fecha.getDay()];
      
      if (diasSchedule[nombreDia]) {
        const schedule = diasSchedule[nombreDia];
        sesiones.push({
          curso_id,
          tutor_id: req.body.tutor_id,
          fecha: fecha.toISOString().split('T')[0],
          dia_semana: nombreDia,
          hora_inicio: schedule.hora_inicio,
          hora_fin: schedule.hora_fin,
          duracion_horas: schedule.duracion_horas || 0,
          estado: 'programada'
        });
      }
    }

    // 3. Guardar sesiones
    const { data, error } = await supabase
      .from('sesiones_clases')
      .insert(sesiones);

    if (error) throw error;

    res.json({ message: `${sesiones.length} sesiones generadas`, sesiones: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH - Marcar sesión como "dada"
router.patch('/:id/marcar-dada', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Actualizar sesión como "dada"
    const { data: sesion, error: errorSesion } = await supabase
      .from('sesiones_clases')
      .update({ estado: 'dada' })
      .eq('id', id)
      .select()
      .single();

    if (errorSesion) throw errorSesion;

    // 2. Obtener info del curso y tutor
    const { data: curso } = await supabase
      .from('cursos')
      .select('pago_tutor')
      .eq('id', sesion.curso_id)
      .single();

    // 3. Crear movimiento de dinero "pago_tutor_pendiente"
    const montoTutor = sesion.duracion_horas * curso.pago_tutor;
    
    const { data: movimiento, error: errorMovimiento } = await supabase
      .from('movimientos_dinero')
      .insert({
        curso_id: sesion.curso_id,
        tutor_id: sesion.tutor_id,
        sesion_id: id,
        tipo: 'pago_tutor_pendiente',
        monto: montoTutor,
        fecha_pago: sesion.fecha,
        estado: 'pendiente',
        notas: `Pago por clase del ${sesion.fecha}`
      })
      .select()
      .single();

    if (errorMovimiento) throw errorMovimiento;

    res.json({ sesion, movimiento });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**En `backend/server.js`**:
```javascript
import sesionesRouter from './routes/sesiones.js';

app.use('/api/sesiones', requireAuth, sesionesRouter);
```

---

### PASO 4: Crear Endpoint para Registrar Factura

**Nuevo endpoint en `backend/routes/sesiones.js`** (o nuevo archivo `pagos.js`):

```javascript
// POST - Registrar factura de ingreso
router.post('/registrar-factura', async (req, res) => {
  try {
    const { 
      curso_id, 
      monto, 
      factura_numero, 
      fecha_comprobante 
    } = req.body;

    // 1. Crear movimiento de ingreso
    const { data: movIngreso, error: errorIngreso } = await supabase
      .from('movimientos_dinero')
      .insert({
        curso_id,
        tipo: 'ingreso_estudiante',
        monto,
        factura_numero,
        fecha_pago: new Date().toISOString().split('T')[0],
        fecha_comprobante,
        estado: 'completado'
      })
      .select()
      .single();

    if (errorIngreso) throw errorIngreso;

    // 2. Obtener movimientos pendientes de pago_tutor para este curso
    const { data: pagosPendientes } = await supabase
      .from('movimientos_dinero')
      .select('*')
      .eq('curso_id', curso_id)
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');

    // 3. Marcar como "pagado" los montos que se puedan cubrir
    let montoRestante = monto;
    for (const pago of pagosPendientes || []) {
      if (montoRestante >= pago.monto) {
        await supabase
          .from('movimientos_dinero')
          .update({ estado: 'pagado' })
          .eq('id', pago.id);
        
        montoRestante -= pago.monto;
      }
    }

    // 4. Retornar resumen
    res.json({
      ingreso: movIngreso,
      pagosRealizados: pagosPendientes?.length || 0,
      saldo: montoRestante
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### PASO 5: Crear Nueva Vista "Pagos" Mejorada

**Archivo**: `LInguistika-Studio/views/Pagos.tsx` (actualizar existente)

**Estructura**:
```tsx
export const Pagos = () => {
  const [sesiones, setSesiones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [formFactura, setFormFactura] = useState({
    curso_id: 0,
    monto: 0,
    factura_numero: '',
    fecha_comprobante: ''
  });

  // UI Sections:
  // 1. SESIONES PENDIENTES
  //    - Listar sesiones_clases con estado = 'programada'
  //    - [✓ Marcar como Dada]
  // 2. MOVIMIENTOS REGISTRADOS
  //    - Filtro: Ingresos | Pagos
  //    - Mostrar tipo, monto, estado
  // 3. ENTRAR FACTURA
  //    - Form: Curso, Monto, Comprobante, Fecha
  //    - [Guardar Factura]
  // 4. RESUMEN
  //    - Ingresos totales
  //    - Pagos realizados
  //    - Saldo
}
```

---

## 🔗 FLUJO COMPLETO DE DATOS

```
1. CREAR CURSO
   Usuario ingresa:
   - Nombre, Descripción, Nivel
   - Días: ☑ Lunes ☑ Martes
   - Lunes: [Tarde] [14:00-17:00]
   - Costo: 150,000 | Pago Tutor: 15,000/hora
   
   ✓ Se guarda con dias_schedule:
   {
     "Lunes": {
       "turno": "Tarde",
       "hora_inicio": "14:00",
       "hora_fin": "17:00",
       "duracion_horas": 3
     }
   }

2. MATRICULAR ESTUDIANTE
   - Validar: tutor disponible en Lunes Tarde 14:00-17:00
   - Crear matrícula
   - Generar sesiones (POST /api/sesiones/generar)
   
   ✓ Se crean sesiones_clases:
   - Sesión 1: 2026-01-20 (Lunes) 14:00-17:00 → estado='programada'
   - Sesión 2: 2026-01-27 (Lunes) 14:00-17:00 → estado='programada'

3. MARCAR COMO "DADA"
   Admin ve sesión de 2026-01-20 y hace click [✓ Dada]
   
   ✓ Se actualiza sesión a estado='dada'
   ✓ Se crea movimiento_dinero:
   - tipo: 'pago_tutor_pendiente'
   - monto: 3 horas × 15,000 = 45,000
   - estado: 'pendiente' (espera ingreso)

4. ENTRAR FACTURA
   Admin ingresa:
   - Monto: 150,000 (pago del estudiante)
   - Comprobante: FAC-001
   - Fecha: 2026-01-20
   
   ✓ Se crea movimiento_dinero:
   - tipo: 'ingreso_estudiante'
   - monto: 150,000
   - estado: 'completado'
   
   ✓ Sistema AUTOMÁTICAMENTE:
   - Busca pagos_tutor_pendiente (45,000)
   - Resta: 150,000 - 45,000 = 105,000 disponible
   - Marca pago tutor como 'pagado'
   - Genera reporte de saldo

5. PRÓXIMA SESIÓN
   Se repite el proceso para siguiente Lunes
   - Marca como dada → 45,000 más
   - Cuando entra 150,000 nuevamente → se paga
```

---

## 📋 CHECKLIST DE PRUEBA

- [ ] Crear curso con Lunes 14:00-17:00 (Tarde) - Costo 150k - Pago 15k/h
- [ ] Crear curso con Martes 19:00-21:00 (Noche) - Costo 100k - Pago 12k/h
- [ ] Matricular estudiante a primer curso
- [ ] Ver sesiones generadas automáticamente
- [ ] Marcar 1ª sesión como "dada" → se crea movimiento 45,000
- [ ] Entrar factura 150,000 → se paga el movimiento
- [ ] Ver resumen: +150,000 ingreso, -45,000 pago, = 105,000 saldo
- [ ] En Backend server.js verify logs de requests

---

## ⚠️ CONSIDERACIONES IMPORTANTES

1. **Datos Históricos**: Los cursos existentes sin `dias_schedule` seguirán funcionando con `dias_turno`
2. **Validación en Matriculas**: Falta implementar validación de horarios disponibles del tutor
3. **Autenticación**: Todos los endpoints POST/PATCH deben ser protegidos con `requireAuth`
4. **Timezone**: Las fechas se guardan en UTC, verificar en Supabase

---

## 🎯 Próxima Reunión: Validación de Horarios

Cuando hayas completado pasos 1-5, continuaremos con:
- Validación: "¿El tutor está disponible a esa hora?"
- Prevención de conflictos de horarios
- Reportes de utilización de tutores
