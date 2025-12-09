// Gestión de la interfaz de usuario - CORREGIDO
import { eventManager } from './eventManager.js';

export const uiManager = {
    alertTimeout: null,
    currentView: null,
    isInitialized: false,

    init() {
    if (this.isInitialized) {
        console.log('⚠️ UI Manager ya estaba inicializado');
        return;
    }
    
    console.log('🎨 Inicializando UI Manager...');

    // Crear contenedores necesarios PRIMERO
    this.createAlertContainer();
    
    // Inicializar manejo de navegación
    this.initNavigation();
    
    // Configurar event listeners
    this.setupEventListeners();

    // Mostrar alerta de prueba
    setTimeout(() => {
        this.showAlert('Sistema listo', 'success', 3000);
    }, 500);

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
    // Eliminar contenedor anterior si existe
    let alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.remove();
    }
    
    // Crear nuevo contenedor
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        min-width: 300px;
        max-width: 600px;
        width: auto;
    `;
    
    document.body.appendChild(alertContainer);
    console.log('✅ Contenedor de alertas creado correctamente');
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

    // ✅ Cambiar vista de forma segura
changeView(viewId) {
    try {
        console.log(`🔄 Cambiando de vista: ${this.currentView} → ${viewId}`);

        // ✅ Limpiar vista anterior antes de cambiar
        if (this.currentView) {
            this.cleanupCurrentView(this.currentView);
        }

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
            
            // ✅ NUEVO: Reinicializar vista después de mostrarla
            this.initializeCurrentView(viewId);
        } else {
            console.error(`❌ No se encontró contenedor para vista: ${viewId}`);
            this.showAlert(`Vista "${viewId}" no encontrada`, 'warning');
        }

    } catch (error) {
        console.error('❌ Error cambiando vista:', error);
        this.showAlert('Error interno al cambiar vista', 'danger');
    }
},

cleanupCurrentView(viewName) {
    console.log(`🧹 Limpiando vista: ${viewName}`);
    
    try {
        // Limpiar vista de ventas/salidas
        if (viewName === 'sales' && window.salesManager) {
            if (typeof window.salesManager.destroy === 'function') {
                window.salesManager.destroy();
            } else if (typeof window.salesManager.destroyBarcodeScanner === 'function') {
                window.salesManager.destroyBarcodeScanner();
            }
        }
        
        // Limpiar vista de productos
        if (viewName === 'products' && window.productsManager) {
            if (typeof window.productsManager.destroy === 'function') {
                window.productsManager.destroy();
            }
        }
        
        // Limpiar vista de inventario
        if (viewName === 'inventory' && window.inventoryManager) {
            if (typeof window.inventoryManager.destroy === 'function') {
                window.inventoryManager.destroy();
            }
        }
        
        console.log(`✅ Vista ${viewName} limpiada`);
        
    } catch (error) {
        console.error(`❌ Error limpiando vista ${viewName}:`, error);
    }
},

initializeCurrentView(viewName) {
    console.log(`🔧 Inicializando vista: ${viewName}`);
    
    try {
        // Reinicializar vista de ventas/salidas
        if (viewName === 'sales' && window.salesManager) {
            if (typeof window.salesManager.init === 'function') {
                window.salesManager.init();
                console.log('✅ salesManager reinicializado');
            }
        }
        
        // Reinicializar vista de productos
        if (viewName === 'products' && window.productsManager) {
            if (typeof window.productsManager.init === 'function') {
                window.productsManager.init();
                console.log('✅ productsManager reinicializado');
            }
        }
        
        // Reinicializar vista de inventario
        if (viewName === 'inventory' && window.inventoryManager) {
            if (typeof window.inventoryManager.init === 'function') {
                window.inventoryManager.init();
                console.log('✅ inventoryManager reinicializado');
            }
        }
        
    } catch (error) {
        console.error(`❌ Error inicializando vista ${viewName}:`, error);
    }
},

    // ✅ FUNCIÓN MEJORADA: showAlert con mejor manejo
    showAlert(message, type = 'info', duration = 5000) {
    try {
        console.log(`🔔 Mostrando alerta: ${type} - ${message}`);

        // Asegurar que existe el contenedor
        let container = document.getElementById('alert-container');
        if (!container) {
            console.warn('⚠️ Contenedor no existe, creándolo...');
            this.createAlertContainer();
            container = document.getElementById('alert-container');
        }

        // Eliminar alerta anterior si existe
        this.clearAlert();

        // Mapear tipos de Bootstrap
        const typeMap = {
            'success': 'success',
            'danger': 'danger',
            'error': 'danger',
            'warning': 'warning',
            'info': 'info',
            'primary': 'primary'
        };
        
        const alertType = typeMap[type] || 'info';

        // Iconos para cada tipo
        const icons = {
            'success': '✓',
            'danger': '✕',
            'warning': '⚠',
            'info': 'ℹ',
            'primary': '●'
        };

        // Crear nueva alerta
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${alertType} alert-dismissible fade show shadow`;
        alertElement.role = 'alert';
        alertElement.style.cssText = `
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            animation: slideInDown 0.3s ease-out;
        `;
        
        alertElement.innerHTML = `
            <span style="font-size: 1.2rem; margin-right: 10px;">${icons[alertType]}</span>
            <span style="flex: 1;">${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        `;

        // Añadir al contenedor
        container.appendChild(alertElement);

        // Auto-cerrar después del tiempo especificado
        if (duration > 0) {
            this.alertTimeout = setTimeout(() => {
                this.fadeOutAlert(alertElement);
            }, duration);
        }

        // Permitir cerrar manualmente
        const closeBtn = alertElement.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => {
            this.fadeOutAlert(alertElement);
        });

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