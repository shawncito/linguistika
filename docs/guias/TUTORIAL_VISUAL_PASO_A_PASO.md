## 🎓 TUTORIAL VISUAL - Ejecutar SQL y Testear

### PARTE 1: Ejecutar Migraciones SQL

#### Paso 1: Abre Supabase
1. Ve a: https://supabase.com
2. Login con tu cuenta
3. Click en tu Proyecto "Linguistika"

```
┌─────────────────────────────────────┐
│ Supabase Dashboard                  │
├─────────────────────────────────────┤
│ Proyectos:                          │
│ • Linguistika  ← Click aquí         │
│ • OtroProyecto                      │
└─────────────────────────────────────┘
```

#### Paso 2: Abre SQL Editor
1. Panel izquierdo: Click en "SQL Editor"
2. Click en botón "+ New Query"

```
Panel Izquierdo:
├─ Dashboard
├─ Table Editor
├─ SQL Editor ← Click aquí
│  └─ Queries
│     └─ [+ New Query]
└─ ...
```

#### Paso 3: Copia Script 1
1. Abre el archivo: `SQL_MIGRATIONS_QUICK.md` (en tu editor)
2. Busca la sección: "FIX_RLS_POLICIES"
3. Copia TODO desde `-- ============` hasta el final del script
4. En Supabase SQL Editor: Pega el código

```
SQL Editor:
┌─────────────────────────────────────┐
│ -- ============                     │
│ -- CORREGIR POLÍTICAS RLS           │
│ -- ============                     │
│                                     │
│ DROP POLICY IF EXISTS ...           │
│ ...                                 │
│ CREATE POLICY "pagos_delete" ...    │
└─────────────────────────────────────┘
```

#### Paso 4: Ejecuta Script 1
1. Button arriba-derecha: "Run" (o Ctrl+Enter)
2. Espera: 5-10 segundos
3. Busca: Mensaje verde "Executed successfully"

```
Resultado Esperado:
┌─────────────────────────────────────┐
│ ✅ Executed successfully            │
│                                     │
│ Rows: 0 affected                    │
│ Time: 2.5ms                         │
└─────────────────────────────────────┘
```

#### Paso 5: Nueva Query para Script 2
1. Click: "+ New Query" (botón superior)
2. Se abre editor nuevo/vacío

#### Paso 6: Copia Script 2
1. Abre: `SQL_MIGRATIONS_QUICK.md`
2. Busca: "MIGRACION_TUTORES_DIAS_TURNO"
3. Copia desde `-- ============` hasta el final
4. Pega en el nuevo editor SQL

```
SQL Editor:
┌─────────────────────────────────────┐
│ -- ============                     │
│ -- AGREGAR COLUMNA 'dias_turno'     │
│ -- ============                     │
│                                     │
│ ALTER TABLE tutores                │
│ ADD COLUMN IF NOT EXISTS            │
│   dias_turno TEXT DEFAULT NULL;     │
└─────────────────────────────────────┘
```

#### Paso 7: Ejecuta Script 2
1. Click: "Run" (o Ctrl+Enter)
2. Espera: 2-3 segundos
3. Busca: Mensaje verde "Executed successfully"

```
✅ Resultado esperado:
Executed successfully
Time: 1.2ms
```

---

### PARTE 2: Verificar en Supabase

#### Paso 8: Verifica que columna fue agregada
1. Panel izquierdo: "Table Editor"
2. Busca tabla: "tutores"
3. Click en "tutores"
4. Scroll derecha hasta encontrar columna "dias_turno"
5. Verifica: Type = TEXT, Default = NULL

```
Tabla tutores:
┌──────────────────────────────────┐
│ id | nombre | email | teléfono | │
├──────────────────────────────────┤
│ 1  | Carlos | ...   | 8888...  │ │
│ 2  | María  | ...   | 7777...  │ │
│ ... [scroll derecha] → dias_turno │
└──────────────────────────────────┘

Columna dias_turno:
Type: TEXT
Default: NULL
Nullable: YES
```

---

### PARTE 3: Testing en la App

#### Paso 9: Recarga la App
1. Cierra Supabase (opcional)
2. Abre tu App: http://localhost:5173 (o tu puerto)
3. Si ya estaba abierta: Presiona F5 (Refresh)
4. Espera a que cargue completamente

