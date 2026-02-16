# Script para roundtrip completo (API + Auth + Delete Cascade)

param(
    [string]$BaseUrl = "http://localhost:5000/api",
    [string]$Email = "",
    [string]$Password = "",

    # Opcional: ruta a un archivo local que contenga la contraseña en texto plano.
    # Útil para automatizar sin escribir la contraseña en el comando.
    [string]$PasswordFile = "",

    # Tipo de pago del curso creado por el script
    [ValidateSet('sesion','mensual')]
    [string]$TipoPago = 'sesion',

    # Etiqueta para identificar datos creados por este script (evita colisiones y permite limpieza segura)
    [string]$RunTag = "",

    # Solo ejecutar limpieza (no crea datos)
    [switch]$CleanupOnly,

    # Limpieza por prefijo (para cuando no hay .roundtrip-state.json).
    # Por defecto hace DRY_RUN; para borrar debes pasar -CleanupByPrefixApply.
    [switch]$CleanupByPrefix,
    [switch]$CleanupByPrefixApply,
    [string]$CleanupPrefix = "RT-",

    # Limpieza de datos legacy (creados por versiones antiguas del script con emails fijos)
    [switch]$CleanupLegacyTestData,

    # Probar borrado cascade del curso (por defecto se dejan los datos listos para fase de pagos)
    [switch]$TestCascadeDelete,

    # Verificar endpoints de pagos/finanzas (sin insertar pagos)
    [switch]$CheckPagoPhase,

    # Modo de tesorería para la fase de pagos
    # - v2: usa /api/tesoreria (recomendado; compatible con reglas contables estrictas)
    # - legacy: usa /api/pagos (requiere habilitar mutaciones legacy en el backend)
    [ValidateSet('v2','legacy')]
    [string]$TesoreriaMode = 'v2',

    # Suite de estrés (movimientos, cancelaciones, faltantes/sobrantes, cierres, export)
    [switch]$StressSuite,

    # Simular ~1 mes de uso (sesiones, cancelaciones, pagos, libro diario)
    [switch]$SimulateMonth,
    [int]$SimDays = 30,
    [string]$SimStartDate = ""
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

function Expect-HttpFailure($Method, $Url, $Headers, $BodyObj, [int]$ExpectedStatus, [string]$Label) {
    try {
        Invoke-Json $Method $Url $Headers $BodyObj | Out-Null
        Write-Host "WARN $Label (se esperaba HTTP $ExpectedStatus, pero respondio OK)" -ForegroundColor Yellow
        return $false
    } catch {
        $msg = ($_ | Out-String)
        if ($msg -like ("*HTTP $ExpectedStatus*") -or $msg -match ("HTTP\\s+" + $ExpectedStatus)) {
            Write-Host "OK $Label (HTTP $ExpectedStatus)" -ForegroundColor Cyan
            return $true
        }
        Write-Host "WARN $Label (error inesperado; se esperaba HTTP $ExpectedStatus)" -ForegroundColor Yellow
        Write-Host $msg -ForegroundColor DarkGray
        return $false
    }
}

function Expect-MultipartFailure([string]$Url, [hashtable]$Headers, [string]$FilePath, [string]$ContentType, [int]$ExpectedStatus, [string]$Label) {
    try {
        Invoke-MultipartFileUpload $Url $Headers $FilePath $ContentType | Out-Null
        Write-Host "WARN $Label (se esperaba HTTP $ExpectedStatus, pero respondio OK)" -ForegroundColor Yellow
        return $false
    } catch {
        $msg = ($_ | Out-String)
        if ($msg -like ("*HTTP $ExpectedStatus*") -or $msg -match ("HTTP\\s+" + $ExpectedStatus)) {
            Write-Host "OK $Label (HTTP $ExpectedStatus)" -ForegroundColor Cyan
            return $true
        }
        Write-Host "WARN $Label (error inesperado; se esperaba HTTP $ExpectedStatus)" -ForegroundColor Yellow
        Write-Host $msg -ForegroundColor DarkGray
        return $false
    }
}

function Invoke-MultipartFileUpload([string]$Url, [hashtable]$Headers, [string]$FilePath, [string]$ContentType = "application/pdf") {
    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Archivo no existe: $FilePath"
    }

    try { Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue } catch { }

    $client = New-Object System.Net.Http.HttpClient
    try {
        if ($Headers -and $Headers.Authorization) {
            $auth = $Headers.Authorization
            $client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $auth) | Out-Null
        }

        $multipart = New-Object System.Net.Http.MultipartFormDataContent
        $stream = [System.IO.File]::OpenRead($FilePath)
        try {
            $fileContent = New-Object System.Net.Http.StreamContent($stream)
            $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
            $multipart.Add($fileContent, "file", [System.IO.Path]::GetFileName($FilePath))

            $resp = $client.PostAsync($Url, $multipart).Result
            $body = $resp.Content.ReadAsStringAsync().Result
            if (-not $resp.IsSuccessStatusCode) {
                throw "HTTP $([int]$resp.StatusCode) ${Url}`n${body}"
            }
            if ([string]::IsNullOrWhiteSpace($body)) { return $null }
            return ($body | ConvertFrom-Json)
        } finally {
            try { $stream.Close() } catch { }
        }
    } finally {
        try { $client.Dispose() } catch { }
    }
}

function Download-File([string]$Url, [hashtable]$Headers, [string]$OutFile) {
    if ([string]::IsNullOrWhiteSpace($OutFile)) {
        throw "OutFile requerido"
    }
    $dir = Split-Path -Parent $OutFile
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        try { New-Item -ItemType Directory -Path $dir -Force | Out-Null } catch { }
    }

    $h = @{}
    if ($Headers -and $Headers.Authorization) { $h.Authorization = $Headers.Authorization }
    try {
        Invoke-WebRequest -Uri $Url -Headers $h -OutFile $OutFile -UseBasicParsing | Out-Null
    } catch {
        throw "No se pudo descargar: $Url`n$($_ | Out-String)"
    }
    if (-not (Test-Path -LiteralPath $OutFile)) {
        throw "Descarga no generó archivo: $OutFile"
    }
}

function Get-ObjProp($Obj, [string]$Name) {
    if ($null -eq $Obj) { return $null }
    try {
        $p = $Obj.PSObject.Properties[$Name]
        if ($p) { return $p.Value }
        return $null
    } catch {
        return $null
    }
}

function Get-PagoIdFromResponse($Obj) {
    if ($null -eq $Obj) { return $null }

    # supabase.rpc puede devolver array
    if ($Obj -is [System.Array]) {
        if ($Obj.Length -lt 1) { return $null }
        $Obj = $Obj[0]
        if ($null -eq $Obj) { return $null }
    }
    foreach ($k in @('id','pago_id','pagoId')) {
        $v = Get-ObjProp $Obj $k
        if ($v) {
            try {
                $n = [int]$v
                if ($n -gt 0) { return $n }
            } catch { }
        }
    }
    return $null
}

