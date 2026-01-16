// Gestión de productos - Versión corregida completa con modal personalizado
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';
import { uiManager } from './ui.js';

export const productManager = {
    products: [],
    productModal: null,
    stockModal: null,
    deleteModal: null,
    viewName: 'productManager',
    isInitialized: false,
    initializationPromise: null,
    currentEditingProduct: null,
    productToDeleteId: null,
    productToDeleteName: null,
    _scrollConfigured: false,

    async init() {
        if (this.initializationPromise) {
            console.log('Esperando inicialización en progreso...');
            return await this.initializationPromise;
        }

        if (this.isInitialized) {
            console.log('ProductManager ya está inicializado');
            return;
        }

        this.initializationPromise = this._performInit();
        return await this.initializationPromise;
    },

    async _performInit() {
    try {
        console.log('Inicializando ProductManager...');

        if (!eventManager.isInitialized) {
            console.log('Inicializando eventManager...');
            eventManager.init();
        }

        if (!dataSync.isInitialized) {
            console.log('Inicializando dataSync...');
            dataSync.init();
        }

        this.setupAuthEventListeners();
        await this._waitForDOMElements(10000);
        this._initializeModals();
        this.setupEventListeners();
        

        if (dataSync && typeof dataSync.subscribe === 'function') {
            dataSync.subscribe(this.viewName, 'products', this.handleDataChange.bind(this));
        }

        // ✅ CAMBIO CRÍTICO: NO cargar productos aquí
        // Se cargarán después del login exitoso
        console.log('⏸️ ProductManager inicializado, esperando login para cargar datos...');

        await this._validateInitialization();

        this.isInitialized = true;
        console.log('✅ ProductManager estructura lista');

        setTimeout(() => {
            if (window.uiManager && window.uiManager.forceStyleUpdate) {
                window.uiManager.forceStyleUpdate();
            }
        }, 100);

        window.productManager = this;
        console.log('✅ ProductManager expuesto globalmente');

    } catch (error) {
        console.error('Error en inicialización de ProductManager:', error);
        this.isInitialized = false;
        throw error;
    } finally {
        this.initializationPromise = null;
    }
},

   _setupTableScrolling() {
        const tableContainer = document.querySelector('#products-view .table-container');
        
        if (!tableContainer) {
            console.warn('Contenedor de tabla no encontrado para scroll');
            return;
        }

        // Solo configurar propiedades CSS esenciales (sin calcular alturas)
        tableContainer.style.maxHeight = 'calc(100vh - 248px)'; // 2px más de altura (250px - 2px)
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.overflowX = 'hidden';
        tableContainer.style.paddingBottom = '10px'; // Reducido de 30px a 10px
        
        const table = tableContainer.querySelector('table');
        if (table) {
            table.style.marginBottom = '15px'; // Reducido de 40px a 15px
            
            const thead = table.querySelector('thead');
            if (thead) {
                thead.style.position = 'sticky';
                thead.style.top = '0';
                thead.style.backgroundColor = '#f8f9fa';
                thead.style.zIndex = '10';
                thead.style.boxShadow = '0 2px 2px -1px rgba(0, 0, 0, 0.1)';
            }
        }

        console.log('✅ Scroll configurado con CSS estático');
    },

    
    setupAuthEventListeners() {
        console.log('Configurando listeners para eventos de auth...');
        eventManager.on('auth:login-success', this.handleLoginSuccess.bind(this));
        eventManager.on('view:activated', this.handleViewActivated.bind(this));
        eventManager.on('auth:products-initialized', this.handleProductsInitialized.bind(this));
        console.log('Listeners de auth configurados');
    },

    async handleLoginSuccess(user) {
        console.log('Login exitoso recibido en ProductManager:', user.fullName);
        try {
            if (!this.isInitialized) {
                console.log('ProductManager no inicializado, inicializando...');
                await this.init();
            }
            console.log('Cargando productos después del login...');
            await this.loadProducts();
        } catch (error) {
            console.error('Error manejando login en ProductManager:', error);
        }
    },

    async handleViewActivated(viewData) {
        if (viewData.viewName === 'products') {
            console.log('Vista de productos activada');
            if (this.isInitialized && (!this.products || this.products.length === 0)) {
                console.log('Vista de productos activada sin datos, cargando...');
                await this.loadProducts();
            }
        }
    },

    handleProductsInitialized(data) {
        console.log('Productos inicializados después del login:', data);
        if (this.isInitialized && this.products.length > 0) {
            setTimeout(() => {
                this._renderTableImmediate();
            }, 100);
        }
    },

    async _waitForDOMElements(maxWait = 10000) {
        const requiredElements = ['products-table-body', 'product-modal', 'stock-modal', 'confirm-delete-modal'];
        const startTime = Date.now();
        console.log('Esperando elementos DOM...', requiredElements);

        return new Promise((resolve, reject) => {
            const checkElements = () => {
                const missingElements = requiredElements.filter(id => !document.getElementById(id));

                if (missingElements.length === 0) {
                    console.log('Todos los elementos DOM requeridos están disponibles');
                    resolve();
                    return;
                }

                const elapsed = Date.now() - startTime;
                if (elapsed > maxWait) {
                    console.error(`Elementos DOM faltantes después de ${maxWait}ms:`, missingElements);
                    reject(new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`));
                    return;
                }

                setTimeout(checkElements, 100);
            };
            checkElements();
        });
    },

    async _validateInitialization() {
        console.log('Validando inicialización...');

        const validations = [
            { name: 'Tabla de productos', check: () => document.getElementById('products-table-body') !== null },
            { name: 'Datos cargados', check: () => Array.isArray(this.products) },
            {
                name: 'Suscripción a dataSync', check: () => {
                    if (!dataSync || typeof dataSync.isSubscribed !== 'function') {
                        console.warn('dataSync.isSubscribed no disponible');
                        return true;
                    }
                    return dataSync.isSubscribed(this.viewName, 'products');
                }
            },
            { name: 'Event listeners configurados', check: () => document.getElementById('add-product-btn') !== null }
        ];

        const failedValidations = validations.filter(v => !v.check());

        if (failedValidations.length > 0) {
            const failedNames = failedValidations.map(v => v.name).join(', ');
            throw new Error(`Validaciones fallidas: ${failedNames}`);
        }

        console.log('Todas las validaciones pasaron');
    },

    _initializeModals() {
        try {
            const productModalEl = document.getElementById('product-modal');
            const stockModalEl = document.getElementById('stock-modal');

            if (productModalEl && typeof bootstrap !== 'undefined') {
                this.productModal = new bootstrap.Modal(productModalEl);
                console.log('Modal de producto inicializado');
            }

            if (stockModalEl && typeof bootstrap !== 'undefined') {
                this.stockModal = new bootstrap.Modal(stockModalEl);
                console.log('Modal de stock inicializado');
            }

            // No necesitamos inicializar el modal de eliminación con Bootstrap
            // ya que lo manejamos manualmente con display: flex/none
            console.log('Modal de eliminación listo para uso');

        } catch (error) {
            console.error('Error inicializando modales:', error);
        }
    },

    setupEventListeners() {
        console.log('Configurando event listeners...');

        const eventBindings = [
            { id: 'add-product-btn', event: 'click', handler: this.showAddProductModal.bind(this) },
            { id: 'save-product-btn', event: 'click', handler: this.saveProduct.bind(this) },
            { id: 'save-stock-btn', event: 'click', handler: this.updateStock.bind(this) },
            { id: 'products-table-body', event: 'click', handler: this.handleProductAction.bind(this) },
            { id: 'generate-barcode-btn', event: 'click', handler: this.generateBarcode.bind(this) },
            { id: 'barcode-scan-btn', event: 'click', handler: this.showBarcodeScannerModal.bind(this) },
            { id: 'manual-barcode-btn', event: 'click', handler: this.searchByManualBarcode.bind(this) },
            { id: 'product-search', event: 'input', handler: this.filterProducts.bind(this) },
            { id: 'confirm-delete-btn', event: 'click', handler: this.executeDelete.bind(this) },
            { id: 'cancel-delete-btn', event: 'click', handler: this.hideDeleteModal.bind(this) }
        ];

        eventBindings.forEach(({ id, event, handler }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`Event listener agregado: ${id} -> ${event}`);
            } else {
                console.warn(`Elemento no encontrado: ${id}`);
            }
        });

        this._setupStockEvents();
        this.setupSyncListeners();
    },

    _setupStockEvents() {
    const stockAddInput = document.getElementById('stock-add-quantity');
    if (stockAddInput) {
        stockAddInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.updateStock();
            }
        });
    }

    const stockDirectInput = document.getElementById('stock-direct-value');
    if (stockDirectInput) {
        stockDirectInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.updateStock();
            }
        });
    }

    const stockForm = document.getElementById('stock-form');
    if (stockForm) {
        stockForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.updateStock();
        });
    }
},

    handleDataChange({ action, data, dataType }) {
        console.log(`ProductManager recibió: ${action} en ${dataType}`, data);

        if (!this.isInitialized) {
            console.log('Ignorando cambio - no inicializado');
            return;
        }

        try {
            switch (action) {
                case 'created':
                    this._handleProductCreatedImmediate(data);
                    break;
                case 'updated':
                    this._handleProductUpdatedImmediate(data);
                    break;
                case 'deleted':
                    this._handleProductDeletedImmediate(data);
                    break;
                case 'refreshed':
                    this._handleProductsRefreshedImmediate(data);
                    break;
                case 'stock-updated':
                    this._handleStockUpdatedImmediate(data);
                    break;
                default:
                    console.warn(`Acción no reconocida: ${action}`);
            }
        } catch (error) {
            console.error('Error manejando cambio de datos:', error);
        }
    },

    _handleProductCreatedImmediate(product) {
        console.log('Manejando producto creado inmediatamente:', product._id);

        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando...');
            this.products = [];
        }

        const exists = this.products.some(p => p._id === product._id);
        if (!exists) {
            this.products.push(product);
            this.sortProductsById();
            this._renderTableImmediate();
            console.log('Producto agregado a la tabla inmediatamente');
        } else {
            console.log('Producto ya existe, actualizando inmediatamente');
            this._handleProductUpdatedImmediate(product);
        }
    },

    _handleProductUpdatedImmediate(product) {
        console.log('Manejando producto actualizado inmediatamente:', product._id);

        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando...');
            this.products = [];
        }

        const index = this.products.findIndex(p => p._id === product._id);
        if (index !== -1) {
            const existingProduct = this.products[index];
            this.products[index] = {
                ...existingProduct,
                ...product,
                _id: product._id
            };
            this.sortProductsById();
            this._renderTableImmediate();
            console.log('Producto actualizado en la tabla inmediatamente');
            this._highlightUpdatedProduct(product._id);
        } else {
            console.log('Producto no encontrado, agregándolo inmediatamente');
            this._handleProductCreatedImmediate(product);
        }
    },

    _handleProductDeletedImmediate(productId) {
        console.log('Manejando producto eliminado inmediatamente:', productId);

        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando...');
            this.products = [];
            return;
        }

        const initialLength = this.products.length;
        this.products = this.products.filter(p => p._id !== productId);

        if (this.products.length < initialLength) {
            this._renderTableImmediate();
            console.log('Producto eliminado de la tabla inmediatamente');
        } else {
            console.log('Producto no estaba en la lista');
        }
    },

    _handleProductsRefreshedImmediate(products) {
        console.log('Manejando refrescado de productos inmediatamente:', Array.isArray(products) ? products.length : 'no-array');

        this.products = Array.isArray(products) ? products : [];
        this.sortProductsById();
        this._renderTableImmediate();
        console.log('Lista de productos refrescada inmediatamente');
    },

    _handleStockUpdatedImmediate(data) {
        console.log('Manejando actualización de stock inmediatamente:', data);

        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando...');
            this.products = [];
        }

        const { productId, newStock, product } = data;

        if (product) {
            this._handleProductUpdatedImmediate(product);
        } else if (productId && newStock !== undefined) {
            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index].stock = newStock;
                this._renderTableImmediate();
                this._highlightUpdatedProduct(productId);
                console.log('Stock actualizado en la tabla inmediatamente');
            }
        }
    },

    _renderTableImmediate() {
        console.log('Renderizando tabla inmediatamente...');

        try {
            this.renderProductsTable();

            const table = document.getElementById('products-table');
            if (table) {
                table.classList.add('table', 'table-base');

                const container = table.closest('.table-container, .table-responsive');
                if (container) {
                    container.classList.add('table-container-base');
                    
                }
            }

            setTimeout(() => {
                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }
            }, 10);

            console.log('Tabla renderizada con estilos aplicados');

        } catch (error) {
            console.error('Error en renderizado inmediato:', error);
        }
    },

    _highlightUpdatedProduct(productId) {
        setTimeout(() => {
            try {
                const tableBody = document.getElementById('products-table-body');
                if (!tableBody) return;

                const targetRow = Array.from(tableBody.querySelectorAll('tr')).find(row => {
                    const editBtn = row.querySelector(`[data-id="${productId}"]`);
                    return editBtn !== null;
                });

                if (targetRow) {
                    targetRow.style.backgroundColor = '#e8f5e8';
                    targetRow.style.transition = 'background-color 0.5s ease';

                    targetRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest'
                    });

                    setTimeout(() => {
                        targetRow.style.backgroundColor = '';
                    }, 3000);

                    console.log('Producto destacado:', productId);
                } else {
                    console.warn('No se encontró la fila para destacar:', productId);
                }
            } catch (error) {
                console.error('Error destacando producto:', error);
            }
        }, 100);
    },

    async loadProducts() {
        try {
            console.log('Cargando productos...');
            this.showLoadingState();

            let products;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    if (dataSync && typeof dataSync.getData === 'function') {
                        products = await dataSync.getData('products');
                    } else {
                        console.warn('dataSync.getData no disponible, usando API directa');
                        products = await window.api.getProducts();
                    }
                    break;
                } catch (error) {
                    retryCount++;
                    console.warn(`Intento ${retryCount}/${maxRetries} falló:`, error.message);

                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        try {
                            products = await window.api.getProducts();
                            break;
                        } catch (apiError) {
                            console.warn(`API directa también falló en intento ${retryCount}`);
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (Array.isArray(products)) {
                this.products = products;
            } else if (products && Array.isArray(products.products)) {
                this.products = products.products;
            } else if (products && Array.isArray(products.data)) {
                this.products = products.data;
            } else {
                console.warn('Datos no válidos recibidos:', products);
                this.products = [];
            }

            console.log(`${this.products.length} productos cargados exitosamente`);

            this.sortProductsById();
            this.renderProductsTable();

            if (window.eventManager) {
                window.eventManager.emit('products:loaded', {
                    count: this.products.length,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('Error cargando productos después de todos los reintentos:', error);
            this.products = [];
            this.renderProductsTable();

            let errorMessage = 'Error al cargar productos';
            if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Error de conexión al cargar productos';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Tiempo de espera agotado al cargar productos';
            }

            if (window.uiManager && window.uiManager.showAlert) {
                window.uiManager.showAlert(errorMessage, 'danger');
            }

            if (window.eventManager) {
                window.eventManager.emit('products:load-error', {
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
    },

    showLoadingState() {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="d-flex justify-content-center align-items-center">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <span class="text-muted">Cargando productos...</span>
                    </div>
                </td>
            </tr>
        `;

        const table = document.getElementById('products-table');
        if (table) {
            table.classList.add('table', 'table-base');
        }
    },

    sortProductsById() {
        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, no se puede ordenar:', typeof this.products);
            this.products = [];
            return;
        }

        if (typeof this.products.sort !== 'function') {
            console.error('this.products no tiene método sort:', this.products);
            this.products = [];
            return;
        }

        try {
            this.products.sort((a, b) => {
                if (!a || !a._id) {
                    console.warn('Elemento sin _id encontrado:', a);
                    return 1;
                }
                if (!b || !b._id) {
                    console.warn('Elemento sin _id encontrado:', b);
                    return -1;
                }

                if (a._id < b._id) return -1;
                if (a._id > b._id) return 1;
                return 0;
            });
        } catch (error) {
            console.error('Error ordenando productos:', error);
            this.products = Array.isArray(this.products) ? this.products : [];
        }
    },

    renderProductsTable() {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) {
            console.error('Elemento products-table-body no encontrado');
            return;
        }

        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando como array vacío');
            this.products = [];
        }

        console.log(`Renderizando ${this.products.length} productos`);

        tableBody.innerHTML = '';

        if (this.products.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-3 text-muted">
                        <i class="bi bi-inbox me-2"></i>
                        No hay productos registrados
                    </td>
                </tr>
            `;
            return;
        }

        const table = document.getElementById('products-table');
        if (table) {
            table.classList.add('table', 'table-base');

            const tableContainer = table.closest('.table-container, .table-responsive');
            if (tableContainer) {
                tableContainer.classList.add('table-container-base');
            }

            console.log('Clases de estilo aplicadas a la tabla');
        }

        const fragment = document.createDocumentFragment();

        this.products.forEach(product => {
            const row = this._createProductRow(product);
            fragment.appendChild(row);
        });

        tableBody.appendChild(fragment);

        if (!this._scrollConfigured && this.products.length > 0) {
            this._setupTableScrolling();
            this._scrollConfigured = true;
            console.log('Scroll configurado por primera vez');
        }

        setTimeout(() => {
            if (window.uiManager && window.uiManager.forceStyleUpdate) {
                window.uiManager.forceStyleUpdate();
            }
        }, 50);

        console.log('Tabla renderizada exitosamente con estilos aplicados');
    },

    _createProductRow(product) {
        const row = document.createElement('tr');

        let stockClass = '';
        const stock = product.stock || 0;
        if (stock <= 0) {
            stockClass = 'stock-low';
        } else if (stock < 5) {
            stockClass = 'stock-medium';
        } else {
            stockClass = 'stock-high';
        }

        row.innerHTML = `
            <td>${product.barcode || ''}</td>
            <td>${product.name || ''}</td>      
            <td>${product.sphere || ''}</td>
            <td>${product.cylinder || ''}</td>
            <td>${product.addition || ''}</td>
            <td class="${stockClass}">${stock}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary edit-product" 
                            data-id="${product._id}" 
                            title="Editar producto">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-info update-stock" 
                            data-id="${product._id}"
                            title="Actualizar stock">
                        <i class="bi bi-box"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-product" 
                            data-id="${product._id}"
                            title="Eliminar producto">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return row;
    },

    showAddProductModal() {
        console.log('Mostrando modal para nuevo producto');

        const form = document.getElementById('product-form');
        if (form) form.reset();

        this.currentEditingProduct = null;

        const productId = document.getElementById('product-id');
        if (productId) productId.value = '';

        const modalTitle = document.getElementById('product-modal-title');
        if (modalTitle) modalTitle.textContent = 'Nuevo Producto';

        if (this.productModal) {
            this.productModal.show();
        }

        setTimeout(() => {
            const nameField = document.getElementById('product-name');
            if (nameField) nameField.focus();
        }, 300);
    },

    async showEditProductModal(productId) {
        console.log('Mostrando modal para editar producto:', productId);

        try {
            let product = this.products.find(p => p._id === productId);

            if (!product) {
                console.log('Producto no en cache, obteniendo del servidor...');
                const response = await window.api.getProduct(productId);
                product = response.product || response;
            }

            if (!product) {
                throw new Error('Producto no encontrado');
            }

            console.log('Cargando datos del producto:', product);

            this.currentEditingProduct = product;

            const fields = [
                ['product-id', product._id],
                ['product-barcode', product.barcode],
                ['product-name', product.name],
                ['product-sphere', product.sphere],
                ['product-cylinder', product.cylinder],
                ['product-addition', product.addition],
                ['product-stock', product.stock]
            ];

            fields.forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value || '';
                    console.log(`Campo ${id} llenado con: ${value}`);
                } else {
                    console.warn(`Campo no encontrado: ${id}`);
                }
            });

            const modalTitle = document.getElementById('product-modal-title');
            if (modalTitle) modalTitle.textContent = `Editar: ${product.name}`;

            if (this.productModal) {
                this.productModal.show();
            }

            setTimeout(() => {
                const nameField = document.getElementById('product-name');
                if (nameField) {
                    nameField.focus();
                    nameField.select();
                }
            }, 300);

        } catch (error) {
            console.error('Error al cargar producto para edición:', error);
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Error al cargar los datos del producto: ' + error.message, 'danger');
            } else {
                alert('Error al cargar los datos del producto: ' + error.message);
            }
        }
    },

    async showUpdateStockModal(productId) {
    console.log('Mostrando modal para actualizar stock:', productId);

    try {
        let product = this.products.find(p => p._id === productId);

        if (!product) {
            console.log('Producto no en cache, obteniendo del servidor...');
            const response = await window.api.getProduct(productId);
            product = response.product || response;
        }

        if (!product) {
            throw new Error('Producto no encontrado');
        }

        console.log('Cargando datos para actualizar stock:', product);

        // Llenar campos del producto
        const stockFields = [
            ['stock-product-id', product._id, 'value'],
            ['stock-product-name', product.name, 'textContent'],
            ['stock-product-barcode', product.barcode, 'textContent'],
            ['stock-product-sphere', product.sphere, 'textContent'],
            ['stock-product-cylinder', product.cylinder, 'textContent'],
            ['stock-product-addition', product.addition, 'textContent'],
            ['stock-current-stock', product.stock || 0, 'textContent']
        ];

        stockFields.forEach(([id, value, prop]) => {
            const element = document.getElementById(id);
            if (element) {
                if (prop === 'textContent') {
                    element.textContent = value || 'N/A';
                } else {
                    element.value = value || '';
                }
            }
        });

        // ====================================================================
        // NUEVO: Inicializar el modo "Agregar" por defecto
        // ====================================================================
        
        // Limpiar campo de entrada
        const stockAddInput = document.getElementById('stock-add-quantity');
        if (stockAddInput) {
            stockAddInput.value = '';
        }

        // Ocultar campo de actualización directa
        const directUpdateContainer = document.getElementById('stock-direct-update-container');
        if (directUpdateContainer) {
            directUpdateContainer.style.display = 'none';
        }

        // Mostrar campo de agregar
        const addStockContainer = document.getElementById('stock-add-container');
        if (addStockContainer) {
            addStockContainer.style.display = 'block';
        }

        // Actualizar botones de modo
        const btnAddMode = document.getElementById('btn-stock-add-mode');
        const btnDirectMode = document.getElementById('btn-stock-direct-mode');
        
        if (btnAddMode) {
            btnAddMode.classList.add('active');
            btnAddMode.classList.remove('btn-outline-primary');
            btnAddMode.classList.add('btn-primary');
        }
        
        if (btnDirectMode) {
            btnDirectMode.classList.remove('active');
            btnDirectMode.classList.add('btn-outline-primary');
            btnDirectMode.classList.remove('btn-primary');
        }

        // Limpiar preview
        const newStockPreview = document.getElementById('new-stock-preview');
        if (newStockPreview) {
            newStockPreview.textContent = product.stock || 0;
        }

        // ====================================================================

        // Mostrar alert con stock actual
        const currentStockDisplay = document.getElementById('current-stock-display');
        if (currentStockDisplay) {
            currentStockDisplay.innerHTML = `
                <div class="alert alert-info mb-3">
                    <strong>Stock Actual:</strong> ${product.stock || 0} unidades
                </div>
            `;
        }

        if (this.stockModal) {
            this.stockModal.show();
        }

        setTimeout(() => {
            const stockAddInput = document.getElementById('stock-add-quantity');
            if (stockAddInput) {
                stockAddInput.focus();
            }
        }, 300);

    } catch (error) {
        console.error('Error al cargar producto para stock:', error);
        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert('Error al cargar los datos del producto: ' + error.message, 'danger');
        }
    }
},

