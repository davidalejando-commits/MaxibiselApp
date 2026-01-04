import { salesManager } from './sales.js';
import { transactionManager } from './transactions.js';
import { productManager } from './products.js';
import { uiManager } from './ui.js';
import { eventManager } from './eventManager.js';
import { BarcodeGenerator } from './barcode-generator.js';
import { activityLogger } from './activityLogger.js';

// ==================== VARIABLES GLOBALES ====================
let barcodeGenerator = null;
let currentUser = null;
let isAuthenticated = false;

// ==================== EXPONER MANAGERS ====================
window.productManager = productManager;
window.salesManager = salesManager;
window.transactionManager = transactionManager;
window.uiManager = uiManager;
window.eventManager = eventManager;
window.activityLogger = activityLogger;

console.log('✅ Managers expuestos globalmente');

// ==================== VERIFICACIÓN DE BACKEND ====================

async function checkBackend() {
    try {
        await window.api.health();
        console.log('✅ Backend conectado');
        return true;
    } catch (error) {
        console.error('❌ Backend no disponible:', error);
        return false;
    }
}

// ==================== INICIALIZACIÓN ====================

async function initialize() {
    console.log('🚀 Iniciando aplicación...');

    try {
        // Verificar backend
        const backendOk = await checkBackend();
        if (!backendOk) {
            alert('Error: No se puede conectar con el servidor');
            return;
        }

        // Configurar navegación
        setupNavigation();

        // ✅ SIEMPRE MOSTRAR LOGIN PRIMERO
        console.log('ℹ️ Mostrando pantalla de login');
        showLogin();

    } catch (error) {
        console.error('💥 Error fatal:', error);
        alert('Error al iniciar la aplicación: ' + error.message);
        showLogin();
    }
}

// ==================== GESTIÓN DE SESIÓN ====================

async function clearSession() {
    currentUser = null;
    isAuthenticated = false;
    await window.api.store.delete('authToken');
    await window.api.store.delete('user');
    console.log('🗑️ Sesión limpiada');
}

// ==================== PANTALLA DE LOGIN ====================

function showLogin() {
    console.log('🔐 Mostrando login');

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (authContainer) authContainer.classList.remove('d-none');
    if (appContainer) appContainer.classList.add('d-none');

    // Limpiar campos
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    if (username) {
        username.value = '';
        setTimeout(() => username.focus(), 100);
    }
    if (password) password.value = '';
    if (loginError) loginError.classList.add('d-none');

    // Configurar formulario
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }
}

