# ✅ CHECKLIST DE EJECUCIÓN - LINGUISTIKA v2.0

**Fecha de inicio:** Hoy
**Objetivo:** Poner en línea Linguistika Academy v2.0
**Duración estimada:** 30 minutos

---

## 🔴 FASE 1: BASE DE DATOS (10 minutos)

### Paso 1.1: Preparar Script SQL - SCHEMA LIMPIO
```
✅ MEJOR OPCIÓN: Empezar completamente de cero
🗑️  ACCIÓN: Borrar todo y crear nuevo schema limpio

[X] Abrir archivo: backend/SCHEMA_LIMPIO_v2.0.sql
[ ] Copiar COMPLETAMENTE el contenido
[ ] Tener listo para pegar
```

### Paso 1.2: Ejecutar en Supabase
```
[ ] Ir a https://supabase.com
[ ] Iniciar sesión con tu cuenta
[ ] Seleccionar proyecto "linguistika"
[ ] Ir a SQL Editor (menú izquierdo)
[ ] Crear nueva query (+ New Query)
[ ] Pegar el contenido COMPLETO del script SCHEMA_LIMPIO_v2.0.sql
[ ] Revisar que NO hay errores de sintaxis
[ ] Click "Run" (triángulo ►)
[ ] ESPERAR a que termine (puede tomar 30-60 segundos)
[X] Verificar resultado: "Executed successfully"

⚠️  ADVERTENCIA: Este script ELIMINA todo y crea desde cero
   (Las tablas antiguas serán borradas)
```

### Paso 1.3: Verificar Tablas
```
[ ] Ir a "Table Editor" (menú izquierdo)
[ ] Expandir cada tabla:
    [x] usuarios (0 filas esperadas)
    [X] tutores (0 filas)
    [x] cursos (0 filas)
    [x] estudiantes (0 filas)
    [X] matriculas (0 filas)
    [x] clases (0 filas)
    [x] pagos (0 filas)
    [X] horas_trabajo (0 filas)
[ ] Verificar que existen todas las tablas
```

---

## 🟡 FASE 2: USUARIO ADMINISTRADOR (5 minutos)

### Paso 2.1: Crear Usuario
```
[ ] En Supabase, ir a "Authentication" (menú izquierdo)
[ ] Click en "Users"
[ ] Click en "Create new user"
[ ] Llenar:
    [ ] Email: admin@linguistika.com
    [ ] Password: admin123
[ ] Deixar otras opciones por defecto
[ ] Click "Create user"
```

### Paso 2.2: Confirmar Usuario
```
[x] Si aparece dialogo "Confirm email", hacer click
[x] Esperar notificación "User created"
[x] Verificar que el usuario aparece en la lista
```

---

## 🟢 FASE 3: BACKEND (5 minutos)

### Paso 3.1: Abrir Terminal Backend
```
[x] Abrir nueva terminal (PowerShell)
[x] Navegar:
    PS> cd "c:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\backend"
```

### Paso 3.2: Instalar Dependencias (si falta)
```
[x] Ejecutar: npm install
[x] ESPERAR a completar (2-3 minutos)
[x] No debería haber errores graves
```

### Paso 3.3: Verificar Variables de Entorno
```
[x] Abrir archivo: backend/.env
[x] Verificar que contiene:
    [x] SUPABASE_URL=https://xxxxx.supabase.co
    [x] SUPABASE_ANON_KEY=eyJxxxxxxxxx
[x] Si falta alguno, copiar de Supabase:
    Settings → API → Project API keys
```

### Paso 3.4: Ejecutar Servidor Backend
```
[ ] En la terminal backend, ejecutar:
    PS> npm run dev
[ ] ESPERAR a ver mensaje:
    ✓ Server running on http://localhost:5000
[X] Dejar corriendo (NO cerrar terminal)
```

---

## 🔵 FASE 4: FRONTEND (5 minutos)

### Paso 4.1: Abrir Terminal Frontend
```
[ ] Abrir NUEVA terminal (PowerShell #2)
[X] Navegar:
    PS> cd "c:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\LInguistika-Studio"
```

### Paso 4.2: Instalar Dependencias (si falta)
```
[X] Ejecutar: npm install
[ ] ESPERAR a completar
[X] No debería haber errores graves
```

