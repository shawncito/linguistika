# Especificación de Nueva Estructura de Horas y Pagos

## 1. ESTRUCTURA DE DATOS

### 1.1 Días y Horas por Tutor (Tutores.tsx)
```typescript
// Antes:
turno: string // "Tarde" | "Noche"

// Ahora:
dias_turno: Record<string, 'Tarde' | 'Noche'>
// Ejemplo: { "Lunes": "Tarde", "Martes": "Noche" }
```
**Estado**: ✅ HECHO

---

### 1.2 Días, Horas y Costos por Curso (Cursos.tsx)
```typescript
// Antes:
dias: string[]  // ["Lunes", "Martes"]
turno: string   // "Tarde" | "Noche"

// Ahora - Opción 1 (SIMPLE):
dias: string[]  // Los días
dias_turno: Record<string, 'Tarde' | 'Noche'>  // Turno por día
costo_curso: number  // ₡10,000 (precio para estudiantes)
pago_tutor: number   // ₡5,000 (pago por HORA de clase)

// Ahora - Opción 2 (COMPLEJA) - CON RANGO DE HORAS:
dias_schedule: {
  "Lunes": {
    turno: "Tarde",
    hora_inicio: "14:00",
    hora_fin: "17:00"
  },
  "Martes": {
    turno: "Noche",
    hora_inicio: "19:00",
    hora_fin: "21:00"
  }
}
costo_curso: number
pago_tutor: number
```

**Recomendación**: Usar **Opción 2** para permitir horarios flexibles

---

### 1.3 Estructura de Sesiones de Clases (NUEVA TABLA)
```sql
CREATE TABLE sesiones_clases (
  id BIGINT PRIMARY KEY,
  curso_id BIGINT REFERENCES cursos(id),
  tutor_id BIGINT REFERENCES tutores(id),
  fecha DATE,
  dia_semana TEXT, -- "Lunes", "Martes", etc
  hora_inicio TIME,
  hora_fin TIME,
  duracion_horas DECIMAL(5,2),
  estado TEXT, -- 'programada', 'dada', 'cancelada'
  created_at TIMESTAMP
);
```

---

### 1.4 Estructura de Movimientos de Dinero (NUEVA TABLA)
```sql
CREATE TABLE movimientos_dinero (
  id BIGINT PRIMARY KEY,
  curso_id BIGINT REFERENCES cursos(id),
  matricula_id BIGINT REFERENCES matriculas(id),
  tipo TEXT, -- 'ingreso_estudiante', 'pago_tutor'
  monto NUMERIC(10,2),
  factura_numero TEXT, -- Para ingresos de estudiantes
  fecha_pago DATE,
  fecha_comprobante DATE, -- Para validación
  estado TEXT, -- 'pendiente', 'completado', 'verificado'
  notas TEXT,
  created_at TIMESTAMP
);
```

---

## 2. FLUJO DE INFORMACIÓN

### 2.1 Al Crear Curso
1. Usuario selecciona días (checkboxes)
2. Para cada día, selecciona turno (Tarde/Noche)
3. **NUEVO**: Para cada día, selecciona rango de horas
   - Hora inicio (14:00)
   - Hora fin (17:00)
   - **Sistema calcula automáticamente duración**
4. Usuario ingresa costo_curso (lo que pagan estudiantes)
5. Usuario ingresa pago_tutor (costo por HORA)

**Resultado guardado**:
```javascript
{
  dias_schedule: {
    "Lunes": {
      turno: "Tarde",
      hora_inicio: "14:00",
      hora_fin: "17:00",
      duracion_horas: 3
    }
  },
  costo_curso: 150000,  // Precio TOTAL del curso
  pago_tutor: 15000     // ₡15,000 por HORA de enseñanza
}
```

---

### 2.2 Al Matricular Estudiante
1. Se valida que el tutor esté disponible en esos días/horas
   - Verificar: `tutor.dias_turno[dia]` coincide con `curso.dias_schedule[dia].turno`
   - Verificar: horario del tutor incluye horario del curso
2. Se crea la matrícula
3. Se generan sesiones de clases (una por semana, hasta fin del mes)
4. Se registra movimiento "ingreso_estudiante" si paga ahora
5. Se crea movimiento "pago_pendiente_tutor" (aún no se paga)

---

### 2.3 Al Marcar Sesión como "Dada"
1. El admin marca sesión como completada (✅ Dada)
2. Sistema calcula automáticamente:
   - Horas: `(hora_fin - hora_inicio) = 3 horas`
   - Monto a pagar tutor: `3 horas × ₡15,000 = ₡45,000`
3. Se crea movimiento de dinero:
   ```javascript
   {
     tipo: "pago_tutor_pendiente",
     monto: 45000,
     estado: "pendiente",  // Espera que entre dinero de estudiante
     ...
   }
   ```

---

### 2.4 Al "Entrar Factura" (Ingreso de Estudiante)
1. Admin ingresa:
   - Monto: ₡150,000
   - Número de comprobante: "FAC-001"
   - Fecha: 2026-01-19
