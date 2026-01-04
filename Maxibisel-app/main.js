// Archivo principal 
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');

// Para almacenar configuraciones y tokens
const store = new Store();

let mainWindow;
let loadingWindow;
let backendProcess = null;
let isBackendReady = false;
let backendPort = 5000;
let isShuttingDown = false; // Prevenir ciclos infinitos

// Configuración de desarrollo/producción
const isDev = process.env.NODE_ENV === 'development';

// NUEVO: Configurar el ícono de la app ANTES de que se muestre
app.setName('Sistema de Inventario Óptico');

// Función para matar procesos en puerto específico - MEJORADA
function killProcessOnPort(port) {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            // Windows: comando más específico y confiable
            const command = `netstat -ano | findstr :${port} | findstr LISTENING`;
            exec(command, (error, stdout) => {
                if (!error && stdout) {
                    const lines = stdout.trim().split('\n');
                    const killPromises = lines.map(line => {
                        const parts = line.trim().split(/\s+/);
                        const pid = parts[parts.length - 1];

                        if (pid && pid !== '0' && !isNaN(pid)) {
                            return new Promise(resolveKill => {
                                exec(`taskkill /F /PID ${pid}`, () => resolveKill());
                            });
                        }
                        return Promise.resolve();
                    });

                    Promise.all(killPromises).then(() => {
                        setTimeout(resolve, 1000);
                    });
                } else {
                    resolve();
                }
            });
        } else {
            // Unix/Linux/Mac
            exec(`lsof -ti:${port}`, (error, stdout) => {
                if (!error && stdout) {
                    const pids = stdout.trim().split('\n').filter(pid => pid);
                    const killPromises = pids.map(pid =>
                        new Promise(resolveKill => {
                            exec(`kill -9 ${pid}`, () => resolveKill());
                        })
                    );

                    Promise.all(killPromises).then(() => {
                        setTimeout(resolve, 1000);
                    });
                } else {
                    resolve();
                }
            });
        }
    });
}

// Función simple para verificar si un puerto está disponible
function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        const timeout = setTimeout(() => {
            server.close();
            resolve(false);
        }, 1000);

        server.listen(port, () => {
            clearTimeout(timeout);
            server.once('close', () => resolve(true));
            server.close();
        });

        server.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

// Función para encontrar puerto disponible
async function findFreePort(startPort = 5000) {
    for (let port = startPort; port < startPort + 5; port++) {
        // Primero verificar si está libre
        if (await isPortFree(port)) {
            return port;
        }

        // Si está ocupado, intentar liberarlo
        console.log(`Puerto ${port} ocupado, intentando liberarlo...`);
        await killProcessOnPort(port);

        // Verificar nuevamente
        if (await isPortFree(port)) {
            console.log(`Puerto ${port} liberado exitosamente`);
            return port;
        }
    }
    throw new Error('No se encontró un puerto disponible');
}

