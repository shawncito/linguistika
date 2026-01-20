# 🎉 LINGUISTIKA ACADEMY v2.0 - GUÍA DE DEPLOYMENT

**Fecha:** Hoy  
**Versión:** 2.0 Completa  
**Estado:** ✅ LISTO PARA EJECUTAR

---

## 📋 CHECKLIST PRE-DEPLOYMENT

Antes de ejecutar la aplicación, verifica estos pasos:

### 1️⃣ BASE DE DATOS - IMPORTAR SCHEMA
```
[ ] Acceder a Supabase.com
[ ] Ir a tu proyecto → SQL Editor
[ ] Copiar contenido de: backend/SCHEMA_ACTUALIZADO_v2.sql
[ ] Pegar en SQL Editor
[ ] Ejecutar (Play button)
[ ] Verificar que NO hay errores
[ ] Confirmar que todas las tablas se crearon
```

**Tablas a verificar:**
- ✓ usuarios
- ✓ tutores (con: dias, turno, horario_tipo)
- ✓ cursos (con: tipo_clase, dias, turno)
- ✓ estudiantes (con: email_encargado, telefono_encargado, dias, turno)
- ✓ matriculas
- ✓ clases
- ✓ pagos
- ✓ horas_trabajo

### 2️⃣ USUARIO ADMINISTRADOR
```
[ ] En Supabase → Authentication → Users
[ ] Click "Create new user"
[ ] Email: admin@linguistika.com
[ ] Password: admin123
[ ] Click "Create user"
[ ] Confirmar usuario (si se requiere)
```

### 3️⃣ BACKEND - CONFIGURAR Y EJECUTAR
```bash
# 1. Navegar al backend
cd backend

# 2. Instalar dependencias (si no lo hizo)
npm install

# 3. Verificar archivo .env
# Debe contener: SUPABASE_URL y SUPABASE_ANON_KEY

# 4. Ejecutar servidor
npm run dev

# Debe mostrar: "Server running on http://localhost:5000"
```

### 4️⃣ FRONTEND - CONFIGURAR Y EJECUTAR
```bash
# En otra terminal

# 1. Navegar al frontend
cd LInguistika-Studio

# 2. Instalar dependencias (si no lo hizo)
npm install

# 3. Ejecutar desarrollo
npm run dev

# Debe mostrar: "VITE v... ready in X ms"
```

### 5️⃣ VERIFICAR CONECTIVIDAD
```
[ ] Abrir navegador: http://localhost:5173
[ ] Ver página de Login
[ ] Intentar login con:
    - Email: admin@linguistika.com
    - Contraseña: admin123
[ ] Debe mostrar Dashboard después de login
```

---

## 🎯 FUNCIONALIDADES A PROBAR

### ✅ TUTORES
```
[ ] Crear nuevo tutor
  ├─ Nombre: Juan García
  ├─ Email: juan@linguistika.com
  ├─ Teléfono: +506 8888-8888 ← Validar formato
  ├─ Especialidad: Inglés
  ├─ Tarifa: 15.00
  ├─ Días: Lunes, Martes, Miércoles, Jueves, Viernes
  ├─ Turno: Tarde libre
  └─ Guardar
[ ] Editar tutor
[ ] Eliminar tutor
```

### ✅ CURSOS
```
[ ] Crear nuevo curso
  ├─ Nombre: English A1
  ├─ Nivel: None ← Verificar que aparece "None"
  ├─ Tipo: Grupal
  ├─ Max estudiantes: 15 ← Campo visible
  ├─ Días: Lunes, Miércoles, Viernes
  ├─ Turno: Noche
  └─ Guardar
[ ] Crear curso de Tutoría
  ├─ Tipo: Tutoría
  ├─ Max estudiantes: ← Campo deshabilitado, muestra "Sin límite"
  └─ Guardar
[ ] Editar curso
[ ] Eliminar curso
```