function Get-EncargadoIdForStudent($Estudiante, [string]$BaseUrl, $Headers) {
    $direct = Get-ObjProp $Estudiante 'encargado_id'
    if ($direct) {
        $n = [int]$direct
        if ($n -gt 0) { return $n }
    }

    $emailEnc = Get-ObjProp $Estudiante 'email_encargado'
    if ([string]::IsNullOrWhiteSpace($emailEnc)) { return $null }

    $res = Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/resumen" $Headers $null ""
    if (-not $res -or -not $res.encargados) { return $null }

    foreach ($row in @($res.encargados)) {
        try {
            if ($row.encargados -and $row.encargados.email -and ($row.encargados.email -eq $emailEnc)) {
                $id = [int]$row.encargado_id
                if ($id -gt 0) { return $id }
            }
        } catch { }
    }
    return $null
}

function Get-TesoreriaEncargadoRow([int]$EncargadoId, [string]$BaseUrl, $Headers) {
    $res = Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/resumen" $Headers $null ""
    if (-not $res -or -not $res.encargados) { return $null }
    foreach ($row in @($res.encargados)) {
        try {
            if ([int]$row.encargado_id -eq $EncargadoId) { return $row }
        } catch { }
    }
    return $null
}

function Get-TesoreriaTutorRow([int]$TutorId, [string]$BaseUrl, $Headers) {
    $res = Try-InvokeJson "GET" "$BaseUrl/tesoreria/tutores/resumen" $Headers $null ""
    if (-not $res -or -not $res.tutores) { return $null }
    foreach ($row in @($res.tutores)) {
        try {
            if ([int]$row.tutor_id -eq $TutorId) { return $row }
        } catch { }
    }
    return $null
}

function Get-TesoreriaBolsa([string]$BaseUrl, $Headers) {
    return Try-InvokeJson "GET" "$BaseUrl/tesoreria/bolsa" $Headers $null ""
}