#### Paso 10: Navega a Tutores
1. Menu superior: Haz click en "Especialistas Docentes" (o "Tutores")
2. Deberías ver lista de docentes existentes

```
┌─────────────────────────────────────┐
│ Linguistika Studio                  │
├─────────────────────────────────────┤
│ Dashboard | Estudiantes | Tutores → │
│           | Especialistas |         │
│           | Cursos | Matrículas ...  │
│                                     │
│ Especialistas Docentes              │
│ [+ Nuevo Docente]                   │
│                                     │
│ ┌──────────────────────────────────┐│
│ │ Carlos García        [Inglés]    ││
│ │ Tarifa: ₡25,000      Activo     ││
│ │ 📧 carlos@... 📱 8888-8888       ││
│ │ Horario: [Lun • Tarde] ...       ││
│ │ [Editar] [Eliminar]              ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

#### Paso 11: Click "Nuevo Docente"
1. Button azul: "+ Nuevo Docente"
2. Se abre Modal/Formulario
3. Verifica que se vea:
   - Campo: Nombre
   - Campo: Email
   - Campo: Teléfono
   - Selector: Especialidad
   - Campo: Tarifa
   - Checkboxes: Días (Lun-Dom)
   - **NUEVO**: Radios de turnos (después de seleccionar días)

```
┌─────────────────────────────────────┐
│ Nuevo Docente              [X]      │
├─────────────────────────────────────┤
│ Nombre *                            │
│ [_________________________________] │
│                                     │
│ Email          │ Teléfono *         │
│ [_______]      │ [________]         │
│                                     │
│ Especialidad * │ Tarifa (₡) *       │
│ [Inglés   ▼]   │ [________]         │
│                                     │
│ Días Hábiles *                      │
│ ☐ Lun ☐ Mar ☐ Mié ☐ Jue ☐ Vie     │
│ ☐ Sáb ☐ Dom                        │
│                                     │
│ [Cancelar] [Guardar]                │
└─────────────────────────────────────┘
```

#### Paso 12: Completa el formulario

**Campo 1: Nombre**
- Texto: "María García"

```
Nombre *
[María García        ]
```

**Campo 2: Teléfono**
- Formato correcto: 8888-8888 o +506 8888-8888
- Ej: "8888-8888"

```
Teléfono *
[8888-8888           ]
```

**Campo 3: Especialidad**
- Click selector dropdown
- Selecciona: "Inglés"

```
Especialidad *
[Inglés             ▼]
  English
  Français
  Deutsch
  ...
```

**Campo 4: Tarifa**
- Número: "25000"

```
Tarifa (₡) *
[25000              ]
```

#### Paso 13: Selecciona Días
1. Verifica: Inicialmente todos checkboxes están ☐ (vacíos)
2. Click en 3 checkboxes: Lunes, Miércoles, Viernes
   - Resultado esperado: ☑ Lun ☐ Mar ☑ Mié ☐ Jue ☑ Vie

```
Días Hábiles *
☑ Lun ☐ Mar ☑ Mié ☐ Jue ☑ Vie ☐ Sáb ☐ Dom
```

#### Paso 14: Asigna Turnos (NUEVO - Main Feature)
1. **IMPORTANTE**: Después de seleccionar días, deben aparecer secciones nuevas
2. Cada sección tiene 2 opciones: Tarde o Noche
3. Asigna según este patrón:
   - **Lunes**: Selecciona ◉ Tarde
   - **Miércoles**: Selecciona ◉ Noche
   - **Viernes**: Selecciona ◉ Tarde

```
Turno por Día *

┌─ Lunes ─────────────────────┐
│ ◉ Tarde (2:00 - 6:00 PM)   │
│ ○ Noche (6:00 - 9:00 PM)   │
└─────────────────────────────┘

┌─ Miércoles ─────────────────┐
│ ○ Tarde (2:00 - 6:00 PM)   │
│ ◉ Noche (6:00 - 9:00 PM)   │
└─────────────────────────────┘