// Función para verificar salud del backend
async function checkBackendHealth(port) {
    try {
        const response = await axios.get(`http://127.0.0.1:${port}/api/health`, {
            timeout: 2000,
            family: 4
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Función para buscar backend existente
async function findExistingBackend() {
    for (let port = 5000; port < 5005; port++) {
        if (await checkBackendHealth(port)) {
            console.log(`✅ Backend encontrado en puerto ${port}`);
            backendPort = port;
            isBackendReady = true;
            return true;
        }
    }
    return false;
}

// NUEVA: Función para actualizar mensaje de loading
function updateLoadingMessage(message) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.webContents.executeJavaScript(`
            const messageEl = document.getElementById('loading-message');
            if (messageEl) {
                messageEl.textContent = '${message}';
            }
        `).catch(() => {
            // Ignorar errores si la ventana no está lista
        });
    }
}

// Función para iniciar backend
async function startBackend() {
    try {
        console.log('🚀 Iniciando backend...');
        updateLoadingMessage('Verificando servidor existente...');

        // Verificar si ya existe un backend funcional
        if (await findExistingBackend()) {
            updateLoadingMessage('Servidor encontrado, conectando...');
            return true;
        }

        updateLoadingMessage('Buscando archivos del servidor...');

        // Buscar carpeta del backend
        const backendPaths = [
            path.join(process.resourcesPath, 'backend'), // PRODUCCIÓN
            path.join(__dirname, '..', 'backend'),        // DESARROLLO
            path.join(__dirname, 'backend'),
            path.join(process.cwd(), 'backend')
        ];

        let backendPath = null;
        for (const testPath of backendPaths) {
            if (fs.existsSync(path.join(testPath, 'package.json'))) {
                backendPath = testPath;
                break;
            }
        }

        if (!backendPath) {
            throw new Error('No se encontró la carpeta del backend');
        }

        updateLoadingMessage('Preparando servidor...');

        // Encontrar puerto libre
        backendPort = await findFreePort(5000);
        console.log(`Usando puerto: ${backendPort}`);

        // Configurar variables de entorno
        const env = {
            ...process.env,
            PORT: backendPort.toString(),
            NODE_ENV: isDev ? 'development' : 'production',
            HOST: '127.0.0.1'
        };

        updateLoadingMessage('Iniciando servidor backend...');

        // Determinar comando según entorno (start para producción, dev para desarrollo)
        const backendCommand = app.isPackaged ? 'start' : 'dev';
        const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

        // Iniciar proceso del backend
        backendProcess = spawn(npmCommand, ['run', backendCommand], {
            cwd: backendPath,
            env: env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        // Almacenar PID para limpieza posterior
        if (backendProcess.pid) {
            store.set('backend_pid', backendProcess.pid);
            console.log(`Backend PID almacenado: ${backendProcess.pid}`);
        }

        // Manejar salida del backend
        backendProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) console.log('Backend:', output);
        });

        backendProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString().trim();
            if (errorOutput && !errorOutput.includes('npm warn')) {
                console.error('Backend Error:', errorOutput);
            }
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend cerrado con código: ${code}`);
            isBackendReady = false;
            backendProcess = null;
            store.delete('backend_pid');
        });

        backendProcess.on('error', (error) => {
            console.error('Error del proceso backend:', error);
            isBackendReady = false;
            backendProcess = null;
            store.delete('backend_pid');
        });

        updateLoadingMessage('Esperando respuesta del servidor...');

        // Esperar a que el backend esté listo
        for (let attempt = 1; attempt <= 30; attempt++) {
            if (await checkBackendHealth(backendPort)) {
                console.log('✅ Backend listo!');
                isBackendReady = true;
                updateLoadingMessage('¡Servidor listo! Iniciando aplicación...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Pausa breve para mostrar mensaje
                return true;
            }
            updateLoadingMessage(`Conectando con servidor (${attempt}/30)...`);
            console.log(`Esperando backend... (${attempt}/30)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('Backend no se inició en 30 segundos');

    } catch (error) {
        console.error('Error al iniciar backend:', error);
        updateLoadingMessage('Error al iniciar servidor');
        return false;
    }
}

// Crear ventana principal - MEJORADA con ícono personalizado
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'renderer', 'assets', 'LogoMMini.png'),
        show: false, // No mostrar hasta que esté completamente cargada
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        if (loadingWindow && !loadingWindow.isDestroyed()) {
            loadingWindow.close();
        }
        mainWindow.show();
        console.log('✅ Aplicación lista!');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// MEJORADA: Ventana de carga con diseño atractivo y mensajes informativos
