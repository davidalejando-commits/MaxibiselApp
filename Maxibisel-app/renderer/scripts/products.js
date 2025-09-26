// Gestión de productos - Versión corregida completa con sincronización inmediata
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';
import { uiManager } from './ui.js';

export const productManager = {
    products: [],
    productModal: null,
    stockModal: null,
    viewName: 'productManager',
    isInitialized: false,
    initializationPromise: null,

    // Inicialización corregida
    async init() {
        if (this.initializationPromise) {
            console.log('⏳ Esperando inicialización en progreso...');
            return await this.initializationPromise;
        }

        if (this.isInitialized) {
            console.log('✅ ProductManager ya está inicializado');
            return;
        }

        this.initializationPromise = this._performInit();
        return await this.initializationPromise;
    },

    async _performInit() {
        try {
            console.log('🚀 Inicializando ProductManager...');

            if (!eventManager.isInitialized) {
                console.log('🔧 Inicializando eventManager...');
                eventManager.init();
            }

            if (!dataSync.isInitialized) {
                console.log('🔧 Inicializando dataSync...');
                dataSync.init();
            }

            this.setupAuthEventListeners();
            await this._waitForDOMElements(10000);
            this._initializeModals();
            this.setupEventListeners();
            
            // ✅ VALIDACIÓN: Verificar métodos de dataSync antes de usar
            if (dataSync && typeof dataSync.subscribe === 'function') {
                dataSync.subscribe(this.viewName, 'products', this.handleDataChange.bind(this));
            } else {
                console.warn('⚠️ dataSync.subscribe no disponible');
            }
            
            await this.loadProducts();
            await this._validateInitialization();

            this.isInitialized = true;
            console.log('✅ ProductManager inicializado completamente');

            setTimeout(() => {
                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }
            }, 100);

            window.productManager = this;
            console.log('🌍 ProductManager expuesto globalmente');

        } catch (error) {
            console.error('❌ Error en inicialización de ProductManager:', error);
            this.isInitialized = false;
            throw error;
        } finally {
            this.initializationPromise = null;
        }
    },

    setupAuthEventListeners() {
        console.log('🔧 Configurando listeners para eventos de auth...');

        eventManager.on('auth:login-success', this.handleLoginSuccess.bind(this));
        eventManager.on('view:activated', this.handleViewActivated.bind(this));
        eventManager.on('auth:products-initialized', this.handleProductsInitialized.bind(this));

        console.log('✅ Listeners de auth configurados');
    },

    async handleLoginSuccess(user) {
        console.log('👤 Login exitoso recibido en ProductManager:', user.fullName);

        try {
            if (!this.isInitialized) {
                console.log('⚠️ ProductManager no inicializado, inicializando...');
                await this.init();
            }

            console.log('📦 Cargando productos después del login...');
            await this.loadProducts();

        } catch (error) {
            console.error('❌ Error manejando login en ProductManager:', error);
        }
    },

    async handleViewActivated(viewData) {
        if (viewData.viewName === 'products') {
            console.log('👁️ Vista de productos activada');

            if (this.isInitialized && (!this.products || this.products.length === 0)) {
                console.log('📦 Vista de productos activada sin datos, cargando...');
                await this.loadProducts();
            }
        }
    },

    handleProductsInitialized(data) {
        console.log('✅ Productos inicializados después del login:', data);

        if (this.isInitialized && this.products.length > 0) {
            setTimeout(() => {
                this._renderTableImmediate();
            }, 100);
        }
    },

    async _waitForDOMElements(maxWait = 10000) {
        const requiredElements = ['products-table-body', 'product-modal', 'stock-modal'];
        const startTime = Date.now();
        console.log('⏳ Esperando elementos DOM...', requiredElements);

        return new Promise((resolve, reject) => {
            const checkElements = () => {
                const missingElements = requiredElements.filter(id => !document.getElementById(id));

                if (missingElements.length === 0) {
                    console.log('✅ Todos los elementos DOM requeridos están disponibles');
                    resolve();
                    return;
                }

                const elapsed = Date.now() - startTime;
                if (elapsed > maxWait) {
                    console.error(`❌ Elementos DOM faltantes después de ${maxWait}ms:`, missingElements);
                    reject(new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`));
                    return;
                }

                if (elapsed % 2000 === 0) {
                    console.log(`⏳ Aún esperando elementos DOM (${Math.round(elapsed / 1000)}s): ${missingElements.join(', ')}`);
                }

                setTimeout(checkElements, 100);
            };

            checkElements();
        });
    },

    // ✅ FUNCIÓN CORREGIDA: Validación con verificaciones de métodos
    async _validateInitialization() {
        console.log('🔍 Validando inicialización...');

        const validations = [
            { name: 'Tabla de productos', check: () => document.getElementById('products-table-body') !== null },
            { name: 'Datos cargados', check: () => Array.isArray(this.products) },
            { name: 'Suscripción a dataSync', check: () => {
                // ✅ CORRECCIÓN: Verificar métodos antes de usar
                if (!dataSync || typeof dataSync.isSubscribed !== 'function') {
                    console.warn('⚠️ dataSync.isSubscribed no disponible');
                    return true; // Asumir válido si no está disponible
                }
                return dataSync.isSubscribed(this.viewName, 'products');
            }},
            { name: 'Event listeners configurados', check: () => document.getElementById('add-product-btn') !== null }
        ];

        const failedValidations = validations.filter(v => !v.check());

        if (failedValidations.length > 0) {
            const failedNames = failedValidations.map(v => v.name).join(', ');
            throw new Error(`Validaciones fallidas: ${failedNames}`);
        }

        console.log('✅ Todas las validaciones pasaron');
    },

    _initializeModals() {
        try {
            const productModalEl = document.getElementById('product-modal');
            const stockModalEl = document.getElementById('stock-modal');

            if (productModalEl && typeof bootstrap !== 'undefined') {
                this.productModal = new bootstrap.Modal(productModalEl);
                console.log('✅ Modal de producto inicializado');
            } else {
                console.warn('⚠️ No se pudo inicializar modal de producto');
            }

            if (stockModalEl && typeof bootstrap !== 'undefined') {
                this.stockModal = new bootstrap.Modal(stockModalEl);
                console.log('✅ Modal de stock inicializado');
            } else {
                console.warn('⚠️ No se pudo inicializar modal de stock');
            }
        } catch (error) {
            console.error('❌ Error inicializando modales:', error);
        }
    },

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');

        const eventBindings = [
            { id: 'add-product-btn', event: 'click', handler: this.showAddProductModal.bind(this) },
            { id: 'save-product-btn', event: 'click', handler: this.saveProduct.bind(this) },
            { id: 'save-stock-btn', event: 'click', handler: this.updateStock.bind(this) },
            { id: 'products-table-body', event: 'click', handler: this.handleProductAction.bind(this) },
            { id: 'generate-barcode-btn', event: 'click', handler: this.generateBarcode.bind(this) },
            { id: 'barcode-scan-btn', event: 'click', handler: this.showBarcodeScannerModal.bind(this) },
            { id: 'manual-barcode-btn', event: 'click', handler: this.searchByManualBarcode.bind(this) },
            { id: 'product-search', event: 'input', handler: this.filterProducts.bind(this) }
        ];

        eventBindings.forEach(({ id, event, handler }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`✅ Event listener agregado: ${id} -> ${event}`);
            } else {
                console.warn(`⚠️ Elemento no encontrado: ${id}`);
            }
        });

        this._setupStockEvents();
    },

    _setupStockEvents() {
        const stockInput = document.getElementById('stock-new-value');
        const stockForm = document.getElementById('stock-form');

        if (stockInput) {
            stockInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.updateStock();
                }
            });
        }

        if (stockForm) {
            stockForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.updateStock();
            });
        }
    },

    handleDataChange({ action, data, dataType }) {
        console.log(`🔄 ProductManager recibió: ${action} en ${dataType}`, data);

        if (!this.isInitialized) {
            console.log('⏳ Ignorando cambio - no inicializado');
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
                    console.warn(`⚠️ Acción no reconocida: ${action}`);
            }
        } catch (error) {
            console.error('❌ Error manejando cambio de datos:', error);
        }
    },

    _handleProductCreatedImmediate(product) {
        console.log('🆕 Manejando producto creado inmediatamente:', product._id);

        // ✅ VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando...');
            this.products = [];
        }

        const exists = this.products.some(p => p._id === product._id);
        if (!exists) {
            this.products.push(product);
            this.sortProductsById();
            this._renderTableImmediate();
            console.log('✅ Producto agregado a la tabla inmediatamente');
        } else {
            console.log('⚠️ Producto ya existe, actualizando inmediatamente');
            this._handleProductUpdatedImmediate(product);
        }
    },

    _handleProductUpdatedImmediate(product) {
        console.log('✏️ Manejando producto actualizado inmediatamente:', product._id);

        // ✅ VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando...');
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
            console.log('✅ Producto actualizado en la tabla inmediatamente');
            this._highlightUpdatedProduct(product._id);
        } else {
            console.log('⚠️ Producto no encontrado, agregándolo inmediatamente');
            this._handleProductCreatedImmediate(product);
        }
    },

    _handleProductDeletedImmediate(productId) {
        console.log('🗑️ Manejando producto eliminado inmediatamente:', productId);

        // ✅ VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando...');
            this.products = [];
            return;
        }

        const initialLength = this.products.length;
        this.products = this.products.filter(p => p._id !== productId);

        if (this.products.length < initialLength) {
            this._renderTableImmediate();
            console.log('✅ Producto eliminado de la tabla inmediatamente');
        } else {
            console.log('⚠️ Producto no estaba en la lista');
        }
    },

    _handleProductsRefreshedImmediate(products) {
        console.log('🔄 Manejando refrescado de productos inmediatamente:', Array.isArray(products) ? products.length : 'no-array');

        this.products = Array.isArray(products) ? products : [];
        this.sortProductsById();
        this._renderTableImmediate();
        console.log('✅ Lista de productos refrescada inmediatamente');
    },

    _handleStockUpdatedImmediate(data) {
        console.log('📦 Manejando actualización de stock inmediatamente:', data);

        // ✅ VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando...');
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
                console.log('✅ Stock actualizado en la tabla inmediatamente');
            }
        }
    },

    _renderTableImmediate() {
        console.log('⚡ Renderizando tabla inmediatamente...');

        try {
            this.renderProductsTable();

            const table = document.getElementById('products-table');
            if (table) {
                table.classList.add('table', 'table-base');

                const container = table.closest('.table-container');
                if (container) {
                    container.classList.add('table-container-base');
                }
            }

            setTimeout(() => {
                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }
            }, 10);

            console.log('✅ Tabla renderizada con estilos aplicados');

        } catch (error) {
            console.error('❌ Error en renderizado inmediato:', error);
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

                    console.log('✅ Producto destacado:', productId);
                } else {
                    console.warn('⚠️ No se encontró la fila para destacar:', productId);
                }
            } catch (error) {
                console.error('❌ Error destacando producto:', error);
            }
        }, 100);
    },

    async loadProducts() {
        try {
            console.log('📥 Cargando productos...');
            this.showLoadingState();

            let products;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    // ✅ VALIDACIÓN: Verificar método dataSync antes de usar
                    if (dataSync && typeof dataSync.getData === 'function') {
                        products = await dataSync.getData('products');
                    } else {
                        console.warn('⚠️ dataSync.getData no disponible, usando API directa');
                        products = await window.api.getProducts();
                    }
                    break;
                } catch (error) {
                    retryCount++;
                    console.warn(`⚠️ Intento ${retryCount}/${maxRetries} falló:`, error.message);

                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));

                        try {
                            products = await window.api.getProducts();
                            break;
                        } catch (apiError) {
                            console.warn(`⚠️ API directa también falló en intento ${retryCount}`);
                        }
                    } else {
                        throw error;
                    }
                }
            }

            // ✅ VALIDACIÓN ESTRICTA: Múltiples formatos de respuesta
            if (Array.isArray(products)) {
                this.products = products;
            } else if (products && Array.isArray(products.products)) {
                this.products = products.products;
            } else if (products && Array.isArray(products.data)) {
                this.products = products.data;
            } else {
                console.warn('⚠️ Datos no válidos recibidos:', products);
                this.products = [];
            }

            console.log(`✅ ${this.products.length} productos cargados exitosamente`);

            this.sortProductsById();
            this.renderProductsTable();

            if (window.eventManager) {
                window.eventManager.emit('products:loaded', {
                    count: this.products.length,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('❌ Error cargando productos después de todos los reintentos:', error);
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

    // ✅ FUNCIÓN CORREGIDA: sortProductsById con validaciones
    sortProductsById() {
        // ✅ VALIDACIÓN: Verificar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, no se puede ordenar:', typeof this.products);
            this.products = [];
            return;
        }

        // ✅ VALIDACIÓN: Verificar que tenga método sort
        if (typeof this.products.sort !== 'function') {
            console.error('❌ this.products no tiene método sort:', this.products);
            this.products = [];
            return;
        }

        try {
            this.products.sort((a, b) => {
                // ✅ VALIDACIÓN: Verificar que ambos elementos tengan _id
                if (!a || !a._id) {
                    console.warn('⚠️ Elemento sin _id encontrado:', a);
                    return 1;
                }
                if (!b || !b._id) {
                    console.warn('⚠️ Elemento sin _id encontrado:', b);
                    return -1;
                }
                
                if (a._id < b._id) return -1;
                if (a._id > b._id) return 1;
                return 0;
            });
        } catch (error) {
            console.error('❌ Error ordenando productos:', error);
            this.products = Array.isArray(this.products) ? this.products : [];
        }
    },

    renderProductsTable() {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) {
            console.error('❌ Elemento products-table-body no encontrado');
            return;
        }

        // ✅ VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando como array vacío');
            this.products = [];
        }

        console.log(`🔄 Renderizando ${this.products.length} productos`);

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

            const tableContainer = table.closest('.table-container');
            if (tableContainer) {
                tableContainer.classList.add('table-container-base');
            }

            console.log('✅ Clases de estilo aplicadas a la tabla');
        }

        const fragment = document.createDocumentFragment();

        this.products.forEach(product => {
            const row = this._createProductRow(product);
            fragment.appendChild(row);
        });

        tableBody.appendChild(fragment);

        setTimeout(() => {
            if (window.uiManager && window.uiManager.forceStyleUpdate) {
                window.uiManager.forceStyleUpdate();
            }
        }, 50);

        console.log('✅ Tabla renderizada exitosamente con estilos aplicados');
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

    // ===== FUNCIONES DE MODAL Y CRUD =====

    showAddProductModal() {
        const form = document.getElementById('product-form');
        if (form) form.reset();

        const productId = document.getElementById('product-id');
        if (productId) productId.value = '';

        const modalTitle = document.getElementById('product-modal-title');
        if (modalTitle) modalTitle.textContent = 'Nuevo Lente';

        if (this.productModal) {
            this.productModal.show();
        }
    },

    async showEditProductModal(productId) {
        try {
            const product = await window.api.getProduct(productId);

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
                if (element) element.value = value || '';
            });

            const modalTitle = document.getElementById('product-modal-title');
            if (modalTitle) modalTitle.textContent = 'Editar Producto';

            if (this.productModal) {
                this.productModal.show();
            }
        } catch (error) {
            console.error('Error al cargar producto para edición:', error);
            uiManager.showAlert('Error al cargar los datos del producto', 'danger');
        }
    },

    async showUpdateStockModal(productId) {
        try {
            const product = await window.api.getProduct(productId);

            const stockFields = [
                ['stock-product-id', product._id, 'value'],
                ['stock-product-name', product.name, 'textContent'],
                ['stock-product-barcode', product.barcode, 'textContent'],
                ['stock-product-sphere', product.sphere, 'textContent'],
                ['stock-product-cylinder', product.cylinder, 'textContent'],
                ['stock-product-addition', product.addition, 'textContent'],
                ['stock-current-stock', product.stock, 'textContent'],
                ['stock-new-value', product.stock, 'value']
            ];

            stockFields.forEach(([id, value, prop]) => {
                const element = document.getElementById(id);
                if (element) {
                    element[prop] = value || '';
                }
            });

            if (this.stockModal) {
                this.stockModal.show();
            }

            setTimeout(() => {
                const stockInput = document.getElementById('stock-new-value');
                if (stockInput) {
                    stockInput.focus();
                    stockInput.select();
                }
            }, 300);

        } catch (error) {
            console.error('Error al cargar producto para stock:', error);
            uiManager.showAlert('Error al cargar los datos del producto', 'danger');
        }
    },

    // FUNCIÓN COMPLETAMENTE CORREGIDA: saveProduct con manejo correcto de respuestas
    async saveProduct() {
        try {
            const productId = document.getElementById('product-id')?.value;
            const productData = {
                name: document.getElementById('product-name')?.value || '',
                barcode: document.getElementById('product-barcode')?.value || '',
                sphere: document.getElementById('product-sphere')?.value || '',
                cylinder: document.getElementById('product-cylinder')?.value || '',
                addition: document.getElementById('product-addition')?.value || '',
                stock: parseInt(document.getElementById('product-stock')?.value) || 0,
            };

            console.log('💾 Guardando producto:', { productId, productData });

            const saveBtn = document.getElementById('save-product-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Guardando...';
            }

            let response;
            let finalProduct;

            if (productId) {
                // EDICIÓN - Manejar stock por separado si cambió
                const currentProduct = await window.api.getProduct(productId);

                if (currentProduct.stock !== productData.stock) {
                    // Actualizar datos sin stock primero
                    const { stock, ...dataWithoutStock } = productData;
                    await window.api.updateProduct(productId, dataWithoutStock);

                    // Luego actualizar stock por separado
                    const stockData = {
                        stock: productData.stock,
                        stock_surtido: currentProduct.stock_surtido || 0
                    };
                    response = await window.api.updateProductStock(productId, stockData);

                    // Extraer producto de la respuesta de stock
                    finalProduct = response.product;

                    console.log('✅ Producto y stock actualizados por separado');
                } else {
                    // Solo actualizar datos del producto
                    response = await window.api.updateProduct(productId, productData);

                    // La respuesta puede ser el producto directamente o un wrapper
                    finalProduct = response.product || response;
                }

                // VALIDACIÓN: Verificar que tenemos un producto válido
                if (!finalProduct || !finalProduct._id) {
                    console.error('❌ Respuesta de actualización inválida:', response);
                    throw new Error('Respuesta del servidor inválida');
                }

                // SINCRONIZACIÓN INMEDIATA MEJORADA
                await this._syncProductUpdateImmediate(finalProduct, productId);

                uiManager.showAlert('Producto actualizado correctamente', 'success');
            } else {
                // CREACIÓN
                response = await window.api.createProduct(productData);

                // Extraer producto de la respuesta
                finalProduct = response.product || response;

                // VALIDACIÓN: Verificar que tenemos un producto válido
                if (!finalProduct || !finalProduct._id) {
                    console.error('❌ Respuesta de creación inválida:', response);
                    throw new Error('Respuesta del servidor inválida');
                }

                // SINCRONIZACIÓN INMEDIATA PARA CREACIÓN
                await this._syncProductCreateImmediate(finalProduct);

                uiManager.showAlert('Producto creado correctamente', 'success');
            }

            // Cerrar modal y enfocar en el producto actualizado
            if (this.productModal) {
                this.productModal.hide();
            }

            // Destacar producto después de un breve delay
            setTimeout(() => {
                this._highlightUpdatedProduct(finalProduct._id);
            }, 300);

        } catch (error) {
            console.error('❌ Error al guardar producto:', error);
            uiManager.showAlert(`Error al guardar el producto: ${error.message}`, 'danger');
        } finally {
            const saveBtn = document.getElementById('save-product-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Guardar Producto';
            }
        }
    },

    // FUNCIÓN CORREGIDA: Sincronización inmediata para actualizaciones
    async _syncProductUpdateImmediate(updatedProduct, productId) {
        console.log('🔄 Sincronizando actualización inmediatamente...', updatedProduct);

        try {
            // VALIDACIÓN: Asegurar que tenemos un producto válido
            if (!updatedProduct || !updatedProduct._id) {
                console.error('❌ Producto inválido para sincronización:', updatedProduct);
                throw new Error('Producto inválido recibido para sincronización');
            }

            // VALIDACIÓN: Asegurar que products sea un array
            if (!Array.isArray(this.products)) {
                console.warn('⚠️ this.products no es un array, inicializando...');
                this.products = [];
            }

            // Actualizar en cache local
            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                // Mantener propiedades importantes del producto existente
                this.products[index] = {
                    ...this.products[index],
                    ...updatedProduct,
                    _id: productId // Asegurar que el ID no cambie
                };
                console.log('✅ Cache local actualizado');
            } else {
                console.warn('⚠️ Producto no encontrado en cache, agregándolo...');
                this.products.push(updatedProduct);
                this.sortProductsById();
            }

            // Re-renderizar tabla inmediatamente
            this._renderTableImmediate();

            // Notificar con el producto válido
            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:updated', updatedProduct);
            }

            // Forzar actualización de estilos
            await this._forceStyleRefresh();

            console.log('✅ Sincronización de actualización completada');

        } catch (error) {
            console.error('❌ Error en sincronización inmediata de actualización:', error);
            // Fallback: recargar todos los productos
            await this.loadProducts();
        }
    },

    // FUNCIÓN CORREGIDA: Sincronización inmediata para creaciones
    async _syncProductCreateImmediate(newProduct) {
        console.log('🆕 Sincronizando creación inmediatamente...', newProduct);

        try {
            // VALIDACIÓN: Asegurar que tenemos un producto válido
            if (!newProduct || !newProduct._id) {
                console.error('❌ Producto inválido para sincronización de creación:', newProduct);
                throw new Error('Producto inválido recibido para sincronización de creación');
            }

            // VALIDACIÓN: Asegurar que products sea un array
            if (!Array.isArray(this.products)) {
                console.warn('⚠️ this.products no es un array, inicializando...');
                this.products = [];
            }

            // Verificar si ya existe (evitar duplicados)
            const exists = this.products.some(p => p._id === newProduct._id);
            if (!exists) {
                this.products.push(newProduct);
                this.sortProductsById();
                console.log('✅ Nuevo producto agregado al cache');
            } else {
                console.warn('⚠️ Producto ya existe, actualizando...');
                const index = this.products.findIndex(p => p._id === newProduct._id);
                this.products[index] = newProduct;
            }

            // Re-renderizar tabla inmediatamente
            this._renderTableImmediate();

            // Notificar con el producto válido
            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:created', newProduct);
            }

            // Forzar actualización de estilos
            await this._forceStyleRefresh();

            console.log('✅ Sincronización de creación completada');

        } catch (error) {
            console.error('❌ Error en sincronización inmediata de creación:', error);
            // Fallback: recargar todos los productos
            await this.loadProducts();
        }
    },

    // FUNCIÓN CORREGIDA: updateStock con emisión de eventos corregida
    async updateStock() {
        try {
            const productId = document.getElementById('stock-product-id')?.value;
            const newStockValue = document.getElementById('stock-new-value')?.value;

            if (!productId) {
                uiManager.showAlert('Error: ID del producto no encontrado', 'danger');
                return;
            }

            const newStock = parseInt(newStockValue);
            if (isNaN(newStock) || newStock < 0) {
                uiManager.showAlert('Por favor, ingrese un valor de stock válido', 'warning');
                return;
            }

            const saveBtn = document.getElementById('save-stock-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Actualizando...';
            }

            // Obtener producto actual para mantener stock_surtido
            const currentProduct = await window.api.getProduct(productId);
            const stockData = {
                stock: newStock,
                stock_surtido: currentProduct.stock_surtido || 0
            };

            console.log('📦 Actualizando stock:', { productId, stockData });

            // Actualizar en backend
            const response = await window.api.updateProductStock(productId, stockData);

            // Extraer el producto de la respuesta antes de sincronizar
            const updatedProduct = response.product; // Extraer el producto real de la respuesta

            if (!updatedProduct || !updatedProduct._id) {
                console.error('❌ Respuesta de API inválida:', response);
                throw new Error('Respuesta del servidor inválida');
            }

            // SINCRONIZACIÓN INMEDIATA CORREGIDA
            await this._syncStockUpdateImmediate(updatedProduct, productId);

            uiManager.showAlert('Stock actualizado correctamente', 'success');

            // Cerrar modal
            if (this.stockModal) {
                this.stockModal.hide();
            }

            // Destacar producto actualizado
            setTimeout(() => {
                this._highlightUpdatedProduct(productId);
            }, 300);

            console.log('✅ Stock actualizado y sincronizado:', updatedProduct);

        } catch (error) {
            console.error('❌ Error al actualizar stock:', error);
            uiManager.showAlert(`Error al actualizar el stock: ${error.message}`, 'danger');
        } finally {
            const saveBtn = document.getElementById('save-stock-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Actualizar Stock';
            }
        }
    },

    // FUNCIÓN CORREGIDA: Sincronización inmediata para stock
    async _syncStockUpdateImmediate(updatedProduct, productId) {
        console.log('📦 Sincronizando actualización de stock inmediatamente...', updatedProduct);

        try {
            // VALIDACIÓN: Asegurar que tenemos un producto válido
            if (!updatedProduct || !updatedProduct._id) {
                console.error('❌ Producto inválido para sincronización:', updatedProduct);
                throw new Error('Producto inválido recibido para sincronización');
            }

            // VALIDACIÓN: Asegurar que products sea un array
            if (!Array.isArray(this.products)) {
                console.warn('⚠️ this.products no es un array, inicializando...');
                this.products = [];
            }

            // Actualizar en cache local
            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                // Actualizar específicamente los campos de stock
                this.products[index] = {
                    ...this.products[index],
                    stock: updatedProduct.stock,
                    stock_surtido: updatedProduct.stock_surtido,
                    stock_almacenado: updatedProduct.stock_almacenado,
                    lastUpdated: updatedProduct.lastUpdated
                };
                console.log('✅ Stock actualizado en cache local');
            } else {
                console.warn('⚠️ Producto no encontrado para actualizar stock');
                // Fallback: agregar el producto completo
                this.products.push(updatedProduct);
                this.sortProductsById();
            }

            // Re-renderizar tabla inmediatamente
            this._renderTableImmediate();

            // Emitir evento con datos correctos
            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:stock-updated', {
                    productId,
                    newStock: updatedProduct.stock, // Usar el stock del producto real
                    product: updatedProduct // Pasar el producto real, no la respuesta completa
                });
            }

            // Forzar actualización de estilos
            await this._forceStyleRefresh();

            console.log('✅ Sincronización de stock completada');

        } catch (error) {
            console.error('❌ Error en sincronización de stock:', error);
            // Fallback: recargar productos
            await this.loadProducts();
        }
    },

    // FUNCIÓN MEJORADA: deleteProduct con sincronización inmediata
    async deleteProduct(productId) {
        // VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array, inicializando...');
            this.products = [];
        }

        const productToDelete = this.products.find(p => p._id === productId);
        const productName = productToDelete ? productToDelete.name : 'el producto';

        if (confirm(`¿Está seguro de eliminar ${productName}? Esta acción no se puede deshacer.`)) {
            try {
                await window.api.deleteProduct(productId);

                // SINCRONIZACIÓN INMEDIATA: Eliminar del cache local
                const initialLength = this.products.length;
                this.products = this.products.filter(p => p._id !== productId);

                if (this.products.length < initialLength) {
                    console.log('✅ Producto eliminado del cache local inmediatamente');
                    this._renderTableImmediate();
                }

                if (eventManager && typeof eventManager.emit === 'function') {
                    eventManager.emit('data:product:deleted', productId);
                }
                uiManager.showAlert(`${productName} eliminado correctamente`, 'success');

                console.log('✅ Producto eliminado y sincronizado:', productId);

            } catch (error) {
                console.error('❌ Error al eliminar producto:', error);
                uiManager.showAlert(`Error al eliminar el producto: ${error.message}`, 'danger');
            }
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

    // ===== FUNCIONES AUXILIARES =====

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
            uiManager.showAlert('Ingrese un código de barras', 'warning');
            return;
        }

        try {
            const product = await window.api.getProductByBarcode(barcode);
            const scannerModal = bootstrap.Modal.getInstance(document.getElementById('barcode-scanner-modal'));
            if (scannerModal) scannerModal.hide();
            this.showEditProductModal(product._id);
        } catch (error) {
            uiManager.showAlert('Producto no encontrado', 'warning');
        }
    },

    filterProducts() {
        const searchInput = document.getElementById('product-search');
        const searchTerm = searchInput?.value.toLowerCase() || '';

        if (!searchTerm) {
            this.renderProductsTable();
            return;
        }

        // VALIDACIÓN: Asegurar que products sea un array
        if (!Array.isArray(this.products)) {
            console.warn('⚠️ this.products no es un array para filtrar');
            return;
        }

        const filteredProducts = this.products.filter(product =>
            (product.name || '').toLowerCase().includes(searchTerm) ||
            (product.barcode || '').toLowerCase().includes(searchTerm) ||
            (product.sphere || '').includes(searchTerm)
        );

        const originalProducts = [...this.products];
        this.products = filteredProducts;
        this.renderProductsTable();
        this.products = originalProducts;
    },

    async refreshProductsManually() {
        console.log('🔄 Refrescando productos manualmente...');
        try {
            const freshProducts = await window.api.getProducts();
            
            // VALIDACIÓN: Verificar formato de respuesta
            if (Array.isArray(freshProducts)) {
                this.products = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                this.products = freshProducts.products;
            } else {
                console.warn('⚠️ Formato de respuesta inesperado:', freshProducts);
                this.products = [];
            }
            
            this.sortProductsById();
            this._renderTableImmediate();
            console.log('✅ Productos refrescados manualmente');

            if (window.uiManager) {
                window.uiManager.showAlert('Productos actualizados', 'success');
            }
        } catch (error) {
            console.error('❌ Error en refresh manual:', error);
            if (window.uiManager) {
                window.uiManager.showAlert('Error al actualizar productos', 'danger');
            }
        }
    },

    // NUEVA FUNCIÓN: Verificar y corregir sincronización
    async checkAndFixSync() {
        console.log('🔍 Verificando sincronización...');

        try {
            const freshProducts = await window.api.getProducts();
            
            // VALIDACIÓN: Verificar formato
            let validFreshProducts;
            if (Array.isArray(freshProducts)) {
                validFreshProducts = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                validFreshProducts = freshProducts.products;
            } else {
                console.error('❌ Formato inválido de productos:', freshProducts);
                return false;
            }

            // Comparar con cache local
            if (validFreshProducts.length !== this.products.length) {
                console.log('⚠️ Diferencia en cantidad detectada, sincronizando...');
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

            // Verificar actualizaciones
            let hasChanges = false;
            validFreshProducts.forEach(freshProduct => {
                const localProduct = this.products.find(p => p._id === freshProduct._id);
                if (localProduct && localProduct.lastUpdated !== freshProduct.lastUpdated) {
                    console.log('⚠️ Producto desincronizado detectado:', freshProduct.name);
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                console.log('🔄 Sincronizando cambios detectados...');
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

            console.log('✅ Sincronización verificada - todo en orden');
            return false;

        } catch (error) {
            console.error('❌ Error verificando sincronización:', error);
            return false;
        }
    },

    // NUEVA FUNCIÓN: Forzar actualización de estilos
    async _forceStyleRefresh() {
        return new Promise(resolve => {
            setTimeout(() => {
                // Forzar re-aplicación de estilos de tabla
                const table = document.getElementById('products-table');
                if (table) {
                    table.classList.remove('table', 'table-base');
                    // Forzar reflow
                    table.offsetHeight;
                    table.classList.add('table', 'table-base');
                }

                // Actualizar estilos del contenedor
                const container = table?.closest('.table-container');
                if (container) {
                    container.classList.remove('table-container-base');
                    container.offsetHeight;
                    container.classList.add('table-container-base');
                }

                // Llamar a uiManager si está disponible
                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }

                resolve();
            }, 50);
        });
    },

    // ===== MÉTODOS DE UTILIDAD Y DEBUG =====

    async refresh() {
        console.log('🔄 Refrescando ProductManager...');
        if (this.isInitialized) {
            await this.loadProducts();
        } else {
            console.warn('⚠️ ProductManager no inicializado');
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
            initializationInProgress: !!this.initializationPromise
        };
    },

    forceRerender() {
        console.log('🔄 Forzando re-renderizado...');
        if (this.isInitialized) {
            this.renderProductsTable();
        }
    },

    validateDataIntegrity() {
        console.log('🔍 Validando integridad de datos...');

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
            console.warn('⚠️ Problemas de integridad encontrados:', issues);
            return { valid: false, issues };
        } else {
            console.log('✅ Integridad de datos válida');
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

        console.log('📤 Datos exportados:', data);
        return data;
    },

    async forceReinit() {
        console.log('🔄 Forzando reinicialización...');

        try {
            this.destroy();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.init();
            console.log('✅ Reinicialización forzada completada');
        } catch (error) {
            console.error('❌ Error en reinicialización forzada:', error);
            throw error;
        }
    },

    // FUNCIÓN CORREGIDA: destroy con validaciones mejoradas
    destroy() {
        console.log('🧹 Destruyendo ProductManager...');

        try {
            // VALIDACIÓN mejorada para dataSync
            if (dataSync && typeof dataSync.isSubscribed === 'function' && typeof dataSync.unsubscribe === 'function') {
                if (dataSync.isSubscribed(this.viewName, 'products')) {
                    dataSync.unsubscribe(this.viewName, 'products');
                    console.log('✅ Desuscrito de dataSync');
                }
            } else {
                console.warn('⚠️ dataSync no disponible o métodos faltantes');
            }

            if (this.productModal) {
                try {
                    this.productModal.dispose();
                } catch (e) {
                    console.warn('⚠️ Error disposing productModal:', e.message);
                }
                this.productModal = null;
            }

            if (this.stockModal) {
                try {
                    this.stockModal.dispose();
                } catch (e) {
                    console.warn('⚠️ Error disposing stockModal:', e.message);
                }
                this.stockModal = null;
            }

            const elementIds = [
                'add-product-btn', 'save-product-btn', 'save-stock-btn',
                'products-table-body', 'generate-barcode-btn', 'barcode-scan-btn',
                'manual-barcode-btn', 'product-search'
            ];

            elementIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const newElement = element.cloneNode(true);
                    element.parentNode.replaceChild(newElement, element);
                }
            });

            this.products = [];
            this.isInitialized = false;
            this.initializationPromise = null;

            if (window.productManager === this) {
                delete window.productManager;
            }

            console.log('✅ ProductManager destruido completamente');

        } catch (error) {
            console.error('❌ Error durante la destrucción:', error);
        }
    }
};