// ✅ FUNCIÓN MEJORADA: Manejo de errores específicos
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    const loginBtn = e.target.querySelector('button[type="submit"]');
    const loginError = document.getElementById('login-error');

    if (!username || !password) {
        showError('Por favor, complete todos los campos');
        return;
    }

    const originalText = loginBtn?.innerHTML || 'Iniciar Sesión';

    try {
        // Mostrar loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Iniciando sesión...';
        }
        if (loginError) loginError.classList.add('d-none');

        console.log('🔐 Login en proceso...');

        // ✅ VERIFICAR CONEXIÓN PRIMERO
        try {
            await window.api.health();
        } catch (healthError) {
            throw new Error('No hay conexión con el servidor. Verifica tu conexión a internet.');
        }

        // Hacer login
        const response = await window.api.login({ username, password });

        // ✅ VERIFICAR RESPUESTA COMPLETA
        console.log('📥 Respuesta recibida:', {
            hasResponse: !!response,
            hasToken: !!response?.token,
            hasUser: !!response?.user,
            success: response?.success
        });

        // ✅ MANEJO MEJORADO: Verificar si es un error del servidor
        if (response && response.success === false) {
            // El servidor respondió con un error específico
            throw new Error(response.message || 'Usuario o contraseña incorrectos');
        }

        if (!response || !response.token) {
            // No hay respuesta o no hay token = credenciales incorrectas
            throw new Error('Usuario o contraseña incorrectos');
        }

        if (!response.user) {
            throw new Error('Error al obtener información del usuario');
        }

        currentUser = response.user;
        isAuthenticated = true;

        console.log('✅ Login exitoso:', currentUser.username);

        // Esperar a que el token se guarde
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verificar token guardado
        const savedToken = await window.api.store.get('authToken');
        if (!savedToken) {
            throw new Error('Error al guardar la sesión. Intenta nuevamente.');
        }

        console.log('✅ Token guardado y verificado');

        // Registrar login en activity log
        activityLogger.log({
            tipo: 'USUARIO',
            accion: 'Inicio de sesión exitoso',
            usuario: currentUser.username || currentUser.fullName,
            entidad: 'Sesión'
        });

        // Limpiar formulario
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';

        // Cargar aplicación
        await loadApplication();

    } catch (error) {
        console.error('❌ Error en login:', error);
        
        // ✅ MENSAJES DE ERROR ESPECÍFICOS Y AMIGABLES
        let errorMessage = 'Error de autenticación';
        
        // Errores de red/conexión
        if (error.message?.includes('servidor') || 
            error.message?.includes('conexión') ||
            error.message?.includes('internet') ||
            error.message?.includes('Network') ||
            error.message?.includes('timeout') ||
            error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('fetch')) {
            errorMessage = '🌐 Sin conexión al servidor. Verifica tu conexión a internet.';
        }
        // Errores de credenciales del backend (en español)
        else if (error.message?.includes('usuario no existe')) {
            errorMessage = '👤 El usuario no existe';
        }
        else if (error.message?.includes('contraseña') || 
                 error.message?.includes('incorrectos') ||
                 error.message?.includes('incorrecta')) {
            errorMessage = '🔒 Usuario o contraseña incorrectos';
        }
        // Error genérico de credenciales
        else if (error.message?.includes('No se recibió token') ||
                 error.message?.includes('Invalid credentials') ||
                 !error.message) {
            errorMessage = '🔒 Usuario o contraseña incorrectos';
        }
        // Otros errores específicos
        else if (error.message?.includes('campos')) {
            errorMessage = '📝 ' + error.message;
        }
        else if (error.message?.includes('guardar')) {
            errorMessage = '💾 ' + error.message;
        }
        // Usar el mensaje del error si es descriptivo
        else if (error.message && error.message.length < 100) {
            errorMessage = error.message;
        }
        
        showError(errorMessage);
        await clearSession();
        
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    }
}

function showError(message) {
    const loginError = document.getElementById('login-error');
    if (loginError) {
        loginError.innerHTML = message; // Usar innerHTML para permitir emojis
        loginError.classList.remove('d-none');
    }
    console.error('🚫', message);
}

// ==================== CARGA DE APLICACIÓN ====================

async function loadApplication() {
    console.log('📱 Cargando aplicación...');

    try {
        // Mostrar app
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');

        if (authContainer) authContainer.classList.add('d-none');
        if (appContainer) appContainer.classList.remove('d-none');

        // Actualizar usuario en UI
        const userDisplay = document.getElementById('user-display');
        if (userDisplay && currentUser) {
            userDisplay.textContent = currentUser.fullName || currentUser.username;
        }

        // Mostrar/ocultar menú admin
        const adminMenu = document.getElementById('admin-menu-item');
        if (adminMenu && currentUser) {
            if (currentUser.role === 'admin') {
                adminMenu.classList.remove('d-none');
            } else {
                adminMenu.classList.add('d-none');
            }
        }

        // Inicializar Activity Logger
        console.log('📊 Inicializando Activity Logger...');
        activityLogger.init();

        console.log('⏳ Esperando antes de cargar datos...');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Cargar datos
        console.log('📦 Cargando productos...');
        await loadAllData();

        // Mostrar vista de productos
        showView('products');

        console.log('✅ Aplicación cargada correctamente');

    } catch (error) {
        console.error('💥 Error cargando aplicación:', error);
        uiManager.showAlert('Error al cargar: ' + error.message, 'danger');
        await handleLogout();
    }
}

