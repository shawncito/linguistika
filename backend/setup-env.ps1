# 🔧 Script de Configuración de .env
# Ejecutar: .\setup-env.ps1

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔧 Configuración de Linguistika .env  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Este script te ayudará a configurar el archivo .env con tus credenciales de Supabase.`n" -ForegroundColor Yellow

# Verificar si ya existe .env
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Host "⚠️  Ya existe un archivo .env" -ForegroundColor Yellow
    $overwrite = Read-Host "¿Deseas sobrescribirlo? (s/n)"
    if ($overwrite -ne "s" -and $overwrite -ne "S") {
        Write-Host "`n❌ Operación cancelada.`n" -ForegroundColor Red
        exit
    }
    # Crear backup del existente
    Copy-Item $envPath "$envPath.old" -Force
    Write-Host "💾 Backup del .env anterior guardado como .env.old`n" -ForegroundColor Green
}

Write-Host "📝 Por favor ingresa tus credenciales de Supabase:" -ForegroundColor Cyan
Write-Host "   (Puedes obtenerlas en: https://supabase.com/dashboard > Settings > API)`n"

# Pedir URL
Write-Host "1️⃣  SUPABASE_URL" -ForegroundColor White
Write-Host "   Ejemplo: https://xxxxxxxxxxxxx.supabase.co" -ForegroundColor DarkGray
$url = Read-Host "   Ingresa el URL"

# Validar URL
if (-not ($url -match "^https://.*\.supabase\.co$")) {
    Write-Host "`n⚠️  Advertencia: El URL no parece tener el formato correcto de Supabase" -ForegroundColor Yellow
    Write-Host "   Debería ser algo como: https://proyecto.supabase.co`n" -ForegroundColor Yellow
}

# Pedir anon key
Write-Host "`n2️⃣  SUPABASE_ANON_KEY (anon/public key)" -ForegroundColor White
Write-Host "   Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor DarkGray
$anon = Read-Host "   Ingresa la clave"

# Validar anon key
if (-not ($anon -match "^eyJ")) {
    Write-Host "`n⚠️  Advertencia: La clave anon normalmente empieza con 'eyJ'" -ForegroundColor Yellow
}

# Pedir service role key
Write-Host "`n3️⃣  SUPABASE_SERVICE_KEY (service_role key)" -ForegroundColor White
Write-Host "   ⚠️  SECRETO - Esta clave tiene permisos de administrador" -ForegroundColor Red
Write-Host "   Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor DarkGray
$service = Read-Host "   Ingresa la clave"

# Validar service key
if (-not ($service -match "^eyJ")) {
    Write-Host "`n⚠️  Advertencia: La clave service_role normalmente empieza con 'eyJ'" -ForegroundColor Yellow
}

if ($anon -eq $service) {
    Write-Host "`n⚠️  Advertencia: Las claves anon y service_role son iguales." -ForegroundColor Yellow
    Write-Host "   Normalmente son diferentes. ¿Estás seguro?" -ForegroundColor Yellow
    $continue = Read-Host "   ¿Continuar de todos modos? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        Write-Host "`n❌ Operación cancelada.`n" -ForegroundColor Red
        exit
    }
}

# Crear contenido del .env
$content = @"
# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL=$url
SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_KEY=$service

# SERVIDOR
HOST=127.0.0.1
PORT=5000
"@

# Guardar archivo
try {
    $content | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline
    Write-Host "`n✅ Archivo .env creado correctamente en:" -ForegroundColor Green
    Write-Host "   $envPath`n" -ForegroundColor White
    
    # Crear backup adicional
    Copy-Item $envPath "$envPath.backup" -Force
    Write-Host "💾 Backup de seguridad creado: .env.backup`n" -ForegroundColor Yellow
    
    # Mostrar configuración (sin las claves completas)
    Write-Host "📋 Configuración guardada:" -ForegroundColor Cyan
    Write-Host "   SUPABASE_URL: $url" -ForegroundColor White
    Write-Host "   SUPABASE_ANON_KEY: $($anon.Substring(0, 20))..." -ForegroundColor White
    Write-Host "   SUPABASE_SERVICE_KEY: $($service.Substring(0, 20))..." -ForegroundColor White
    Write-Host "   HOST: 127.0.0.1" -ForegroundColor White
    Write-Host "   PORT: 5000`n" -ForegroundColor White
    
    Write-Host "🎉 ¡Listo! Ahora puedes ejecutar la aplicación.`n" -ForegroundColor Green
    Write-Host "Para probar la conexión:" -ForegroundColor Cyan
    Write-Host "   cd .." -ForegroundColor White
    Write-Host "   npm run desktop:dev`n" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ Error al crear el archivo .env:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Preguntar si desea probar la conexión
$test = Read-Host "¿Deseas probar la conexión a Supabase ahora? (s/n)"
if ($test -eq "s" -or $test -eq "S") {
    Write-Host "`n🔍 Probando conexión a Supabase...`n" -ForegroundColor Cyan
    
    try {
        $testResult = node -e "import('../backend/supabase.js').then(m => console.log('OK')).catch(e => {console.error('ERROR:', e.message); process.exit(1)})" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Conexión a Supabase exitosa!`n" -ForegroundColor Green
        } else {
            Write-Host "❌ Error al conectar con Supabase:" -ForegroundColor Red
            Write-Host "   $testResult`n" -ForegroundColor Red
            Write-Host "💡 Verifica que las credenciales sean correctas.`n" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  No se pudo ejecutar el test de conexión." -ForegroundColor Yellow
        Write-Host "   Puedes probarlo manualmente después.`n" -ForegroundColor Yellow
    }
}

Write-Host "═════════════════════════════════════════`n" -ForegroundColor Cyan
