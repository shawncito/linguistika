# 🛠️ Herramienta de Migración - Linguistika

Script Node.js para explorar y modificar la base de datos Supabase directamente con permisos de administrador.

## 📋 Requisitos

- Node.js instalado
- `SUPABASE_SERVICE_KEY` configurada en `.env`
- Permisos de administrador en Supabase

## 🚀 Uso Rápido

```bash
cd backend
node migrate.js
```

## 📊 Funciones Disponibles

### 1. Ver Estructura de Todas las Tablas

```javascript
await verEstructura();
```

**Salida**:
```
📊 ESTRUCTURA DE TABLAS

✅ cursos: id, nombre, descripcion, nivel, tipo_clase, max_estudiantes, dias, turno, ...
✅ tutores: id, nombre, email, telefono, especialidad, tarifa_por_hora, ...
✅ estudiantes: id, nombre, email, telefono, grado, fecha_inscripcion, ...
✅ matriculas: id, estudiante_id, curso_id, tutor_id, fecha_inscripcion, estado, ...
✅ sesiones_clases: id, curso_id, tutor_id, fecha, dia_semana, hora_inicio, hora_fin, ...
⚪ movimientos_dinero: (vacía)
⚪ horas_trabajo: (vacía)
```

### 2. Ver Contenido de una Tabla

```javascript
await verTabla('tutores');
await verTabla('cursos', 50); // límite opcional
```

**Salida**:
```
📋 Contenido de tabla: tutores

┌─────────┬────┬─────────────────────┬─────────────────────────────┬────────┐
│ (index) │ id │ nombre              │ email                       │ estado │
├─────────┼────┼─────────────────────┼─────────────────────────────┼────────┤
│ 0       │ 1  │ 'Reyshawn Lawrence' │ 'reyshawn@unadeca.net'      │ true   │
│ 1       │ 2  │ 'Pedro Pedro'       │ 'pedro@unadeca.net'         │ true   │
└─────────┴────┴─────────────────────┴─────────────────────────────┴────────┘

  Total registros: 2
```

### 3. Ver Registros Específicos

```javascript
await verFilasPor('matriculas', 'id', 1);
await verFilasPor('cursos', 'estado', true);
await verFilasPor('tutores', 'especialidad', 'Inglés');
```

**Salida**:
```
📋 Filas en matriculas donde id = 1

┌─────────┬────┬───────────────┬──────────┬──────────┬────────┐
│ (index) │ id │ estudiante_id │ curso_id │ tutor_id │ estado │
├─────────┼────┼───────────────┼──────────┼──────────┼────────┤
│ 0       │ 1  │ 3             │ 3        │ 1        │ true   │
└─────────┴────┴───────────────┴──────────┴──────────┴────────┘

  Total: 1
```

## 🔧 Operaciones CRUD

### Actualizar Registros

```javascript
// Actualizar tarifa de un tutor
const { error } = await supabase
  .from('tutores')
  .update({ tarifa_por_hora: 2000 })
  .eq('id', 1);

if (error) throw error;
console.log('✅ Tutor actualizado');
```

### Insertar Registros

```javascript
// Insertar nuevo tutor
const { error } = await supabase
  .from('tutores')
  .insert([{ 
    nombre: 'María López', 
    email: 'maria@example.com',
    especialidad: 'Matemáticas',
    tarifa_por_hora: 1800,
    estado: true
  }]);

if (error) throw error;
console.log('✅ Nuevo tutor insertado');
```

### Eliminar Registros

```javascript
// Eliminar un registro
const { error } = await supabase
  .from('tutores')
  .delete()
  .eq('id', 99);

if (error) throw error;
console.log('✅ Registro eliminado');
```

## 📝 Ejemplos de Uso Común

### Ejemplo 1: Ver todas las matrículas activas

```javascript
const matriculas = await verFilasPor('matriculas', 'estado', true);
console.log(`Total matrículas activas: ${matriculas.length}`);
```

### Ejemplo 2: Actualizar múltiples registros

```javascript
// Actualizar tarifa de todos los tutores de inglés
const { error } = await supabase
  .from('tutores')
  .update({ tarifa_por_hora: 1600 })
  .eq('especialidad', 'Inglés');

if (error) throw error;
console.log('✅ Tarifas actualizadas');
```

### Ejemplo 3: Corregir datos inconsistentes

```javascript
// Encontrar matrículas con cursos inactivos
const { data: matriculas } = await supabase
  .from('matriculas')
  .select(`
    id, 
    curso_id,
    cursos:curso_id (id, nombre, estado)
  `)
  .eq('estado', true);

const matriculasProblematicas = matriculas.filter(m => !m.cursos?.estado);
console.log('⚠️  Matrículas con cursos inactivos:', matriculasProblematicas);

// Desactivar esas matrículas
for (const m of matriculasProblematicas) {
  await supabase
    .from('matriculas')
    .update({ estado: false })
    .eq('id', m.id);
  console.log(`✅ Matrícula ${m.id} desactivada`);
}
```

### Ejemplo 4: Generar reporte

```javascript
// Ver resumen financiero
const { data: movimientos } = await supabase
  .from('movimientos_dinero')
  .select('*')
  .eq('estado', 'pendiente');

const totalPendiente = movimientos.reduce((sum, m) => sum + m.monto, 0);
console.log(`\n💰 Total pendiente: ₡${totalPendiente.toLocaleString()}`);
```

## ⚠️ Precauciones

1. **SIEMPRE haz backup antes de modificar datos**
2. **Prueba queries en desarrollo primero**
3. **Usa transacciones para operaciones múltiples**
4. **Verifica los datos ANTES de actualizar**
5. **Ten cuidado con DELETE - no hay undo**

## 🔐 Seguridad

- ✅ Service role key tiene permisos completos
- ✅ Bypasa Row Level Security (RLS)
- ⚠️  NO compartir la service key
- ⚠️  NO commitear el archivo `.env`

## 📊 Tablas Disponibles

- `tutores` - Docentes/especialistas
- `cursos` - Tutorías y cursos grupales
- `estudiantes` - Alumnos inscritos
- `matriculas` - Inscripciones estudiante-curso-tutor
- `sesiones_clases` - Clases programadas/completadas/canceladas
- `movimientos_dinero` - Transacciones financieras
- `horas_trabajo` - Registro de horas trabajadas

## 🐛 Troubleshooting

### Error: "SUPABASE_SERVICE_KEY no encontrada"
**Solución**: Verifica que `.env` tenga la línea:
```env
SUPABASE_SERVICE_KEY=eyJ...tu_key_aqui
```

### Error: "Cannot find module @supabase/supabase-js"
**Solución**: 
```bash
cd backend
npm install
```

### Error: "Row violates check constraint"
**Solución**: Verifica que los datos cumplan las restricciones de la tabla (NOT NULL, FOREIGN KEY, etc.)

## 📚 Recursos

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)

---

**⚠️ IMPORTANTE**: Esta herramienta es para uso administrativo únicamente. No exponer en producción.