// 2. NUEVA FUNCIÓN: Cambiar entre modos de actualización
switchStockMode(mode) {
    const addContainer = document.getElementById('stock-add-container');
    const directContainer = document.getElementById('stock-direct-update-container');
    const btnAddMode = document.getElementById('btn-stock-add-mode');
    const btnDirectMode = document.getElementById('btn-stock-direct-mode');

    if (mode === 'add') {
        // Mostrar modo agregar
        if (addContainer) addContainer.style.display = 'block';
        if (directContainer) directContainer.style.display = 'none';
        
        // Actualizar botones
        if (btnAddMode) {
            btnAddMode.classList.add('active', 'btn-primary');
            btnAddMode.classList.remove('btn-outline-primary');
        }
        if (btnDirectMode) {
            btnDirectMode.classList.remove('active', 'btn-primary');
            btnDirectMode.classList.add('btn-outline-primary');
        }

        // Limpiar campo de agregar
        const stockAddInput = document.getElementById('stock-add-quantity');
        if (stockAddInput) {
            stockAddInput.value = '';
            stockAddInput.focus();
        }

        // Resetear preview
        this.updateStockPreview();

    } else if (mode === 'direct') {
        // Mostrar modo actualización directa
        if (addContainer) addContainer.style.display = 'none';
        if (directContainer) directContainer.style.display = 'block';
        
        // Actualizar botones
        if (btnAddMode) {
            btnAddMode.classList.remove('active', 'btn-primary');
            btnAddMode.classList.add('btn-outline-primary');
        }
        if (btnDirectMode) {
            btnDirectMode.classList.add('active', 'btn-primary');
            btnDirectMode.classList.remove('btn-outline-primary');
        }

        // Llenar campo con valor actual
        const currentStock = document.getElementById('stock-current-stock');
        const directInput = document.getElementById('stock-direct-value');
        if (currentStock && directInput) {
            directInput.value = currentStock.textContent || '0';
            directInput.focus();
            directInput.select();
        }
    }
},

