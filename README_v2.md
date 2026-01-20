# 🎓 Linguistika v2.0 - Sistema de Gestión de Tutorías

Sistema completo de gestión para centros de tutorías con horarios personalizados, seguimiento de sesiones y control financiero.

**Stack:** Node.js + Express + Supabase (PostgreSQL) + React + TypeScript + Vite

[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](backend/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)](LInguistika-Studio/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-orange)](https://supabase.com)

---

## 📁 Estructura del Proyecto

```
linguistika/
├── backend/                  # 🔧 API REST Node.js + Express
│   ├── docs/                # Documentación y migraciones SQL
│   ├── middleware/          # Autenticación JWT
│   ├── routes/              # Endpoints de la API
│   ├── server.js            # Servidor principal
│   └── README.md            # Documentación del backend
├── LInguistika-Studio/      # 🎨 Frontend React + TypeScript
│   ├── components/          # Componentes UI reutilizables
│   ├── services/            # Cliente API (Axios)
│   ├── views/               # Vistas principales
│   ├── types.ts             # Interfaces TypeScript
│   └── README.md            # Documentación del frontend
├── docs/                     # 📚 Documentación general
│   ├── guias/               # Guías de instalación y configuración
│   ├── migraciones/         # SQL scripts principales
│   ├── ESPECIFICACION_NUEVA_ESTRUCTURA.md
│   ├── GUIA_IMPLEMENTACION_PAGOS.md
│   └── RESUMEN_CAMBIOS_2026-01-19.md
└── README_v2.md             # Este archivo
```

---

## 🎯 Características Principales

### ✅ Implementado (v2.0)

#### 👨‍🏫 Gestión de Tutores
- ✅ Crear, editar y eliminar tutores
- ✅ Asignar especialidades (Inglés, Francés, Alemán, etc.)
- ✅ Gestionar días y turnos disponibles
- ✅ **NUEVO:** Eliminada tarifa por hora (ahora se paga por curso completo)

#### 📚 Gestión de Cursos con Horarios Personalizados
- ✅ Crear cursos con niveles (None, A1-C2)
- ✅ Tipos de clase: Individual o Grupal
- ✅ Establecer capacidad máxima de estudiantes
- ✅ **NUEVO:** Selector de días de la semana
- ✅ **NUEVO:** Turno personalizado por día (Tarde/Noche)
- ✅ **NUEVO:** Hora de inicio y fin por día
- ✅ **NUEVO:** Cálculo automático de duración
- ✅ **NUEVO:** Costo total del curso
- ✅ **NUEVO:** Pago al tutor por curso

#### 🎓 Gestión de Estudiantes
- ✅ Registrar nuevos estudiantes
- ✅ Mantener contacto y datos personales
- ✅ Visualizar matrículas activas

#### ✏️ Sistema de Matrículas
- ✅ Matricular estudiantes en cursos
- ✅ Asignar tutores específicos
- ✅ Gestionar estado de matrículas

#### 💰 Sistema de Pagos (Básico)
- ✅ Registrar pagos de estudiantes
- ✅ Historial de transacciones

### ⏳ En Desarrollo

#### 📅 Sistema de Sesiones de Clases
- ⏳ Generar sesiones automáticamente desde `dias_schedule`
- ⏳ Marcar sesiones como "dada" (completada)
- ⏳ Vista de calendario con sesiones programadas
- ⏳ Validación de disponibilidad de tutor

#### 💸 Sistema de Movimientos de Dinero
- ⏳ Registro de ingresos (facturas de estudiantes)
- ⏳ Registro de egresos (pagos a tutores)
- ⏳ Calcular automáticamente pago al tutor al marcar sesión "dada"
- ⏳ Dashboard con balance (ingresos - egresos)
- ⏳ Reportes financieros por curso

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ y npm
- Cuenta de Supabase (gratis)
- Git

### 1. Clonar Repositorios
```bash
# Clonar backend
git clone https://github.com/shawncito/linguistika.git
cd linguistika

# Clonar frontend (submódulo)
git clone https://github.com/shawncito/LInguistika-Studio.git
```

### 2. Configurar Backend
```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tus credenciales de Supabase
npm run dev
```

**Ver:** [backend/README.md](backend/README.md) para detalles completos

### 3. Ejecutar Migraciones SQL
En Supabase SQL Editor, ejecuta en orden:
1. `backend/docs/migraciones/supabase-schema.sql`
2. `docs/migraciones/MIGRACION_CURSOS_COMPLETA.sql`
3. `docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql`

### 4. Configurar Frontend
```bash
cd ../LInguistika-Studio
npm install
npm run dev
```

**Ver:** [LInguistika-Studio/README.md](LInguistika-Studio/README.md) para detalles

---

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro

### Recursos Principales
- `GET/POST/PUT/DELETE /api/tutores` - Tutores
- `GET/POST/PUT/DELETE /api/cursos` - Cursos (con `dias_schedule`)
- `GET/POST/PUT/DELETE /api/estudiantes` - Estudiantes
- `GET/POST/PUT/DELETE /api/matriculas` - Matrículas
- `GET/POST/PUT/DELETE /api/pagos` - Pagos
- `GET /api/dashboard/stats` - Estadísticas

### Próximamente
- `POST /api/sesiones/generar` - Generar sesiones desde curso
- `PATCH /api/sesiones/:id/marcar-dada` - Marcar sesión completada
- `POST /api/sesiones/registrar-factura` - Registrar ingreso

---

## 🗄️ Modelo de Datos (v2.0)

### Tablas Principales

#### `tutores`
```sql
- id, nombre, email, telefono
- especialidad (Inglés, Francés, etc.)
- dias, dias_turno (Tarde/Noche)
- [ELIMINADO] tarifa_por_hora
```

#### `cursos` ⭐ Actualizado
```sql
- id, nombre, descripcion, nivel (None/A1-C2)
- tipo_clase (grupal/individual)
- max_estudiantes
- dias (Array: ["Lunes", "Martes"])
- dias_turno (Object: {"Lunes": "Tarde"})
- dias_schedule (JSONB): 🆕
  {
    "Lunes": {
      "turno": "Tarde",
      "hora_inicio": "14:00",
      "hora_fin": "17:00",
      "duracion_horas": 3
    }
  }
- costo_curso 🆕
- pago_tutor 🆕
```

#### `sesiones_clases` 🆕 (SQL listo, endpoints pendientes)
```sql
- id, curso_id, tutor_id
- fecha, dia_semana
- hora_inicio, hora_fin, duracion_horas
- estado (programada/dada/cancelada)
- notas
```

#### `movimientos_dinero` 🆕 (SQL listo, endpoints pendientes)
```sql
- id, curso_id, matricula_id, tutor_id, sesion_id
- tipo (ingreso_estudiante/pago_tutor)
- monto, factura_numero
- fecha_pago, fecha_comprobante
- estado (pendiente/completado/verificado)
```

---

## 📚 Documentación Completa

### Guías de Instalación
- [00_COMIENZA_AQUI.md](docs/guias/00_COMIENZA_AQUI.md) - Guía inicial
- [GUIA_WINDOWS.md](docs/guias/GUIA_WINDOWS.md) - Instalación en Windows
- [QUICKSTART.md](docs/guias/QUICKSTART.md) - Inicio rápido

### Documentación Técnica
- [ESPECIFICACION_NUEVA_ESTRUCTURA.md](docs/ESPECIFICACION_NUEVA_ESTRUCTURA.md) - Especificación v2.0
- [GUIA_IMPLEMENTACION_PAGOS.md](docs/GUIA_IMPLEMENTACION_PAGOS.md) - Guía de implementación
- [RESUMEN_CAMBIOS_2026-01-19.md](docs/RESUMEN_CAMBIOS_2026-01-19.md) - Changelog detallado

### Migraciones SQL
- [supabase-schema.sql](backend/docs/migraciones/supabase-schema.sql) - Schema base
- [MIGRACION_CURSOS_COMPLETA.sql](docs/migraciones/MIGRACION_CURSOS_COMPLETA.sql) - Actualización cursos
- [MIGRACION_SESIONES_MOVIMIENTOS.sql](docs/migraciones/MIGRACION_SESIONES_MOVIMIENTOS.sql) - Nuevas tablas

---

## 🔄 Cambios Recientes (19 Enero 2026)

### ✅ Completado
- ✅ Eliminado `tarifa_por_hora` de tutores (Frontend, Backend, DB)
- ✅ Agregado `dias_schedule` con horarios personalizados en cursos
- ✅ Implementado selector de turno (Tarde/Noche) por día
- ✅ Agregado inputs de hora_inicio y hora_fin
- ✅ Cálculo automático de duración en horas
- ✅ Agregado `costo_curso` y `pago_tutor` a cursos
- ✅ Creadas tablas `sesiones_clases` y `movimientos_dinero` (SQL)
- ✅ Documentación completa (4 archivos, 1500+ líneas)
- ✅ Fix: Separación de `resetForm()` y `handleEdit()` en Cursos.tsx

### ⏳ Pendiente
- ⏳ Crear `backend/routes/sesiones.js` con 3 endpoints
- ⏳ Actualizar `views/Pagos.tsx` con nuevo UI
- ⏳ Implementar validación de disponibilidad en Matriculas
- ⏳ Testing end-to-end completo

---

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** 18+ - Runtime
- **Express** - Framework web
- **Supabase** - PostgreSQL + Auth + RLS
- **JWT** - Autenticación
- **Nodemon** - Hot reload

### Frontend
- **React** 18 - UI Library
- **TypeScript** - Tipado estático
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Iconos
- **Axios** - HTTP client

### Base de Datos
- **PostgreSQL** (Supabase)
- **JSONB** - Datos flexibles (dias_schedule)
- **RLS Policies** - Seguridad a nivel de filas

---

## 📝 Scripts Disponibles

### Backend
```bash
npm run dev    # Desarrollo con nodemon
npm start      # Producción
```

### Frontend
```bash
npm run dev    # Desarrollo Vite (puerto 5173)
npm run build  # Build para producción
npm run preview # Preview del build
```

---

## 🐛 Troubleshooting

### Error: "connect ECONNREFUSED"
**Solución:** Verifica `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `.env`

### Error: "JWT malformed"
**Solución:** Regenera token desde `/api/auth/login`

### Error: "relation does not exist"
**Solución:** Ejecuta las migraciones SQL en Supabase

### Warnings: "Duplicate keys"
**Solución:** Ya corregido en commit `f3cf536`

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'feat: Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es de código cerrado. Todos los derechos reservados.

---

## 👥 Autores

- **Rey** - Desarrollo inicial y v2.0

---

## 📞 Soporte

Para soporte o preguntas:
- 📧 Email: [Tu email]
- 📂 Issues: [GitHub Issues](https://github.com/shawncito/linguistika/issues)

---

**Versión:** 2.0  
**Última actualización:** 19 Enero 2026  
**Estado:** ✅ Frontend + Backend listos | ⏳ Sesiones/Movimientos pendientes
