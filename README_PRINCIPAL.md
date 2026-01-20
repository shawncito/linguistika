# 🎓 Linguistika Academy v2.0

Sistema de gestión académica para escuela de idiomas con horarios flexibles por día.

## 📚 Documentación

### 🚀 Inicio Rápido
- **[00_COMIENZA_AQUI.md](00_COMIENZA_AQUI.md)** - Guía de inicio
- **[QUICKSTART.md](QUICKSTART.md)** - Setup rápido
- **[docs/00_COMIENZA_AQUI_DOCUMENTACION.md](docs/00_COMIENZA_AQUI_DOCUMENTACION.md)** - Índice de documentación

### 📖 Guías
- **[docs/guias/TUTORIAL_VISUAL_PASO_A_PASO.md](docs/guias/TUTORIAL_VISUAL_PASO_A_PASO.md)** - Tutorial con screenshots
- **[docs/guias/GUIA_SIGUIENTES_PASOS.md](docs/guias/GUIA_SIGUIENTES_PASOS.md)** - Próximos pasos detallados
- **[docs/guias/CHECKLIST_FINAL.md](docs/guias/CHECKLIST_FINAL.md)** - Checklist de implementación
- **[docs/guias/GUIA_DEPLOYMENT_v2.md](docs/guias/GUIA_DEPLOYMENT_v2.md)** - Deployment a producción

### 🔄 Migraciones
- **[docs/migraciones/SQL_MIGRATIONS_QUICK.md](docs/migraciones/SQL_MIGRATIONS_QUICK.md)** - Scripts SQL (EJECUTAR PRIMERO)
- **[docs/migraciones/FIX_RLS_POLICIES.sql](docs/migraciones/FIX_RLS_POLICIES.sql)** - Políticas RLS
- **[docs/migraciones/MIGRACION_TUTORES_DIAS_TURNO.sql](docs/migraciones/MIGRACION_TUTORES_DIAS_TURNO.sql)** - Columna dias_turno tutores
- **[docs/migraciones/MIGRACION_ESTUDIANTES_DIAS_TURNO.sql](docs/migraciones/MIGRACION_ESTUDIANTES_DIAS_TURNO.sql)** - Columna dias_turno estudiantes
- **[docs/migraciones/SCHEMA_LIMPIO_v2.0.sql](docs/migraciones/SCHEMA_LIMPIO_v2.0.sql)** - Schema completo v2.0

### 📊 Cambios y Features
- **[docs/RESUMEN_EJECUTIVO_HOY.md](docs/RESUMEN_EJECUTIVO_HOY.md)** - Resumen ejecutivo de cambios recientes
- **[docs/cambios/CAMBIOS_HOY_TUTORES_DIAS_TURNO.md](docs/cambios/CAMBIOS_HOY_TUTORES_DIAS_TURNO.md)** - Cambios en tutores
- **[docs/cambios/README_TUTORES_DIAS_TURNO.md](docs/cambios/README_TUTORES_DIAS_TURNO.md)** - Documentación técnica
- **[docs/cambios/FEATURES_v2.0.md](docs/cambios/FEATURES_v2.0.md)** - Features v2.0
- **[docs/cambios/RESUMEN_CAMBIOS_v2.0.md](docs/cambios/RESUMEN_CAMBIOS_v2.0.md)** - Resumen de todos los cambios

### ⚡ Referencias Rápidas
- **[docs/QUICK_REFERENCE.txt](docs/QUICK_REFERENCE.txt)** - Referencia de 1 página

---

## 🏗️ Arquitectura

### Backend (Node.js + Express + Supabase)
```
backend/
├── server.js              # Servidor principal
├── supabase.js            # Cliente Supabase
├── middleware/
│   └── auth.js           # Middleware de autenticación
└── routes/
    ├── auth.js           # Login/registro
    ├── tutores.js        # Gestión de docentes
    ├── cursos.js         # Gestión de cursos
    ├── estudiantes.js    # Gestión de estudiantes
    ├── matriculas.js     # Matrículas
    ├── pagos.js          # Pagos
    ├── dashboard.js      # Analytics
    └── horas-trabajo.js  # Horas trabajadas
```

### Frontend (React + TypeScript + Vite)
```
LInguistika-Studio/
├── App.tsx               # App principal
├── types.ts              # Tipos TypeScript
├── components/
│   └── UI.tsx           # Componentes UI
├── services/
│   └── api.ts           # API client
├── lib/
│   └── format.ts        # Utilidades de formato
└── views/
    ├── Login.tsx        # Login
    ├── Dashboard.tsx    # Dashboard
    ├── Tutores.tsx      # Gestión tutores
    ├── Cursos.tsx       # Gestión cursos
    ├── Estudiantes.tsx  # Gestión estudiantes
    ├── Matriculas.tsx   # Gestión matrículas
    └── Pagos.tsx        # Gestión pagos
```

---

## 🚀 Setup

### Prerequisitos
- Node.js 18+
- npm o yarn
- Cuenta en Supabase

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Configurar variables
npm run dev
```

### Frontend
```bash
cd LInguistika-Studio
npm install
npm run dev
```

### Base de Datos
1. Ir a [Supabase](https://supabase.com)
2. Ejecutar scripts en orden:
   - `docs/migraciones/FIX_RLS_POLICIES.sql`
   - `docs/migraciones/MIGRACION_TUTORES_DIAS_TURNO.sql`
   - `docs/migraciones/MIGRACION_ESTUDIANTES_DIAS_TURNO.sql`

---

## ✨ Features Principales

### 📅 Horarios Flexibles por Día
- Turnos diferentes para cada día (Tarde/Noche)
- Formato: `{ "Lunes": "Tarde", "Martes": "Noche", ... }`
- Aplica a: Tutores, Cursos, Estudiantes

### 👨‍🏫 Gestión de Docentes
- Validación de teléfono (+506 XXXX-XXXX)
- Especialidades múltiples
- Tarifa por hora personalizable
- Horarios flexibles por día

### 📚 Gestión de Cursos
- Niveles: None, A1-C2
- Tipos: Grupal, Tutoría (ilimitados estudiantes)
- Horarios flexibles
- Max estudiantes configurable

### 🎓 Gestión de Estudiantes
- Datos personales + encargado
- Email estudiante + email encargado
- Teléfono encargado
- Grado: 1ro-11mo
- Horarios preferidos por día

### 📊 Dashboard Dinámico
- Stats en tiempo real
- Agenda de sesiones
- Sesiones de hoy
- Carga de trabajo

### 💰 Gestión de Pagos
- Registro de pagos
- Estados: Pendiente/Pagado
- Historial completo

---

## 🔐 Seguridad

- RLS (Row Level Security) habilitado
- Autenticación con Supabase Auth
- JWT tokens
- Middleware de autenticación en todas las rutas

---

## 📝 Changelog

### v2.0 (Enero 2026)
- ✅ Horarios flexibles por día (dias_turno)
- ✅ Migración completa a Supabase
- ✅ Redesign completo de UI (React + TypeScript)
- ✅ Dashboard dinámico con stats
- ✅ Validaciones mejoradas
- ✅ RLS policies configuradas
- ✅ Documentación completa

---

## 🤝 Contribuir

Ver [GUIA_DEPLOYMENT_v2.md](docs/guias/GUIA_DEPLOYMENT_v2.md) para deployment.

---

## 📞 Soporte

Ver documentación en `docs/` para troubleshooting y guías detalladas.

---

**Versión:** 2.0  
**Última actualización:** Enero 2026  
**Status:** ✅ Producción Ready
