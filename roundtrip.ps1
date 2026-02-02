# Script para roundtrip completo (API + Auth + Delete Cascade)

param(
    [string]$BaseUrl = "http://localhost:5000/api",
    [string]$Email = "",
    [string]$Password = "",

    # Etiqueta para identificar datos creados por este script (evita colisiones y permite limpieza segura)
    [string]$RunTag = "",

    # Solo ejecutar limpieza (no crea datos)
    [switch]$CleanupOnly,

    # Limpieza de datos legacy (creados por versiones antiguas del script con emails fijos)
    [switch]$CleanupLegacyTestData,

    # Probar borrado cascade del curso (por defecto se dejan los datos listos para fase de pagos)
    [switch]$TestCascadeDelete,

    # Verificar endpoints de pagos/finanzas (sin insertar pagos)
    [switch]$CheckPagoPhase
)

$StateFile = Join-Path $PSScriptRoot ".roundtrip-state.json"

function New-RunTag() {
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $rand = Get-Random -Minimum 1000 -Maximum 9999
    return "$stamp-$rand"
}

function Load-State([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return ($raw | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Save-State([string]$Path, $Obj) {
    try {
        $json = $Obj | ConvertTo-Json -Depth 10
        Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
        return $true
    } catch {
        return $false
    }
}

function Get-PlainPassword([Security.SecureString]$Secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Read-ErrorBody($Response) {
    try {
        $stream = $Response.GetResponseStream()
        if (-not $stream) { return "" }
        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
    } catch {
        return ""
    }
}

function Invoke-Json($Method, $Url, $Headers, $BodyObj) {
    $json = $null
    if ($null -ne $BodyObj) {
        $json = ($BodyObj | ConvertTo-Json -Depth 20)
    }

    try {
        if ($null -ne $json) {
            return Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers -Body $json -ContentType "application/json"
        }
        return Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers
    } catch {
        $resp = $_.Exception.Response
        $status = $null
        if ($resp -and $resp.StatusCode) { $status = [int]$resp.StatusCode }
        $body = ""
        if ($resp) { $body = Read-ErrorBody $resp }
        if ([string]::IsNullOrWhiteSpace($body) -and $_.ErrorDetails -and $_.ErrorDetails.Message) {
            $body = $_.ErrorDetails.Message
        }
        throw "HTTP $status ${Url}`n${body}`n$($_.Exception.Message)"
    }
}

function Try-InvokeJson($Method, $Url, $Headers, $BodyObj, [string]$Label) {
    try {
        $res = Invoke-Json $Method $Url $Headers $BodyObj
        if ($Label) { Write-Host "OK $Label" -ForegroundColor Cyan }
        return $res
    } catch {
        if ($Label) {
            Write-Host "WARN $Label" -ForegroundColor Yellow
            Write-Host $_ -ForegroundColor DarkGray
        }
        return $null
    }
}

function Cleanup-ByState($state, $BaseUrl, $headers) {
    if (-not $state) {
        Write-Host "WARN No hay state guardado para limpiar." -ForegroundColor Yellow
        return
    }

    Write-Host "=== CLEANUP ===" -ForegroundColor Yellow
    Write-Host "RunTag: $($state.runTag)" -ForegroundColor DarkYellow

    # 1) Borrar grupo primero (evita FK tutor/grupo si por alguna razon no se borra en cascade)
    if ($state.ids -and $state.ids.grupoId) {
        $gid = [int]$state.ids.grupoId
        Try-InvokeJson "DELETE" "$BaseUrl/bulk/grupos/$($gid)" $headers $null "Grupo eliminado"
    }

    # 2) Borrar curso (cascade) para liberar FKs
    if ($state.ids -and $state.ids.cursoId) {
        $cid = [int]$state.ids.cursoId
        Try-InvokeJson "DELETE" "$BaseUrl/cursos/$($cid)?cascade=1" $headers $null "Curso eliminado (cascade)"
    }

    # 3) Borrar estudiantes
    if ($state.ids -and $state.ids.estudianteIds) {
        foreach ($eid in $state.ids.estudianteIds) {
            if ($eid) {
                Try-InvokeJson "DELETE" "$BaseUrl/estudiantes/$($eid)" $headers $null "Estudiante eliminado (id=$eid)"
            }
        }
    }

    # 4) Borrar tutor
    if ($state.ids -and $state.ids.tutorId) {
        $tid = [int]$state.ids.tutorId
        Try-InvokeJson "DELETE" "$BaseUrl/tutores/$($tid)" $headers $null "Tutor eliminado"
    }

    Write-Host "OK Cleanup finalizado" -ForegroundColor Green
}

function Cleanup-Legacy($BaseUrl, $headers) {
    Write-Host "=== CLEANUP LEGACY ===" -ForegroundColor Yellow
    Write-Host "Esto limpia SOLO datos con emails legacy: maria@example.com, juan@example.com, ana@example.com" -ForegroundColor DarkYellow

    $tutores = Try-InvokeJson "GET" "$BaseUrl/tutores" $headers $null "Listar tutores";
    $estudiantes = Try-InvokeJson "GET" "$BaseUrl/estudiantes" $headers $null "Listar estudiantes";
    $cursos = Try-InvokeJson "GET" "$BaseUrl/cursos" $headers $null "Listar cursos";

    # Cursos legacy: borrar cascade por nombre exacto
    if ($cursos) {
        $legacyCursos = @($cursos | Where-Object { $_.nombre -eq "Frances Avanzado A1" -or $_.nombre -eq "Francés Avanzado A1" })
        foreach ($c in $legacyCursos) {
            Try-InvokeJson "DELETE" "$BaseUrl/cursos/$($c.id)?cascade=1" $headers $null "Curso legacy eliminado (cascade)"
        }
    }

    # Estudiantes legacy por email
    if ($estudiantes) {
        $legacyEst = @($estudiantes | Where-Object { $_.email -in @("juan@example.com","ana@example.com") })
        foreach ($e in $legacyEst) {
            Try-InvokeJson "DELETE" "$BaseUrl/estudiantes/$($e.id)" $headers $null "Estudiante legacy eliminado"
        }
    }

    # Tutor legacy por email
    if ($tutores) {
        $legacyTut = @($tutores | Where-Object { $_.email -eq "maria@example.com" })
        foreach ($t in $legacyTut) {
            Try-InvokeJson "DELETE" "$BaseUrl/tutores/$($t.id)" $headers $null "Tutor legacy eliminado"
        }
    }

    Write-Host "OK Cleanup legacy finalizado" -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Email (Supabase Auth)"
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    $secure = Read-Host "Password" -AsSecureString
    $Password = Get-PlainPassword $secure
}

Write-Host "=== LOGIN ===" -ForegroundColor Yellow
$login = Invoke-Json "POST" "$BaseUrl/auth/login" @{ } @{ email = $Email; password = $Password }
$token = $login.token
if (-not $token) { throw "No se pudo obtener token en login" }

# Headers
$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $token"
}

if ($CleanupOnly) {
    $state = Load-State $StateFile
    if (-not $state -and -not $CleanupLegacyTestData) {
        Write-Host "WARN No existe $StateFile. Para limpiar sin state: use -CleanupLegacyTestData (solo emails legacy) o ejecute primero el script normal para que guarde state." -ForegroundColor Yellow
        exit 1
    }

    if ($CleanupLegacyTestData) {
        Cleanup-Legacy $BaseUrl $headers
    }
    if ($state) {
        Cleanup-ByState $state $BaseUrl $headers
    }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($RunTag)) {
    $RunTag = New-RunTag
}
$Prefix = "RT-$RunTag"

Write-Host "=== ROUNDTRIP COMPLETO ===" -ForegroundColor Yellow
Write-Host "RunTag: $RunTag" -ForegroundColor DarkYellow
Write-Host "StateFile: $StateFile" -ForegroundColor DarkGray
Write-Host ""

# 1. CREAR TUTOR
Write-Host "1. CREAR TUTOR" -ForegroundColor Green
$tutorBody = @{
    nombre = "$Prefix Maria Garcia"
    especialidad = "Frances"
    email = "maria.$RunTag@example.com"
    telefono = "+506 8888-8888"
    dias_horarios = @{
        "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
        "Miercoles" = @{hora_inicio = "10:00"; hora_fin = "12:00"}
    }
}

$tutor = Invoke-Json "POST" "$BaseUrl/tutores" $headers $tutorBody
Write-Host "OK Tutor creado: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Cyan
Write-Host ""

# 2. CREAR ALUMNOS
Write-Host "2. CREAR ALUMNOS" -ForegroundColor Green

$estudiante1Body = @{
    nombre = "$Prefix Juan Perez"
    grado = "7mo"
    email = "juan.$RunTag@example.com"
    email_encargado = "encargado.juan.$RunTag@example.com"
    telefono_encargado = "+506 8888-8888"
} 

$estudiante1 = Invoke-Json "POST" "$BaseUrl/estudiantes" $headers $estudiante1Body
Write-Host "OK Alumno 1 creado: $($estudiante1.nombre) (ID: $($estudiante1.id))" -ForegroundColor Cyan

$estudiante2Body = @{
    nombre = "$Prefix Ana Lopez"
    grado = "8vo"
    email = "ana.$RunTag@example.com"
    email_encargado = "encargado.ana.$RunTag@example.com"
    telefono_encargado = "+506 8888-8888"
}

$estudiante2 = Invoke-Json "POST" "$BaseUrl/estudiantes" $headers $estudiante2Body
Write-Host "OK Alumno 2 creado: $($estudiante2.nombre) (ID: $($estudiante2.id))" -ForegroundColor Cyan
Write-Host ""

# 3. CREAR CURSO CON TUTOR COMPATIBLE
Write-Host "3. CREAR CURSO CON TUTOR ASIGNADO" -ForegroundColor Green

$cursoBody = @{
    nombre = "$Prefix Frances Avanzado A1"
    nivel = "A1"
    tipo_clase = "grupal"
    max_estudiantes = 10
    costo_curso = 15000
    pago_tutor = 5000
    dias_schedule = @{
        "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
    }
    tutor_id = $tutor.id
}

$curso = Invoke-Json "POST" "$BaseUrl/cursos" $headers $cursoBody
Write-Host "OK Curso creado: $($curso.nombre) con Tutor: Maria Garcia (ID: $($curso.id))" -ForegroundColor Cyan
Write-Host ""

# 4. CREAR MATRICULAS
Write-Host "4. CREAR MATRICULAS" -ForegroundColor Green

$matricula1Body = @{
    estudiante_id = $estudiante1.id
    curso_id = $curso.id
    tutor_id = $tutor.id
    es_grupo = $false
    grupo_nombre = $null
}

$matricula1 = Invoke-Json "POST" "$BaseUrl/matriculas" $headers $matricula1Body
Write-Host "OK Matricula 1: Juan Perez -> Frances Avanzado (ID: $($matricula1.id))" -ForegroundColor Cyan

$matricula2Body = @{
    estudiante_id = $estudiante2.id
    curso_id = $curso.id
    tutor_id = $tutor.id
    es_grupo = $false
    grupo_nombre = $null
}

$matricula2 = Invoke-Json "POST" "$BaseUrl/matriculas" $headers $matricula2Body
Write-Host "OK Matricula 2: Ana Lopez -> Frances Avanzado (ID: $($matricula2.id))" -ForegroundColor Cyan
Write-Host ""

# 4.1 CREAR GRUPO (matriculas_grupo) y ASIGNAR ESTUDIANTES MANUALES
Write-Host "4.1 CREAR GRUPO Y ASIGNAR ESTUDIANTES" -ForegroundColor Green

$grupoBody = @{
    curso_id = $curso.id
    tutor_id = $tutor.id
    nombre_grupo = "$Prefix Grupo Frances A1 (Test)"
    cantidad_estudiantes_esperados = 2
    fecha_inicio = "2026-02-01"
    turno = "Tarde"
    estado = "activa"
}

$grupo = Invoke-Json "POST" "$BaseUrl/bulk/grupos" $headers $grupoBody
Write-Host "OK Grupo creado: $($grupo.nombre_grupo) (ID: $($grupo.id))" -ForegroundColor Cyan

$assignBody = @{
    estudiante_ids = @($estudiante1.id, $estudiante2.id)
}

$assigned = Invoke-Json "POST" "$BaseUrl/bulk/grupos/$($grupo.id)/estudiantes" $headers $assignBody
Write-Host "OK Estudiantes asignados al grupo (normales): $($assigned.assigned_normales)" -ForegroundColor Cyan
Write-Host ""

# 4.2 COMPLETAR SESIÓN PARA GENERAR sesiones_clases + movimientos_dinero
Write-Host "4.2 COMPLETAR SESION (genera movimientos)" -ForegroundColor Green

function Get-NextMonday([datetime]$From) {
    $d = $From.Date
    while ($d.DayOfWeek -ne [System.DayOfWeek]::Monday) { $d = $d.AddDays(1) }
    return $d
}

$fechaLunes = (Get-NextMonday (Get-Date)).ToString('yyyy-MM-dd')
Write-Host "-> Fecha usada (Lunes): $fechaLunes" -ForegroundColor DarkYellow

$comp1 = Invoke-Json "POST" "$BaseUrl/dashboard/sesion/$($matricula1.id)/$fechaLunes/completar" $headers @{}
Write-Host "OK Sesion completada para matricula 1 (sesion_id: $($comp1.sesion_id))" -ForegroundColor Cyan

$comp2 = Invoke-Json "POST" "$BaseUrl/dashboard/sesion/$($matricula2.id)/$fechaLunes/completar" $headers @{}
Write-Host "OK Sesion completada para matricula 2 (sesion_id: $($comp2.sesion_id))" -ForegroundColor Cyan
Write-Host ""

# 5. VERIFICAR DATOS EN BASE DE DATOS
Write-Host "5. VERIFICAR DATOS EN BASE DE DATOS" -ForegroundColor Green

$allTutores = Invoke-Json "GET" "$BaseUrl/tutores" $headers $null
Write-Host "STATS Total de tutores: $($allTutores.Count)" -ForegroundColor Cyan

$allEstudiantes = Invoke-Json "GET" "$BaseUrl/estudiantes" $headers $null
Write-Host "STATS Total de alumnos: $($allEstudiantes.Count)" -ForegroundColor Cyan

$allCursos = Invoke-Json "GET" "$BaseUrl/cursos" $headers $null
Write-Host "STATS Total de cursos: $($allCursos.Count)" -ForegroundColor Cyan

$allMatriculas = Invoke-Json "GET" "$BaseUrl/matriculas" $headers $null
Write-Host "STATS Total de matriculas: $($allMatriculas.Count)" -ForegroundColor Cyan
Write-Host ""

if ($TestCascadeDelete) {
    # 6. PROBAR BORRADO DE CURSO (OPCIONAL)
    Write-Host "6. PROBAR BORRADO DE CURSO (CASCADE)" -ForegroundColor Green

    Write-Host "-> Intento 1: borrar SIN cascade (esperado 409)" -ForegroundColor DarkYellow
    try {
        Invoke-Json "DELETE" "$BaseUrl/cursos/$($curso.id)" $headers $null | Out-Null
        Write-Host "WARN Se borro sin cascade (inesperado)" -ForegroundColor Yellow
    } catch {
        Write-Host "OK Bloqueo esperado al borrar sin cascade" -ForegroundColor Cyan
        Write-Host $_ -ForegroundColor DarkGray
    }

    Write-Host "-> Intento 2: borrar CON cascade=1 (esperado OK)" -ForegroundColor DarkYellow
    $del = Invoke-Json "DELETE" "$BaseUrl/cursos/$($curso.id)?cascade=1" $headers $null
    Write-Host "OK Resultado delete cascade: $($del.message)" -ForegroundColor Cyan

    try {
        $cursoCheck = Invoke-Json "GET" "$BaseUrl/cursos/$($curso.id)" $headers $null
        Write-Host "WARN Curso todavia existe (inesperado): $($cursoCheck.nombre)" -ForegroundColor Yellow
    } catch {
        Write-Host "OK Confirmado: curso ya no existe" -ForegroundColor Green
    }
} else {
    Write-Host "6. SALTANDO BORRADO (datos se dejan listos para fase de pagos)" -ForegroundColor Green
    Write-Host "TIP Para probar cascade despues: DELETE $BaseUrl/cursos/$($curso.id)?cascade=1" -ForegroundColor DarkGray
}

if ($CheckPagoPhase) {
    Write-Host "7. CHECK FASE PAGOS" -ForegroundColor Green
    # Pagos requiere rol admin/contador
    Try-InvokeJson "GET" "$BaseUrl/pagos" $headers $null "Endpoint /pagos accesible (admin/contador)"

    # Finanzas puede requerir SUPABASE_SERVICE_KEY en backend
    Try-InvokeJson "GET" "$BaseUrl/finanzas/movimientos?curso_id=$($curso.id)" $headers $null "Endpoint /finanzas/movimientos (si hay service key)"
}

Write-Host "=== RESUMEN DEL ROUNDTRIP ===" -ForegroundColor Yellow
Write-Host "OK Tutor: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Green
Write-Host "OK Alumno 1: $($estudiante1.nombre) (ID: $($estudiante1.id))" -ForegroundColor Green
Write-Host "OK Alumno 2: $($estudiante2.nombre) (ID: $($estudiante2.id))" -ForegroundColor Green
Write-Host "OK Curso: $($curso.nombre) (ID: $($curso.id))" -ForegroundColor Green
Write-Host "OK Matricula 1: $($matricula1.id)" -ForegroundColor Green
Write-Host "OK Matricula 2: $($matricula2.id)" -ForegroundColor Green
Write-Host ""
Write-Host "ROUNDTRIP COMPLETADO EXITOSAMENTE" -ForegroundColor Yellow

$stateObj = [PSCustomObject]@{
    runTag = $RunTag
    createdAt = (Get-Date).ToString('o')
    baseUrl = $BaseUrl
    ids = [PSCustomObject]@{
        tutorId = $tutor.id
        estudianteIds = @($estudiante1.id, $estudiante2.id)
        cursoId = $curso.id
        matriculaIds = @($matricula1.id, $matricula2.id)
        grupoId = $grupo.id
    }
}

if (Save-State $StateFile $stateObj) {
    Write-Host "OK State guardado en: $StateFile" -ForegroundColor DarkGray
    Write-Host "TIP CleanupOnly: powershell -NoProfile -ExecutionPolicy Bypass -File ..\roundtrip.ps1 -BaseUrl \"$BaseUrl\" -Email \"$Email\" -Password \"<tu password>\" -CleanupOnly" -ForegroundColor DarkGray
    Write-Host "TIP Cleanup legacy (emails fijos antiguos): ... -CleanupOnly -CleanupLegacyTestData" -ForegroundColor DarkGray
} else {
    Write-Host "WARN No se pudo guardar state en: $StateFile" -ForegroundColor Yellow
}