// 3. NUEVA FUNCIÓN: Actualizar preview del nuevo stock
updateStockPreview() {
    const currentStockEl = document.getElementById('stock-current-stock');
    const addQuantityInput = document.getElementById('stock-add-quantity');
    const newStockPreview = document.getElementById('new-stock-preview');

    if (!currentStockEl || !addQuantityInput || !newStockPreview) return;

    const currentStock = parseInt(currentStockEl.textContent) || 0;
    const addQuantity = parseInt(addQuantityInput.value) || 0;
    const newStock = currentStock + addQuantity;

    newStockPreview.textContent = newStock;

    // Añadir clase de animación
    newStockPreview.classList.remove('stock-preview-update');
    void newStockPreview.offsetWidth; // Trigger reflow
    newStockPreview.classList.add('stock-preview-update');
},

// 4. MODIFICAR updateStock para manejar ambos modos
async updateStock() {
    try {
        console.log('Iniciando actualización de stock...');

        const productId = document.getElementById('stock-product-id')?.value;
        
        if (!productId) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Error: ID del producto no encontrado', 'danger');
            }
            return;
        }

        // Determinar modo (agregar o directo)
        const addContainer = document.getElementById('stock-add-container');
        const isAddMode = addContainer && addContainer.style.display !== 'none';

        let newStock;
        let cantidadModificada = 0;

        if (isAddMode) {
            // MODO AGREGAR
            const currentStockEl = document.getElementById('stock-current-stock');
            const addQuantityInput = document.getElementById('stock-add-quantity');
            
            const currentStock = parseInt(currentStockEl?.textContent) || 0;
            const addQuantity = parseInt(addQuantityInput?.value);

            if (isNaN(addQuantity) || addQuantity <= 0) {
                if (uiManager && uiManager.showAlert) {
                    uiManager.showAlert('Por favor, ingrese una cantidad válida a agregar (mayor a 0)', 'warning');
                }
                return;
            }

            newStock = currentStock + addQuantity;
            cantidadModificada = addQuantity;
            console.log(`Modo AGREGAR: ${currentStock} + ${addQuantity} = ${newStock}`);

        } else {
            // MODO ACTUALIZAR DIRECTO
            const directValueInput = document.getElementById('stock-direct-value');
            newStock = parseInt(directValueInput?.value);

            if (isNaN(newStock) || newStock < 0) {
                if (uiManager && uiManager.showAlert) {
                    uiManager.showAlert('Por favor, ingrese un valor de stock válido (0 o mayor)', 'warning');
                }
                return;
            }

            console.log(`Modo DIRECTO: Nuevo stock = ${newStock}`);
        }

        const saveBtn = document.getElementById('save-stock-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Actualizando...';
        }

        // Obtener producto actual
        let currentProduct = this.products.find(p => p._id === productId);
        if (!currentProduct) {
            console.log('Producto no en cache, obteniendo del servidor...');
            const response = await window.api.getProduct(productId);
            currentProduct = response.product || response;
        }

        if (!currentProduct) {
            throw new Error('Producto no encontrado');
        }

        // ====================================================================
        // 📝 GUARDAR DATOS ANTERIORES PARA EL LOG (CON FÓRMULA)
        // ====================================================================
        const datosAnteriores = {
            nombre: currentProduct.name,
            stock: currentProduct.stock || 0,
            barcode: currentProduct.barcode,
            formula: {
                sphere: currentProduct.sphere || 'N/A',
                cylinder: currentProduct.cylinder || 'N/A',
                addition: currentProduct.addition || 'N/A'
            }
        };

        const stockData = {
            stock: newStock,
            stock_surtido: currentProduct.stock_surtido || 0
        };

        console.log('Actualizando stock:', { productId, stockData });

        // Actualizar en servidor
        const response = await window.api.updateProductStock(productId, stockData);
        const updatedProduct = response.product || response;

        if (!updatedProduct || !updatedProduct._id) {
            console.error('Respuesta de API inválida:', response);
            throw new Error('Respuesta del servidor inválida');
        }

        console.log('Stock actualizado en servidor:', updatedProduct);

        // ====================================================================
        // 📝 REGISTRAR LOG DE ACTUALIZACIÓN DE STOCK (CON FÓRMULA)
        // ====================================================================
        if (window.activityLogger) {
            const accionDescripcion = isAddMode 
                ? `Stock incrementado: ${currentProduct.name} (+${cantidadModificada} unidades)` 
                : `Stock actualizado: ${currentProduct.name} (${datosAnteriores.stock} → ${newStock})`;

            window.activityLogger.log({
                tipo: 'PRODUCTO',
                accion: accionDescripcion,
                entidad: 'producto',
                entidad_id: updatedProduct._id,
                datos_anteriores: datosAnteriores,
                datos_nuevos: {
                    nombre: updatedProduct.name,
                    stock: updatedProduct.stock,
                    barcode: updatedProduct.barcode,
                    formula: {
                        sphere: updatedProduct.sphere || 'N/A',
                        cylinder: updatedProduct.cylinder || 'N/A',
                        addition: updatedProduct.addition || 'N/A'
                    },
                    modificacion: isAddMode ? `+${cantidadModificada}` : `Directo: ${newStock}`
                }
            });
        }

        // Sincronizar UI
        await this._syncStockUpdateImmediate(updatedProduct, productId);

        const modeText = isAddMode ? 'agregadas' : 'actualizado';
        const quantityText = isAddMode 
            ? `${cantidadModificada} unidades ${modeText}` 
            : `${updatedProduct.stock} unidades`;

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(
                `Stock ${isAddMode ? 'incrementado' : 'actualizado'} correctamente: ${quantityText}`, 
                'success'
            );
        }

        if (this.stockModal) {
            this.stockModal.hide();
        }

        setTimeout(() => {
            this._highlightUpdatedProduct(productId);
        }, 300);

    } catch (error) {
        console.error('Error al actualizar stock:', error);

        let errorMessage = 'Error al actualizar el stock';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(errorMessage, 'danger');
        }
    } finally {
        const saveBtn = document.getElementById('save-stock-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Actualizar Stock';
        }
    }
},