┌─ Viernes ───────────────────┐
│ ◉ Tarde (2:00 - 6:00 PM)   │
│ ○ Noche (6:00 - 9:00 PM)   │
└─────────────────────────────┘
```

#### Paso 15: Haz Click en "Guardar"
1. Verifica que NO aparezcan errores en rojo
2. Espera: 2-3 segundos (mientras se guarda)
3. Resultado esperado:
   - Modal se cierra
   - Vuelves a lista de docentes
   - Nuevo docente "María García" aparece

#### Paso 16: Verifica que se guardó correctamente
1. Busca: "María García" en la lista
2. Click en su tarjeta para ver detalles
3. **MUY IMPORTANTE**: Verifica que muestre el horario
4. Formato esperado: `[Lun • Tarde] [Mié • Noche] [Vie • Tarde]`

```
┌──────────────────────────────────────┐
│ María García         [Inglés]        │
├──────────────────────────────────────┤
│ Tarifa: ₡25,000      │ Activo       │
│ 📧 maria@...                         │
│ 📱 8888-8888                         │
│                                      │
│ Horario:                             │
│ [Lun • Tarde] [Mié • Noche]         │
│ [Vie • Tarde]                        │
│                                      │
│ [Editar ✏️] [Eliminar 🗑️]           │
└──────────────────────────────────────┘
```

---

### PARTE 4: Test de Edición (Bonus)

#### Paso 17: Click Botón "Editar"
1. En la tarjeta de María García
2. Click en ícono de lápiz [✏️ Editar]
3. Se abre Modal con datos pre-llenados

#### Paso 18: Haz cambios
1. Agregar un día nuevo: Click ☑ Sábado
2. Cambiar turno: Lunes de Tarde → Noche
3. Resultado esperado:
   - Viernes: Tarde (sin cambios)
   - Lunes: Noche (CAMBIADO)
   - Sábado: Noche (NUEVO)

#### Paso 19: Guardar cambios
1. Click: "Guardar"
2. Espera a que se actualice
3. Verifica en tarjeta:
   - Debe mostrar: `[Lun • Noche] [Mié • Noche] [Vie • Tarde] [Sáb • Noche]`

---

### PARTE 5: Troubleshooting

#### ❌ Error: "Turno por Día" no aparece
**Solución:**
1. Verifica que hayas seleccionado ≥1 día
2. Scroll down en el formulario (puede estar debajo)
3. Si sigue sin aparecer: Borra localStorage
   - DevTools (F12) → Application → LocalStorage → Elimina todo
   - Recarga (F5)

#### ❌ Error: "PGRST204 dias_turno column not found"
**Solución:**
1. ¿Ejecutaste MIGRACION_TUTORES_DIAS_TURNO.sql?
2. Verifica en Supabase → Table Editor → tutores → Scroll derecha
3. Si la columna NO existe → Ejecuta el script nuevamente

#### ❌ Error: "42501 row-level security"
**Solución:**
1. ¿Ejecutaste FIX_RLS_POLICIES.sql?
2. Si SÍ ejecutaste → Recarga app (F5) e intenta de nuevo
3. Si NO ejecutaste → Ejecuta ahora

#### ❌ Error: "500 Internal Server Error"
**Solución:**
1. Recarga app (F5)
2. Verifica backend está corriendo: `npm run dev` en carpeta backend/
3. Abre DevTools (F12) → Console para ver error exacto
4. Si persiste: Revisa `backend/routes/tutores.js` línea de POST

---

### ✅ INDICADORES DE ÉXITO

| Punto | Indicador | Status |
|------|-----------|--------|
| 1 | FIX_RLS_POLICIES ejecutado | ✓ |
| 2 | MIGRACION_TUTORES ejecutada | ✓ |
| 3 | Columna `dias_turno` visible en BD | ✓ |
| 4 | Formulario muestra radios de turnos | ✓ |
| 5 | Nuevo docente se guarda sin error | ✓ |
| 6 | Tarjeta muestra formato "Día • Turno" | ✓ |
| 7 | Edición funciona correctamente | ✓ |
| 8 | Cambios se reflejan en tarjeta | ✓ |

---

**Tutorial Visual Completado** ✅  
Si completaste todos los pasos → ¡Sistema funcionando! 🎉
