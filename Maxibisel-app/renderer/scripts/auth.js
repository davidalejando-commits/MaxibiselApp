// Manejo de autenticación - VERSIÓN CORREGIDA
import { eventManager } from './eventManager.js';

export const authManager = {
    currentUser: null,
    isLoggedIn: false,
    token: null,
    isInitialized: false,

    async init() {
        console.log('🔧 Inicializando AuthManager...');

        // Prevenir inicialización múltiple
        if (this.isInitialized) {
            console.warn('⚠️ AuthManager ya está inicializado');
            return;
        }

        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        this.setupEventListeners();
        
        // Intentar recuperar sesión guardada
        const hasSession = await this.checkStoredSession();
        
        if (hasSession) {
            console.log('✅ Sesión válida encontrada');
            await this.initializeApp();
        } else {
            console.log('ℹ️ No hay sesión válida');
            this.showLoginScreen();
        }

        this.isInitialized = true;
        console.log('✅ AuthManager inicializado');
    },

    async checkStoredSession() {
        try {
            console.log('🔍 Verificando sesión guardada...');
            
            const token = await window.api.store.get('authToken');
            const user = await window.api.store.get('user');

            if (!token || !user) {
                console.log('ℹ️ No hay token o usuario guardado');
                return false;
            }

            // Verificar que el token sea válido haciendo una petición
            try {
                await window.api.health();
                
                // Token válido, restaurar sesión
                this.token = token;
                this.currentUser = user;
                this.isLoggedIn = true;
                
                console.log('✅ Sesión restaurada:', user.username);
                return true;
                
            } catch (error) {
                console.warn('⚠️ Token inválido, limpiando sesión');
                await this.clearStoredSession();
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error verificando sesión:', error);
            return false;
        }
    },

    async clearStoredSession() {
        await window.api.store.delete('authToken');
        await window.api.store.delete('user');
        this.token = null;
        this.currentUser = null;
        this.isLoggedIn = false;
    },

    setupEventListeners() {
        const loginForm = this.safeGetElement('login-form');
        const logoutBtn = this.safeGetElement('logout-btn');

        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    },

    safeGetElement(id, required = false) {
        const element = document.getElementById(id);
        if (!element && required) {
            console.error(`❌ Elemento requerido '${id}' no encontrado`);
        } else if (!element) {
            console.warn(`⚠️ Elemento '${id}' no encontrado`);
        }
        return element;
    },

    showLoginScreen() {
        console.log('🔐 Mostrando pantalla de login');
        
        const authContainer = this.safeGetElement('auth-container');
        const appContainer = this.safeGetElement('app-container');

        if (authContainer) {
            authContainer.classList.remove('d-none');
        }
        
        if (appContainer) {
            appContainer.classList.add('d-none');
        }

        // Limpiar y enfocar campos
        const usernameEl = this.safeGetElement('username');
        const passwordEl = this.safeGetElement('password');
        const errorEl = this.safeGetElement('login-error');

        if (usernameEl) {
            usernameEl.value = '';
            setTimeout(() => usernameEl.focus(), 100);
        }
        
        if (passwordEl) {
            passwordEl.value = '';
        }
        
        if (errorEl) {
            errorEl.classList.add('d-none');
        }
    },

    async handleLogin(event) {
        event.preventDefault();

        const usernameEl = this.safeGetElement('username', true);
        const passwordEl = this.safeGetElement('password', true);

        if (!usernameEl || !passwordEl) {
            this.showLoginError('Elementos del formulario no encontrados');
            return;
        }

        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();

        if (!username || !password) {
            this.showLoginError('Por favor, complete todos los campos');
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';

        try {
            // Mostrar loading
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Iniciando sesión...';
            }

            this.hideLoginError();

            console.log('🔐 Procesando login...');
            
            // Realizar login
            const response = await window.api.login({ username, password });

            if (!response.token) {
                throw new Error('No se recibió token de autenticación');
            }

            // Guardar en memoria
            this.token = response.token;
            this.currentUser = response.user;
            this.isLoggedIn = true;

            console.log('✅ Login exitoso:', this.currentUser.username);

            // Verificar que el token se guardó
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const tokenSaved = await window.api.store.get('authToken');
            if (!tokenSaved) {
                throw new Error('Error al guardar el token');
            }
            
            console.log('✅ Token verificado y guardado');

            // Inicializar aplicación
            await this.initializeApp();

            // Emitir evento de login exitoso
            eventManager.emit('auth:login-success', this.currentUser);

        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showLoginError(error.message || 'Error de autenticación');
            await this.clearStoredSession();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText || 'Iniciar Sesión';
            }
        }
    },

    async initializeApp() {
        console.log('🚀 Inicializando aplicación...');

        try {
            // Actualizar UI
            this.updateUIAfterLogin();

            // Esperar un momento para asegurar que el DOM esté actualizado
            await new Promise(resolve => setTimeout(resolve, 200));

            // Cargar datos críticos
            await this.loadCriticalData();

            // Configurar vista por defecto
            this.setupDefaultView();

            console.log('✅ Aplicación inicializada correctamente');

        } catch (error) {
            console.error('❌ Error al inicializar aplicación:', error);
            throw error;
        }
    },

    async loadCriticalData() {
        console.log('📦 Cargando datos críticos...');

        try {
            // Esperar a que productManager esté disponible
            let attempts = 0;
            while (!window.productManager && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.productManager) {
                throw new Error('ProductManager no disponible');
            }

            console.log('✅ ProductManager encontrado');

            // Inicializar productManager si es necesario
            if (typeof window.productManager.init === 'function') {
                await window.productManager.init();
            }

            // Cargar productos
            if (typeof window.productManager.loadProducts === 'function') {
                console.log('📥 Cargando productos...');
                await window.productManager.loadProducts();
                
                const count = window.productManager.products?.length || 0;
                console.log(`✅ ${count} productos cargados`);

                if (count === 0) {
                    console.warn('⚠️ No se cargaron productos');
                }
            }

            // Inicializar otros managers si están disponibles
            if (window.salesManager && typeof window.salesManager.loadInitialData === 'function') {
                console.log('🛒 Inicializando salesManager...');
                await window.salesManager.loadInitialData();
            }

            if (window.transactionManager && typeof window.transactionManager.loadProducts === 'function') {
                console.log('📋 Inicializando transactionManager...');
                await window.transactionManager.loadProducts();
            }

            // Emitir evento de datos cargados
            eventManager.emit('auth:data-loaded', {
                timestamp: Date.now(),
                productsCount: window.productManager?.products?.length || 0
            });

        } catch (error) {
            console.error('❌ Error cargando datos críticos:', error);
            
            // Mostrar advertencia pero no bloquear el login
            if (window.uiManager && typeof window.uiManager.showAlert === 'function') {
                window.uiManager.showAlert(
                    'Algunos datos no se cargaron. Intenta recargar la aplicación.',
                    'warning'
                );
            }
        }
    },

    updateUIAfterLogin() {
        console.log('🖥️ Actualizando interfaz...');

        const authContainer = this.safeGetElement('auth-container');
        const appContainer = this.safeGetElement('app-container');
        const userDisplay = this.safeGetElement('user-display');
        const adminMenuItem = this.safeGetElement('admin-menu-item');

        if (authContainer) {
            authContainer.classList.add('d-none');
        }

        if (appContainer) {
            appContainer.classList.remove('d-none');
        }

        if (userDisplay && this.currentUser) {
            userDisplay.textContent = this.currentUser.fullName || this.currentUser.username;
        }

        if (adminMenuItem && this.currentUser) {
            if (this.currentUser.role === 'admin') {
                adminMenuItem.classList.remove('d-none');
            } else {
                adminMenuItem.classList.add('d-none');
            }
        }
    },

    setupDefaultView() {
        console.log('📄 Configurando vista por defecto...');

        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Desactivar todos los nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Activar vista de productos
        const productsSection = this.safeGetElement('products-section');
        const productsNavLink = document.querySelector('[data-view="products"]');

        if (productsSection) {
            productsSection.classList.add('active');
        }

        if (productsNavLink) {
            productsNavLink.classList.add('active');
        }

        // Emitir evento de vista activada
        eventManager.emit('view:activated', {
            viewName: 'products',
            timestamp: Date.now()
        });
    },

    showLoginError(message) {
        const errorElement = this.safeGetElement('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('d-none');
        } else {
            console.error('❌ Error de login:', message);
            alert('Error: ' + message);
        }
    },

    hideLoginError() {
        const errorElement = this.safeGetElement('login-error');
        if (errorElement) {
            errorElement.classList.add('d-none');
        }
    },

    async handleLogout() {
        try {
            console.log('👋 Cerrando sesión...');

            // Intentar logout en servidor
            try {
                await window.api.logout();
            } catch (error) {
                console.warn('⚠️ Error en logout del servidor:', error);
            }

            // Limpiar sesión local
            await this.clearStoredSession();

            // Resetear UI
            this.resetUIAfterLogout();

            // Emitir evento de logout
            eventManager.emit('auth:logout');

            console.log('✅ Sesión cerrada');

        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
        }
    },

    resetUIAfterLogout() {
        console.log('🔄 Reseteando interfaz...');

        const appContainer = this.safeGetElement('app-container');
        const authContainer = this.safeGetElement('auth-container');

        if (appContainer) {
            appContainer.classList.add('d-none');
        }

        if (authContainer) {
            authContainer.classList.remove('d-none');
        }

        // Limpiar campos
        const usernameEl = this.safeGetElement('username');
        const passwordEl = this.safeGetElement('password');
        const errorEl = this.safeGetElement('login-error');

        if (usernameEl) {
            usernameEl.value = '';
            setTimeout(() => usernameEl.focus(), 100);
        }

        if (passwordEl) {
            passwordEl.value = '';
        }

        if (errorEl) {
            errorEl.classList.add('d-none');
        }

        // Resetear managers si están disponibles
        if (window.productManager && typeof window.productManager.reset === 'function') {
            window.productManager.reset();
        }

        if (window.salesManager && typeof window.salesManager.reset === 'function') {
            window.salesManager.reset();
        }
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    isAuthenticated() {
        return this.isLoggedIn && this.currentUser !== null && this.token !== null;
    },

    getToken() {
        return this.token;
    },

    getUser() {
        return this.currentUser;
    }
};