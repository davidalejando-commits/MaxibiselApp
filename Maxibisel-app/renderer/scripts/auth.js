//Manejo de autenticación
export const authManager = {
    currentUser: null,

    init() {
        // Asegurar que el DOM esté completamente cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
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

    async handleLogin(event) {
        event.preventDefault();

        const usernameEl = this.safeGetElement('username', true);
        const passwordEl = this.safeGetElement('password', true);

        if (!usernameEl || !passwordEl) {
            this.showLoginError('Elementos de formulario no encontrados');
            return;
        }

        const username = usernameEl.value;
        const password = passwordEl.value;

        if (!username || !password) {
            this.showLoginError('Por favor, complete todos los campos');
            return;
        }

        try {
            // Ocultar error anterior si existe
            const loginErrorEl = this.safeGetElement('login-error');
            if (loginErrorEl) {
                loginErrorEl.classList.add('d-none');
            }

            const response = await window.api.login({ username, password });
            this.currentUser = response.user;

            // Actualizar la interfaz después del login exitoso
            this.updateUIAfterLogin();

        } catch (error) {
            console.error('Error en login:', error);

            // Manejar errores específicos de token/autenticación
            if (error.message && (error.message.includes('Token inválido') || error.message.includes('expirado'))) {
                this.handleTokenError();
            } else {
                this.showLoginError(error.message || 'Error de autenticación');
            }
        }
    },

    // Nueva función para manejar la actualización de UI después del login
    updateUIAfterLogin() {
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
    },

    // Nueva función para mostrar errores de login
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

    // Nueva función para manejar errores de token
    handleTokenError() {
        console.log('Token inválido o expirado, limpiando sesión...');

        // Limpiar datos de sesión
        localStorage.clear();
        sessionStorage.clear();

        // Mostrar mensaje al usuario
        this.showLoginError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');

        // Resetear la interfaz
        this.resetUIAfterLogout();
    },

    async handleLogout() {
        try {
            await window.api.logout();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);

            // Incluso si hay error en el logout del servidor, limpiar localmente
            if (error.message && (error.message.includes('Token inválido') || error.message.includes('expirado'))) {
                console.log('Token ya expirado durante logout, continuando con limpieza local...');
            }
        } finally {
            // Siempre resetear la UI
            this.resetUIAfterLogout();
        }
    },

    // Nueva función para resetear UI después del logout
    resetUIAfterLogout() {
        this.currentUser = null;

        const appContainer = this.safeGetElement('app-container');
        const authContainer = this.safeGetElement('auth-container');
        const usernameEl = this.safeGetElement('username');
        const passwordEl = this.safeGetElement('password');
        const loginErrorEl = this.safeGetElement('login-error');

        if (appContainer) {
            appContainer.classList.add('d-none');
        }
        if (authContainer) {
            authContainer.classList.remove('d-none');
        }
        if (usernameEl) {
            usernameEl.value = '';
        }
        if (passwordEl) {
            passwordEl.value = '';
        }
        if (loginErrorEl) {
            loginErrorEl.classList.add('d-none');
        }
    },

    checkSession() {
        const authContainer = this.safeGetElement('auth-container');
        const appContainer = this.safeGetElement('app-container');

        if (authContainer) {
            authContainer.classList.remove('d-none');
        }
        if (appContainer) {
            appContainer.classList.add('d-none');
        }
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }
}