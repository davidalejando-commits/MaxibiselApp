//Manejo de autenticación - SIN persistencia de token
import { eventManager } from './eventManager.js';

export const authManager = {
    currentUser: null,
    isLoggedIn: false,

    init() {
        console.log('🔧 Inicializando AuthManager (sin persistencia)...');

        // Asegurar que el DOM esté completamente cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.showLoginScreen(); // Siempre mostrar login al iniciar
            });
        } else {
            this.setupEventListeners();
            this.showLoginScreen(); // Siempre mostrar login al iniciar
        }
    },

    setupEventListeners() {
        // Verificar que los elementos existan antes de agregar listeners
        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('logout-btn');

        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        } else {
            console.warn('Elemento login-form no encontrado');
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        } else {
            console.warn('Elemento logout-btn no encontrado');
        }
    },

    // Función helper para obtener elementos de forma segura
    safeGetElement(id, required = false) {
        const element = document.getElementById(id);
        if (!element && required) {
            console.error(`Elemento requerido '${id}' no encontrado`);
        } else if (!element) {
            console.warn(`Elemento '${id}' no encontrado`);
        }
        return element;
    },

    // Función para mostrar pantalla de login
    showLoginScreen() {
        console.log('🔓 Mostrando pantalla de login');
        const authContainer = this.safeGetElement('auth-container');
        const appContainer = this.safeGetElement('app-container');

        if (authContainer) {
            authContainer.classList.remove('d-none');
        }
        if (appContainer) {
            appContainer.classList.add('d-none');
        }

        // Limpiar campos si existen
        const usernameEl = this.safeGetElement('username');
        const passwordEl = this.safeGetElement('password');

        if (usernameEl) {
            usernameEl.value = '';
            // Enfocar el campo de usuario después de un pequeño delay
            setTimeout(() => usernameEl.focus(), 100);
        }
        if (passwordEl) {
            passwordEl.value = '';
        }
    },

    async handleLogin(event) {
        event.preventDefault();

        const usernameEl = this.safeGetElement('username', true);
        const passwordEl = this.safeGetElement('password', true);

        if (!usernameEl || !passwordEl) {
            this.showLoginError('Elementos de formulario no encontrados');
            return;
        }

        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();

        if (!username || !password) {
            this.showLoginError('Por favor, complete todos los campos');
            return;
        }

        // Mostrar indicador de carga
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Iniciando sesión...';
        }

        try {
            // Ocultar error anterior si existe
            const loginErrorEl = this.safeGetElement('login-error');
            if (loginErrorEl) {
                loginErrorEl.classList.add('d-none');
            }

            console.log('🔐 Intentando login...');
            const response = await window.api.login({ username, password });

            this.currentUser = response.user;
            this.isLoggedIn = true;
            console.log('✅ Login exitoso:', this.currentUser.fullName);

            // Actualizar la interfaz después del login exitoso
            this.updateUIAfterLogin();

            // ✅ EMITIR EVENTO DE LOGIN EXITOSO
            console.log('🚀 Emitiendo evento auth:login-success');
            eventManager.emit('auth:login-success', this.currentUser);

            // ✅ NUEVO: Inicializar y cargar productos automáticamente
            await this.initializeProductsAfterLogin();

        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showLoginError(error.message || 'Error de autenticación');
        } finally {
            // Restaurar botón
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText || 'Iniciar Sesión';
            }
        }
    },

    // ✅ NUEVA FUNCIÓN: Inicializar productos después del login
    async initializeProductsAfterLogin() {
        console.log('📦 Inicializando gestión de productos después del login...');
        
        try {
            // Esperar a que la UI esté completamente configurada
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verificar si productManager está disponible
            if (window.productManager) {
                console.log('🔄 Inicializando ProductManager...');
                
                // Asegurar que productManager esté inicializado
                if (!window.productManager.isInitialized) {
                    await window.productManager.init();
                }
                
                // Forzar carga inmediata de productos
                console.log('📥 Forzando carga inicial de productos...');
                await window.productManager.loadProducts();
                
                console.log('✅ Productos cargados automáticamente después del login');
                
                // Emitir evento para notificar que los productos están listos
                if (window.eventManager) {
                    window.eventManager.emit('auth:products-initialized', {
                        timestamp: Date.now(),
                        productsCount: window.productManager.products.length
                    });
                }
            } else {
                console.warn('⚠️ ProductManager no está disponible globalmente');
            }
            
        } catch (error) {
            console.error('❌ Error inicializando productos después del login:', error);
            // No interrumpir el flujo de login por este error
        }
    },

    // Función para manejar la actualización de UI después del login
    updateUIAfterLogin() {
        console.log('🖥️ Actualizando UI después del login...');

        const authContainer = this.safeGetElement('auth-container');
        const appContainer = this.safeGetElement('app-container');
        const userDisplay = this.safeGetElement('user-display');
        const adminMenuItem = this.safeGetElement('admin-menu-item');

        // Cambiar contenedores
        if (authContainer) {
            authContainer.classList.add('d-none');
        }
        if (appContainer) {
            appContainer.classList.remove('d-none');
        }

        // Mostrar información del usuario
        if (userDisplay && this.currentUser) {
            userDisplay.textContent = `Usuario: ${this.currentUser.fullName}`;
        }

        // Mostrar/ocultar opciones según el rol
        if (adminMenuItem) {
            if (this.currentUser && this.currentUser.role === 'admin') {
                adminMenuItem.classList.remove('d-none');
            } else {
                adminMenuItem.classList.add('d-none');
            }
        }

        // ✅ CRÍTICO: Asegurar que la vista de productos esté activa por defecto
        setTimeout(() => {
            this.ensureDefaultView();
        }, 100);
    },

    // ✅ FUNCIÓN MEJORADA: Configurar vista por defecto con carga de productos
    ensureDefaultView() {
        console.log('📦 Configurando vista de productos como predeterminada...');

        const productsSection = document.getElementById('products-section');
        const productsNavLink = document.querySelector('[data-view="products"]');

        // Ocultar todas las secciones primero
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Remover active de todos los nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Activar sección de productos
        if (productsSection) {
            productsSection.classList.add('active');
            console.log('✅ Sección de productos activada');
        }

        // Activar nav link de productos
        if (productsNavLink) {
            productsNavLink.classList.add('active');
            console.log('✅ Nav link de productos activado');
        }

        // ✅ NUEVO: Emitir evento de vista activada para que productManager pueda reaccionar
        if (window.eventManager) {
            window.eventManager.emit('view:activated', {
                viewName: 'products',
                timestamp: Date.now()
            });
        }
    },

    // Función para mostrar errores de login
    showLoginError(message) {
        const errorElement = this.safeGetElement('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('d-none');
        } else {
            // Fallback si no existe el elemento
            console.error('Login error:', message);
            alert('Error de autenticación: ' + message);
        }
    },

    async handleLogout() {
        try {
            console.log('🚪 Cerrando sesión...');
            await window.api.logout();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            // Continuar con el logout local incluso si hay error en el servidor
        } finally {
            // Siempre resetear la UI y estado local
            this.resetUIAfterLogout();

            // ✅ EMITIR EVENTO DE LOGOUT
            eventManager.emit('auth:logout');
        }
    },

    // Función para resetear UI después del logout
    resetUIAfterLogout() {
        console.log('🔄 Reseteando UI después del logout...');

        // Limpiar estado local
        this.currentUser = null;
        this.isLoggedIn = false;

        const appContainer = this.safeGetElement('app-container');
        const authContainer = this.safeGetElement('auth-container');
        const usernameEl = this.safeGetElement('username');
        const passwordEl = this.safeGetElement('password');
        const loginErrorEl = this.safeGetElement('login-error');

        // Mostrar pantalla de login
        if (appContainer) {
            appContainer.classList.add('d-none');
        }
        if (authContainer) {
            authContainer.classList.remove('d-none');
        }

        // Limpiar campos de login
        if (usernameEl) {
            usernameEl.value = '';
            setTimeout(() => usernameEl.focus(), 100); // Enfocar campo de usuario
        }
        if (passwordEl) {
            passwordEl.value = '';
        }
        if (loginErrorEl) {
            loginErrorEl.classList.add('d-none');
        }
    },

    // Función de verificación de sesión simplificada
    checkSession() {
        // Sin persistencia, siempre mostrar login
        console.log('📋 Verificando sesión - sin persistencia, mostrando login');
        this.showLoginScreen();
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    // Función para verificar si está logueado
    isAuthenticated() {
        return this.isLoggedIn && this.currentUser !== null;
    }
};