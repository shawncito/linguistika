# Linguistika - Gestor de Horarios y Tutorías para Centro de Idiomas

**Versión:** 0.2.0-alpha  
**Estado:** En desarrollo activo  
**Última actualización:** 16 de febrero de 2026

Una aplicación de escritorio completa (Electron) para gestionar eficientemente un centro de idiomas. Permite administrar tutores, cursos, estudiantes, horarios de tutorías, pagos y tesorería.

---

## 📦 Novedades v0.2.0-alpha

- ✅ **Nuevo módulo de Tesorería** (en progreso):
  - Cobros grupales simplificados
  - Libro auxiliar con historial de movimientos
  - Totales rápidos: dinero actual, deuda pendiente, saldos
- ✅ Login mejorado con correos guardados
- ✅ Lista de empleados muestra emails
- ✅ Múltiples correcciones de bugs y optimizaciones

Ver [CHANGELOG_v0.2.0-alpha.md](CHANGELOG_v0.2.0-alpha.md) para detalles completos.

---

## 📚 Documentación

- **Índice completo**: [docs/INDICE_DOCUMENTACION.md](docs/INDICE_DOCUMENTACION.md)
- **Guía de usuario**: [docs/GUIA_USUARIO_COMPLETA.md](docs/GUIA_USUARIO_COMPLETA.md)  
- **Tesorería v2**: [docs/TESORERIA_V2.md](docs/TESORERIA_V2.md)
- **Changelog actual**: [CHANGELOG_v0.2.0-alpha.md](CHANGELOG_v0.2.0-alpha.md)

---

## 🎯 Características Principales

### 👨‍🏫 Gestión de Tutores
- Crear, editar y eliminar tutores
- Asignar especialidades (Inglés, Francés, Alemán, etc.)
- Establecer tarifas por hora
- Visualizar información de contacto

### 📚 Gestión de Cursos
- Crear cursos con niveles (A1-C2)
- Establecer capacidad máxima de estudiantes
- Gestionar descripciones y contenido
- Organizar por especialidad de idioma

### 🎓 Gestión de Estudiantes
- Registrar nuevos estudiantes
- Mantener contacto y datos personales
- Seguimiento de inscripciones
- Historial de matrículas

### ✏️ Sistema de Matrículas
- Matricular estudiantes en cursos
- Asignar tutores específicos
- Visualizar todas las matrículas activas
- Cancelar matrículas cuando sea necesario

### 📅 Dashboard de Horarios
- Vista diaria de tutorías programadas
- Información detallada por clase (horario, estudiante, tutor, curso)
- Resumen de actividad por tutor
- Estadísticas generales del centro

### 💰 Gestión de Pagos
- Registrar pagos a tutores
- Calcular automáticamente basado en horas dictadas
- Registrar estado del pago (pendiente/pagado)
- Generar reportes de ingresos

## 🛠️ Tecnologías Utilizadas

### Backend
+ **Node.js** - Runtime de JavaScript
+ **Express.js** - Framework web
+ **Supabase** - Base de datos PostgreSQL y autenticación
+ **CORS** - Para comunicación entre frontend y backend
+
+### Frontend
+ **React 18** - Librería UI
+ **TypeScript** - Tipado estático
+ **Vite** - Build tool y dev server
+ **Tailwind CSS** - Framework CSS
+
+## 📁 Estructura del Proyecto
+
+```
+linguistika/
+├── backend/                 # API Node.js + Express
+│   ├── routes/             # Endpoints por entidad
+│   ├── middleware/         # Auth y validaciones
+│   ├── migrate.js          # Herramienta de migración DB
+│   └── server.js           # Punto de entrada
+├── LInguistika-Studio/     # Frontend React + TypeScript
+│   ├── components/         # Componentes reutilizables
+│   ├── views/              # Vistas principales
+│   ├── services/           # API client
+│   └── types.ts            # Tipos TypeScript
+└── CHANGELOG.md            # Historial de cambios
+```

### Frontend
- **React** - Librería de UI
- **Vite** - Build tool y dev server
- **React Router** - Enrutamiento
- **Axios** - Cliente HTTP

## 📦 Estructura del Proyecto

```
linguistika/
├── backend/
│   ├── routes/              # Rutas de API
│   │   ├── tutores.js
│   │   ├── cursos.js
│   │   ├── estudiantes.js
│   │   ├── matriculas.js
│   │   ├── horarios.js
│   │   ├── pagos.js
│   │   └── dashboard.js
│   ├── database.js          # Configuración de BD
│   ├── server.js            # Servidor principal
│   ├── .env                 # Variables de entorno
│   └── package.json
│
├── LInguistika-Studio/      # Frontend activo (React/Vite)
│   ├── views/
│   ├── components/
│   ├── services/
│   ├── index.html
│   ├── index.tsx
│   └── package.json
│
└── README.md
```

## 🚀 Instalación y Uso

### Requisitos
- Node.js 16 o superior
- npm 8 o superior

### Instalación del Backend

```bash
cd backend
npm install
```

### Instalación del Frontend

```bash
cd LInguistika-Studio
npm install
```

### Ejecutar en Desarrollo

**Opción 1: Ejecutar ambos simultáneamente (desde la raíz)**
```bash
npm run dev
```

**Opción 2: Ejecutar por separado**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev:frontend
```

El frontend estará disponible en: `http://localhost:3000`
El backend estará disponible en: `http://localhost:5000`

### Construcción para Producción

```bash
npm run build
```

## 📊 Base de Datos

La aplicación utiliza **Supabase (PostgreSQL)** con las siguientes tablas (entre otras):

- **tutores** - Información de tutores y tarifas
- **cursos** - Cursos disponibles
- **estudiantes** - Registro de estudiantes
- **matriculas** - Relación estudiante-curso-tutor
- **horarios_tutores** - Horarios disponibles de tutores
- **clases** - Tutorías programadas
- **pagos** - Registro de pagos a tutores

## 🔄 Flujo de Uso

1. **Crear Tutores**: Registra tutores con especialidades y tarifas
2. **Crear Cursos**: Define los cursos disponibles
3. **Registrar Estudiantes**: Inscribe estudiantes en el centro
4. **Crear Matrículas**: Asigna estudiantes a tutores en cursos específicos
5. **Programar Clases**: Crea tutorías basadas en horarios disponibles
6. **Registrar Pagos**: Documenta los pagos realizados a tutores
7. **Consultar Dashboard**: Visualiza el resumen y estadísticas diarias

## 🎨 Interfaz de Usuario

- **Diseño responsivo** - Funciona en desktop, tablet y móvil
- **Navbar intuitivo** - Navegación fácil entre secciones
- **Formularios validados** - Validación en cliente y servidor
- **Cards y grillas** - Presentación visual atractiva
- **Tablas interactivas** - Datos organizados y fáciles de consultar
- **Alertas visuales** - Feedback claro de acciones

## 📈 Próximas Mejoras Sugeridas

- Autenticación y control de acceso
- Exportar reportes en PDF
- Notificaciones por email
- Integración con calendario (Google Calendar)
- Sistema de backup automático
- Gráficos de estadísticas
- Multi-idioma
- Modo oscuro

## 📝 Licencia

Privado - Linguistika Centro de Idiomas

## 👨‍💻 Soporte

Para reportar problemas o sugerir mejoras, contacta al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2026