async function loadAllData() {
    const errors = [];

    // Cargar productos
    try {
        if (productManager && typeof productManager.loadProducts === 'function') {
            await productManager.loadProducts();
            console.log('✅ Productos cargados');
        }
    } catch (error) {
        console.error('❌ Error productos:', error);
        errors.push('Productos');
    }

    // Cargar datos de ventas
    try {
        if (salesManager && typeof salesManager.loadInitialData === 'function') {
            await salesManager.loadInitialData();
            console.log('✅ Ventas cargadas');
        }
    } catch (error) {
        console.error('❌ Error ventas:', error);
        errors.push('Ventas');
    }

    // Cargar transacciones
    try {
        if (transactionManager && typeof transactionManager.loadProducts === 'function') {
            await transactionManager.loadProducts();
            console.log('✅ Transacciones cargadas');
        }
    } catch (error) {
        console.error('❌ Error transacciones:', error);
        errors.push('Transacciones');
    }

    if (errors.length > 0) {
        console.warn('⚠️ Errores al cargar:', errors.join(', '));
        uiManager.showAlert(
            'Algunos datos no se cargaron. Recarga la aplicación.',
            'warning'
        );
    }
}

// ==================== NAVEGACIÓN ====================

function setupNavigation() {
    console.log('🧭 Configurando navegación...');

    // Links de navegación
    document.querySelectorAll('[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            showView(view);
        });
    });

    // Botón de logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    console.log('✅ Navegación configurada');
}

function showView(viewName) {
    console.log(`📄 Mostrando vista: ${viewName}`);

    // Ocultar todas las vistas
    const allViews = document.querySelectorAll('.view-container');
    allViews.forEach(view => {
        view.classList.add('d-none');
        view.style.display = 'none';
    });

    // Desactivar todos los nav links
    document.querySelectorAll('[data-view]').forEach(link => {
        link.classList.remove('active');
    });

    // Mostrar SOLO la vista seleccionada
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('d-none');
        targetView.style.display = 'block';
        console.log(`✅ Vista ${viewName} activada`);
    } else {
        console.error(`❌ Vista ${viewName}-view no encontrada`);
    }

    // Activar nav link correspondiente
    const activeLink = document.querySelector(`[data-view="${viewName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Inicializar vista
    initView(viewName);
}

// ==================== INICIALIZACIÓN DE VISTAS ====================

function initView(viewName) {
    switch (viewName) {
        case 'products':
            if (productManager?.init) productManager.init();
            break;
        case 'sales':
            if (salesManager?.init) salesManager.init();
            break;
        case 'transactions':
            if (transactionManager?.init) transactionManager.init();
            break;
        case 'users':
            initBarcodeGenerator();
            break;
    }
}

// ==================== GENERADOR DE CÓDIGOS DE BARRA ====================

async function initBarcodeGenerator() {
    console.log('📊 Inicializando generador de códigos de barra...');
    
    try {
        if (!barcodeGenerator) {
            barcodeGenerator = new BarcodeGenerator();
            console.log('✅ Generador de códigos creado');
        }
        
        await barcodeGenerator.init();
        console.log('✅ Generador de códigos inicializado');
        
    } catch (error) {
        console.error('❌ Error al inicializar generador de códigos:', error);
        uiManager.showAlert('Error al cargar el generador de códigos', 'danger');
    }
}

// ==================== LOGOUT ====================

async function handleLogout() {
    console.log('👋 Cerrando sesión...');

    // Registrar cierre de sesión
    if (currentUser) {
        activityLogger.log({
            tipo: 'USUARIO',
            accion: 'Cierre de sesión',
            usuario: currentUser.username || currentUser.fullName,
            entidad: 'Sesión'
        });
    }

    try {
        await window.api.logout();
    } catch (error) {
        console.warn('⚠️ Error logout servidor:', error);
    }

    await clearSession();

    // Resetear managers
    if (productManager?.reset) productManager.reset();
    if (salesManager?.reset) salesManager.reset();
    
    if (barcodeGenerator) {
        barcodeGenerator = null;
        console.log('🗑️ Generador de códigos reseteado');
    }

    showLogin();

    uiManager.showAlert('Sesión cerrada', 'success');
}

// ==================== INICIO ====================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ app.js cargado');