function showLoadingWindow() {
    const iconPath = path.join(__dirname, 'renderer', 'assets', 'LogoMMini.png');

    loadingWindow = new BrowserWindow({
        width: 450,
        height: 280,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        icon: iconPath, // Aplicar el ícono personalizado también aquí
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Permitir recursos locales
        }
    });

    // Crear archivo HTML temporal para la ventana de loading
    const loadingHtmlPath = path.join(__dirname, 'loading.html');

    // Verificar si el logo existe y crear el HTML
    let logoHTML = '';
    if (fs.existsSync(iconPath)) {
        try {
            const logoBase64 = fs.readFileSync(iconPath).toString('base64');
            logoHTML = `background-image: url('data:image/png;base64,${logoBase64}'); background-size: contain; background-repeat: no-repeat; background-position: center;`;
        } catch (error) {
            console.log('Error al cargar el logo:', error.message);
        }
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cargando...</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }
        
        .logo-container {
            margin-bottom: 20px;
            animation: fadeInScale 0.8s ease-out;
        }
        
        .logo {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 16px;
            padding: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            ${logoHTML}
        }
        
        .app-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            text-align: center;
            animation: fadeInUp 0.8s ease-out 0.2s both;
        }
        
        .app-subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 30px;
            text-align: center;
            animation: fadeInUp 0.8s ease-out 0.4s both;
        }
        
        .spinner-container {
            display: flex;
            align-items: center;
            gap: 15px;
            animation: fadeInUp 0.8s ease-out 0.6s both;
        }
        
        .spinner { 
            border: 3px solid rgba(255,255,255,0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }
        
        .loading-message {
            font-size: 16px;
            font-weight: 500;
            min-width: 200px;
        }
        
        .version {
            position: absolute;
            bottom: 20px;
            right: 20px;
            font-size: 12px;
            opacity: 0.7;
            animation: fadeIn 1s ease-out 1s both;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeInScale {
            0% { 
                opacity: 0; 
                transform: scale(0.8); 
            }
            100% { 
                opacity: 1; 
                transform: scale(1); 
            }
        }
        
        @keyframes fadeInUp {
            0% { 
                opacity: 0; 
                transform: translateY(20px); 
            }
            100% { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }
        
        @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="logo-container">
        <div class="logo"></div>
    </div>
    <h1 class="app-title">Sistema de Inventario</h1>
    <p class="app-subtitle">Gestión óptima de productos</p>
    
    <div class="spinner-container">
        <div class="spinner"></div>
        <div id="loading-message" class="loading-message">Iniciando aplicación...</div>
    </div>
    
    <div class="version">v1.0.0</div>
</body>
</html>`;

    // Escribir el archivo HTML temporal
    try {
        fs.writeFileSync(loadingHtmlPath, htmlContent);
        loadingWindow.loadFile(loadingHtmlPath);

        // Limpiar el archivo temporal después de cargar
        loadingWindow.webContents.once('did-finish-load', () => {
            setTimeout(() => {
                try {
                    if (fs.existsSync(loadingHtmlPath)) {
                        fs.unlinkSync(loadingHtmlPath);
                    }
                } catch (error) {
                    console.log('Error al limpiar archivo temporal:', error.message);
                }
            }, 1000);
        });

    } catch (error) {
        console.error('Error al crear ventana de loading:', error);
        // Fallback simple si hay error
        loadingWindow.loadURL('data:text/html,<html><body style="background:#667eea;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial;"><div style="text-align:center;"><h2>Sistema de Inventario</h2><p>Iniciando aplicación...</p></div></body></html>');
    }
}

// Configurar URL de la API
function getApiUrl() {
    return `http://127.0.0.1:${backendPort}/api`;
}

// Función de cierre limpio - Evitando ciclos infinitos
async function cleanShutdown() {
    if (isShuttingDown) {
        console.log('Cierre ya en progreso...');
        return;
    }

    isShuttingDown = true;
    console.log('🔄 Iniciando cierre limpio...');

    try {
        // ✅ NUEVO: Limpiar datos de sesión al cerrar la app
        console.log('🧹 Limpiando datos de sesión...');
        store.delete('authToken');
        store.delete('user');
        console.log('✅ Sesión limpiada correctamente');
        
        // Cerrar proceso del backend si existe
        if (backendProcess && !backendProcess.killed) {
            console.log('Cerrando backend process...');
            try {
                backendProcess.kill('SIGTERM');

                // Esperar un poco para cierre graceful
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Si aún existe, forzar cierre
                if (backendProcess && !backendProcess.killed) {
                    console.log('Forzando cierre del backend...');
                    backendProcess.kill('SIGKILL');
                }
            } catch (killError) {
                console.log('Error al cerrar backend:', killError.message);
            }
        }

        // Limpiar puerto por si acaso
        await killProcessOnPort(backendPort);

        // Limpiar datos almacenados del backend
        store.delete('backend_pid');

        console.log('✅ Cierre limpio completado');
    } catch (error) {
        console.error('Error durante cierre:', error);
    } finally {
        // Cerrar la aplicación SIN llamar app.quit() recursivamente
        process.exit(0);
    }
}

// Configurar eventos de aplicación
app.whenReady().then(async () => {
    console.log('🚀 Aplicación iniciada');

    setupIpcHandlers();
    showLoadingWindow();

    const backendStarted = await startBackend();

    if (!backendStarted) {
        console.error('❌ No se pudo iniciar el backend');
        if (loadingWindow && !loadingWindow.isDestroyed()) {
            loadingWindow.close();
        }
        dialog.showErrorBox('Error', 'No se pudo iniciar el servidor backend.');
        cleanShutdown();
        return;
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0 && !isShuttingDown) {
            createWindow();
        }
    });
});

// Eventos de cierre - CORREGIDOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        cleanShutdown();
    }
});

app.on('before-quit', (event) => {
    if (!isShuttingDown) {
        event.preventDefault();
        cleanShutdown();
    }
});

// Manejar señales del sistema
process.on('SIGINT', cleanShutdown);
process.on('SIGTERM', cleanShutdown);

