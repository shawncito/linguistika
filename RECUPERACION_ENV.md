# 🆘 Recuperación de Credenciales .env

**Fecha:** 16 de febrero de 2026  
**Problema:** El archivo `.env` se sobrescribió durante el proceso de merge/clean

---

## 📋 Opciones de Recuperación

### 🔄 OPCIÓN 1: Historial de Versiones de OneDrive (MÁS FÁCIL)

Como tu proyecto está en OneDrive, hay alta probabilidad de recuperación:

1. **Abre el Explorador de Windows**
2. **Navega a:** 
   ```
   C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\linguistika\backend
   ```
3. **Clic derecho** en el archivo `.env`
4. **Selecciona:** "Historial de versiones" o "Ver versiones en línea"
5. **Busca** una versión de antes de las 10:58 AM de hoy
6. **Restaura** esa versión

**📸 También puedes intentar por la web:**
- Ve a: https://onedrive.live.com
- Navega a la carpeta del proyecto
- Clic derecho en `.env` → "Historial de versiones"

---

### 🔑 OPCIÓN 2: Obtener las Credenciales de Supabase (SI NO HAY BACKUP)

Si OneDrive no tiene versiones anteriores, puedes obtener las credenciales fácilmente:

#### Paso 1: Acceder a tu Proyecto Supabase

1. **Ve a:** https://supabase.com/dashboard/projects
2. **Inicia sesión** con tu cuenta
3. **Selecciona** tu proyecto (probablemente se llama "linguistika" o similar)

#### Paso 2: Obtener las Credenciales

1. En el panel izquierdo, ve a: **Settings** (⚙️) → **API**
2. **Copia** los siguientes valores:

   ```
   📍 Project URL:
      Busca: "API URL" o "Project URL"
      Ejemplo: https://xxxxxxxxxxxxx.supabase.co
      
   🔑 anon/public key:
      Busca: "anon public"
      Es una clave larga que empieza con "eyJ..."
      
   🔐 service_role key:
      Busca: "service_role" 
      ⚠️ SECRETO - No compartir públicamente
      También empieza con "eyJ..." pero es diferente
   ```

#### Paso 3: Actualizar el .env

Edita el archivo `backend/.env` y pega tus credenciales:

```env
# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL=https://[TU-PROYECTO].supabase.co
SUPABASE_ANON_KEY=eyJ[tu-clave-anon-aqui]
SUPABASE_SERVICE_KEY=eyJ[tu-service-role-key-aqui]

# SERVIDOR
HOST=127.0.0.1
PORT=5000
```

#### Paso 4: Verificar

```powershell
# Desde la raíz del proyecto
cd backend
node -c server.js
```

Si no hay errores, las credenciales están correctas.

---

### 💾 OPCIÓN 3: Búsqueda en Papelera de Reciclaje

Aunque poco probable, vale la pena revisar:

1. **Abre la Papelera de Reciclaje**
2. **Busca:** archivos con ".env" en el nombre
3. **Verifica la fecha** de eliminación (debería ser de hoy)
4. **Restaurar** si lo encuentras

---

## 🛡️ Prevención Futura

Para evitar que esto vuelva a pasar:

### 1. Crear Backup Manual

```powershell
# Ejecutar esto regularmente
Copy-Item backend\.env backend\.env.backup -Force
```

### 2. Agregar a .gitignore (pero hacer backup)

El `.env` ya está en `.gitignore`, pero considera:

```powershell
# Crear un .env.local con tus credenciales
# Y agregar a .gitignore:
backend/.env.local
```

### 3. Usar Variables de Entorno del Sistema

Para producción, considera usar variables de entorno de Windows en vez de .env:

```powershell
# PowerShell (configura una vez, persiste)
[System.Environment]::SetEnvironmentVariable("SUPABASE_URL", "tu-url", "User")
[System.Environment]::SetEnvironmentVariable("SUPABASE_ANON_KEY", "tu-key", "User")
```

---

## ⚡ Script Rápido de Configuración

Guarda esto como `backend/setup-env.ps1`:

```powershell
# Script para configurar .env interactivamente

Write-Host "`n🔧 Configuración de Linguistika .env`n" -ForegroundColor Cyan

# Pedir credenciales
$url = Read-Host "SUPABASE_URL (ej: https://xxxxx.supabase.co)"
$anon = Read-Host "SUPABASE_ANON_KEY (empieza con eyJ...)"
$service = Read-Host "SUPABASE_SERVICE_KEY (empieza con eyJ...)"

# Crear contenido
$content = @"
# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL=$url
SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_KEY=$service

# SERVIDOR
HOST=127.0.0.1
PORT=5000
"@

# Guardar
$envPath = Join-Path $PSScriptRoot ".env"
$content | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline

Write-Host "`n✅ Archivo .env creado correctamente en:`n   $envPath`n" -ForegroundColor Green

# Crear backup
Copy-Item $envPath "$envPath.backup" -Force
Write-Host "💾 Backup creado: .env.backup`n" -ForegroundColor Yellow
```

**Para usarlo:**
```powershell
cd backend
.\setup-env.ps1
```

---

## 🔍 Verificación de Credenciales

Una vez que tengas el `.env` configurado:

```powershell
# Test 1: Ver si el archivo existe y tiene contenido
cd backend
Get-Content .env

# Test 2: Verificar conexión a Supabase
node -e "import('./supabase.js').then(m => console.log('✅ Conexión exitosa'))"

# Test 3: Ejecutar servidor
node server.js
# Debería mostrar: "🚀 Servidor ejecutándose en http://127.0.0.1:5000"
```

---

## 📞 Checklist

- [ ] Intenté recuperar desde OneDrive (Historial de versiones)
- [ ] Obtuve las credenciales de Supabase Dashboard
- [ ] Actualicé backend/.env con mis credenciales
- [ ] Verifiqué la conexión con `node -e ...`
- [ ] Creé un backup: `.env.backup`
- [ ] La app ahora funciona correctamente

---

## 🚨 Si Nada Funciona

Si no puedes recuperar las credenciales y no recuerdas cuál era tu proyecto de Supabase:

1. **Revisa tu email** - Supabase envía confirmaciones cuando creas proyectos
2. **Revisa tu navegador** - Historial de navegación de supabase.com
3. **Crea un proyecto nuevo** en Supabase y ejecuta las migraciones desde cero

---

**¿Pudiste recuperar las credenciales?** 

Si sigues con problemas, dime:
- ¿Recuerdas el nombre de tu proyecto en Supabase?
- ¿Aparecen versiones anteriores en OneDrive?
- ¿Tienes acceso al dashboard de Supabase?
