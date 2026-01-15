# 🪟 Guía de Inicio para Windows PowerShell

## Requisitos Previos

✅ Node.js 16+ instalado  
✅ npm 8+ instalado

### Verificar instalación:
```powershell
node --version
npm --version
```

---

## 📥 Paso 1: Instalar Dependencias

### 1.1 Instalar dependencias del Backend

```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\backend"
npm install
```

**Espera a que termine la instalación** (puede tardar 1-2 minutos)

### 1.2 Instalar dependencias del Frontend

```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\frontend"
npm install
```

---

## 🚀 Paso 2: Ejecutar la Aplicación

### Opción A: Ejecutar ambos servidores (Recomendado)

Desde la carpeta raíz:

```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika"
npm run dev
```

**Resultado esperado**:
- Backend iniciará en `http://localhost:5000`
- Frontend iniciará en `http://localhost:3000`

### Opción B: Ejecutar servidores por separado (Avanzado)

**PowerShell 1 - Backend**:
```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\backend"
npm run dev
```

**PowerShell 2 - Frontend** (abrir nueva ventana):
```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\frontend"
npm run dev
```

---

## 🌐 Paso 3: Acceder a la Aplicación

Abre tu navegador favorito y ve a:

```
http://localhost:3000
```

**¡Listo!** Ya deberías ver la interfaz de Linguistika

---

## 💡 Primeras Acciones

### 1. Crear un Tutor
1. Haz clic en **"Tutores"**
2. Clic en **"+ Nuevo Tutor"**
3. Rellena el formulario:
   - Nombre: `María García`
   - Especialidad: `Inglés`
   - Tarifa: `25` (€/hora)
4. Clic en **"Guardar"**

### 2. Crear un Curso
1. Ve a **"Cursos"**
2. Clic en **"+ Nuevo Curso"**
3. Rellena:
   - Nombre: `Inglés Básico`
   - Nivel: `A1`
4. Clic en **"Guardar"**

### 3. Registrar un Estudiante
1. Ve a **"Estudiantes"**
2. Clic en **"+ Nuevo Estudiante"**
3. Rellena:
   - Nombre: `Juan Pérez`
4. Clic en **"Guardar"**

### 4. Crear una Matrícula
1. Ve a **"Matrículas"**
2. Clic en **"+ Nueva Matrícula"**
3. Selecciona:
   - Estudiante: `Juan Pérez`
   - Curso: `Inglés Básico`
   - Tutor: `María García`
4. Clic en **"Matricular"**

### 5. Ver Dashboard
1. Haz clic en **"Dashboard"**
2. ¡Verás las estadísticas!

---

## ⚠️ Troubleshooting

### Problema: "Puerto 3000/5000 ya en uso"

**Solución**:

```powershell
# Para el puerto 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Para el puerto 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Reemplaza `<PID>` con el número mostrado por netstat.

### Problema: "npm: el término 'npm' no se reconoce"

**Solución**: Node.js no está instalado correctamente
1. Descarga e instala desde https://nodejs.org
2. Reinicia PowerShell
3. Verifica: `npm --version`

### Problema: "Cannot find module 'express'"

**Solución**: Las dependencias no se instalaron
```powershell
cd backend
npm install --verbose
```

### Problema: Frontend muestra "No se puede alcanzar el servidor"

**Solución**: 
1. Verifica que el backend esté corriendo en otra PowerShell
2. Abre la consola del navegador (F12)
3. Revisa si hay errores de CORS

### Problema: Base de datos vacía

**Solución**:
1. Detén el servidor (Ctrl+C)
2. Elimina `backend\linguistika.db` si existe
3. Reinicia el servidor

---

## 🔄 Comandos Útiles

```powershell
# Ver versión de Node
node --version

# Ver versión de npm
npm --version

# Actualizar npm
npm install -g npm@latest

# Limpiar caché npm
npm cache clean --force

# Reinstalar dependencias
cd backend
rm node_modules -Force -Recurse
npm install
```

---

## 📁 Estructura de Carpetas (Windows)

```
C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika\
├── backend\
│   ├── routes\
│   ├── database.js
│   ├── server.js
│   ├── package.json
│   └── linguistika.db (se crea automáticamente)
├── frontend\
│   ├── src\
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── README.md
├── QUICKSTART.md
└── package.json
```

---

## 🎯 Desarrollar Localmente

### Reiniciar aplicación
```powershell
# Ctrl+C para detener
# npm run dev para reiniciar
```

### Ver logs del servidor
Los logs aparecen directamente en la terminal de PowerShell

### Editar código
- Frontend: Edita archivos en `frontend\src\`
- Backend: Edita archivos en `backend\routes\`
- Los cambios se reflejan automáticamente (hot reload)

---

## 📦 Actualizar Dependencias

```powershell
cd backend
npm update

cd ../frontend
npm update
```

---

## 🚀 Compilar para Producción

```powershell
cd "C:\Users\reysh\OneDrive - UNADECA\Desktop\linguistika"
npm run build
```

Esto crea carpetas `backend/dist` y `frontend/dist` listas para desplegar.

---

## 📞 Soporte Rápido

| Problema | Comando |
|----------|---------|
| Reimiciar servidor | `Ctrl+C` luego `npm run dev` |
| Ver puertos en uso | `netstat -ano` |
| Matar proceso | `taskkill /PID <PID> /F` |
| Limpiar npm | `npm cache clean --force` |
| Reinstalar todo | `rm node_modules -r; npm install` |

---

## ✅ Checklist de Inicio

- [ ] Node.js y npm instalados
- [ ] Dependencias instaladas (`npm install`)
- [ ] Backend en ejecución
- [ ] Frontend en ejecución
- [ ] Navegador abierto en `http://localhost:3000`
- [ ] ¡Crear tu primer tutor!

---

**Versión**: 1.0.0  
**Sistema Operativo**: Windows 10/11  
**Shell**: PowerShell 5.1+

¡Disfruta usando Linguistika! 🎉
