# 🚀 Guía de Inicio Rápido - Linguistika

## 1️⃣ Instalación Inicial

### Paso 1: Instalar Dependencias del Backend

```bash
cd backend
npm install
```

### Paso 2: Instalar Dependencias del Frontend

```bash
cd LInguistika-Studio
npm install
```

## 2️⃣ Ejecutar la Aplicación

### Opción A: Ejecutar ambos servidores automáticamente (desde la raíz)

```bash
npm run dev
```

Esto iniciará:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

### Opción B: Ejecutar servidores por separado

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

## 3️⃣ Acceder a la Aplicación

Abre tu navegador web y ve a:
```
http://localhost:3000
```

## 4️⃣ Primeros Pasos en la Aplicación

### Paso 1: Crear Tutores
1. Haz clic en **"Tutores"** en la barra de navegación
2. Haz clic en **"+ Nuevo Tutor"**
3. Completa el formulario con:
   - Nombre
   - Email (opcional)
   - Teléfono (opcional)
   - Especialidad (Inglés, Francés, etc.)
   - Tarifa por hora en ₡
4. Haz clic en **"Guardar"**

### Paso 2: Crear Cursos
1. Ve a **"Cursos"**
2. Haz clic en **"+ Nuevo Curso"**
3. Completa:
   - Nombre del curso
   - Descripción (opcional)
   - Nivel (A1, A2, B1, B2, C1, C2)
   - Máximo de estudiantes
4. Haz clic en **"Guardar"**

### Paso 3: Registrar Estudiantes
1. Ve a **"Estudiantes"**
2. Haz clic en **"+ Nuevo Estudiante"**
3. Completa:
   - Nombre
   - Email (opcional)
   - Teléfono (opcional)
4. Haz clic en **"Guardar"**

### Paso 4: Crear Matrículas (Asignar Estudiantes a Tutores)
1. Ve a **"Matrículas"**
2. Haz clic en **"+ Nueva Matrícula"**
3. Selecciona:
   - Estudiante
   - Curso
   - Tutor
4. Haz clic en **"Matricular"**

### Paso 5: Ver Dashboard
1. Ve a **"Dashboard"** (página principal)
2. Verás:
   - Estadísticas generales
   - Tutorías del día (selecciona una fecha)
   - Resumen de tutores

### Paso 6: Registrar Pagos
1. Ve a **"Pagos"**
2. En el formulario de pago, completa:
   - Tutor
   - Monto en ₡
   - Descripción (opcional)
3. Haz clic en **"Registrar Pago"**
4. Verás un resumen de todos los pagos registrados

## 📱 Funcionalidades Principales

### 📊 Dashboard
- **Vista rápida**: Estadísticas de tutores, estudiantes, cursos activos
- **Filtro por fecha**: Ver tutorías programadas para un día específico
- **Resumen de tutores**: Actividad diaria por tutor

### 👨‍🏫 Tutores
- Crear, editar o eliminar tutores
- Establecer especialidades y tarifas

### 📚 Cursos
- Crear cursos con diferentes niveles
- Especificar capacidad de estudiantes
- Organizar por especialidad

### 🎓 Estudiantes
- Registrar nuevos estudiantes
- Mantener información de contacto
- Ver historial de inscripciones

### ✏️ Matrículas
- Asignar estudiantes a tutores
- Vincular a cursos específicos
- Cancelar matrículas

### 💰 Pagos
- Registrar pagos realizados
- Seguimiento por tutor
- Resumen de ingresos

## 🔧 Troubleshooting

### El frontend no se conecta al backend
- Verifica que el backend esté corriendo en `http://localhost:5000`
- Revisa la consola del navegador (F12) para errores

### Error "Puerto ya en uso"
- Backend (5000):
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```
- Frontend (3000):
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

### Base de datos vacía
- Reinicia el servidor backend
- Verifica que `linguistika.db` exista en la carpeta `backend/`

## 📝 Notas Importantes

- La aplicación usa **SQLite** como base de datos (archivo local)
- Los datos se guardan en `backend/linguistika.db`
- Realiza copias de seguridad regularmente
- Por ahora no hay autenticación, así que todos tienen acceso

## 🎯 Próximas Características (Futuro)

- [ ] Sistema de autenticación y roles
- [ ] Exportar reportes en PDF
- [ ] Horarios recurrentes automáticos
- [ ] Notificaciones por email
- [ ] Gráficos de estadísticas
- [ ] Integración con Google Calendar

## 📞 Soporte

Si encuentras algún problema, verifica:
1. Que Node.js esté instalado (`node --version`)
2. Que npm esté actualizado (`npm --version`)
3. Los logs de la consola del navegador
4. Los logs del servidor en la terminal

---

¡Disfruta usando Linguistika! 🎉
