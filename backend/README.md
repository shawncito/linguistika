# 🔧 Backend - Linguistika v2.0

Backend Node.js + Express + Supabase para el sistema de gestión de tutorías Linguistika.

## 📁 Estructura del Proyecto

```
backend/
├── docs/                      # 📚 Documentación completa
│   ├── guias/                # Guías de configuración y uso
│   ├── migraciones/          # Scripts SQL para base de datos
│   ├── MIGRACION-COMPLETADA.md
│   └── RESUMEN-FINAL.md
├── middleware/               # Middleware de autenticación
│   └── auth.js
├── routes/                   # Rutas de la API
│   ├── auth.js              # Login/registro
│   ├── cursos.js            # Gestión de cursos
│   ├── dashboard.js         # Estadísticas
│   ├── estudiantes.js       # Gestión de estudiantes
│   ├── horarios.js          # Horarios
│   ├── horas-trabajo.js     # Registro de horas
│   ├── matriculas.js        # Matrículas
│   ├── pagos.js             # Gestión de pagos
│   └── tutores.js           # Gestión de tutores
├── .env                      # Variables de entorno (NO SUBIR)
├── .env.example             # Ejemplo de configuración
├── database.js              # Conexión SQLite (legacy)
├── migrate-data.js          # Script de migración
├── server.js                # Servidor Express
├── supabase.js              # Cliente Supabase
└── package.json             # Dependencias

```

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copia `.env.example` a `.env` y configura:
```env
SUPABASE_URL=tu-url-de-supabase
SUPABASE_ANON_KEY=tu-clave-anonima
JWT_SECRET=tu-secreto-jwt
PORT=3000
```

### 3. Ejecutar migraciones SQL
Ve a Supabase SQL Editor y ejecuta en orden:
1. `docs/migraciones/supabase-schema.sql` - Schema base
2. `docs/migraciones/MIGRACION_CURSOS_COMPLETA.sql` - Actualización de cursos
3. `docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql` - Tablas de sesiones y pagos

### 4. Iniciar servidor
```bash
npm run dev
```

Servidor corriendo en: `http://localhost:3000`

## 📡 Endpoints Disponibles

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario

### Tutores
- `GET /api/tutores` - Listar todos los tutores
- `POST /api/tutores` - Crear tutor
- `PUT /api/tutores/:id` - Actualizar tutor
- `DELETE /api/tutores/:id` - Eliminar tutor

### Cursos
- `GET /api/cursos` - Listar todos los cursos
- `GET /api/cursos/:id` - Obtener curso específico
- `POST /api/cursos` - Crear curso (con dias_schedule)
- `PUT /api/cursos/:id` - Actualizar curso
- `DELETE /api/cursos/:id` - Eliminar curso

### Estudiantes
- `GET /api/estudiantes` - Listar estudiantes
- `POST /api/estudiantes` - Crear estudiante
- `PUT /api/estudiantes/:id` - Actualizar estudiante
- `DELETE /api/estudiantes/:id` - Eliminar estudiante

### Matrículas
- `GET /api/matriculas` - Listar matrículas
- `POST /api/matriculas` - Crear matrícula
- `PUT /api/matriculas/:id` - Actualizar matrícula
- `DELETE /api/matriculas/:id` - Eliminar matrícula

### Pagos
- `GET /api/pagos` - Listar pagos
- `POST /api/pagos` - Registrar pago
- `PUT /api/pagos/:id` - Actualizar pago
- `DELETE /api/pagos/:id` - Eliminar pago

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales

## 🔐 Seguridad

- **JWT Authentication**: Todas las rutas protegidas requieren token JWT
- **RLS Policies**: Row Level Security habilitado en Supabase
- **CORS**: Configurado para frontend en desarrollo y producción

## 🗄️ Base de Datos

### Tablas Principales
- `tutores` - Información de tutores (sin tarifa_por_hora)
- `cursos` - Cursos con horarios personalizados (dias_schedule)
- `estudiantes` - Estudiantes registrados
- `matriculas` - Relación estudiante-curso
- `pagos` - Pagos de estudiantes
- `sesiones_clases` - Sesiones programadas/dadas ⚠️ PENDIENTE IMPLEMENTAR
- `movimientos_dinero` - Flujo de ingresos/egresos ⚠️ PENDIENTE IMPLEMENTAR

### Nuevos Campos (v2.0)
- `cursos.dias_schedule` (JSONB) - Horarios personalizados por día
  ```json
  {
    "Lunes": {
      "turno": "Tarde",
      "hora_inicio": "14:00",
      "hora_fin": "17:00",
      "duracion_horas": 3
    }
  }
  ```
- `cursos.costo_curso` - Costo total del curso
- `cursos.pago_tutor` - Pago al tutor por curso

## 📚 Documentación Adicional

- **[GUIA-SUPABASE.md](docs/guias/GUIA-SUPABASE.md)** - Configuración de Supabase
- **[CHECKLIST-SUPABASE.md](docs/guias/CHECKLIST-SUPABASE.md)** - Checklist de migración
- **[MIGRACION-COMPLETADA.md](docs/MIGRACION-COMPLETADA.md)** - Resumen de migración
- **[docs/migraciones/](docs/migraciones/)** - Scripts SQL completos

## 🛠️ Scripts Disponibles

```bash
npm run dev    # Iniciar en modo desarrollo (nodemon)
npm start      # Iniciar en producción
```

## 🐛 Troubleshooting

### Error: "connect ECONNREFUSED"
- Verifica que las variables SUPABASE_URL y SUPABASE_ANON_KEY estén correctas
- Asegúrate de tener conexión a internet

### Error: "JWT malformed"
- Verifica JWT_SECRET en .env
- Regenera el token desde el login

### Error: "relation does not exist"
- Ejecuta las migraciones SQL en Supabase SQL Editor

## 📝 Cambios Recientes (19 Enero 2026)

✅ Eliminado `tarifa_por_hora` de tutores  
✅ Agregado `dias_schedule` a cursos  
✅ Agregado `costo_curso` y `pago_tutor` a cursos  
✅ Creadas tablas `sesiones_clases` y `movimientos_dinero` (SQL listo)  
⏳ Pendiente: Endpoints para sesiones y movimientos

---

**Versión:** 2.0  
**Última actualización:** 19 Enero 2026