### Paso 4.3: Ejecutar Frontend
```
[ ] En la terminal frontend, ejecutar:
    PS> npm run dev
[ ] ESPERAR a ver mensaje:
    ✓ Local: http://localhost:5173/
[ ] Dejar corriendo
```

---

## 🟣 FASE 5: PRUEBAS (5 minutos)

### Paso 5.1: Abrir Navegador
```
[ ] Abrir navegador (Chrome, Edge, Firefox)
[ ] Ir a: http://localhost:5173
[ ] Debería ver: Página de LOGIN
```

### Paso 5.2: Hacer Login
```
[ ] Email: admin@linguistika.com
[ ] Contraseña: admin123
[ ] Click "Ingresar"
[ ] ESPERAR 2-3 segundos
[ ] Debería mostrar: DASHBOARD
```

### Paso 5.3: Probar Navegación
```
[ ] Click en "Dashboard" → Funciona ✓
[ ] Click en "Estudiantes" → Funciona ✓
[ ] Click en "Tutores" → Funciona ✓
[ ] Click en "Cursos" → Funciona ✓
[ ] Click en "Matrículas" → Funciona ✓
[ ] Click en "Pagos" → Funciona ✓
```

### Paso 5.4: Crear Tutor de Prueba
```
[ ] Click en "Tutores"
[ ] Click "Nuevo Tutor"
[ ] Llenar formulario:
    [ ] Nombre: Juan García
    [ ] Email: juan@test.com
    [ ] Teléfono: +506 8888-8888
    [ ] Especialidad: Inglés
    [ ] Tarifa: 15.00
    [ ] Seleccionar días: Lunes-Viernes
    [ ] Turno: Tarde libre
[ ] Click "Registrar"
[ ] Debería aparecer en lista ✓
```

### Paso 5.5: Crear Curso de Prueba
```
[ ] Click en "Cursos"
[ ] Click "Nuevo Curso"
[ ] Llenar:
    [ ] Nombre: English A1
    [ ] Nivel: A1
    [ ] Tipo: Grupal
    [ ] Max: 15
    [ ] Días: Lunes, Miércoles, Viernes
    [ ] Turno: Noche
[ ] Click "Registrar"
[ ] Debería aparecer ✓
```

### Paso 5.6: Crear Estudiante de Prueba
```
[ ] Click en "Estudiantes"
[ ] Click "Nuevo Estudiante"
[ ] Llenar:
    [ ] Nombre: María López
    [ ] Email: maria@test.com
    [ ] Email encargado: papas@test.com
    [ ] Teléfono encargado: +506 9999-9999
    [ ] Grado: 5to
    [ ] Días: Lunes, Miércoles
    [ ] Turno: Noche
[ ] Click "Registrar"
[ ] Debería aparecer ✓
```

### Paso 5.7: Crear Matrícula de Prueba
```
[ ] Click en "Matrículas"
[ ] Click "Nueva Matrícula"
[ ] Seleccionar:
    [ ] Estudiante: María López
    [ ] Curso: English A1
    [ ] Tutor: Juan García
[ ] Debería mostrar: ✅ "Horarios compatibles" (verde)
[ ] Click "Matricular"
[ ] Debería aparecer en tabla ✓
```

### Paso 5.8: Verificar Dashboard
```
[ ] Click en "Dashboard"
[ ] Debería mostrar:
    [ ] Tutores: 1
    [ ] Estudiantes: 1
    [ ] Cursos: 1
    [ ] Matrículas: 1
    [ ] Sesiones: 0 (sin clases programadas)
[ ] Todos los números actualizados ✓
```

---

## ✨ VALIDACIONES FINALES

### Validación de Teléfono
```
[ ] Ir a Tutores
[ ] Click "Editar" en Juan García
[ ] Cambiar teléfono a: 888-8888 (formato incorrecto)
[ ] Debería mostrar error rojo ✗
[ ] Cambiar a: +506 7777-7777
[ ] Debería aceptar ✓
```

### Validación de Compatibilidad
```
[ ] Ir a Matrículas
[ ] Click "Editar" en matrícula existente
[ ] Cambiar tutor a uno que NO tenga "Miércoles"
[ ] Debería mostrar: ❌ "Horarios de estudiante y tutor no coinciden"
[ ] Cambiar de vuelta a Juan García
[ ] Debería mostrar: ✅ "Horarios compatibles"
```