// 5. MODIFICAR setupEventListeners para incluir los nuevos controles
setupEventListeners() {
    console.log('Configurando event listeners...');

    const eventBindings = [
        { id: 'add-product-btn', event: 'click', handler: this.showAddProductModal.bind(this) },
        { id: 'save-product-btn', event: 'click', handler: this.saveProduct.bind(this) },
        { id: 'save-stock-btn', event: 'click', handler: this.updateStock.bind(this) },
        { id: 'products-table-body', event: 'click', handler: this.handleProductAction.bind(this) },
        { id: 'generate-barcode-btn', event: 'click', handler: this.generateBarcode.bind(this) },
        { id: 'barcode-scan-btn', event: 'click', handler: this.showBarcodeScannerModal.bind(this) },
        { id: 'manual-barcode-btn', event: 'click', handler: this.searchByManualBarcode.bind(this) },
        { id: 'product-search', event: 'input', handler: this.filterProducts.bind(this) },
        { id: 'confirm-delete-btn', event: 'click', handler: this.executeDelete.bind(this) },
        { id: 'cancel-delete-btn', event: 'click', handler: this.hideDeleteModal.bind(this) },
        
        // ====================================================================
        // NUEVOS EVENT LISTENERS PARA EL MODAL DE STOCK
        // ====================================================================
        { id: 'btn-stock-add-mode', event: 'click', handler: () => this.switchStockMode('add') },
        { id: 'btn-stock-direct-mode', event: 'click', handler: () => this.switchStockMode('direct') },
        { id: 'stock-add-quantity', event: 'input', handler: this.updateStockPreview.bind(this) }
    ];

    eventBindings.forEach(({ id, event, handler }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
            console.log(`Event listener agregado: ${id} -> ${event}`);
        } else {
            console.warn(`Elemento no encontrado: ${id}`);
        }
    });

    this._setupStockEvents();
    this.setupSyncListeners();
},

