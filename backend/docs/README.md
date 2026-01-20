# Linguistika Backend

Backend API REST para la aplicación de gestión de horarios y tutorías.

## 🚀 MIGRACIÓN A SUPABASE COMPLETADA

✅ El proyecto ha sido **migrado completamente de SQLite a Supabase (PostgreSQL)**

### 📖 Guías de Configuración

1. **[MIGRACION-COMPLETADA.md](./MIGRACION-COMPLETADA.md)** - Resumen de la migración y próximos pasos
2. **[GUIA-SUPABASE.md](./GUIA-SUPABASE.md)** - Guía detallada paso a paso

### ⚡ Quick Start (15 minutos)

```bash
# 1. Crear proyecto en Supabase (https://app.supabase.com)
# 2. Ejecutar schema SQL (copiar contenido de supabase-schema.sql al SQL Editor)
# 3. Configurar variables de entorno en .env
# 4. Instalar dependencias
npm install

# 5. Iniciar servidor
npm run dev
```

**Credenciales de prueba:**
- Usuario: `admin`
- Contraseña: `admin123`

---

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:5000`

## Endpoints de la API

### Tutores
- `GET /api/tutores` - Obtener todos los tutores
- `GET /api/tutores/:id` - Obtener un tutor por ID
- `POST /api/tutores` - Crear nuevo tutor
- `PUT /api/tutores/:id` - Actualizar tutor
- `DELETE /api/tutores/:id` - Desactivar tutor

### Cursos
- `GET /api/cursos` - Obtener todos los cursos
- `GET /api/cursos/:id` - Obtener un curso por ID
- `POST /api/cursos` - Crear nuevo curso
- `PUT /api/cursos/:id` - Actualizar curso
- `DELETE /api/cursos/:id` - Desactivar curso

### Estudiantes
- `GET /api/estudiantes` - Obtener todos los estudiantes
- `GET /api/estudiantes/:id` - Obtener un estudiante por ID
- `POST /api/estudiantes` - Crear nuevo estudiante
- `PUT /api/estudiantes/:id` - Actualizar estudiante
- `DELETE /api/estudiantes/:id` - Desactivar estudiante

### Matrículas
- `GET /api/matriculas` - Obtener todas las matrículas
- `GET /api/matriculas/:id` - Obtener una matrícula por ID
- `POST /api/matriculas` - Crear nueva matrícula
- `PUT /api/matriculas/:id` - Actualizar matrícula
- `DELETE /api/matriculas/:id` - Desactivar matrícula

### Horarios
- `GET /api/horarios/tutor/:tutor_id` - Obtener horarios de un tutor
- `POST /api/horarios` - Crear nuevo horario
- `PUT /api/horarios/:id` - Actualizar horario
- `DELETE /api/horarios/:id` - Desactivar horario
- `GET /api/horarios/clases/todas` - Obtener todas las clases
- `POST /api/horarios/clases/crear` - Crear nueva clase (tutoría)

### Pagos
- `GET /api/pagos` - Obtener todos los pagos
- `GET /api/pagos/tutor/:tutor_id` - Obtener pagos de un tutor
- `POST /api/pagos` - Registrar nuevo pago
- `POST /api/pagos/calcular` - Calcular pago automático
- `PUT /api/pagos/:id` - Actualizar pago

### Dashboard
- `GET /api/dashboard/tutorías/:fecha` - Obtener tutorías del día
- `GET /api/dashboard/resumen-tutores/:fecha` - Resumen de tutores
- `GET /api/dashboard/estadisticas/general` - Estadísticas generales

## Estructura de Base de Datos

### Tabla: tutores
```sql
- id (INTEGER PRIMARY KEY)
- nombre (TEXT)
- email (TEXT)
- telefono (TEXT)
- especialidad (TEXT)
- tarifa_por_hora (REAL)
- estado (BOOLEAN)
- created_at (DATETIME)
```

### Tabla: cursos
```sql
- id (INTEGER PRIMARY KEY)
- nombre (TEXT)
- descripcion (TEXT)
- nivel (TEXT)
- max_estudiantes (INTEGER)
- estado (BOOLEAN)
- created_at (DATETIME)
```

### Tabla: estudiantes
```sql
- id (INTEGER PRIMARY KEY)
- nombre (TEXT)
- email (TEXT)
- telefono (TEXT)
- fecha_inscripcion (DATETIME)
- estado (BOOLEAN)
- created_at (DATETIME)
```

### Tabla: matriculas
```sql
- id (INTEGER PRIMARY KEY)
- estudiante_id (FK)
- curso_id (FK)
- tutor_id (FK)
- fecha_inscripcion (DATETIME)
- estado (BOOLEAN)
- created_at (DATETIME)
```

### Tabla: horarios_tutores
```sql
- id (INTEGER PRIMARY KEY)
- tutor_id (FK)
- dia_semana (TEXT)
- hora_inicio (TEXT)
- hora_fin (TEXT)
- estado (BOOLEAN)
- created_at (DATETIME)
```

### Tabla: clases
```sql
- id (INTEGER PRIMARY KEY)
- matricula_id (FK)
- fecha (DATE)
- hora_inicio (TEXT)
- hora_fin (TEXT)
- estado (TEXT)
- notas (TEXT)
- created_at (DATETIME)
```

### Tabla: pagos
```sql
- id (INTEGER PRIMARY KEY)
- tutor_id (FK)
- clase_id (FK)
- cantidad_clases (INTEGER)
- monto (REAL)
- fecha_pago (DATETIME)
- estado (TEXT)
- descripcion (TEXT)
- created_at (DATETIME)
```

## Variables de Entorno (.env)

```
PORT=5000
NODE_ENV=development
DATABASE=./linguistika.db
```

## Ejemplos de Requests

### Crear Tutor
```bash
curl -X POST http://localhost:5000/api/tutores \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "María García",
    "email": "maria@example.com",
    "telefono": "+34 123456789",
    "especialidad": "Inglés",
    "tarifa_por_hora": 25
  }'
```

### Crear Matrícula
```bash
curl -X POST http://localhost:5000/api/matriculas \
  -H "Content-Type: application/json" \
  -d '{
    "estudiante_id": 1,
    "curso_id": 1,
    "tutor_id": 1
  }'
```

### Registrar Pago
```bash
curl -X POST http://localhost:5000/api/pagos \
  -H "Content-Type: application/json" \
  -d '{
    "tutor_id": 1,
    "monto": 100,
    "descripcion": "Clases semana 1"
  }'
```

## Respuestas de Error

La API devuelve códigos de estado HTTP apropiados:

- `200` - Éxito
- `201` - Creado
- `400` - Solicitud incorrecta
- `404` - No encontrado
- `500` - Error del servidor

Las respuestas de error incluyen un mensaje descriptivo:
```json
{
  "error": "Descripción del error"
}
```

## Tecnologías

- Node.js
- Express.js
- SQLite3
- CORS
- Body Parser

## Notas

- La base de datos SQLite se crea automáticamente al iniciar el servidor
- Las claves foráneas están habilitadas
- Se validan los datos requeridos en cada endpoint
- Los registros pueden desactivarse (soft delete) en lugar de eliminarse