### Actualización Automática Dashboard
```
[ ] En Dashboard, verificar que los números se actualizan
[ ] Esperar 30+ segundos
[ ] Los números deben actualizarse automáticamente
[ ] Si no, hacer click "Actualizar Datos"
```

---

## 🆘 SI ALGO FALLA

### Error: "Network Error" en Login
```
SOLUCIÓN:
1. Verificar que backend está corriendo:
   - Terminal Backend debe mostrar: "Server running on http://localhost:5000"
   
2. Verificar que frontend está corriendo:
   - Terminal Frontend debe mostrar: "Local: http://localhost:5173/"
   
3. Si no ves esos mensajes:
   - Cerrar terminal
   - npm install
   - npm run dev
   
4. Si persiste:
   - Restart ambas terminales
   - npm install nuevamente
```

### Error: "Tabla no existe"
```
SOLUCIÓN:
1. Verificar que schema SQL se ejecutó correctamente:
   - En Supabase → Table Editor
   - Debería ver 8 tablas
   
2. Si las tablas NO existen:
   - Volver a ejecutar SCHEMA_ACTUALIZADO_v2.sql
   - Verificar que no hay errores en la ejecución
   
3. Si hay conflicto:
   - Ir a SQL Editor
   - Ejecutar: DROP TABLE IF EXISTS tablas_viejas CASCADE;
   - Luego ejecutar schema nuevo
```

### Error: "Invalid authentication"
```
SOLUCIÓN:
1. Verificar credenciales:
   - Email: admin@linguistika.com
   - Contraseña: admin123
   
2. Verificar que usuario existe:
   - Supabase → Authentication → Users
   - Debería ver admin@linguistika.com
   
3. Si no existe:
   - Crear nuevo usuario
   - Email: admin@linguistika.com
   - Password: admin123
   
4. Limpiar localStorage:
   - Abierto navegador en http://localhost:5173
   - F12 → Console
   - Ejecutar: localStorage.clear()
   - Recargar página
```

### Error: "Validación de teléfono"
```
SOLUCIÓN:
Formatos válidos:
✓ +506 8888-8888
✓ 8888-8888
✗ +506 888-8888 (falta dígito)
✗ 88888888 (sin guion)

Usa siempre: XXXX-XXXX
             ^^^^-^^^^
             4 dígitos - guion - 4 dígitos
```

---

## 📊 RESUMEN DE VERIFICACIÓN

```
┌─────────────────────────────────────────────┐
│ ✅ BASE DE DATOS                            │
│   └─ Schema ejecutado                      │
│   └─ 8 tablas creadas                      │
│   └─ Índices creados                       │
├─────────────────────────────────────────────┤
│ ✅ USUARIO ADMIN                            │
│   └─ admin@linguistika.com creado          │
│   └─ Contraseña: admin123                  │
├─────────────────────────────────────────────┤
│ ✅ BACKEND                                  │
│   └─ npm install completado                │
│   └─ Servidor en puerto 5000               │
│   └─ Conecta a Supabase                    │
├─────────────────────────────────────────────┤
│ ✅ FRONTEND                                 │
│   └─ npm install completado                │
│   └─ Servidor en puerto 5173               │
│   └─ Conecta a backend                     │
├─────────────────────────────────────────────┤
│ ✅ FUNCIONALIDADES                          │
│   └─ Login funciona                        │
│   └─ CRUD Tutores                          │
│   └─ CRUD Cursos                           │
│   └─ CRUD Estudiantes                      │
│   └─ CRUD Matrículas (+ edición)           │
│   └─ Dashboard dinámico                    │
│   └─ Validaciones activas                  │
├─────────────────────────────────────────────┤
│ ✅ PRONTO PARA PRODUCCIÓN                   │
└─────────────────────────────────────────────┘
```

---

## 🎉 ¡FELICIDADES!

Si completaste todos los pasos y las verificaciones pasaron, ¡**Linguistika Academy v2.0 está lista para usar!**

### Próximas acciones:
1. Crear base de datos de ejemplo (tutores, cursos, estudiantes)
2. Probar todas las funcionalidades
3. Hacer backup de datos
4. Consideración de features adicionales
5. ¡Ir a producción!

---

**¡Bienvenido a Linguistika v2.0! 🚀**

Cualquier duda, revisa:
- RESUMEN_CAMBIOS_v2.0.md
- GUIA_DEPLOYMENT_v2.md
- FEATURES_v2.0.md