2. Se crea movimiento:
   ```javascript
   {
     tipo: "ingreso_estudiante",
     monto: 150000,
     factura_numero: "FAC-001",
     estado: "completado"
   }
   ```
3. Sistema AUTOMÁTICAMENTE:
   - Busca movimientos pendientes de pago_tutor para ese curso
   - Deduce: 150,000 - 45,000 (pago tutor 1) - 30,000 (pago tutor 2) = 75,000 (ganancia escuela)
   - Marca movimientos de pago como "pagado"
   - Crea reporte de deudas/ganancias

---

## 3. INTERFAZ DE USUARIO

### 3.1 Cursos - Agregar Rango de Horas

**Cuando se selecciona un día**:
```
☑ Lunes [Tarde ▼] [14:00 - 17:00] ← Nueva línea con inputs de hora
☑ Martes [Noche ▼] [19:00 - 21:00]
```

### 3.2 Pagos - Nueva Sección "Entrar Factura"

```
┌─ MOVIMIENTOS DE DINERO ───────────────────┐
│                                             │
│ [Buscar por Curso] [Filtrar Mes]           │
│                                             │
│ ┌─ Sesión: Inglés - Lunes 14:00-17:00 ───┐│
│ │ [✓ Dada] 3 Horas → Tutor: ₡45,000      ││
│ │ Status: Pendiente Pago del Tutor        ││
│ └─────────────────────────────────────────┘│
│                                             │
│ [+ Entrar Factura]                          │
│ ┌─ Factura ────────────────────────────────┐│
│ │ Monto: [150000    ]                      ││
│ │ Comprobante: [FAC-001    ]               ││
│ │ Fecha: [2026-01-19]                      ││
│ │ [Guardar Factura]                        ││
│ └─────────────────────────────────────────┘│
│                                             │
│ ✓ Ingreso: +₡150,000 (FAC-001)             │
│ ✗ Pago Tutor 1: ₡45,000 PAGADO           │
│ ✗ Pago Tutor 2: ₡30,000 PAGADO           │
│ = Ganancia: ₡75,000                        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. PRÓXIMOS PASOS (ORDEN DE PRIORIDAD)

### Fase 1: Base de Datos
- [ ] Crear tabla `sesiones_clases`
- [ ] Crear tabla `movimientos_dinero`
- [ ] Ejecutar migraciones SQL

### Fase 2: Backend
- [ ] Actualizar `cursos.js` para aceptar `dias_schedule` con horas
- [ ] Crear endpoint POST `/sesiones` (generar sesiones automáticas)
- [ ] Crear endpoint PATCH `/sesiones/:id` (marcar como dada)
- [ ] Crear endpoint POST `/movimientos-dinero` (registrar factura)

### Fase 3: Frontend
- [ ] Actualizar `Cursos.tsx` para inputs de horas por día
- [ ] Actualizar `Matriculas.tsx` para validar disponibilidad de tutor
- [ ] Crear nueva vista `Pagos.tsx` mejorada con:
  - Listado de sesiones pendientes
  - Botón "Entrar Factura"
  - Resumen de ingresos/egresos

### Fase 4: Testing
- [ ] Probar flujo completo: Crear Curso → Matricular → Marcar Sesión → Entrar Factura

---

## 5. CONSIDERACIONES TÉCNICAS

### 5.1 Horas Disponibles del Tutor
**Problema**: El tutor puede tener múltiples horas por día (ej: 14:00-17:00 y 19:00-21:00)

**Solución**: Permitir en Tutores múltiples rangos
```typescript
dias_horarios: {
  "Lunes": [
    { hora_inicio: "14:00", hora_fin: "17:00" },
    { hora_inicio: "19:00", hora_fin: "21:00" }
  ]
}
```

### 5.2 Validación de Disponibilidad
```javascript
// Pseudo-código para validar si tutor puede enseñar ese horario
function validarDisponibilidadTutor(tutor, curso, dia) {
  const horarioTutor = tutor.dias_horarios[dia];
  const horarioCurso = curso.dias_schedule[dia];
  
  // Verificar que el rango del curso está dentro del tutor
  return horarioTutor.some(rango =>
    horarioCurso.hora_inicio >= rango.hora_inicio &&
    horarioCurso.hora_fin <= rango.hora_fin
  );
}
```

### 5.3 Cálculo de Duración
```javascript
// Calcular automáticamente duracion_horas
const hora_inicio = "14:00"; // HH:mm
const hora_fin = "17:00";

const [hi, mi] = hora_inicio.split(':').map(Number);
const [hf, mf] = hora_fin.split(':').map(Number);
const minutosTotales = (hf * 60 + mf) - (hi * 60 + mi);
const horasTotales = minutosTotales / 60; // 3.0
```

---

## 6. DECISIONES PENDIENTES

- [ ] ¿Permitir múltiples rangos de horas por tutor por día?
- [ ] ¿Duración de sesión fija o flexible?
- [ ] ¿Cobro por hora exacta o bloques de 30 min?
- [ ] ¿Generar sesiones automáticamente o manualmente?