// Configurar manejadores IPC
function setupIpcHandlers() {
    // Login - CORREGIDO
    ipcMain.handle('api:login', async (event, credentials) => {
        if (!isBackendReady) {
            return {
                success: false,
                message: 'Backend no disponible'
            };
        }

        try {
            console.log('🔐 Procesando login en main...');
            
            const response = await axios.post(`${getApiUrl()}/auth/login`, credentials, {
                timeout: 10000,
                family: 4
            });

            console.log('✅ Respuesta de login recibida:', {
                hasToken: !!response.data.token,
                hasUser: !!response.data.user
            });

            // Guardar token INMEDIATAMENTE
            if (response.data.token) {
                store.set('authToken', response.data.token);
                console.log('✅ Token guardado en store (main)');
            } else {
                console.error('❌ No se recibió token en la respuesta');
            }
            
            if (response.data.user) {
                store.set('user', response.data.user);
                console.log('✅ Usuario guardado en store');
            }

            return response.data;
        } catch (error) {
            console.error('❌ Error en login (main):', error.response?.data || error.message);
            
            return {
                success: false,
                message: error.response?.data?.message || 'Error de autenticación'
            };
        }
    });

    // ✅ CORRECCIÓN CRÍTICA: Handler de API requests
    ipcMain.handle('api:request', async (event, { method, endpoint, data, requiresAuth = true }) => {
        console.log('\n📡 [MAIN] ========== INICIO REQUEST ==========');
        console.log(`📡 [MAIN] ${method.toUpperCase()} /${endpoint}`);
        
        if (!isBackendReady) {
            console.error('❌ [MAIN] Backend no disponible');
            return {
                success: false,
                message: 'Backend no disponible'
            };
        }

        try {
            // Obtener token desde el store
            const token = requiresAuth ? store.get('authToken') : null;

            if (requiresAuth && !token) {
                console.error('❌ [MAIN] No hay token disponible');
                return {
                    success: false,
                    message: 'No hay sesión activa. Por favor inicia sesión nuevamente.'
                };
            }

            console.log(`📡 [MAIN] URL: ${getApiUrl()}/${endpoint.replace(/^\//, '')}`);
            console.log(`📡 [MAIN] Auth: ${!!token ? 'YES' : 'NO'}`);

            const config = {
                method: method.toLowerCase(),
                url: `${getApiUrl()}/${endpoint.replace(/^\//, '')}`,
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                family: 4
            };

            if (requiresAuth && token) {
                config.headers['Authorization'] = `Bearer ${token}`;
                console.log('✅ [MAIN] Token incluido en headers');
            }

            if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
                config.data = data;
                console.log('📦 [MAIN] Data incluida:', JSON.stringify(data).substring(0, 100));
            }

            const response = await axios(config);
            
            console.log(`✅ [MAIN] Response Status: ${response.status}`);
            console.log(`✅ [MAIN] Response Data:`, JSON.stringify(response.data).substring(0, 200));
            console.log('📡 [MAIN] ========== FIN REQUEST ==========\n');
            
            // ✅ CORRECCIÓN: Siempre retornar response.data
            return response.data;
            
        } catch (error) {
            console.error('💥 [MAIN] ========== ERROR EN REQUEST ==========');
            console.error(`💥 [MAIN] Error en ${method.toUpperCase()} /${endpoint}`);
            console.error('💥 [MAIN] Error status:', error.response?.status);
            console.error('💥 [MAIN] Error data:', error.response?.data);
            console.error('💥 [MAIN] Error message:', error.message);
            console.error('💥 [MAIN] =========================================\n');

            // Si es error 401, limpiar token
            if (error.response?.status === 401 && requiresAuth) {
                console.warn('⚠️ [MAIN] Token inválido, limpiando store...');
                store.delete('authToken');
                store.delete('user');
            }
            
            // ✅ CORRECCIÓN CRÍTICA: NO lanzar error, retornar objeto con estructura
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Error de conexión',
                error: error.response?.data || { message: error.message },
                status: error.response?.status
            };
        }
    });

    // Salud del backend
    ipcMain.handle('api:health', async () => {
        return {
            status: 'Ready',
            port: backendPort,
            timestamp: Date.now()
        };
    });

    // Manejadores de store - CON LOGS
    ipcMain.handle('store:get', async (event, key) => {
        const value = store.get(key);
        console.log(`📦 Store GET: ${key} = ${value ? 'exists' : 'null'}`);
        return value;
    });
    
    ipcMain.handle('store:set', async (event, key, value) => {
        store.set(key, value);
        console.log(`📦 Store SET: ${key} = ${typeof value}`);
        return true;
    });
    
    ipcMain.handle('store:delete', async (event, key) => {
        store.delete(key);
        console.log(`📦 Store DELETE: ${key}`);
        return true;
    });
    
    ipcMain.handle('store:clear', async () => {
        store.clear();
        console.log('📦 Store CLEAR: all data');
        return true;
    });

    // Configuración de la app
    ipcMain.handle('app:getConfig', async () => ({
        version: app.getVersion(),
        name: app.getName(),
        isDev: isDev,
        platform: process.platform,
        apiUrl: getApiUrl()
    }));

    // Reiniciar app
    ipcMain.handle('app:restart', async () => {
        app.relaunch();
        cleanShutdown();
    });
}

// Manejo de errores - CORREGIDO
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
    if (!isShuttingDown) {
        cleanShutdown();
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('Promise rechazada:', reason);
});
