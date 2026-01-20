    -- ============================================
    -- SCHEMA SQL ACTUALIZADO PARA SUPABASE
    -- LINGUISTIKA ACADEMY - Versión 2.0
    -- ============================================
    -- Ejecuta este script en el SQL Editor de Supabase
    -- ============================================

    -- Habilitar extensiones necesarias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Tabla de Usuarios (autenticación y auditoría)
    CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        username TEXT UNIQUE,
        rol TEXT NOT NULL DEFAULT 'admin',
        estado BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
    );

    -- ============================================
    -- TABLA DE TUTORES (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS tutores (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE,
        telefono TEXT, -- Formato: +506 XXXX-XXXX
        especialidad TEXT NOT NULL,
        tarifa_por_hora DECIMAL(10,2) NOT NULL,
        horario_preferido TEXT,
        horario_tipo TEXT DEFAULT 'predefinido', -- 'predefinido' o 'custom'
        dias TEXT, -- JSON: ["Lunes", "Martes", ...] - opcional
        turno TEXT, -- 'Tarde libre', 'Noche libre', 'Custom' - opcional
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        estado BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE CURSOS (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS cursos (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        nivel TEXT NOT NULL DEFAULT 'None', -- 'None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
        tipo_clase TEXT DEFAULT 'grupal', -- 'grupal' o 'tutoria'
        max_estudiantes INTEGER, -- NULL si es tutoría (sin límite)
        dias TEXT, -- JSON: ["Lunes", "Martes", ...] - opcional
        turno TEXT, -- 'Tarde', 'Noche' - opcional
        dias_semana TEXT, -- Legacy: JSON array - opcional
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        estado BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE ESTUDIANTES (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS estudiantes (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT, -- Email del estudiante
        email_encargado TEXT, -- Email del encargado
        telefono TEXT, -- Teléfono del estudiante
        telefono_encargado TEXT, -- Teléfono del encargado (formato: +506 XXXX-XXXX)
        grado TEXT, -- '1ro', '2do', '3ro', ... '11mo'
        contacto_padres TEXT, -- Legacy field
        horario_preferido TEXT, -- Legacy field
        dias TEXT, -- JSON: ["Lunes", "Martes", ...] - opcional
        turno TEXT, -- 'Tarde', 'Noche' - opcional
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
        estado BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE MATRÍCULAS (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS matriculas (
        id BIGSERIAL PRIMARY KEY,
        estudiante_id BIGINT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
        tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
        estado BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE CLASES PROGRAMADAS (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS clases (
        id BIGSERIAL PRIMARY KEY,
        matricula_id BIGINT NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
        tutor_id BIGINT REFERENCES tutores(id) ON DELETE SET NULL,
        estudiante_id BIGINT REFERENCES estudiantes(id) ON DELETE SET NULL,
        curso_id BIGINT REFERENCES cursos(id) ON DELETE SET NULL,
        fecha DATE NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        estado TEXT DEFAULT 'programada', -- 'programada', 'completada', 'cancelada'
        notas TEXT,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE PAGOS (ACTUALIZADA)
    -- ============================================
    CREATE TABLE IF NOT EXISTS pagos (
        id BIGSERIAL PRIMARY KEY,
        tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
        clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
        cantidad_clases INTEGER,
        monto DECIMAL(10,2) NOT NULL,
        fecha_pago TIMESTAMPTZ DEFAULT NOW(),
        estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagado', 'cancelado'
        descripcion TEXT,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- TABLA DE HORAS DE TRABAJO
    -- ============================================
    CREATE TABLE IF NOT EXISTS horas_trabajo (
        id BIGSERIAL PRIMARY KEY,
        tutor_id BIGINT NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
        clase_id BIGINT REFERENCES clases(id) ON DELETE SET NULL,
        fecha DATE NOT NULL,
        horas DECIMAL(5,2) NOT NULL,
        tarifa_por_hora DECIMAL(10,2),
        monto DECIMAL(10,2),
        estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobado'
        notas TEXT,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================
    -- ÍNDICES PARA MEJORAR PERFORMANCE
    -- ============================================

    -- Tutores
    CREATE INDEX IF NOT EXISTS idx_tutores_estado ON tutores(estado);
    CREATE INDEX IF NOT EXISTS idx_tutores_especialidad ON tutores(especialidad);
    CREATE INDEX IF NOT EXISTS idx_tutores_email ON tutores(email);

    -- Cursos
    CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
    CREATE INDEX IF NOT EXISTS idx_cursos_nivel ON cursos(nivel);
    CREATE INDEX IF NOT EXISTS idx_cursos_tipo_clase ON cursos(tipo_clase);

    -- Estudiantes
    CREATE INDEX IF NOT EXISTS idx_estudiantes_estado ON estudiantes(estado);
    CREATE INDEX IF NOT EXISTS idx_estudiantes_grado ON estudiantes(grado);
    CREATE INDEX IF NOT EXISTS idx_estudiantes_email ON estudiantes(email);

    -- Matrículas
    CREATE INDEX IF NOT EXISTS idx_matriculas_estado ON matriculas(estado);
    CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante ON matriculas(estudiante_id);
    CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
    CREATE INDEX IF NOT EXISTS idx_matriculas_tutor ON matriculas(tutor_id);

    -- Clases
    CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases(fecha);
    CREATE INDEX IF NOT EXISTS idx_clases_estado ON clases(estado);
    CREATE INDEX IF NOT EXISTS idx_clases_matricula ON clases(matricula_id);
    CREATE INDEX IF NOT EXISTS idx_clases_tutor ON clases(tutor_id);

    -- Pagos
    CREATE INDEX IF NOT EXISTS idx_pagos_tutor ON pagos(tutor_id);
    CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
    CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);

    -- Horas de Trabajo
    CREATE INDEX IF NOT EXISTS idx_horas_tutor ON horas_trabajo(tutor_id);
    CREATE INDEX IF NOT EXISTS idx_horas_fecha ON horas_trabajo(fecha);
    CREATE INDEX IF NOT EXISTS idx_horas_estado ON horas_trabajo(estado);

    -- ============================================
    -- ROW LEVEL SECURITY (RLS) - OPCIONAL
    -- ============================================
    -- Habilita RLS para tablas
    ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE clases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE horas_trabajo ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- SEED DATA - USUARIO ADMIN (OPCIONAL)
    -- ============================================
    -- Nota: Primero crea un usuario en Authentication de Supabase con:
    -- Email: admin@linguistika.com
    -- Password: admin123
    -- Luego ejecuta:

    INSERT INTO usuarios (id, username, rol, estado)
    SELECT id, 'admin', 'admin', true
    FROM auth.users
    WHERE email = 'admin@linguistika.com'
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- DATOS DE EJEMPLO (OPCIONAL)
    -- ============================================
    -- Insertar tutor de ejemplo
    INSERT INTO tutores (nombre, email, telefono, especialidad, tarifa_por_hora, dias, turno, estado)
    VALUES (
        'María García',
        'maria@linguistika.com',
        '+506 8888-8888',
        'Inglés',
        15.00,
        '["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]',
        'Tarde libre',
        true
    ) ON CONFLICT DO NOTHING;

    -- Insertar curso de ejemplo
    INSERT INTO cursos (nombre, descripcion, nivel, tipo_clase, max_estudiantes, dias, turno, estado)
    VALUES (
        'English A1 - Intermediate',
        'Curso de inglés nivel intermedio',
        'A1',
        'grupal',
        15,
        '["Lunes", "Miércoles", "Viernes"]',
        'Noche',
        true
    ) ON CONFLICT DO NOTHING;

    -- Insertar estudiante de ejemplo
    INSERT INTO estudiantes (nombre, email, email_encargado, telefono_encargado, grado, dias, turno, estado)
    VALUES (
        'Juan Pérez',
        'juan@example.com',
        'padres@example.com',
        '+506 9999-9999',
        '5to',
        '["Lunes", "Martes", "Miércoles"]',
        'Tarde',
        true
    ) ON CONFLICT DO NOTHING;

    -- ============================================
    -- FIN DEL SCHEMA
    -- ============================================
