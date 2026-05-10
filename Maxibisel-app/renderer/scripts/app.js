import { salesManager } from './sales.js';
import { transactionManager } from './transactions.js';
import { productManager } from './products.js';
import { uiManager } from './ui.js';
import { eventManager } from './eventManager.js';
import { BarcodeGenerator } from './barcode-generator.js';
import { activityLogger } from './activityLogger.js';

let barcodeGenerator = null;
let currentUser = null;
let isAuthenticated = false;

window.productManager = productManager;
window.salesManager = salesManager;
window.transactionManager = transactionManager;
window.uiManager = uiManager;
window.eventManager = eventManager;
window.activityLogger = activityLogger;

console.log('✅ Managers expuestos globalmente');


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


async function initialize() {
    console.log('🚀 Iniciando aplicación...');

    try {
        // Verificar backend
        const backendOk = await checkBackend();
        if (!backendOk) {
            alert('Error: No se puede conectar con el servidor');
            return;
        }

        setupNavigation();

        console.log('ℹ️ Mostrando pantalla de login');
        showLogin();

    } catch (error) {
        console.error('💥 Error fatal:', error);
        alert('Error al iniciar la aplicación: ' + error.message);
        showLogin();
    }
}


async function clearSession() {
    currentUser = null;
    isAuthenticated = false;
    await window.api.store.delete('authToken');
    await window.api.store.delete('user');
    console.log('🗑️ Sesión limpiada');
}


function showLogin() {
    console.log('🔐 Mostrando login');

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (authContainer) authContainer.classList.remove('d-none');
    if (appContainer) appContainer.classList.add('d-none');

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    if (username) {
        username.value = '';
        setTimeout(() => username.focus(), 100);
    }
    if (password) password.value = '';
    if (loginError) loginError.classList.add('d-none');

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }
}

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

        try {
            await window.api.health();
        } catch (healthError) {
            throw new Error('No hay conexión con el servidor. Verifica tu conexión a internet.');
        }

        const response = await window.api.login({ username, password });

        console.log('📥 Respuesta recibida:', {
            hasResponse: !!response,
            hasToken: !!response?.token,
            hasUser: !!response?.user,
            success: response?.success
        });

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

        await new Promise(resolve => setTimeout(resolve, 300));

        const savedToken = await window.api.store.get('authToken');
        if (!savedToken) {
            throw new Error('Error al guardar la sesión. Intenta nuevamente.');
        }

        console.log('✅ Token guardado y verificado');

        activityLogger.log({
            tipo: 'USUARIO',
            accion: 'Inicio de sesión exitoso',
            usuario: currentUser.username || currentUser.fullName,
            entidad: 'Sesión'
        });

        document.getElementById('username').value = '';
        document.getElementById('password').value = '';

        await loadApplication();

    } catch (error) {
        console.error('❌ Error en login:', error);
        
        let errorMessage = 'Error de autenticación';
        
        if (error.message?.includes('servidor') || 
            error.message?.includes('conexión') ||
            error.message?.includes('internet') ||
            error.message?.includes('Network') ||
            error.message?.includes('timeout') ||
            error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('fetch')) {
            errorMessage = '🌐 Sin conexión al servidor. Verifica tu conexión a internet.';
        }
        else if (error.message?.includes('usuario no existe')) {
            errorMessage = '👤 El usuario no existe';
        }
        else if (error.message?.includes('contraseña') || 
                 error.message?.includes('incorrectos') ||
                 error.message?.includes('incorrecta')) {
            errorMessage = '🔒 Usuario o contraseña incorrectos';
        }
        else if (error.message?.includes('No se recibió token') ||
                 error.message?.includes('Invalid credentials') ||
                 !error.message) {
            errorMessage = '🔒 Usuario o contraseña incorrectos';
        }
        else if (error.message?.includes('campos')) {
            errorMessage = '📝 ' + error.message;
        }
        else if (error.message?.includes('guardar')) {
            errorMessage = '💾 ' + error.message;
        }
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

async function loadApplication() {
    console.log('📱 Cargando aplicación...');

    try {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');

        if (authContainer) authContainer.classList.add('d-none');
        if (appContainer) appContainer.classList.remove('d-none');

        const userDisplay = document.getElementById('user-display');
        if (userDisplay && currentUser) {
            userDisplay.textContent = currentUser.fullName || currentUser.username;
        }

        const adminMenu = document.getElementById('admin-menu-item');
        if (adminMenu && currentUser) {
            if (currentUser.role === 'admin') {
                adminMenu.classList.remove('d-none');
            } else {
                adminMenu.classList.add('d-none');
            }
        }

        console.log('📊 Inicializando Activity Logger...');
        activityLogger.init();

        console.log('⏳ Esperando antes de cargar datos...');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('📦 Cargando productos...');
        await loadAllData();

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

    try {
        if (productManager && typeof productManager.loadProducts === 'function') {
            await productManager.loadProducts();
            console.log('✅ Productos cargados');
        }
    } catch (error) {
        console.error('❌ Error productos:', error);
        errors.push('Productos');
    }

    try {
        if (salesManager && typeof salesManager.loadInitialData === 'function') {
            await salesManager.loadInitialData();
            console.log('✅ Ventas cargadas');
        }
    } catch (error) {
        console.error('❌ Error ventas:', error);
        errors.push('Ventas');
    }

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

function setupNavigation() {
    console.log('🧭 Configurando navegación...');

    document.querySelectorAll('[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            showView(view);
        });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    console.log('✅ Navegación configurada');
}

function showView(viewName) {
    console.log(`📄 Mostrando vista: ${viewName}`);

    const allViews = document.querySelectorAll('.view-container');
    allViews.forEach(view => {
        view.classList.add('d-none');
        view.style.display = 'none';
    });

    document.querySelectorAll('[data-view]').forEach(link => {
        link.classList.remove('active');
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('d-none');
        targetView.style.display = 'block';
        console.log(`✅ Vista ${viewName} activada`);
    } else {
        console.error(`❌ Vista ${viewName}-view no encontrada`);
    }

    const activeLink = document.querySelector(`[data-view="${viewName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    initView(viewName);
}


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

async function handleLogout() {
    console.log('👋 Cerrando sesión...');

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

    if (productManager?.reset) productManager.reset();
    if (salesManager?.reset) salesManager.reset();
    
    if (barcodeGenerator) {
        barcodeGenerator = null;
        console.log('🗑️ Generador de códigos reseteado');
    }

    showLogin();

    uiManager.showAlert('Sesión cerrada', 'success');
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ app.js cargado');