// 6. MODIFICAR _setupStockEvents para manejar ambos inputs
_setupStockEvents() {
    // Input para agregar cantidad
    const stockAddInput = document.getElementById('stock-add-quantity');
    if (stockAddInput) {
        stockAddInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.updateStock();
            }
        });
    }

    // Input para actualización directa
    const stockDirectInput = document.getElementById('stock-direct-value');
    if (stockDirectInput) {
        stockDirectInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.updateStock();
            }
        });
    }

    const stockForm = document.getElementById('stock-form');
    if (stockForm) {
        stockForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.updateStock();
        });
    }
},

    async saveProduct() {
    try {
        console.log('Iniciando guardado de producto...');

        const productId = document.getElementById('product-id')?.value;
        const productData = {
            name: document.getElementById('product-name')?.value?.trim() || '',
            barcode: document.getElementById('product-barcode')?.value?.trim() || '',
            sphere: document.getElementById('product-sphere')?.value?.trim() || '',
            cylinder: document.getElementById('product-cylinder')?.value?.trim() || '',
            addition: document.getElementById('product-addition')?.value?.trim() || '',
            stock: parseInt(document.getElementById('product-stock')?.value) || 0
        };

        // ========== VALIDACIONES ==========
        if (!productData.name) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('El nombre del producto es obligatorio', 'warning');
            } else {
                alert('El nombre del producto es obligatorio');
            }
            return;
        }

        if (!productData.barcode) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('El código de barras es obligatorio', 'warning');
            } else {
                alert('El código de barras es obligatorio');
            }
            return;
        }

        if (productData.barcode.length < 3) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('El código de barras debe tener al menos 3 dígitos', 'warning');
            } else {
                alert('El código de barras debe tener al menos 3 dígitos');
            }
            return;
        }

        console.log('Datos a guardar:', { productId, productData });

        const saveBtn = document.getElementById('save-product-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Guardando...';
        }

        let response;
        let finalProduct;
        let datosAnteriores = null; // Declarar aquí para usar después

        if (productId) {
            // ========== EDITAR PRODUCTO EXISTENTE ==========
            console.log('Editando producto existente:', productId);

            // 📝 GUARDAR DATOS ANTERIORES (para log posterior)
            datosAnteriores = this.currentEditingProduct ? {
                nombre: this.currentEditingProduct.name,
                barcode: this.currentEditingProduct.barcode,
                stock: this.currentEditingProduct.stock,
                sphere: this.currentEditingProduct.sphere || 'N/A',
                cylinder: this.currentEditingProduct.cylinder || 'N/A',
                addition: this.currentEditingProduct.addition || 'N/A',
                formula: {
                    sphere: this.currentEditingProduct.sphere || 'N/A',
                    cylinder: this.currentEditingProduct.cylinder || 'N/A',
                    addition: this.currentEditingProduct.addition || 'N/A'
                }
            } : null;

            if (this.currentEditingProduct && this.currentEditingProduct.stock !== productData.stock) {
                console.log('Stock cambió, actualizando por separado...');

                const { stock, ...dataWithoutStock } = productData;
                const updateResponse = await window.api.updateProduct(productId, dataWithoutStock);

                const stockData = {
                    stock: productData.stock,
                    stock_surtido: this.currentEditingProduct.stock_surtido || 0
                };
                const stockResponse = await window.api.updateProductStock(productId, stockData);
                finalProduct = stockResponse.product || stockResponse;
            } else {
                response = await window.api.updateProduct(productId, productData);
                finalProduct = response.product || response;
            }

            console.log('Producto actualizado:', finalProduct);

        } else {
            // ========== CREAR NUEVO PRODUCTO ==========
            console.log('Creando nuevo producto...');
            response = await window.api.createProduct(productData);

            // Validar respuesta
            if (!response || !response.success) {
                throw new Error(response?.message || 'Error al crear producto');
            }

            finalProduct = response.product || response;
            console.log('Producto creado:', finalProduct);
        }

        // ========== VALIDACIÓN DE RESPUESTA ==========
        if (!finalProduct || !finalProduct._id) {
            console.error('Respuesta inválida del servidor:', response);
            throw new Error('Respuesta del servidor inválida');
        }

        // ========== SINCRONIZACIÓN ==========
        if (productId) {
            await this._syncProductUpdateImmediate(finalProduct, productId);
        } else {
            await this._syncProductCreateImmediate(finalProduct);
        }

        // ====================================================================
        // ✅ LOGS SE GUARDAN AQUÍ - DESPUÉS DE CONFIRMAR ÉXITO
        // ====================================================================
        if (window.activityLogger) {
            try {
                if (productId) {
                    // LOG DE ACTUALIZACIÓN
                    window.activityLogger.log({
                        tipo: 'PRODUCTO',
                        accion: `Producto actualizado: ${finalProduct.name}`,
                        entidad: 'producto',
                        entidad_id: finalProduct._id,
                        datos_anteriores: datosAnteriores,
                        datos_nuevos: {
                            nombre: finalProduct.name,
                            barcode: finalProduct.barcode,
                            stock: finalProduct.stock,
                            sphere: finalProduct.sphere || 'N/A',
                            cylinder: finalProduct.cylinder || 'N/A',
                            addition: finalProduct.addition || 'N/A',
                            formula: {
                                sphere: finalProduct.sphere || 'N/A',
                                cylinder: finalProduct.cylinder || 'N/A',
                                addition: finalProduct.addition || 'N/A'
                            }
                        }
                    });
                } else {
                    // LOG DE CREACIÓN
                    window.activityLogger.log({
                        tipo: 'PRODUCTO',
                        accion: `Producto creado: ${finalProduct.name}`,
                        entidad: 'producto',
                        entidad_id: finalProduct._id,
                        datos_nuevos: {
                            nombre: finalProduct.name,
                            barcode: finalProduct.barcode,
                            stock: finalProduct.stock,
                            sphere: finalProduct.sphere || 'N/A',
                            cylinder: finalProduct.cylinder || 'N/A',
                            addition: finalProduct.addition || 'N/A',
                            formula: {
                                sphere: finalProduct.sphere || 'N/A',
                                cylinder: finalProduct.cylinder || 'N/A',
                                addition: finalProduct.addition || 'N/A'
                            }
                        }
                    });
                }
            } catch (logError) {
                // Si falla el log, NO detener la operación
                console.error('Error guardando log (no crítico):', logError);
            }
        }

        // ========== NOTIFICACIONES Y CIERRE ==========
        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(
                productId ? 'Producto actualizado correctamente' : 'Producto creado correctamente', 
                'success'
            );
        }

        if (this.productModal) {
            this.productModal.hide();
        }

        this.currentEditingProduct = null;

        setTimeout(() => {
            this._highlightUpdatedProduct(finalProduct._id);
        }, 300);

    } catch (error) {
        console.error('Error completo al guardar producto:', error);

        let errorMessage = 'Error al guardar el producto';

        if (error.message.includes('código de barras es obligatorio')) {
            errorMessage = 'El código de barras es obligatorio';
        } else if (error.message.includes('duplicate') ||
            error.message.includes('unique') ||
            error.message.includes('ya existe')) {
            errorMessage = 'Ya existe un producto con ese código de barras';
        } else if (error.message.includes('validation')) {
            errorMessage = 'Datos del producto no válidos';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet';
        } else if (error.message) {
            errorMessage = error.message;
        }

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(errorMessage, 'danger');
        } else {
            alert(errorMessage);
        }
    } finally {
        const saveBtn = document.getElementById('save-product-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Guardar Producto';
        }
    }
},

    async updateStock() {
    try {
        console.log('Iniciando actualización de stock...');

        const productId = document.getElementById('stock-product-id')?.value;
        
        if (!productId) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Error: ID del producto no encontrado', 'danger');
            }
            return;
        }

        // Determinar modo (agregar o directo)
        const addContainer = document.getElementById('stock-add-container');
        const isAddMode = addContainer && addContainer.style.display !== 'none';

        let newStock;
        let cantidadModificada = 0;

        if (isAddMode) {
            // MODO AGREGAR
            const currentStockEl = document.getElementById('stock-current-stock');
            const addQuantityInput = document.getElementById('stock-add-quantity');
            
            const currentStock = parseInt(currentStockEl?.textContent) || 0;
            const addQuantity = parseInt(addQuantityInput?.value);

            if (isNaN(addQuantity) || addQuantity <= 0) {
                if (uiManager && uiManager.showAlert) {
                    uiManager.showAlert('Por favor, ingrese una cantidad válida a agregar (mayor a 0)', 'warning');
                }
                return;
            }

            newStock = currentStock + addQuantity;
            cantidadModificada = addQuantity;
            console.log(`Modo AGREGAR: ${currentStock} + ${addQuantity} = ${newStock}`);

        } else {
            // MODO ACTUALIZAR DIRECTO
            const directValueInput = document.getElementById('stock-direct-value');
            newStock = parseInt(directValueInput?.value);

            if (isNaN(newStock) || newStock < 0) {
                if (uiManager && uiManager.showAlert) {
                    uiManager.showAlert('Por favor, ingrese un valor de stock válido (0 o mayor)', 'warning');
                }
                return;
            }

            console.log(`Modo DIRECTO: Nuevo stock = ${newStock}`);
        }

        const saveBtn = document.getElementById('save-stock-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Actualizando...';
        }

        // Obtener producto actual
        let currentProduct = this.products.find(p => p._id === productId);
        if (!currentProduct) {
            console.log('Producto no en cache, obteniendo del servidor...');
            const response = await window.api.getProduct(productId);
            currentProduct = response.product || response;
        }

        if (!currentProduct) {
            throw new Error('Producto no encontrado');
        }

        // ====================================================================
        // 📝 GUARDAR DATOS ANTERIORES PARA EL LOG (CON FÓRMULA)
        // ====================================================================
        const datosAnteriores = {
            nombre: currentProduct.name,
            stock: currentProduct.stock || 0,
            barcode: currentProduct.barcode,
            sphere: currentProduct.sphere || 'N/A',
            cylinder: currentProduct.cylinder || 'N/A',
            addition: currentProduct.addition || 'N/A',
            formula: {
                sphere: currentProduct.sphere || 'N/A',
                cylinder: currentProduct.cylinder || 'N/A',
                addition: currentProduct.addition || 'N/A'
            }
        };

        const stockData = {
            stock: newStock,
            stock_surtido: currentProduct.stock_surtido || 0
        };

        console.log('Actualizando stock:', { productId, stockData });

        // Actualizar en servidor
        const response = await window.api.updateProductStock(productId, stockData);
        const updatedProduct = response.product || response;

        if (!updatedProduct || !updatedProduct._id) {
            console.error('Respuesta de API inválida:', response);
            throw new Error('Respuesta del servidor inválida');
        }

        console.log('Stock actualizado en servidor:', updatedProduct);

        // ====================================================================
        // 📝 REGISTRAR LOG DE ACTUALIZACIÓN DE STOCK (CON FÓRMULA)
        // ====================================================================
        if (window.activityLogger) {
            const accionDescripcion = isAddMode 
                ? `Stock incrementado: ${currentProduct.name} (+${cantidadModificada} unidades)` 
                : `Stock actualizado: ${currentProduct.name} (${datosAnteriores.stock} → ${newStock})`;

            window.activityLogger.log({
                tipo: 'PRODUCTO',
                accion: accionDescripcion,
                entidad: 'producto',
                entidad_id: updatedProduct._id,
                datos_anteriores: datosAnteriores,
                datos_nuevos: {
                    nombre: updatedProduct.name,
                    stock: updatedProduct.stock,
                    barcode: updatedProduct.barcode,
                    sphere: updatedProduct.sphere || 'N/A',
                    cylinder: updatedProduct.cylinder || 'N/A',
                    addition: updatedProduct.addition || 'N/A',
                    formula: {
                        sphere: updatedProduct.sphere || 'N/A',
                        cylinder: updatedProduct.cylinder || 'N/A',
                        addition: updatedProduct.addition || 'N/A'
                    },
                    modificacion: isAddMode ? `+${cantidadModificada}` : `Directo: ${newStock}`
                }
            });
        }

        // Sincronizar UI
        await this._syncStockUpdateImmediate(updatedProduct, productId);

        const modeText = isAddMode ? 'agregadas' : 'actualizado';
        const quantityText = isAddMode 
            ? `${cantidadModificada} unidades ${modeText}` 
            : `${updatedProduct.stock} unidades`;

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(
                `Stock ${isAddMode ? 'incrementado' : 'actualizado'} correctamente: ${quantityText}`, 
                'success'
            );
        }

        if (this.stockModal) {
            this.stockModal.hide();
        }

        setTimeout(() => {
            this._highlightUpdatedProduct(productId);
        }, 300);

    } catch (error) {
        console.error('Error al actualizar stock:', error);

        let errorMessage = 'Error al actualizar el stock';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(errorMessage, 'danger');
        }
    } finally {
        const saveBtn = document.getElementById('save-stock-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Actualizar Stock';
        }
    }
    },

    async _syncProductUpdateImmediate(updatedProduct, productId) {
        console.log('Sincronizando actualización inmediatamente...', updatedProduct);

        try {
            if (!updatedProduct || !updatedProduct._id) {
                console.error('Producto inválido para sincronización:', updatedProduct);
                throw new Error('Producto inválido recibido para sincronización');
            }

            if (!Array.isArray(this.products)) {
                console.warn('this.products no es un array, inicializando...');
                this.products = [];
            }

            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index] = {
                    ...this.products[index],
                    ...updatedProduct,
                    _id: productId
                };
                console.log('Cache local actualizado');
            } else {
                console.warn('Producto no encontrado en cache, agregándolo...');
                this.products.push(updatedProduct);
                this.sortProductsById();
            }

            this._renderTableImmediate();

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:updated', updatedProduct);
            }

            await this._forceStyleRefresh();
            console.log('Sincronización de actualización completada');

        } catch (error) {
            console.error('Error en sincronización inmediata de actualización:', error);
            await this.loadProducts();
        }
    },

    async _syncProductCreateImmediate(newProduct) {
        console.log('Sincronizando creación inmediatamente...', newProduct);

        try {
            if (!newProduct || !newProduct._id) {
                console.error('Producto inválido para sincronización de creación:', newProduct);
                throw new Error('Producto inválido recibido para sincronización de creación');
            }

            if (!Array.isArray(this.products)) {
                console.warn('this.products no es un array, inicializando...');
                this.products = [];
            }

            const exists = this.products.some(p => p._id === newProduct._id);
            if (!exists) {
                this.products.push(newProduct);
                this.sortProductsById();
                console.log('Nuevo producto agregado al cache');
            } else {
                console.warn('Producto ya existe, actualizando...');
                const index = this.products.findIndex(p => p._id === newProduct._id);
                this.products[index] = newProduct;
            }

            this._renderTableImmediate();

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:created', newProduct);
            }

            await this._forceStyleRefresh();
            console.log('Sincronización de creación completada');

        } catch (error) {
            console.error('Error en sincronización inmediata de creación:', error);
            await this.loadProducts();
        }
    },

    async _syncStockUpdateImmediate(updatedProduct, productId) {
        console.log('Sincronizando actualización de stock inmediatamente...', updatedProduct);

        try {
            if (!updatedProduct || !updatedProduct._id) {
                console.error('Producto inválido para sincronización:', updatedProduct);
                throw new Error('Producto inválido recibido para sincronización');
            }

            if (!Array.isArray(this.products)) {
                console.warn('this.products no es un array, inicializando...');
                this.products = [];
            }

            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index] = {
                    ...this.products[index],
                    stock: updatedProduct.stock,
                    stock_surtido: updatedProduct.stock_surtido,
                    stock_almacenado: updatedProduct.stock_almacenado,
                    lastUpdated: updatedProduct.lastUpdated
                };
                console.log('Stock actualizado en cache local');
            } else {
                console.warn('Producto no encontrado para actualizar stock');
                this.products.push(updatedProduct);
                this.sortProductsById();
            }

            this._renderTableImmediate();

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:stock-updated', {
                    productId,
                    newStock: updatedProduct.stock,
                    product: updatedProduct
                });
            }

            await this._forceStyleRefresh();
            console.log('Sincronización de stock completada');

        } catch (error) {
            console.error('Error en sincronización de stock:', error);
            await this.loadProducts();
        }
    },

    // ========== MÉTODOS DE ELIMINACIÓN CON MODAL PERSONALIZADO ==========

    async deleteProduct(productId) {
        if (!Array.isArray(this.products)) {
            console.warn('this.products no es un array, inicializando...');
            this.products = [];
        }

        const productToDelete = this.products.find(p => p._id === productId);
        const productName = productToDelete ? productToDelete.name : 'el producto';

        this.productToDeleteId = productId;
        this.productToDeleteName = productName;

        this.showDeleteModal(productName);
    },

    showDeleteModal(productName) {
        const modal = document.getElementById('confirm-delete-modal');
        const messageElement = document.getElementById('delete-modal-message');

        if (messageElement) {
            messageElement.textContent = `¿Está seguro de eliminar "${productName}"? Esta acción no se puede deshacer.`;
        }

        if (modal) {
            modal.style.display = 'flex';
        }
    },

    hideDeleteModal() {
        const modal = document.getElementById('confirm-delete-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.productToDeleteId = null;
        this.productToDeleteName = null;
    },

    async executeDelete() {
    if (!this.productToDeleteId) {
        console.warn('No hay producto para eliminar');
        this.hideDeleteModal();
        return;
    }

    try {
        console.log('Eliminando producto:', this.productToDeleteId);

        // ====================================================================
        // 📝 GUARDAR DATOS DEL PRODUCTO ANTES DE ELIMINAR (CON FÓRMULA)
        // ====================================================================
        const productoAEliminar = this.products.find(p => p._id === this.productToDeleteId);
        
        const datosEliminados = productoAEliminar ? {
            nombre: productoAEliminar.name,
            barcode: productoAEliminar.barcode,
            stock: productoAEliminar.stock,
            sphere: productoAEliminar.sphere || 'N/A',
            cylinder: productoAEliminar.cylinder || 'N/A',
            addition: productoAEliminar.addition || 'N/A',
            formula: {
                sphere: productoAEliminar.sphere || 'N/A',
                cylinder: productoAEliminar.cylinder || 'N/A',
                addition: productoAEliminar.addition || 'N/A'
            }
        } : null;

        // Eliminar del servidor
        await window.api.deleteProduct(this.productToDeleteId);

        // ====================================================================
        // 📝 REGISTRAR LOG DE ELIMINACIÓN
        // ====================================================================
        if (window.activityLogger && datosEliminados) {
            window.activityLogger.log({
                tipo: 'PRODUCTO',
                accion: `Producto eliminado: ${this.productToDeleteName}`,
                entidad: 'producto',
                entidad_id: this.productToDeleteId,
                datos_anteriores: datosEliminados,
                datos_nuevos: null // No hay datos nuevos porque fue eliminado
            });
        }

        // Eliminar del cache local
        const initialLength = this.products.length;
        this.products = this.products.filter(p => p._id !== this.productToDeleteId);

        if (this.products.length < initialLength) {
            console.log('Producto eliminado del cache local inmediatamente');
            this._renderTableImmediate();
        }

        // Emitir evento
        if (eventManager && typeof eventManager.emit === 'function') {
            eventManager.emit('data:product:deleted', this.productToDeleteId);
        }

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(`${this.productToDeleteName} eliminado correctamente`, 'success');
        }

        this.hideDeleteModal();
        console.log('Producto eliminado y sincronizado:', this.productToDeleteId);

    } catch (error) {
        console.error('Error al eliminar producto:', error);

        let errorMessage = 'Error al eliminar el producto';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        if (uiManager && uiManager.showAlert) {
            uiManager.showAlert(errorMessage, 'danger');
        }

        this.hideDeleteModal();
    }
    },

    handleProductAction(event) {
        const target = event.target.closest('button');
        if (!target) return;

        const productId = target.dataset.id;
        if (!productId) return;

        if (target.classList.contains('edit-product')) {
            this.showEditProductModal(productId);
        } else if (target.classList.contains('update-stock')) {
            this.showUpdateStockModal(productId);
        } else if (target.classList.contains('delete-product')) {
            this.deleteProduct(productId);
        }
    },

    generateBarcode() {
        const prefix = '200';
        const middleDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
        const barcodeWithoutChecksum = prefix + middleDigits;

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(barcodeWithoutChecksum[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;

        const barcode = barcodeWithoutChecksum + checkDigit;
        const barcodeInput = document.getElementById('product-barcode');
        if (barcodeInput) barcodeInput.value = barcode;
    },

    showBarcodeScannerModal() {
        const scannerModal = new bootstrap.Modal(document.getElementById('barcode-scanner-modal'));
        scannerModal.show();

        setTimeout(() => {
            const manualInput = document.getElementById('manual-barcode-input');
            if (manualInput) manualInput.focus();
        }, 500);
    },

    async searchByManualBarcode() {
        const barcodeInput = document.getElementById('manual-barcode-input');
        const barcode = barcodeInput?.value.trim();

        if (!barcode) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Ingrese un código de barras', 'warning');
            } else {
                alert('Ingrese un código de barras');
            }
            return;
        }

        try {
            const response = await window.api.getProductByBarcode(barcode);
            const product = response.product || response;

            const scannerModal = bootstrap.Modal.getInstance(document.getElementById('barcode-scanner-modal'));
            if (scannerModal) scannerModal.hide();

            this.showEditProductModal(product._id);
        } catch (error) {
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Producto no encontrado con ese código de barras', 'warning');
            } else {
                alert('Producto no encontrado');
            }
        }
    },