### ✅ ESTUDIANTES
```
[ ] Crear nuevo estudiante
  ├─ Nombre: María López
  ├─ Email: maria@example.com
  ├─ Email Encargado: papas@example.com
  ├─ Teléfono Encargado: +506 9999-9999 ← Validar formato
  ├─ Grado: 5to ← Dropdown 1ro-11mo
  ├─ Días: Lunes, Martes, Miércoles
  ├─ Turno: Tarde
  └─ Guardar
[ ] Editar estudiante
[ ] Eliminar estudiante
```

### ✅ MATRÍCULAS
```
[ ] Crear nueva matrícula
  ├─ Estudiante: María López
  ├─ Curso: English A1
  ├─ Tutor: Juan García
  ├─ Verificar: ✅ "Horarios compatibles" (verde)
  └─ Guardar
[ ] Editar matrícula
[ ] Ver indicador de compatibilidad
  ├─ Verde: Compatible ✅
  ├─ Rojo: No compatible ❌
  └─ Ámbar: Advertencia ⚠️
[ ] Cancelar matrícula (botón ROJO oscuro)
```

### ✅ DASHBOARD
```
[ ] Verificar estadísticas
  ├─ Tutores: cuenta correcta
  ├─ Estudiantes: cuenta correcta
  ├─ Cursos: cuenta correcta
  ├─ Matrículas: cuenta correcta
  └─ Actualizar cada 30 segundos
[ ] Agenda del día
  ├─ Selector de fecha
  ├─ Mostrar sesiones por fecha
  └─ Información completa
[ ] Sesiones de hoy
  ├─ Solo sesiones del día actual
  └─ Diseño destacado
[ ] Carga de trabajo
  ├─ Resumen por tutor
  ├─ Número de sesiones
  └─ Barra de progreso
```

---

## 🔍 VALIDACIONES A VERIFICAR

### Teléfono de Tutor
```
✓ Acepta: +506 8888-8888
✓ Acepta: 8888-8888
✗ Rechaza: 888-8888 (formato incorrecto)
✗ Rechaza: (506) 8888-8888 (formato incorrecto)
```

### Teléfono de Encargado
```
✓ Igual que tutor
✓ +506 XXXX-XXXX
✓ XXXX-XXXX
```

### Email
```
✓ Valida formato estándar
✗ Rechaza emails sin @
✗ Rechaza emails sin dominio
```

### Grado de Estudiante
```
[ ] 1ro
[ ] 2do
[ ] 3ro
[ ] 4to
[ ] 5to
[ ] 6to
[ ] 7mo
[ ] 8vo
[ ] 9no
[ ] 10mo
[ ] 11mo
```

---

## 📱 FLUJO COMPLETO DE USO

### 1. Login
```
1. Ir a http://localhost:5173
2. Email: admin@linguistika.com
3. Contraseña: admin123
4. Click "Ingresar"
```

### 2. Crear Base de Datos
```
1. Tutores:
   - Crear 2-3 tutores con diferentes horarios
   
2. Cursos:
   - Crear cursos Grupal
   - Crear cursos Tutoría
   - Variar niveles
   
3. Estudiantes:
   - Crear con datos de encargado
   - Agregar grados y horarios
   
4. Matrículas:
   - Vincular estudiante → curso → tutor
   - Verificar compatibilidad de horarios
```

### 3. Ver Dashboard
```
1. Ir a Dashboard
2. Ver estadísticas actualizadas
3. Seleccionar una fecha
4. Ver agenda de sesiones
5. Verificar "Programado para Hoy"
6. Ver "Carga de Trabajo"
```

---

## 🆘 TROUBLESHOOTING

### Error: "Network Error" al login
```
[ ] Verificar que backend está corriendo (http://localhost:5000)
[ ] Verificar que frontend está corriendo (http://localhost:5173)
[ ] Reiniciar ambos servidores
```

