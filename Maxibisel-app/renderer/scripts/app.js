// app.js - VERSIÓN FINAL SIMPLIFICADA Y FUNCIONAL

import { salesManager } from './sales.js';
import { transactionManager } from './transactions.js';
import { productManager } from './products.js';
import { uiManager } from './ui.js';
import { eventManager } from './eventManager.js';
import { BarcodeGenerator } from './barcode-generator.js';

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

        // Verificar sesión guardada
        const hasSession = await checkSavedSession();

        if (hasSession) {
            console.log('✅ Sesión válida encontrada');
            await loadApplication();
        } else {
            console.log('ℹ️ No hay sesión, mostrando login');
            showLogin();
        }

    } catch (error) {
        console.error('💥 Error fatal:', error);
        alert('Error al iniciar la aplicación: ' + error.message);
        showLogin();
    }
}

// ==================== GESTIÓN DE SESIÓN ====================

async function checkSavedSession() {
    try {
        const token = await window.api.store.get('authToken');
        const user = await window.api.store.get('user');

        if (!token || !user) {
            return false;
        }

        // Verificar que el token funcione
        try {
            await window.api.health();
            currentUser = user;
            isAuthenticated = true;
            console.log('✅ Sesión restaurada:', user.username);
            return true;
        } catch (error) {
            console.warn('⚠️ Token inválido');
            await clearSession();
            return false;
        }

    } catch (error) {
        console.error('❌ Error verificando sesión:', error);
        return false;
    }
}

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

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    const loginBtn = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');

    if (!username || !password) {
        showError('Completa todos los campos');
        return;
    }

    const originalText = loginBtn?.textContent || 'Iniciar Sesión';

    try {
        // Mostrar loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Iniciando...';
        }
        if (loginError) loginError.classList.add('d-none');

        console.log('🔐 Login en proceso...');

        // Hacer login
        const response = await window.api.login({ username, password });

        if (!response.token) {
            throw new Error('No se recibió token');
        }

        currentUser = response.user;
        isAuthenticated = true;

        console.log('✅ Login exitoso:', currentUser.username);

        // Esperar a que el token se guarde
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verificar token
        const savedToken = await window.api.store.get('authToken');
        if (!savedToken) {
            throw new Error('Token no se guardó correctamente');
        }

        console.log('✅ Token guardado y verificado');

        // Limpiar formulario
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';

        // Cargar aplicación
        await loadApplication();

    } catch (error) {
        console.error('❌ Error en login:', error);
        showError(error.message || 'Error de autenticación');
        await clearSession();
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    }
}

function showError(message) {
    const loginError = document.getElementById('login-error');
    if (loginError) {
        loginError.textContent = message;
        loginError.classList.remove('d-none');
    }
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
// 🆕 MODIFICADO: Agregada inicialización del generador de códigos de barra

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
            // 🆕 NUEVO: Inicializar generador de códigos de barra
            initBarcodeGenerator();
            break;
    }
}

// ==================== GENERADOR DE CÓDIGOS DE BARRA ====================
// 🆕 NUEVO: Función para inicializar el generador

async function initBarcodeGenerator() {
    console.log('📊 Inicializando generador de códigos de barra...');
    
    try {
        // Crear instancia si no existe
        if (!barcodeGenerator) {
            barcodeGenerator = new BarcodeGenerator();
            console.log('✅ Generador de códigos creado');
        }
        
        // Inicializar
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

    try {
        await window.api.logout();
    } catch (error) {
        console.warn('⚠️ Error logout servidor:', error);
    }

    await clearSession();

    // Resetear managers
    if (productManager?.reset) productManager.reset();
    if (salesManager?.reset) salesManager.reset();
    
    // 🆕 NUEVO: Resetear generador de códigos
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