function Parse-ISODate([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    try {
        return [datetime]::ParseExact($Value, 'yyyy-MM-dd', $null)
    } catch {
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

    # 5) Borrar tutor2 (si se creó en StressSuite)
    if ($state.ids -and $state.ids.tutor2Id) {
        $tid2 = [int]$state.ids.tutor2Id
        if ($tid2 -gt 0) {
            Try-InvokeJson "DELETE" "$BaseUrl/tutores/$($tid2)" $headers $null "Tutor 2 eliminado"
        }
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
    if (-not [string]::IsNullOrWhiteSpace($env:ROUNDTRIP_EMAIL)) {
        $Email = $env:ROUNDTRIP_EMAIL
    }
}
if ([string]::IsNullOrWhiteSpace($Email)) {
    $defaultEmailFile = Join-Path $PSScriptRoot ".roundtrip-email.txt"
    if (Test-Path -LiteralPath $defaultEmailFile) {
        try {
            $rawEmail = Get-Content -LiteralPath $defaultEmailFile -Raw
            if (-not [string]::IsNullOrWhiteSpace($rawEmail)) {
                $Email = $rawEmail.Trim()
            }
        } catch {
            # ignorar y caer al prompt
        }
    }
}
if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Email (Supabase Auth)"
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    if (-not [string]::IsNullOrWhiteSpace($env:ROUNDTRIP_PASSWORD)) {
        $Password = $env:ROUNDTRIP_PASSWORD
    }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $pf = $PasswordFile
    if ([string]::IsNullOrWhiteSpace($pf) -and -not [string]::IsNullOrWhiteSpace($env:ROUNDTRIP_PASSWORD_FILE)) {
        $pf = $env:ROUNDTRIP_PASSWORD_FILE
    }

    # Conveniencia: si existe .roundtrip-pass.txt junto al script, usarlo por defecto.
    if ([string]::IsNullOrWhiteSpace($pf)) {
        $defaultPf = Join-Path $PSScriptRoot ".roundtrip-pass.txt"
        if (Test-Path -LiteralPath $defaultPf) {
            $pf = $defaultPf
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($pf) -and (Test-Path -LiteralPath $pf)) {
        try {
            $rawPass = Get-Content -LiteralPath $pf -Raw
            if (-not [string]::IsNullOrWhiteSpace($rawPass)) {
                $Password = $rawPass.Trim()
            }
        } catch {
            # ignorar y caer al prompt
        }
    }
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

    if (-not $state -and -not $CleanupLegacyTestData -and -not $CleanupByPrefix) {
        Write-Host "WARN No existe $StateFile." -ForegroundColor Yellow
        Write-Host "- Para limpiar solo datos legacy: use -CleanupLegacyTestData" -ForegroundColor DarkYellow
        Write-Host "- Para limpiar por prefijo (recomendado): use -CleanupByPrefix [-RunTag <tag>] [-CleanupByPrefixApply]" -ForegroundColor DarkYellow
        Write-Host "  Ejemplo seguro (solo una corrida): .\roundtrip.ps1 -CleanupOnly -CleanupByPrefix -RunTag <tag> -CleanupByPrefixApply" -ForegroundColor DarkGray
        Write-Host "  Ejemplo mas amplio (TODO lo RT-*): .\roundtrip.ps1 -CleanupOnly -CleanupByPrefix -CleanupPrefix RT- -CleanupByPrefixApply" -ForegroundColor DarkGray
        exit 1
    }

    if ($CleanupLegacyTestData) {
        Cleanup-Legacy $BaseUrl $headers
    }
    if ($state) {
        Cleanup-ByState $state $BaseUrl $headers
    }

    if ($CleanupByPrefix) {
        Write-Host "=== CLEANUP POR PREFIJO ===" -ForegroundColor Yellow
        $scriptPath = Join-Path $PSScriptRoot "backend\scripts\cleanupRoundtrip.js"
        if (-not (Test-Path -LiteralPath $scriptPath)) {
            Write-Host "WARN No existe: $scriptPath" -ForegroundColor Yellow
            Write-Host "No se puede ejecutar limpieza por prefijo." -ForegroundColor DarkYellow
            exit 1
        }

        $args = @($scriptPath)
        if (-not [string]::IsNullOrWhiteSpace($RunTag)) {
            $args += @('--runTag', $RunTag)
        } else {
            $args += @('--prefix', $CleanupPrefix)
        }

        if ($CleanupByPrefixApply) {
            $args += '--apply'
            Write-Host "APPLY: se borraran registros que matcheen el criterio" -ForegroundColor DarkYellow
        } else {
            Write-Host "DRY_RUN: no se borrara nada (usa -CleanupByPrefixApply para aplicar)" -ForegroundColor DarkYellow
        }

        try {
            & node @args
            if ($LASTEXITCODE -ne 0) {
                Write-Host "WARN cleanupRoundtrip.js fallo (exit=$LASTEXITCODE)" -ForegroundColor Yellow
                exit $LASTEXITCODE
            }
        } catch {
            Write-Host "WARN No se pudo ejecutar node cleanupRoundtrip.js" -ForegroundColor Yellow
            Write-Host $_ -ForegroundColor DarkGray
            exit 1
        }
    }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($RunTag)) {
    $RunTag = New-RunTag
}
$Prefix = "RT-$RunTag"

$SimStart = $null
$SimEnd = $null
if ($SimulateMonth) {
    if ($SimDays -lt 7) { $SimDays = 30 }
    if ($SimDays -gt 60) { $SimDays = 60 }

    $parsed = Parse-ISODate $SimStartDate
    if ($parsed) {
        $SimStart = $parsed.Date
    } else {
        $SimStart = (Get-Date).Date.AddDays(-1 * ($SimDays - 1))

        # Tesorería v2 puede tener cierres mensuales activos que bloquean fechas antiguas.
        # Si el rango simulado cae dentro del periodo cerrado, moverlo automáticamente al primer día disponible.
        if ($TesoreriaMode -eq 'v2') {
            try {
                $cierres = Try-InvokeJson "GET" "$BaseUrl/tesoreria/cierres" $headers $null ""
                $cerradoHastaRaw = $null
                try { $cerradoHastaRaw = [string]$cierres.cerrado_hasta } catch { $cerradoHastaRaw = $null }
                $cerradoHasta = Parse-ISODate $cerradoHastaRaw
                if ($cerradoHasta -and $SimStart -le $cerradoHasta.Date) {
                    $SimStart = $cerradoHasta.Date.AddDays(1)
                    Write-Host "INFO SimStart ajustado por cierre tesorería: cerrado_hasta=$cerradoHastaRaw => SimStart=$($SimStart.ToString('yyyy-MM-dd'))" -ForegroundColor DarkYellow
                }
            } catch {
                Write-Host "WARN No se pudo consultar /tesoreria/cierres; usando SimStart por defecto." -ForegroundColor Yellow
            }
        }
    }
    $SimEnd = $SimStart.AddDays($SimDays - 1)
    Write-Host "SIMULATE MONTH: $($SimStart.ToString('yyyy-MM-dd')) -> $($SimEnd.ToString('yyyy-MM-dd')) ($SimDays dias)" -ForegroundColor DarkYellow
    Write-Host "" 
}

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
        "Miércoles" = @{hora_inicio = "10:00"; hora_fin = "12:00"}
    }
}

$tutor = Invoke-Json "POST" "$BaseUrl/tutores" $headers $tutorBody
Write-Host "OK Tutor creado: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Cyan
Write-Host ""

$tutor2 = $null
if ($StressSuite) {
    Write-Host "1.1 STRESS: CREAR TUTOR 2 (HORARIO RESTRINGIDO)" -ForegroundColor Green
    $tutor2Body = @{
        nombre = "$Prefix Carlos Stress"
        especialidad = "Frances"
        email = "carlos.$RunTag@example.com"
        telefono = "+506 8888-7777"
        dias_horarios = @{
            "Lunes" = @{hora_inicio = "09:00"; hora_fin = "10:00"}
        }
    }
    try {
        $tutor2 = Invoke-Json "POST" "$BaseUrl/tutores" $headers $tutor2Body
        Write-Host "OK Tutor 2 creado: $($tutor2.nombre) (ID: $($tutor2.id))" -ForegroundColor Cyan
    } catch {
        Write-Host "WARN No se pudo crear tutor 2" -ForegroundColor Yellow
        Write-Host $_ -ForegroundColor DarkGray
    }
    Write-Host ""
}

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

if ($StressSuite) {
    # 3.0 Pruebas negativas: tutor con horario incompatible
    if ($tutor2 -and $tutor2.id) {
        $badCursoTutor2 = @{
            nombre = "$Prefix (NEG) Curso incompatible tutor2"
            nivel = "A1"
            tipo_clase = "grupal"
            max_estudiantes = 10
            costo_curso = 15000
            pago_tutor = 5000
            tipo_pago = $TipoPago
            dias_schedule = @{
                "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
            }
            tutor_id = $tutor2.id
        }
        Expect-HttpFailure "POST" "$BaseUrl/cursos" $headers $badCursoTutor2 400 "Curso con tutor2 incompatible (debe fallar)" | Out-Null
    }

    Write-Host "" 
}

$cursoBody = @{
    nombre = "$Prefix Frances Avanzado A1"
    nivel = "A1"
    tipo_clase = "grupal"
    max_estudiantes = 10
    costo_curso = 15000
    pago_tutor = 5000
    tipo_pago = $TipoPago
    dias_schedule = @{
        "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        "Martes" = @{hora_inicio = "14:00"; hora_fin = "16:00"}
        "Miercoles" = @{hora_inicio = "10:00"; hora_fin = "12:00"}
        "Miércoles" = @{hora_inicio = "10:00"; hora_fin = "12:00"}
    }
    tutor_id = $tutor.id
}

$curso = Invoke-Json "POST" "$BaseUrl/cursos" $headers $cursoBody
Write-Host "OK Curso creado: $($curso.nombre) con Tutor: Maria Garcia (ID: $($curso.id))" -ForegroundColor Cyan
Write-Host ""

if ($StressSuite) {
    # Choque: mismo tutor, misma franja => debe fallar
    $badCursoChoque = @{
        nombre = "$Prefix (NEG) Curso choque horario"
        nivel = "A1"
        tipo_clase = "grupal"
        max_estudiantes = 10
        costo_curso = 15000
        pago_tutor = 5000
        tipo_pago = $TipoPago
        dias_schedule = @{
            "Lunes" = @{hora_inicio = "09:00"; hora_fin = "11:00"}
        }
        tutor_id = $tutor.id
    }
    Expect-HttpFailure "POST" "$BaseUrl/cursos" $headers $badCursoChoque 400 "Curso choque horario (debe fallar)" | Out-Null
    Write-Host ""
}

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

if ($StressSuite) {
    Write-Host "4.0 STRESS: VALIDAR HORAS (clase fuera de rango)" -ForegroundColor Green
    $testDate = $(if ($SimulateMonth -and $SimStart) { $SimStart.ToString('yyyy-MM-dd') } else { (Get-Date).Date.AddDays(1).ToString('yyyy-MM-dd') })
    $badClase = @{ matricula_id = $matricula1.id; fecha = $testDate; hora_inicio = '07:00'; hora_fin = '08:00'; notas = 'RT clase fuera de horario (debe fallar)' }
    Expect-HttpFailure "POST" "$BaseUrl/horarios/clases/crear" $headers $badClase 400 "Crear clase fuera de horario (debe fallar)" | Out-Null
    Write-Host ""
}

# 4.1 CREAR GRUPO (matriculas_grupo) y ASIGNAR ESTUDIANTES MANUALES
Write-Host "4.1 CREAR GRUPO Y ASIGNAR ESTUDIANTES" -ForegroundColor Green

$grupoBody = @{
    curso_id = $curso.id
    tutor_id = $tutor.id
    nombre_grupo = "$Prefix Grupo Frances A1 (Test)"
    cantidad_estudiantes_esperados = 2
    fecha_inicio = $(if ($SimulateMonth -and $SimStart) { $SimStart.ToString('yyyy-MM-dd') } else { "2026-02-01" })
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

# 4.1.1 CREAR MATRICULA GRUPAL DESDE EL GRUPO (es_grupo=true)
Write-Host "4.1.1 CREAR MATRICULA GRUPAL (desde grupo)" -ForegroundColor Green
$matriculaGrupo = $null
try {
    $matriculaGrupo = Invoke-Json "POST" "$BaseUrl/matriculas/from-bulk-grupo" $headers @{ matricula_grupo_id = "$($grupo.id)"; grupo_nombre = $grupo.nombre_grupo }
    $mgid = $null
    if ($matriculaGrupo -and $matriculaGrupo.matricula -and $matriculaGrupo.matricula.id) {
        $mgid = $matriculaGrupo.matricula.id
    } elseif ($matriculaGrupo -and $matriculaGrupo.id) {
        $mgid = $matriculaGrupo.id
    }
    Write-Host "OK Matricula grupal creada (ID: $mgid)" -ForegroundColor Cyan
} catch {
    Write-Host "WARN No se pudo crear matrícula grupal desde el grupo" -ForegroundColor Yellow
    Write-Host $_ -ForegroundColor DarkGray
}
Write-Host ""

# 4.2 COMPLETAR SESIONES
if ($SimulateMonth) {
    if ($TipoPago -eq 'mensual') {
        Write-Host "4.2 COMPLETAR SESIONES (mensual: sesiones dadas; movimientos por cierre mensual)" -ForegroundColor Green
    } else {
        Write-Host "4.2 COMPLETAR SESIONES (sesion: genera movimientos por clase)" -ForegroundColor Green
    }

    # Crear artefactos temporales (no ensuciar el repo)
    $ArtifactsDir = Join-Path ([System.IO.Path]::GetTempPath()) "linguistika-roundtrip"
    try { New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null } catch { }

    # Crear comprobante dummy (PDF) para adjuntos
    $dummyPath = Join-Path $ArtifactsDir "roundtrip-$RunTag-comprobante.pdf"
    if (-not (Test-Path -LiteralPath $dummyPath)) {
        $pdfText = "%PDF-1.4`n%RT`n1 0 obj`n<<>>`nendobj`ntrailer`n<<>>`n%%EOF`n"
        $bytes = [System.Text.Encoding]::ASCII.GetBytes($pdfText)
        [System.IO.File]::WriteAllBytes($dummyPath, $bytes)
    }

    $grupoMatId = $null
    if ($matriculaGrupo) {
        if ($matriculaGrupo.matricula -and $matriculaGrupo.matricula.id) { $grupoMatId = [int]$matriculaGrupo.matricula.id }
        elseif ($matriculaGrupo.id) { $grupoMatId = [int]$matriculaGrupo.id }
    }

    $d = $SimStart
    $completed = 0
    while ($d -le $SimEnd) {
        $iso = $d.ToString('yyyy-MM-dd')
        $dow = $d.DayOfWeek

        # Consultar agenda (prueba dashboard)
        Try-InvokeJson "GET" "$BaseUrl/dashboard/tutorias/$iso" $headers $null "Agenda $iso"

        # Solo completar clases en días del horario del curso (Lunes/Martes/Miercoles)
        if ($dow -eq [System.DayOfWeek]::Monday -or $dow -eq [System.DayOfWeek]::Tuesday -or $dow -eq [System.DayOfWeek]::Wednesday) {
            $c1 = Try-InvokeJson "POST" "$BaseUrl/dashboard/sesion/$($matricula1.id)/$iso/completar" $headers @{} "Completar sesion M1 $iso"
            $c2 = Try-InvokeJson "POST" "$BaseUrl/dashboard/sesion/$($matricula2.id)/$iso/completar" $headers @{} "Completar sesion M2 $iso"
            if ($grupoMatId) {
                Try-InvokeJson "POST" "$BaseUrl/dashboard/sesion/$grupoMatId/$iso/completar" $headers @{} "Completar sesion GRUPO $iso" | Out-Null
            }
            $completed++
        }

        $dayIndex = [int]([Math]::Floor(($d - $SimStart).TotalDays))

        # Estrés: cancelar algunas clases (día específico)
        if ($StressSuite -and ($dayIndex -in 6, 13, 20)) {
            Try-InvokeJson "POST" "$BaseUrl/dashboard/sesion/$($matricula2.id)/$iso/cancelar-dia" $headers @{} "Cancelar día M2 $iso" | Out-Null
            if ($grupoMatId) {
                Try-InvokeJson "POST" "$BaseUrl/dashboard/sesion/$grupoMatId/$iso/cancelar-dia" $headers @{} "Cancelar día GRUPO $iso" | Out-Null
            }
        }

        # Estrés: mover estudiante 2 fuera del grupo y re-asignarlo más adelante
        if ($StressSuite -and $dayIndex -eq 14) {
            Try-InvokeJson "POST" "$BaseUrl/bulk/estudiantes/unassign" $headers @{ estudiante_ids = @($estudiante2.id) } "Unassign estudiante 2 del grupo" | Out-Null
        }
        if ($StressSuite -and $dayIndex -eq 21) {
            Try-InvokeJson "POST" "$BaseUrl/bulk/grupos/$($grupo.id)/estudiantes" $headers @{ estudiante_ids = @($estudiante2.id) } "Re-assign estudiante 2 al grupo" | Out-Null
        }

        # Cada 7 días (solo legacy): registrar movimientos manuales (entrada y salida)
        if ($TesoreriaMode -eq 'legacy' -and ($dayIndex -in 3, 10, 17, 24)) {
            # Entrada manual vinculada a estudiante 1 (ej: pago servicio/otros)
            $movIn = Try-InvokeJson "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'entrada'; monto = 2500; fecha = $iso; metodo = 'sinpe'; referencia = "RT-IN-$iso"; categoria = 'Ingreso extra'; detalle = "Ingreso manual del día $iso"; estudiante_id = $estudiante1.id } "Movimiento manual ENTRADA $iso"
            if ($movIn -and $movIn.id) {
                try {
                    $up = Invoke-MultipartFileUpload "$BaseUrl/pagos/movimientos/$($movIn.id)/comprobante" $headers $dummyPath "application/pdf"
                    Write-Host "OK Adjuntado comprobante a movimiento $($movIn.id)" -ForegroundColor Cyan
                } catch {
                    Write-Host "WARN No se pudo adjuntar comprobante" -ForegroundColor Yellow
                    Write-Host $_ -ForegroundColor DarkGray
                }
            }

            # Salida manual (ej: pago de servicio)
            Try-InvokeJson "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'salida'; monto = 1800; fecha = $iso; metodo = 'efectivo'; referencia = "RT-OUT-$iso"; categoria = 'Servicio'; detalle = "Pago de servicio del día $iso" } "Movimiento manual SALIDA $iso" | Out-Null

            # Salida manual vinculada al tutor (ej: reembolso)
            Try-InvokeJson "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'salida'; monto = 1200; fecha = $iso; metodo = 'transferencia'; referencia = "RT-REEMB-$iso"; categoria = 'Reembolso'; detalle = "Reembolso tutor del día $iso"; tutor_id = $tutor.id } "Reembolso tutor $iso" | Out-Null
        }

        $d = $d.AddDays(1)
    }

    Write-Host "OK Simulación: días con clases procesados: $completed" -ForegroundColor Cyan
    Write-Host ""

    $f1 = $SimStart.ToString('yyyy-MM-dd')
    $f2 = $SimStart.AddDays([Math]::Min(7, $SimDays-1)).ToString('yyyy-MM-dd')
    $f3 = $SimEnd.ToString('yyyy-MM-dd')

    if ($TesoreriaMode -eq 'legacy') {
        # LEGACY (si está habilitado en backend)
        if ($TipoPago -eq 'mensual') {
            Write-Host "4.3 CIERRE MENSUAL (FORZADO)" -ForegroundColor Green
            $anio = [int]$SimEnd.ToString('yyyy')
            $mes = [int]$SimEnd.ToString('MM')
            Try-InvokeJson "POST" "$BaseUrl/pagos/cierre-mensual" $headers @{ anio = $anio; mes = $mes; force = $true } "Cierre mensual" | Out-Null
            Write-Host "" 
        }

        Write-Host "4.4 LIQUIDAR INGRESOS ESTUDIANTES (LEGACY)" -ForegroundColor Green
        Try-InvokeJson "POST" "$BaseUrl/pagos/ingresos/liquidar-estudiante" $headers @{ estudiante_id = $estudiante1.id; metodo = 'sinpe'; referencia = "RT-PAGO-$($SimEnd.ToString('yyyyMMdd'))"; fecha_comprobante = $f3 } "Pago estudiante 1" | Out-Null
        Try-InvokeJson "POST" "$BaseUrl/pagos/ingresos/liquidar-estudiante" $headers @{ estudiante_id = $estudiante2.id; metodo = 'transferencia'; referencia = "RT-PAGO2-$($SimEnd.ToString('yyyyMMdd'))"; fecha_comprobante = $f3 } "Pago estudiante 2" | Out-Null
        Write-Host ""

        Write-Host "4.5 LIQUIDAR PENDIENTES TUTOR (LEGACY)" -ForegroundColor Green
        Try-InvokeJson "POST" "$BaseUrl/pagos/liquidar" $headers @{ tutor_id = $tutor.id; descripcion = "RT Liquidación mensual ($RunTag)"; estado = 'pagado'; fecha_inicio = $f1; fecha_fin = $f3 } "Liquidar tutor" | Out-Null
        Write-Host ""

        Write-Host "4.6 CONSULTAR LIBRO DIARIO (LEGACY)" -ForegroundColor Green
        Try-InvokeJson "GET" "$BaseUrl/pagos/libro-diario?fecha=$f1" $headers $null "Libro $f1" | Out-Null
        Try-InvokeJson "GET" "$BaseUrl/pagos/libro-diario?fecha=$f2" $headers $null "Libro $f2" | Out-Null
        Try-InvokeJson "GET" "$BaseUrl/pagos/libro-diario?fecha=$f3" $headers $null "Libro $f3" | Out-Null
        Write-Host ""

        Write-Host "4.7 ROBUSTEZ (LEGACY)" -ForegroundColor Green
        $noAuthHeaders = @{ "Content-Type" = "application/json" }
        Expect-HttpFailure "GET" "$BaseUrl/tutores" $noAuthHeaders $null 401 "GET /tutores sin Authorization" | Out-Null
        Expect-HttpFailure "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'entrada'; monto = 0; fecha = $f3; metodo = 'efectivo'; referencia = 'RT-BAD-M0'; categoria = 'Test'; detalle = 'Monto 0 debe fallar' } 400 "Movimiento manual monto=0" | Out-Null
        Expect-HttpFailure "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'x'; monto = 100; fecha = $f3; metodo = 'efectivo'; referencia = 'RT-BAD-DIR'; categoria = 'Test'; detalle = 'Direccion invalida debe fallar' } 400 "Movimiento manual direccion invalida" | Out-Null
        if ($TipoPago -eq 'mensual') {
            $anio = [int]$SimEnd.ToString('yyyy')
            $mes = [int]$SimEnd.ToString('MM')
            Try-InvokeJson "POST" "$BaseUrl/pagos/cierre-mensual" $headers @{ anio = $anio; mes = $mes; force = $true } "Cierre mensual (reintento)" | Out-Null
        }
        Write-Host ""
    } else {
        # TESORERÍA V2 (contabilidad estricta)
        Write-Host "4.3 TESORERIA V2: RESUMEN / SALDOS" -ForegroundColor Green
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/resumen" $headers $null "Resumen tesorería" | Out-Null
        $bolsa = Get-TesoreriaBolsa $BaseUrl $headers
        if ($bolsa) {
            Write-Host "STATS Bolsa real: $($bolsa.bolsa_real)" -ForegroundColor Cyan
        }
        Write-Host ""

        $enc1 = Get-EncargadoIdForStudent $estudiante1 $BaseUrl $headers
        $enc2 = Get-EncargadoIdForStudent $estudiante2 $BaseUrl $headers

        # Fallback: si no hay vínculo directo estudiante -> encargado, usar los primeros encargados disponibles
        # para poder validar pagos exacto/faltante/sobrante en Tesorería v2.
        if (-not $enc1 -or -not $enc2) {
            $encRes = Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/resumen" $headers $null ""
            $encIds = @()
            if ($encRes -and $encRes.encargados) {
                foreach ($row in @($encRes.encargados)) {
                    try {
                        $id = [int]$row.encargado_id
                        if ($id -gt 0) { $encIds += $id }
                    } catch { }
                }
            }
            $encIds = @($encIds | Select-Object -Unique)
            if ($encIds.Count -ge 1 -and (-not $enc1)) { $enc1 = [int]$encIds[0] }
            if ($encIds.Count -ge 2 -and (-not $enc2)) {
                $enc2cand = ($encIds | Where-Object { $_ -ne $enc1 } | Select-Object -First 1)
                if ($null -ne $enc2cand) { $enc2 = [int]$enc2cand }
            }
            if ($enc1 -and $enc2) {
                Write-Host "WARN No se pudo resolver encargado_id desde estudiantes; usando fallback encargados: $enc1 y $enc2" -ForegroundColor Yellow
            }
        }

        if (-not $enc1 -or -not $enc2) {
            Write-Host "WARN No se pudo resolver encargado_id para estudiantes; se omiten pagos de encargados (Tesorería v2)." -ForegroundColor Yellow
        } else {
            $row1 = Get-TesoreriaEncargadoRow $enc1 $BaseUrl $headers
            $row2 = Get-TesoreriaEncargadoRow $enc2 $BaseUrl $headers

            $deuda1 = 0
            $deuda2 = 0
            try { $deuda1 = [double]($row1.deuda_pendiente) } catch { }
            try { $deuda2 = [double]($row2.deuda_pendiente) } catch { }

            $mExact = [int]([Math]::Max(1000, [Math]::Round($deuda1)))
            $mUnder = [int]([Math]::Max(500, [Math]::Round([Math]::Max(0, $deuda2 - 1500))))
            $mOver = [int]([Math]::Max(1500, [Math]::Round($deuda2 + 2000)))

            Write-Host "4.4 PAGOS ENCARGADOS (EXACTO / FALTANTE / SOBRANTE)" -ForegroundColor Green

            # 4.4.1 Exacto (no-efectivo: debe exigir evidencia al completar)
            $p1 = Try-InvokeJson "POST" "$BaseUrl/tesoreria/encargados/$enc1/pagos" $headers @{ monto = $mExact; fecha_pago = $f3; metodo = 'sinpe'; referencia = "RT-ENC1-EXACT-$f3"; detalle = "Pago exacto encargado 1" } "Crear pago encargado 1 (pendiente)"
            $p1id = Get-PagoIdFromResponse $p1
            if ($p1id) {
                Expect-HttpFailure "PATCH" "$BaseUrl/tesoreria/pagos/$p1id" $headers @{ metodo = 'sinpe'; estado = 'completado' } 400 "Completar sin evidencia (enc1)" | Out-Null
                Invoke-MultipartFileUpload "$BaseUrl/tesoreria/pagos/$p1id/comprobante" $headers $dummyPath "application/pdf" | Out-Null
                Try-InvokeJson "PATCH" "$BaseUrl/tesoreria/pagos/$p1id" $headers @{ metodo = 'sinpe'; numero_comprobante = "RT-$RunTag-$p1id"; fecha_comprobante = $f3; estado = 'verificado'; referencia = "RT-ENC1-EXACT-$f3" } "Verificar con evidencia (enc1)" | Out-Null
                Try-InvokeJson "GET" "$BaseUrl/tesoreria/pagos/$p1id/aplicaciones" $headers $null "Aplicaciones FIFO (enc1)" | Out-Null
            }

            # 4.4.2 Faltante
            $p2 = Try-InvokeJson "POST" "$BaseUrl/tesoreria/encargados/$enc2/pagos" $headers @{ monto = $mUnder; fecha_pago = $f3; metodo = 'transferencia'; referencia = "RT-ENC2-UNDER-$f3"; detalle = "Pago faltante encargado 2" } "Crear pago encargado 2 (faltante)"
            $p2id = Get-PagoIdFromResponse $p2
            if ($p2id) {
                Invoke-MultipartFileUpload "$BaseUrl/tesoreria/pagos/$p2id/comprobante" $headers $dummyPath "application/pdf" | Out-Null
                Try-InvokeJson "PATCH" "$BaseUrl/tesoreria/pagos/$p2id" $headers @{ metodo = 'transferencia'; numero_comprobante = "RT-$RunTag-$p2id"; fecha_comprobante = $f3; estado = 'completado'; referencia = "RT-ENC2-UNDER-$f3" } "Completar con evidencia (enc2 under)" | Out-Null
            }

            # 4.4.3 Sobrante
            $p3 = Try-InvokeJson "POST" "$BaseUrl/tesoreria/encargados/$enc2/pagos" $headers @{ monto = $mOver; fecha_pago = $f3; metodo = 'sinpe'; referencia = "RT-ENC2-OVER-$f3"; detalle = "Pago sobrante encargado 2" } "Crear pago encargado 2 (sobrante)"
            $p3id = Get-PagoIdFromResponse $p3
            if ($p3id) {
                Invoke-MultipartFileUpload "$BaseUrl/tesoreria/pagos/$p3id/comprobante" $headers $dummyPath "application/pdf" | Out-Null
                Try-InvokeJson "PATCH" "$BaseUrl/tesoreria/pagos/$p3id" $headers @{ metodo = 'sinpe'; numero_comprobante = "RT-$RunTag-$p3id"; fecha_comprobante = $f3; estado = 'verificado'; referencia = "RT-ENC2-OVER-$f3" } "Verificar con evidencia (enc2 over)" | Out-Null
            }
            Write-Host ""
        }

        Write-Host "4.5 PAGO A TUTOR (VALIDACIONES + EVIDENCIA)" -ForegroundColor Green
        # Refrescar bolsa aquí porque pagos de encargados pueden cambiarla.
        $bolsa = Get-TesoreriaBolsa $BaseUrl $headers
        $bolsaReal = 0
        try { $bolsaReal = [double]($bolsa.bolsa_real) } catch { }

        $tRow = Get-TesoreriaTutorRow ([int]$tutor.id) $BaseUrl $headers
        $porPagar = 0
        try { $porPagar = [double]($tRow.por_pagar) } catch { }

        Write-Host "4.5.1 SMOKE: ADELANTO SISTEMA -> AJUSTE -> RECUPERO FIFO" -ForegroundColor Green
        try {
            # Seleccionar 1-3 obligaciones pendientes del tutor para poder atribuir por sesión.
            $ot = Try-InvokeJson "GET" "$BaseUrl/tesoreria/tutores/$($tutor.id)/obligaciones?estado=pendiente" $headers $null "Obligaciones tutor (para adelanto)"
            $obsT = @()
            try { $obsT = @($ot.obligaciones) } catch { $obsT = @() }

            $sel = @()
            $selRows = @()
            $encAdv = $null
            $selMonto = 0.0
            foreach ($o in $obsT) {
                if ($sel.Count -ge 3) { break }
                $rest = 0.0
                try { $rest = [double]($o.restante) } catch { $rest = 0.0 }
                if ($rest -le 0) { continue }

                # Para que el smoke pueda verificar recupero FIFO, necesitamos poder inferir encargado_id.
                $encCand = $null
                try { $encCand = [int]$o.estudiantes.encargado_id } catch { $encCand = $null }
                if (-not $encCand -or $encCand -le 0) { continue }
                if (-not $encAdv) { $encAdv = $encCand }

                $sel += [int]$o.id
                $selRows += $o
                $selMonto += $rest
            }

            if ($sel.Count -lt 1 -or $selMonto -le 0) {
                Write-Host "WARN No hay obligaciones de tutor pendientes para probar adelanto." -ForegroundColor Yellow
            } else {
                $bolsa2 = Get-TesoreriaBolsa $BaseUrl $headers
                $bolsaReal2 = 0.0
                try { $bolsaReal2 = [double]($bolsa2.bolsa_real) } catch { }
                $mAdelanto = [int]([Math]::Max(1, [Math]::Min([Math]::Floor($bolsaReal2), [Math]::Ceiling($selMonto))))

                if ($mAdelanto -le 0) {
                    Write-Host "WARN Bolsa insuficiente para probar adelanto (monto=0)." -ForegroundColor Yellow
                } else {
                    $refAdv = "RT-TUTOR-ADV-SISTEMA-$f3"
                    $ptAdv = Try-InvokeJson "POST" "$BaseUrl/tesoreria/tutores/$($tutor.id)/pagos" $headers @{ monto = $mAdelanto; fecha_pago = $f3; metodo = 'efectivo'; referencia = $refAdv; detalle = 'Smoke adelanto sistema'; funding_mode = 'sistema'; obligacion_ids = $sel } "Pagar tutor con bolsa del sistema (efectivo)"
                    $ptAdvId = Get-PagoIdFromResponse $ptAdv
                    if (-not $encAdv) {
                        Write-Host "WARN No se pudo inferir encargado_id desde obligaciones tutor; se omite recupero." -ForegroundColor Yellow
                    } else {
                        # Ver ajustes pendientes (adelantos)
                        $eo1 = Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/$encAdv/obligaciones?estado=pendiente&tipo=all" $headers $null "Obligaciones encargado (cobro+ajuste)"
                        $encObs = @()
                        try { $encObs = @($eo1.obligaciones) } catch { $encObs = @() }

                        $deudaCobro = 0.0
                        $deudaAjuste = 0.0
                        foreach ($o in $encObs) {
                            $rest = 0.0
                            try { $rest = [double]($o.restante) } catch { $rest = 0.0 }
                            if ($rest -le 0) { continue }
                            if ($o.tipo -eq 'ajuste') { $deudaAjuste += $rest } else { $deudaCobro += $rest }
                        }

                        if ($deudaAjuste -le 0) {
                            Write-Host "WARN No se detectaron ajustes (adelanto_sistema) pendientes. ¿Aplicaste migración 022 y está usando RPC v3?" -ForegroundColor Yellow
                        } else {
                            # Pagar encargado suficiente para cubrir cobros + ajustes (así verificamos recupero FIFO).
                            $mEnc = [int]([Math]::Ceiling($deudaCobro + $deudaAjuste))
                            $refEnc = "RT-RECUPERO-$f3"
                            Try-InvokeJson "POST" "$BaseUrl/tesoreria/encargados/$encAdv/pagos" $headers @{ monto = $mEnc; fecha_pago = $f3; metodo = 'efectivo'; referencia = $refEnc; detalle = 'Smoke recupero adelanto sistema' } "Pagar encargado para recuperar ajustes" | Out-Null

                            $eo2 = Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/$encAdv/obligaciones?estado=pendiente&tipo=ajuste" $headers $null "Revisar ajustes pendientes post-pago"
                            $aj2 = 0.0
                            try {
                                foreach ($o in @($eo2.obligaciones)) {
                                    $r = 0.0
                                    try { $r = [double]($o.restante) } catch { $r = 0.0 }
                                    if ($r -gt 0) { $aj2 += $r }
                                }
                            } catch { }
                            if ($aj2 -gt 0) {
                                Write-Host "WARN Aún quedan ajustes pendientes tras el pago (restante=$aj2). Puede ser por cobros previos o monto insuficiente." -ForegroundColor Yellow
                            } else {
                                Write-Host "OK Recupero FIFO de adelanto sistema (ajustes saldados)" -ForegroundColor Cyan
                            }
                        }
                    }
                }
            }
        } catch {
            Write-Host "WARN Smoke adelanto/recupero falló (no bloqueante)." -ForegroundColor Yellow
            Write-Host ($_ | Out-String) -ForegroundColor DarkGray
        }
        Write-Host ""

        # Monto inválido: excede tanto bolsa_real como por_pagar para garantizar HTTP 400.
        $mBad = [int]([Math]::Max(1, [Math]::Round([Math]::Max($bolsaReal, $porPagar) + 1)))
        Expect-HttpFailure "POST" "$BaseUrl/tesoreria/tutores/$($tutor.id)/pagos" $headers @{ monto = $mBad; fecha_pago = $f3; metodo = 'transferencia'; referencia = "RT-TUTOR-TOO-MUCH-$f3"; detalle = 'Debe fallar por bolsa/por_pagar' } 400 "Pago tutor supera bolsa" | Out-Null

        $mTutor = [int]([Math]::Max(1000, [Math]::Min([Math]::Floor($bolsaReal), [Math]::Round([Math]::Max(0, $porPagar)))))
        if ($mTutor -gt 0) {
            $pt = Try-InvokeJson "POST" "$BaseUrl/tesoreria/tutores/$($tutor.id)/pagos" $headers @{ monto = $mTutor; fecha_pago = $f3; metodo = 'transferencia'; referencia = "RT-TUTOR-PAY-$f3"; detalle = 'Pago tutor test' } "Crear pago tutor (pendiente)"
            $ptid = Get-PagoIdFromResponse $pt
            if ($ptid) {
                Expect-HttpFailure "PATCH" "$BaseUrl/tesoreria/pagos/$ptid" $headers @{ metodo = 'transferencia'; estado = 'completado' } 400 "Completar tutor sin evidencia" | Out-Null
                Invoke-MultipartFileUpload "$BaseUrl/tesoreria/pagos/$ptid/comprobante" $headers $dummyPath "application/pdf" | Out-Null
                Try-InvokeJson "PATCH" "$BaseUrl/tesoreria/pagos/$ptid" $headers @{ metodo = 'transferencia'; numero_comprobante = "RT-$RunTag-$ptid"; fecha_comprobante = $f3; estado = 'verificado'; referencia = "RT-TUTOR-PAY-$f3" } "Verificar pago tutor" | Out-Null
            }
        } else {
            Write-Host "WARN No hay bolsa/por_pagar suficiente para simular pago tutor en v2." -ForegroundColor Yellow
        }

        Write-Host "4.6 CONSULTAR LIBRO DIARIO (TESORERIA V2)" -ForegroundColor Green
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/diario?fecha=$f1&incluir_pendientes=true" $headers $null "Diario $f1" | Out-Null
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/diario?fecha=$f2&incluir_pendientes=true" $headers $null "Diario $f2" | Out-Null
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/diario?fecha=$f3&incluir_pendientes=true" $headers $null "Diario $f3" | Out-Null
        Write-Host ""

        Write-Host "4.7 EXPORT XLSX (TESORERIA V2)" -ForegroundColor Green
        $xlsx1 = Join-Path $ArtifactsDir "tesoreria-diario-$RunTag.xlsx"
        try {
            Download-File "$BaseUrl/tesoreria/export/diario?fecha_inicio=$f1&fecha_fin=$f3" $headers $xlsx1
            Write-Host "OK Export diario XLSX: $xlsx1" -ForegroundColor Cyan
        } catch {
            Write-Host "WARN No se pudo exportar diario XLSX" -ForegroundColor Yellow
            Write-Host $_ -ForegroundColor DarkGray
        }

        if ($tRow -and $tRow.cuenta_id) {
            $xlsx2 = Join-Path $ArtifactsDir "tesoreria-cuenta-tutor-$RunTag.xlsx"
            try {
                Download-File "$BaseUrl/tesoreria/export/cuenta/$($tRow.cuenta_id)?fecha_inicio=$f1&fecha_fin=$f3" $headers $xlsx2
                Write-Host "OK Export cuenta tutor XLSX: $xlsx2" -ForegroundColor Cyan
            } catch {
                Write-Host "WARN No se pudo exportar cuenta tutor XLSX" -ForegroundColor Yellow
                Write-Host $_ -ForegroundColor DarkGray
            }
        }
        Write-Host ""

        Write-Host "4.8 CIERRE MENSUAL (LOCK) + ANTI-MODIFICACION" -ForegroundColor Green
        $mesIso = $SimEnd.ToString('yyyy-MM')
        # El endpoint exige que cerrado_hasta sea el último día del mes.
        $cerradoHasta = (Get-Date -Year $SimEnd.Year -Month $SimEnd.Month -Day 1).AddMonths(1).AddDays(-1).ToString('yyyy-MM-dd')
        $cierre = Try-InvokeJson "POST" "$BaseUrl/tesoreria/cierres" $headers @{ mes = $mesIso; cerrado_hasta = $cerradoHasta; nota = "RT cierre ($RunTag)" } "Crear cierre (tesorería v2)"
        if ($cierre) {
            # Intentar registrar pago en fecha cerrada (debe fallar 409)
            if ($enc1) {
                $fechaCerradaTest = $f3
                Expect-HttpFailure "POST" "$BaseUrl/tesoreria/encargados/$enc1/pagos" $headers @{ monto = 1000; fecha_pago = $fechaCerradaTest; metodo = 'efectivo'; referencia = "RT-CERRADO-$fechaCerradaTest"; detalle = 'Debe bloquear por cierre' } 409 "Registrar pago en periodo cerrado" | Out-Null
            }
        }
        Write-Host ""

        Write-Host "4.9 ROBUSTEZ (TESORERIA V2 + ANTI-BYPASS)" -ForegroundColor Green
        $noAuthHeaders = @{ "Content-Type" = "application/json" }
        Expect-HttpFailure "GET" "$BaseUrl/tutores" $noAuthHeaders $null 401 "GET /tutores sin Authorization" | Out-Null
        if ($enc1) {
            Expect-HttpFailure "POST" "$BaseUrl/tesoreria/encargados/$enc1/pagos" $headers @{ monto = 0; fecha_pago = $f3; metodo = 'efectivo'; referencia = 'RT-BAD-M0'; detalle = 'Monto 0 debe fallar' } 400 "Pago encargado monto=0" | Out-Null
        }
        # Anti-bypass: endpoints legacy deben rechazar mutaciones (410)
        Expect-HttpFailure "POST" "$BaseUrl/pagos/movimientos/manual" $headers @{ direccion = 'entrada'; monto = 100; fecha = $f3; metodo = 'efectivo'; referencia = 'RT-LEGACY-BYPASS'; categoria = 'Test'; detalle = 'Debe bloquear si legacy está deshabilitado' } 410 "Legacy mutación bloqueada" | Out-Null
        Write-Host ""
    }

    # Limpieza de artefactos temporales
    foreach ($p in @($dummyPath, $txtPath)) {
        try {
            if ($p -and (Test-Path -LiteralPath $p)) { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue }
        } catch { }
    }
} else {
    # Modo clásico: una sesión en lunes
    if ($TipoPago -eq 'mensual') {
        Write-Host "4.2 COMPLETAR SESION (mensual: NO genera movimientos al instante)" -ForegroundColor Green
    } else {
        Write-Host "4.2 COMPLETAR SESION (sesion: genera movimientos)" -ForegroundColor Green
    }

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
}

if ($CheckPagoPhase -and $TipoPago -eq 'mensual') {
    if ($TesoreriaMode -eq 'legacy') {
        Write-Host "4.3 CIERRE MENSUAL (LEGACY)" -ForegroundColor Green
        $now = Get-Date
        $anio = [int]$now.ToString('yyyy')
        $mes = [int]$now.ToString('MM')
        try {
            $cierre = Invoke-Json "POST" "$BaseUrl/pagos/cierre-mensual" $headers @{ anio = $anio; mes = $mes; force = $true }
            Write-Host "OK Cierre mensual ejecutado: insertados=$($cierre.insertados) skipped=$($cierre.skipped_existentes)" -ForegroundColor Cyan
        } catch {
            Write-Host "WARN No se pudo ejecutar cierre mensual" -ForegroundColor Yellow
            Write-Host $_ -ForegroundColor DarkGray
        }
    } else {
        Write-Host "4.3 CIERRE MENSUAL (TESORERIA V2 - LOCK)" -ForegroundColor Green
        $now = Get-Date
        $mesIso = $now.ToString('yyyy-MM')
        $cerradoHasta = (Get-Date -Year $now.Year -Month $now.Month -Day 1).AddMonths(1).AddDays(-1).ToString('yyyy-MM-dd')
        $cierresStatus = Try-InvokeJson "GET" "$BaseUrl/tesoreria/cierres" $headers $null ""
        $yaCerradoHasta = $null
        try { $yaCerradoHasta = $cierresStatus.cerrado_hasta } catch { }
        if ($yaCerradoHasta -and ("$cerradoHasta" -le "$yaCerradoHasta")) {
            Write-Host "OK Cierre ya aplicado (cerrado_hasta=$yaCerradoHasta)" -ForegroundColor Cyan
        } else {
            Try-InvokeJson "POST" "$BaseUrl/tesoreria/cierres" $headers @{ mes = $mesIso; cerrado_hasta = $cerradoHasta; nota = "Roundtrip cierre ($RunTag)" } "Crear cierre tesorería v2" | Out-Null
        }
    }
    Write-Host ""
}

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
    if ($TesoreriaMode -eq 'legacy') {
        # Pagos requiere rol admin/contador
        Try-InvokeJson "GET" "$BaseUrl/pagos" $headers $null "Endpoint /pagos accesible (admin/contador)"
        Try-InvokeJson "GET" "$BaseUrl/pagos/pendientes/resumen?tutor_id=$($tutor.id)" $headers $null "Resumen pendientes tutor (movimientos_dinero)"
    } else {
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/resumen" $headers $null "Endpoint /tesoreria/resumen"
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/diario?limit=10&incluir_pendientes=true" $headers $null "Endpoint /tesoreria/diario"
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/encargados/resumen" $headers $null "Endpoint /tesoreria/encargados/resumen"
        Try-InvokeJson "GET" "$BaseUrl/tesoreria/tutores/resumen" $headers $null "Endpoint /tesoreria/tutores/resumen"
    }

    # Finanzas puede requerir SUPABASE_SERVICE_KEY en backend
    Try-InvokeJson "GET" "$BaseUrl/finanzas/movimientos?curso_id=$($curso.id)" $headers $null "Endpoint /finanzas/movimientos (si hay service key)"
}

Write-Host "=== RESUMEN DEL ROUNDTRIP ===" -ForegroundColor Yellow
Write-Host "OK Tutor: $($tutor.nombre) (ID: $($tutor.id))" -ForegroundColor Green
if ($tutor2 -and $tutor2.id) {
    Write-Host "OK Tutor 2: $($tutor2.nombre) (ID: $($tutor2.id))" -ForegroundColor Green
}
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
        tutor2Id = $(if ($tutor2 -and $tutor2.id) { $tutor2.id } else { $null })
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