### Error: "Teléfono inválido"
```
[ ] Usar formato: +506 XXXX-XXXX o XXXX-XXXX
[ ] Verificar que tiene exactamente 8 dígitos después del país
[ ] No usar espacios extras
```

### Error: "Estudiante/Tutor no encontrado"
```
[ ] Verificar que el registro existe en la BD
[ ] Recargar la página (F5)
[ ] Crear el registro faltante
```

### Datos no se actualizan
```
[ ] Hacer click en "Actualizar Datos" (Dashboard)
[ ] Recargar página (F5)
[ ] Verificar que el usuario está autenticado
```

### Matrículas: "No compatible"
```
[ ] Verificar que tutor y curso comparten al menos un día
[ ] Ejemplo:
  ├─ Tutor: Lunes, Martes, Miércoles
  ├─ Curso: Lunes, Miércoles, Viernes
  └─ Común: Lunes, Miércoles ✅ (Compatible)
```

---

## 📞 CARACTERÍSTICAS POR MÓDULO

### 🎓 TUTORES
- ✅ CRUD completo
- ✅ Validación de teléfono
- ✅ Selección de días hábiles
- ✅ Selección de turno (predefinido/custom)
- ✅ Especialidad y tarifa

### 📚 CURSOS
- ✅ CRUD completo
- ✅ Nivel: None + A1-C2
- ✅ Tipo: Grupal o Tutoría
- ✅ Max estudiantes (null si tutoría)
- ✅ Días y turno

### 👥 ESTUDIANTES
- ✅ CRUD completo
- ✅ Email estudiante y encargado
- ✅ Teléfono encargado con validación
- ✅ Grado (1ro-11mo)
- ✅ Horario preferido opcional

### 📋 MATRÍCULAS
- ✅ CRUD completo
- ✅ Crear matrícula
- ✅ **EDITAR matrícula** (nuevo)
- ✅ Cancelar (botón rojo fuerte)
- ✅ Validación de compatibilidad en tiempo real

### 📊 DASHBOARD
- ✅ Estadísticas dinámicas
- ✅ Actualización automática cada 30s
- ✅ Agenda de sesiones (por fecha)
- ✅ Sesiones de hoy
- ✅ Carga de trabajo por tutor

---

## 💾 ARCHIVOS IMPORTANTES

### Backend
```
backend/
├── server.js (punto de entrada)
├── supabase.js (cliente Supabase)
├── SCHEMA_ACTUALIZADO_v2.sql (schema DB) ← EJECUTAR EN SUPABASE
└── routes/
    ├── tutores.js (actualizado)
    ├── cursos.js (actualizado)
    ├── estudiantes.js (actualizado)
    ├── matriculas.js (con edición)
    └── dashboard.js (estadísticas)
```

### Frontend
```
LInguistika-Studio/
├── App.tsx (navegación reordenada)
├── types.ts (tipos actualizados)
├── services/api.ts (cliente API actualizado)
└── views/
    ├── Dashboard.tsx (reescrito)
    ├── Tutores.tsx (reescrito)
    ├── Cursos.tsx (reescrito)
    ├── Estudiantes.tsx (reescrito)
    └── Matriculas.tsx (reescrito)
```

---

## 🎊 RESUMEN FINAL

| Aspecto | Estado |
|--------|--------|
| 🎓 Tutores | ✅ Completo |
| 📚 Cursos | ✅ Completo |
| 👥 Estudiantes | ✅ Completo |
| 📋 Matrículas | ✅ Completo (+ edición) |
| 📊 Dashboard | ✅ Completo (+ dinámico) |
| 🔐 Backend | ✅ Actualizado |
| 💾 Base de Datos | ✅ Preparada |
| 🧪 Tests | ⏳ Pendiente (manual) |

**Próximo paso:** Ejecutar el Schema SQL en Supabase y probar funcionalidades.

¡Buena suerte! 🚀
