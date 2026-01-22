# Script para roundtrip completo
$baseUrl = "http://localhost:5000"

# Headers
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "=== ROUNDTRIP COMPLETO ===" -ForegroundColor Yellow
Write-Host ""

# 1. CREAR TUTOR
Write-Host "1️⃣ CREAR TUTOR" -ForegroundColor Green
$tutorData = @{
    nombre = "María García"
    especialidad = "Francés"
    email = "maria@example.com"
    telefono = "1234567890"
    dias = @("Lunes", "Martes", "Miércoles")
    dias_horarios = @{
        "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
        "Miércoles" = @{hora_inicio = "10:00"; hora_fin = "12:00"}
    }
} | ConvertTo-Json -Depth 10

$tutorResponse = Invoke-WebRequest -Uri "$baseUrl/tutores" -Method POST -Headers $headers -Body $tutorData
$tutor = $tutorResponse.Content | ConvertFrom-Json
Write-Host "✅ Tutor creado: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Cyan
Write-Host ""

# 2. CREAR ALUMNOS
Write-Host "2️⃣ CREAR ALUMNOS" -ForegroundColor Green

$estudiante1Data = @{
    nombre = "Juan Pérez"
    grado = "Intermedio"
    email = "juan@example.com"
    telefono = "0987654321"
    dias = @("Lunes", "Martes")
} | ConvertTo-Json -Depth 10

$estudiante1Response = Invoke-WebRequest -Uri "$baseUrl/estudiantes" -Method POST -Headers $headers -Body $estudiante1Data
$estudiante1 = $estudiante1Response.Content | ConvertFrom-Json
Write-Host "✅ Alumno 1 creado: $($estudiante1.nombre) (ID: $($estudiante1.id))" -ForegroundColor Cyan

$estudiante2Data = @{
    nombre = "Ana López"
    grado = "Principiante"
    email = "ana@example.com"
    telefono = "5551234567"
    dias = @("Martes", "Miércoles")
} | ConvertTo-Json -Depth 10

$estudiante2Response = Invoke-WebRequest -Uri "$baseUrl/estudiantes" -Method POST -Headers $headers -Body $estudiante2Data
$estudiante2 = $estudiante2Response.Content | ConvertFrom-Json
Write-Host "✅ Alumno 2 creado: $($estudiante2.nombre) (ID: $($estudiante2.id))" -ForegroundColor Cyan
Write-Host ""

# 3. CREAR CURSO CON TUTOR COMPATIBLE
Write-Host "3️⃣ CREAR CURSO CON TUTOR ASIGNADO" -ForegroundColor Green

$cursoData = @{
    nombre = "Francés Avanzado A1"
    nivel = "Avanzado"
    tipo_clase = "grupal"
    costo_curso = 15000
    pago_tutor = 5000
    dias = @("Lunes", "Martes")
    dias_schedule = @{
        "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
    }
    tutor_id = $tutor.id
} | ConvertTo-Json -Depth 10

$cursoResponse = Invoke-WebRequest -Uri "$baseUrl/cursos" -Method POST -Headers $headers -Body $cursoData
$curso = $cursoResponse.Content | ConvertFrom-Json
Write-Host "✅ Curso creado: $($curso.nombre) con Tutor: María García (ID: $($curso.id))" -ForegroundColor Cyan
Write-Host ""

# 4. CREAR MATRICULAS
Write-Host "4️⃣ CREAR MATRÍCULAS" -ForegroundColor Green

$matricula1Data = @{
    estudiante_id = $estudiante1.id
    curso_id = $curso.id
    tutor_id = $tutor.id
    es_grupo = $false
    grupo_nombre = $null
} | ConvertTo-Json -Depth 10

$matricula1Response = Invoke-WebRequest -Uri "$baseUrl/matriculas" -Method POST -Headers $headers -Body $matricula1Data
$matricula1 = $matricula1Response.Content | ConvertFrom-Json
Write-Host "✅ Matrícula 1: Juan Pérez -> Francés Avanzado (ID: $($matricula1.id))" -ForegroundColor Cyan

$matricula2Data = @{
    estudiante_id = $estudiante2.id
    curso_id = $curso.id
    tutor_id = $tutor.id
    es_grupo = $false
    grupo_nombre = $null
} | ConvertTo-Json -Depth 10

$matricula2Response = Invoke-WebRequest -Uri "$baseUrl/matriculas" -Method POST -Headers $headers -Body $matricula2Data
$matricula2 = $matricula2Response.Content | ConvertFrom-Json
Write-Host "✅ Matrícula 2: Ana López -> Francés Avanzado (ID: $($matricula2.id))" -ForegroundColor Cyan
Write-Host ""

# 5. VERIFICAR DATOS EN BASE DE DATOS
Write-Host "5️⃣ VERIFICAR DATOS EN BASE DE DATOS" -ForegroundColor Green

$allTutores = (Invoke-WebRequest -Uri "$baseUrl/tutores" -Method GET -Headers $headers).Content | ConvertFrom-Json
Write-Host "📊 Total de tutores: $($allTutores.Count)" -ForegroundColor Cyan

$allEstudiantes = (Invoke-WebRequest -Uri "$baseUrl/estudiantes" -Method GET -Headers $headers).Content | ConvertFrom-Json
Write-Host "📊 Total de alumnos: $($allEstudiantes.Count)" -ForegroundColor Cyan

$allCursos = (Invoke-WebRequest -Uri "$baseUrl/cursos" -Method GET -Headers $headers).Content | ConvertFrom-Json
Write-Host "📊 Total de cursos: $($allCursos.Count)" -ForegroundColor Cyan

$allMatriculas = (Invoke-WebRequest -Uri "$baseUrl/matriculas" -Method GET -Headers $headers).Content | ConvertFrom-Json
Write-Host "📊 Total de matrículas: $($allMatriculas.Count)" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== RESUMEN DEL ROUNDTRIP ===" -ForegroundColor Yellow
Write-Host "✅ Tutor: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Green
Write-Host "✅ Alumno 1: $($estudiante1.nombre) (ID: $($estudiante1.id))" -ForegroundColor Green
Write-Host "✅ Alumno 2: $($estudiante2.nombre) (ID: $($estudiante2.id))" -ForegroundColor Green
Write-Host "✅ Curso: $($curso.nombre) (ID: $($curso.id))" -ForegroundColor Green
Write-Host "✅ Matrícula 1: $($matricula1.id)" -ForegroundColor Green
Write-Host "✅ Matrícula 2: $($matricula2.id)" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 ROUNDTRIP COMPLETADO EXITOSAMENTE" -ForegroundColor Yellow