filterProducts() {
    const searchInput = document.getElementById('product-search');
    const searchTerm = searchInput?.value.trim() || '';

    // Si no hay término de búsqueda, mostrar todos los productos
    if (!searchTerm) {
        this.renderProductsTable();
        return;
    }

    // Validación: Asegurar que products sea un array
    if (!Array.isArray(this.products)) {
        console.warn('this.products no es un array para filtrar');
        this.products = [];
        this.renderProductsTable();
        return;
    }

    console.log('🔍 Filtrando productos con término:', searchTerm);

    // Normalizar término de búsqueda
    const searchTermNormalized = this.normalizarTerminoBusqueda(searchTerm);

    // Filtrar productos usando función especializada
    const filteredProducts = this.products.filter(product => 
        this.productoCoincideConBusqueda(product, searchTermNormalized)
    );

    console.log(`✅ Encontrados ${filteredProducts.length} de ${this.products.length} productos`);

    // Guardar productos originales y renderizar filtrados
    const originalProducts = [...this.products];
    this.products = filteredProducts;
    this.renderProductsTable();
    this.products = originalProducts;
},

// ✅ AGREGAR estas funciones auxiliares después de filterProducts

// Normalizar término de búsqueda
normalizarTerminoBusqueda(termino) {
    if (!termino) return '';
    
    let normalizado = String(termino);
    normalizado = normalizado.trim();
    normalizado = normalizado.toLowerCase();
    
    // Reemplazar caracteres especiales que el escáner puede leer mal
    normalizado = normalizado.replace(/'/g, '-');
    normalizado = normalizado.replace(/¡/g, '+');
    
    return normalizado;
},

// Normalizar código de barras (reutilizar la misma lógica que salesManager)
normalizarCodigoBarras(barcode) {
    if (!barcode) return '';
    
    let codigo = String(barcode);
    codigo = codigo.trim();
    codigo = codigo.replace(/'/g, '-');
    codigo = codigo.replace(/¡/g, '+');
    codigo = codigo.toLowerCase();
    codigo = codigo.replace(/\s+/g, '');
    
    return codigo;
},

// Verificar si un producto coincide con la búsqueda
productoCoincideConBusqueda(product, searchTerm) {
    if (!product) return false;
    
    // 1. BÚSQUEDA POR CÓDIGO DE BARRAS (prioridad alta)
    if (product.barcode) {
        const barcodeNormalizado = this.normalizarCodigoBarras(product.barcode);
        if (barcodeNormalizado === searchTerm || barcodeNormalizado.includes(searchTerm)) {
            return true;
        }
    }

    // 2. BÚSQUEDA POR NOMBRE
    if (product.name) {
        const nombreNormalizado = product.name.toLowerCase().trim();
        if (nombreNormalizado.includes(searchTerm)) {
            return true;
        }
    }

    // 3. BÚSQUEDA POR ESFERA
    if (product.sphere && product.sphere !== 'N' && product.sphere !== 'N/A') {
        const esferaNormalizada = String(product.sphere).toLowerCase().trim();
        
        if (esferaNormalizada === searchTerm || esferaNormalizada.includes(searchTerm)) {
            return true;
        }
        
        // Búsqueda sin signo
        const esferaSinSigno = esferaNormalizada.replace(/[+\-]/g, '');
        const terminoSinSigno = searchTerm.replace(/[+\-]/g, '');
        if (esferaSinSigno === terminoSinSigno) {
            return true;
        }
    }

    // 4. BÚSQUEDA POR CILINDRO
    if (product.cylinder && product.cylinder !== '-' && product.cylinder !== 'N/A') {
        const cilindroNormalizado = String(product.cylinder).toLowerCase().trim();
        
        if (cilindroNormalizado === searchTerm || cilindroNormalizado.includes(searchTerm)) {
            return true;
        }
        
        const cilindroSinSigno = cilindroNormalizado.replace(/[+\-]/g, '');
        const terminoSinSigno = searchTerm.replace(/[+\-]/g, '');
        if (cilindroSinSigno === terminoSinSigno) {
            return true;
        }
    }

    // 5. BÚSQUEDA POR ADICIÓN
    if (product.addition && product.addition !== '-' && product.addition !== 'N/A') {
        const adicionNormalizada = String(product.addition).toLowerCase().trim();
        
        if (adicionNormalizada === searchTerm || adicionNormalizada.includes(searchTerm)) {
            return true;
        }
        
        const adicionSinSigno = adicionNormalizada.replace(/[+\-]/g, '');
        const terminoSinSigno = searchTerm.replace(/[+\-]/g, '');
        if (adicionSinSigno === terminoSinSigno) {
            return true;
        }
    }

    return false;
},

    async _forceStyleRefresh() {
        return new Promise(resolve => {
            setTimeout(() => {
                const table = document.getElementById('products-table');
                if (table) {
                    table.classList.remove('table', 'table-base');
                    table.offsetHeight;
                    table.classList.add('table', 'table-base');
                }

                const container = table?.closest('.table-container, .table-responsive');
                if (container) {
                    container.classList.remove('table-container-base');
                    container.offsetHeight;
                    container.classList.add('table-container-base');
                }

                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }

                resolve();
            }, 50);
        });
    },

    async refresh() {
        console.log('Refrescando ProductManager...');
        if (this.isInitialized) {
            await this.loadProducts();
        } else {
            console.warn('ProductManager no inicializado');
        }
    },

    async refreshProductsManually() {
        console.log('Refrescando productos manualmente...');
        try {
            const freshProducts = await window.api.getProducts();

            if (Array.isArray(freshProducts)) {
                this.products = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                this.products = freshProducts.products;
            } else {
                console.warn('Formato de respuesta inesperado:', freshProducts);
                this.products = [];
            }

            this.sortProductsById();
            this._renderTableImmediate();
            console.log('Productos refrescados manualmente');

            if (window.uiManager) {
                window.uiManager.showAlert('Productos actualizados', 'success');
            }
        } catch (error) {
            console.error('Error en refresh manual:', error);
            if (window.uiManager) {
                window.uiManager.showAlert('Error al actualizar productos', 'danger');
            }
        }
    },

    async checkAndFixSync() {
        console.log('Verificando sincronización...');

        try {
            const freshProducts = await window.api.getProducts();

            let validFreshProducts;
            if (Array.isArray(freshProducts)) {
                validFreshProducts = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                validFreshProducts = freshProducts.products;
            } else {
                console.error('Formato inválido de productos:', freshProducts);
                return false;
            }

            if (validFreshProducts.length !== this.products.length) {
                console.log('Diferencia en cantidad detectada, sincronizando...');
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

            let hasChanges = false;
            validFreshProducts.forEach(freshProduct => {
                const localProduct = this.products.find(p => p._id === freshProduct._id);
                if (localProduct && localProduct.lastUpdated !== freshProduct.lastUpdated) {
                    console.log('Producto desincronizado detectado:', freshProduct.name);
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                console.log('Sincronizando cambios detectados...');
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

            console.log('Sincronización verificada - todo en orden');
            return false;

        } catch (error) {
            console.error('Error verificando sincronización:', error);
            return false;
        }
    },

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            productsCount: Array.isArray(this.products) ? this.products.length : 0,
            hasModals: !!(this.productModal && this.stockModal),
            isSubscribed: dataSync && typeof dataSync.isSubscribed === 'function'
                ? dataSync.isSubscribed(this.viewName, 'products')
                : false,
            initializationInProgress: !!this.initializationPromise,
            currentEditingProduct: !!this.currentEditingProduct
        };
    },

    forceRerender() {
        console.log('Forzando re-renderizado...');
        if (this.isInitialized) {
            this.renderProductsTable();
        }
    },

    validateDataIntegrity() {
        console.log('Validando integridad de datos...');

        if (!Array.isArray(this.products)) {
            return { valid: false, issues: ['products no es un array'] };
        }

        const issues = [];

        const ids = this.products.map(p => p._id).filter(id => id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            issues.push(`IDs duplicados: ${duplicateIds.join(', ')}`);
        }

        const productsWithoutName = this.products.filter(p => !p.name);
        if (productsWithoutName.length > 0) {
            issues.push(`${productsWithoutName.length} productos sin nombre`);
        }

        const negativeStock = this.products.filter(p => (p.stock || 0) < 0);
        if (negativeStock.length > 0) {
            issues.push(`${negativeStock.length} productos con stock negativo`);
        }

        if (issues.length > 0) {
            console.warn('Problemas de integridad encontrados:', issues);
            return { valid: false, issues };
        } else {
            console.log('Integridad de datos válida');
            return { valid: true, issues: [] };
        }
    },

    getStats() {
        if (!Array.isArray(this.products)) {
            return { error: 'products no es un array válido' };
        }

        const totalProducts = this.products.length;
        const totalStock = this.products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const lowStock = this.products.filter(p => (p.stock || 0) <= 0).length;
        const mediumStock = this.products.filter(p => {
            const stock = p.stock || 0;
            return stock > 0 && stock < 5;
        }).length;
        const highStock = this.products.filter(p => (p.stock || 0) >= 5).length;

        return {
            totalProducts,
            totalStock,
            stockLevels: {
                low: lowStock,
                medium: mediumStock,
                high: highStock
            },
            avgStock: totalProducts > 0 ? (totalStock / totalProducts).toFixed(2) : 0
        };
    },

    exportData() {
        const data = {
            products: Array.isArray(this.products) ? this.products : [],
            metadata: {
                exportDate: new Date().toISOString(),
                totalCount: Array.isArray(this.products) ? this.products.length : 0,
                version: '2.0',
                status: this.getStatus()
            }
        };

        console.log('Datos exportados:', data);
        return data;
    },

    async forceReinit() {
        console.log('Forzando reinicialización...');

        try {
            this.destroy();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.init();
            console.log('Reinicialización forzada completada');
        } catch (error) {
            console.error('Error en reinicialización forzada:', error);
            throw error;
        }
    },

    destroy() {
        console.log('Destruyendo ProductManager...');

        try {
            if (dataSync && typeof dataSync.isSubscribed === 'function' && typeof dataSync.unsubscribe === 'function') {
                if (dataSync.isSubscribed(this.viewName, 'products')) {
                    dataSync.unsubscribe(this.viewName, 'products');
                    console.log('Desuscrito de dataSync');
                }
            } else {
                console.warn('dataSync no disponible o métodos faltantes');
            }

            if (this.productModal) {
                try {
                    this.productModal.dispose();
                } catch (e) {
                    console.warn('Error disposing productModal:', e.message);
                }
                this.productModal = null;
            }

            if (this.stockModal) {
                try {
                    this.stockModal.dispose();
                } catch (e) {
                    console.warn('Error disposing stockModal:', e.message);
                }
                this.stockModal = null;
            }

            const elementIds = [
                'add-product-btn', 'save-product-btn', 'save-stock-btn',
                'products-table-body', 'generate-barcode-btn', 'barcode-scan-btn',
                'manual-barcode-btn', 'product-search', 'confirm-delete-btn', 'cancel-delete-btn'
            ];

            elementIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const newElement = element.cloneNode(true);
                    element.parentNode.replaceChild(newElement, element);
                }
            });

            this.products = [];
            this.currentEditingProduct = null;
            this.productToDeleteId = null;
            this.productToDeleteName = null;
            this.isInitialized = false;
            this.initializationPromise = null;

            if (window.productManager === this) {
                delete window.productManager;
            }

            console.log('ProductManager destruido completamente');

        } catch (error) {
            console.error('Error durante la destrucción:', error);
        }
    },

    debug() {
        const debugInfo = {
            status: this.getStatus(),
            stats: this.getStats(),
            integrity: this.validateDataIntegrity(),
            sampleProducts: this.products.slice(0, 3),
            methods: Object.getOwnPropertyNames(this).filter(prop => typeof this[prop] === 'function')
        };

        console.group('ProductManager Debug Info');
        console.table(debugInfo.status);
        console.table(debugInfo.stats);
        console.log('Integridad:', debugInfo.integrity);
        console.log('Productos muestra:', debugInfo.sampleProducts);
        console.log('Métodos disponibles:', debugInfo.methods);
        console.groupEnd();

        return debugInfo;
    },

    setupSyncListeners() {
        console.log('🔧 Configurando listeners de sincronización...');

        if (window.syncCoordinator && typeof window.syncCoordinator.subscribe === 'function') {
            this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
                'productManager',
                (eventType, data) => this.handleSyncEvent(eventType, data)
            );
            console.log('✅ Suscrito a syncCoordinator');
        }

        eventManager.on('external:product-updated', (product) => {
            console.log('🌐 ProductManager: Actualización externa recibida', product._id);
            this.handleExternalProductUpdate(product);
        });

        eventManager.on('external:stock-updated', (data) => {
            console.log('🌐 ProductManager: Stock externo actualizado', data.productId);
            this.handleExternalStockUpdate(data);
        });

        eventManager.on('sync:product-synced', (syncData) => {
            console.log('✅ ProductManager: Producto sincronizado', syncData.productId);
            this._highlightUpdatedProduct(syncData.productId);
        });
    },

    handleSyncEvent(eventType, data) {
        console.log(`🔄 ProductManager recibió evento de sync: ${eventType}`);

        switch (eventType) {
            case 'product:updated':
                this._handleProductUpdatedImmediate(data);
                break;
            case 'stock:updated':
                this._handleStockUpdatedImmediate(data);
                break;
            case 'force:refresh':
                this.loadProducts();
                break;
        }
    },

    handleExternalProductUpdate(product) {
        if (!product || !product._id) return;

        console.log('🔄 Actualizando producto desde fuente externa:', product._id);

        if (Array.isArray(this.products)) {
            const index = this.products.findIndex(p => p._id === product._id);
            if (index !== -1) {
                this.products[index] = {
                    ...this.products[index],
                    ...product
                };
            } else {
                this.products.push(product);
                this.sortProductsById();
            }
        }

        this._renderTableImmediate();
        this._highlightUpdatedProduct(product._id);
    },

    handleExternalStockUpdate(data) {
        if (!data || !data.productId) return;

        console.log('🔄 Actualizando stock desde fuente externa:', data.productId);

        if (data.product) {
            this.handleExternalProductUpdate(data.product);
            return;
        }

        if (data.productId && data.newStock !== undefined) {
            const index = this.products.findIndex(p => p._id === data.productId);
            if (index !== -1) {
                this.products[index].stock = data.newStock;
                this.products[index].stock_surtido = data.product?.stock_surtido || this.products[index].stock_surtido;
                this._renderTableImmediate();
                this._highlightUpdatedProduct(data.productId);
            }
        }
    }
};