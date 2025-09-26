// Gestión de la interfaz de usuario - CORREGIDO
import { eventManager } from './eventManager.js';

export const uiManager = {
    alertTimeout: null,
    currentView: null,
    isInitialized: false,

    init() {
        if (this.isInitialized) return;
        
        console.log('🎨 Inicializando UI Manager...');

        // Inicializar manejo de navegación
        this.initNavigation();
        
        // Crear contenedores necesarios
        this.createAlertContainer();
        
        // Configurar event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        console.log('✅ UI Manager inicializado');
    },

    // ✅ NUEVA FUNCIÓN: Inicializar navegación
    initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        if (navLinks.length === 0) {
            console.warn('⚠️ No se encontraron links de navegación');
            return;
        }

        navLinks.forEach(navLink => {
            navLink.addEventListener('click', this.handleNavigation.bind(this));
        });

        console.log(`✅ ${navLinks.length} links de navegación configurados`);
    },

    // ✅ NUEVA FUNCIÓN: Crear contenedor de alertas
    createAlertContainer() {
        // Crear contenedor para alertas si no existe
        let alertContainer = document.getElementById('alert-container');
        
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alert-container';
            alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
            alertContainer.style.zIndex = '1050';
            document.body.appendChild(alertContainer);
            console.log('✅ Contenedor de alertas creado');
        }
    },

    // ✅ NUEVA FUNCIÓN: Configurar event listeners
    setupEventListeners() {
        // Listener para cambios de vista
        eventManager.on('view:change', (viewName) => {
            this.changeView(viewName);
        });

        // Listener para alertas del sistema
        eventManager.on('ui:alert', ({ message, type }) => {
            this.showAlert(message, type);
        });

        // Listener para loading states
        eventManager.on('ui:loading', (isLoading) => {
            this.setLoading(isLoading);
        });

        console.log('✅ Event listeners de UI configurados');
    },

    // ✅ FUNCIÓN MEJORADA: handleNavigation con mejor manejo de errores
    handleNavigation(event) {
        try {
            event.preventDefault();

            // Obtener la vista a mostrar
            const viewId = event.target.dataset?.view;
            
            if (!viewId) {
                console.error('❌ No se encontró dataset.view en el elemento');
                return;
            }

            console.log(`🧭 Navegando a vista: ${viewId}`);

            // Cambiar vista
            this.changeView(viewId);

            // Emitir evento de cambio de vista
            eventManager.emit('view:changed', viewId);

        } catch (error) {
            console.error('❌ Error en navegación:', error);
            this.showAlert('Error al cambiar de vista', 'danger');
        }
    },

    // ✅ NUEVA FUNCIÓN: Cambiar vista de forma segura
    changeView(viewId) {
        try {
            // Actualizar clases activas en la navegación
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.dataset?.view === viewId) {
                    link.classList.add('active');
                }
            });

            // Ocultar todas las vistas
            const viewContainers = document.querySelectorAll('.view-container');
            viewContainers.forEach(container => {
                container.classList.add('d-none');
            });

            // Mostrar la vista seleccionada
            const viewContainer = document.getElementById(`${viewId}-view`);
            if (viewContainer) {
                viewContainer.classList.remove('d-none');
                this.currentView = viewId;
                console.log(`✅ Vista cambiada a: ${viewId}`);
            } else {
                console.error(`❌ No se encontró contenedor para vista: ${viewId}`);
                this.showAlert(`Vista "${viewId}" no encontrada`, 'warning');
            }

        } catch (error) {
            console.error('❌ Error cambiando vista:', error);
            this.showAlert('Error interno al cambiar vista', 'danger');
        }
    },

    // ✅ FUNCIÓN MEJORADA: showAlert con mejor manejo
    showAlert(message, type = 'info', duration = 5000) {
        try {
            console.log(`🔔 Mostrando alerta: ${type} - ${message}`);

            // Eliminar alerta anterior si existe
            this.clearAlert();

            // Crear nueva alerta
            const alertElement = document.createElement('div');
            alertElement.className = `alert alert-${type} alert-dismissible fade show`;
            alertElement.role = 'alert';
            alertElement.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
            `;

            // Añadir al contenedor
            const container = document.getElementById('alert-container');
            if (!container) {
                console.error('❌ Contenedor de alertas no encontrado');
                return;
            }

            container.appendChild(alertElement);

            // Auto-cerrar después del tiempo especificado
            if (duration > 0) {
                this.alertTimeout = setTimeout(() => {
                    this.fadeOutAlert(alertElement);
                }, duration);
            }

            return alertElement;

        } catch (error) {
            console.error('❌ Error mostrando alerta:', error);
            // Fallback: alert nativo
            alert(`${type.toUpperCase()}: ${message}`);
        }
    },

    // ✅ NUEVA FUNCIÓN: Limpiar alertas existentes
    clearAlert() {
        if (this.alertTimeout) {
            clearTimeout(this.alertTimeout);
            this.alertTimeout = null;
        }

        const existingAlerts = document.querySelectorAll('#alert-container .alert');
        existingAlerts.forEach(alert => alert.remove());
    },

    // ✅ NUEVA FUNCIÓN: Fadeout animado para alertas
    fadeOutAlert(alertElement) {
        try {
            alertElement.classList.remove('show');
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, 150);
        } catch (error) {
            console.error('❌ Error en fadeOut de alerta:', error);
        }
    },

    // ✅ NUEVA FUNCIÓN: Mostrar estado de loading
    setLoading(isLoading, target = null) {
        console.log(`⏳ Cambiando estado loading: ${isLoading}`);
        
        if (target) {
            // Loading específico en un elemento
            const element = typeof target === 'string' ? document.getElementById(target) : target;
            if (element) {
                if (isLoading) {
                    element.classList.add('loading');
                    const spinner = document.createElement('div');
                    spinner.className = 'spinner-border spinner-border-sm me-2';
                    spinner.id = 'temp-spinner';
                    element.insertBefore(spinner, element.firstChild);
                } else {
                    element.classList.remove('loading');
                    const spinner = element.querySelector('#temp-spinner');
                    if (spinner) spinner.remove();
                }
            }
        } else {
            // Loading global
            let overlay = document.getElementById('global-loading-overlay');
            
            if (isLoading && !overlay) {
                overlay = document.createElement('div');
                overlay.id = 'global-loading-overlay';
                overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center';
                overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                overlay.style.zIndex = '2000';
                overlay.innerHTML = `
                    <div class="bg-white p-4 rounded shadow">
                        <div class="spinner-border text-primary me-3" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <span>Cargando...</span>
                    </div>
                `;
                document.body.appendChild(overlay);
            } else if (!isLoading && overlay) {
                overlay.remove();
            }
        }
    },

    // ✅ NUEVA FUNCIÓN: Confirmar acción con modal
    async confirmAction(message, title = 'Confirmar acción') {
        return new Promise((resolve) => {
            // Crear modal de confirmación
            const modalId = 'confirm-modal-' + Date.now();
            const modalHTML = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${message}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-primary confirm-btn">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modalElement = document.getElementById(modalId);
            const confirmBtn = modalElement.querySelector('.confirm-btn');

            // Configurar eventos
            confirmBtn.addEventListener('click', () => {
                resolve(true);
                bootstrap.Modal.getInstance(modalElement).hide();
            });

            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                resolve(false);
            });

            // Mostrar modal
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        });
    },

    // ✅ NUEVA FUNCIÓN: Actualizar badge de notificaciones
    updateBadge(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            let badge = element.querySelector('.badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'badge bg-danger rounded-pill';
                    element.appendChild(badge);
                }
                badge.textContent = count > 99 ? '99+' : count.toString();
            } else if (badge) {
                badge.remove();
            }
        }
    },

    // ✅ NUEVA FUNCIÓN: Funciones utilitarias
    getCurrentView() {
        return this.currentView;
    },

    hideAllViews() {
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('d-none');
        });
    },

    showView(viewId) {
        this.changeView(viewId);
    },

    // ✅ NUEVA FUNCIÓN: Toggle sidebar (si existe)
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    },

    // ✅ NUEVA FUNCIÓN: Destructor
    destroy() {
        console.log('🧹 Destruyendo UI Manager...');
        
        try {
            // Limpiar timeouts
            if (this.alertTimeout) {
                clearTimeout(this.alertTimeout);
                this.alertTimeout = null;
            }

            // Remover event listeners
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(navLink => {
                navLink.removeEventListener('click', this.handleNavigation.bind(this));
            });

            // Limpiar alertas
            this.clearAlert();

            // Remover overlays
            const overlay = document.getElementById('global-loading-overlay');
            if (overlay) overlay.remove();

            this.isInitialized = false;
            console.log('✅ UI Manager destruido');

        } catch (error) {
            console.error('❌ Error destruyendo UI Manager:', error);
        }
    }
};