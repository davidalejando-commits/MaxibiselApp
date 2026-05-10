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
    _currentSearchTerm: '',

    async init() {
        if (this.initializationPromise) {
            return await this.initializationPromise;
        }
        if (this.isInitialized) {
            return;
        }
        this.initializationPromise = this._performInit();
        return await this.initializationPromise;
    },

    async _performInit() {
        try {
            if (!eventManager.isInitialized) {
                eventManager.init();
            }
            if (!dataSync.isInitialized) {
                dataSync.init();
            }

            this.setupAuthEventListeners();
            await this._waitForDOMElements(10000);
            this._initializeModals();
            this.setupEventListeners();

            if (dataSync && typeof dataSync.subscribe === 'function') {
                dataSync.subscribe(this.viewName, 'products', this.handleDataChange.bind(this));
            }

            await this._validateInitialization();

            this.isInitialized = true;

            setTimeout(() => {
                if (window.uiManager && window.uiManager.forceStyleUpdate) {
                    window.uiManager.forceStyleUpdate();
                }
            }, 100);

            this.setupBarcodeScanner();

            window.productManager = this;

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
        if (!tableContainer) return;

        tableContainer.style.maxHeight = 'calc(100vh - 248px)';
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.overflowX = 'hidden';
        tableContainer.style.paddingBottom = '10px';

        const table = tableContainer.querySelector('table');
        if (table) {
            table.style.marginBottom = '15px';
            const thead = table.querySelector('thead');
            if (thead) {
                thead.style.position = 'sticky';
                thead.style.top = '0';
                thead.style.backgroundColor = '#f8f9fa';
                thead.style.zIndex = '10';
                thead.style.boxShadow = '0 2px 2px -1px rgba(0, 0, 0, 0.1)';
            }
        }
    },

    setupAuthEventListeners() {
        eventManager.on('auth:login-success', this.handleLoginSuccess.bind(this));
        eventManager.on('view:activated', this.handleViewActivated.bind(this));
        eventManager.on('auth:products-initialized', this.handleProductsInitialized.bind(this));
    },

    async handleLoginSuccess(user) {
        try {
            if (!this.isInitialized) {
                await this.init();
            }
            await this.loadProducts();
        } catch (error) {
            console.error('Error manejando login en ProductManager:', error);
        }
    },

    async handleViewActivated(viewData) {
        if (viewData.viewName === 'products') {
            if (this.isInitialized && (!this.products || this.products.length === 0)) {
                await this.loadProducts();
            }
        }
    },

    handleProductsInitialized(data) {
        if (this.isInitialized && this.products.length > 0) {
            setTimeout(() => {
                this._renderTableImmediate();
            }, 100);
        }
    },

    async _waitForDOMElements(maxWait = 10000) {
        const requiredElements = ['products-table-body', 'product-modal', 'stock-modal', 'confirm-delete-modal'];
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkElements = () => {
                const missingElements = requiredElements.filter(id => !document.getElementById(id));
                if (missingElements.length === 0) {
                    resolve();
                    return;
                }
                const elapsed = Date.now() - startTime;
                if (elapsed > maxWait) {
                    reject(new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`));
                    return;
                }
                setTimeout(checkElements, 100);
            };
            checkElements();
        });
    },

    async _validateInitialization() {
        const validations = [
            { name: 'Tabla de productos', check: () => document.getElementById('products-table-body') !== null },
            { name: 'Datos cargados', check: () => Array.isArray(this.products) },
            {
                name: 'Suscripción a dataSync', check: () => {
                    if (!dataSync || typeof dataSync.isSubscribed !== 'function') return true;
                    return dataSync.isSubscribed(this.viewName, 'products');
                }
            },
            { name: 'Event listeners configurados', check: () => document.getElementById('add-product-btn') !== null }
        ];

        const failedValidations = validations.filter(v => !v.check());
        if (failedValidations.length > 0) {
            throw new Error(`Validaciones fallidas: ${failedValidations.map(v => v.name).join(', ')}`);
        }
    },

    _initializeModals() {
        try {
            const productModalEl = document.getElementById('product-modal');
            const stockModalEl = document.getElementById('stock-modal');

            if (productModalEl && typeof bootstrap !== 'undefined') {
                this.productModal = new bootstrap.Modal(productModalEl);
            }
            if (stockModalEl && typeof bootstrap !== 'undefined') {
                this.stockModal = new bootstrap.Modal(stockModalEl);
            }
        } catch (error) {
            console.error('Error inicializando modales:', error);
        }
    },

    setupEventListeners() {
        const eventBindings = [
            { id: 'add-product-btn', event: 'click', handler: this.showAddProductModal.bind(this) },
            { id: 'save-product-btn', event: 'click', handler: this.saveProduct.bind(this) },
            { id: 'save-stock-btn', event: 'click', handler: this.updateStock.bind(this) },
            { id: 'products-table-body', event: 'click', handler: this.handleProductAction.bind(this) },
            { id: 'generate-barcode-btn', event: 'click', handler: this.generateBarcode.bind(this) },
            { id: 'barcode-scan-btn', event: 'click', handler: this.showBarcodeScannerModal.bind(this) },
            { id: 'manual-barcode-btn', event: 'click', handler: this.searchByManualBarcode.bind(this) },
            { id: 'product-search', event: 'input', handler: this.handleSearchInput.bind(this) },
            { id: 'confirm-delete-btn', event: 'click', handler: this.executeDelete.bind(this) },
            { id: 'cancel-delete-btn', event: 'click', handler: this.hideDeleteModal.bind(this) },
            { id: 'btn-stock-add-mode', event: 'click', handler: () => this.switchStockMode('add') },
            { id: 'btn-stock-direct-mode', event: 'click', handler: () => this.switchStockMode('direct') },
            { id: 'stock-add-quantity', event: 'input', handler: this.updateStockPreview.bind(this) }
        ];

        eventBindings.forEach(({ id, event, handler }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
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
        if (!this.isInitialized) return;

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
        if (!Array.isArray(this.products)) this.products = [];

        const exists = this.products.some(p => p._id === product._id);
        if (!exists) {
            this.products.push(product);
            this.sortProductsById();
            this._renderTableImmediate();
        } else {
            this._handleProductUpdatedImmediate(product);
        }
    },

    _handleProductUpdatedImmediate(product) {
        if (!Array.isArray(this.products)) this.products = [];

        const index = this.products.findIndex(p => p._id === product._id);
        if (index !== -1) {
            this.products[index] = { ...this.products[index], ...product, _id: product._id };
            this.sortProductsById();
            this._renderTableImmediate();
            this._highlightUpdatedProduct(product._id);
        } else {
            this._handleProductCreatedImmediate(product);
        }
    },

    _handleProductDeletedImmediate(productId) {
        if (!Array.isArray(this.products)) {
            this.products = [];
            return;
        }

        const initialLength = this.products.length;
        this.products = this.products.filter(p => p._id !== productId);

        if (this.products.length < initialLength) {
            this._renderTableImmediate();
        }
    },

    _handleProductsRefreshedImmediate(products) {
        this.products = Array.isArray(products) ? products : [];
        this.sortProductsById();
        this._renderTableImmediate();
    },

    _handleStockUpdatedImmediate(data) {
        if (!Array.isArray(this.products)) this.products = [];

        const { productId, newStock, product } = data;

        if (product) {
            this._handleProductUpdatedImmediate(product);
        } else if (productId && newStock !== undefined) {
            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index].stock = newStock;
                this._renderTableImmediate();
                this._highlightUpdatedProduct(productId);
            }
        }
    },

    _renderTableImmediate() {
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

        } catch (error) {
            console.error('Error en renderizado inmediato:', error);
        }
    },

    _highlightUpdatedProduct(productId) {
        setTimeout(() => {
            try {
                const tableBody = document.getElementById('products-table-body');
                if (!tableBody) return;

                const targetRow = Array.from(tableBody.querySelectorAll('tr')).find(row =>
                    row.querySelector(`[data-id="${productId}"]`) !== null
                );

                if (targetRow) {
                    targetRow.style.backgroundColor = '#e8f5e8';
                    targetRow.style.transition = 'background-color 0.5s ease';
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    setTimeout(() => { targetRow.style.backgroundColor = ''; }, 3000);
                }
            } catch (error) {
                console.error('Error destacando producto:', error);
            }
        }, 100);
    },

    async loadProducts() {
        try {
            this.showLoadingState();

            let products;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    if (dataSync && typeof dataSync.getData === 'function') {
                        products = await dataSync.getData('products');
                    } else {
                        products = await window.api.getProducts();
                    }
                    break;
                } catch (error) {
                    retryCount++;
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
                this.products = [];
            }

            this.sortProductsById();
            this.renderProductsTable();

            if (window.eventManager) {
                window.eventManager.emit('products:loaded', {
                    count: this.products.length,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('Error cargando productos:', error);
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
        if (table) table.classList.add('table', 'table-base');
    },

    sortProductsById() {
        if (!Array.isArray(this.products)) {
            this.products = [];
            return;
        }

        try {
            this.products.sort((a, b) => {
                if (!a || !a._id) return 1;
                if (!b || !b._id) return -1;
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
        if (!tableBody) return;

        if (!Array.isArray(this.products)) this.products = [];

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
            if (tableContainer) tableContainer.classList.add('table-container-base');
        }

        const fragment = document.createDocumentFragment();
        this.products.forEach(product => {
            fragment.appendChild(this._createProductRow(product));
        });
        tableBody.appendChild(fragment);

        this._rowCache = null;

        if (this._currentSearchTerm) {
            this._buildRowCache();
            this._applyFilterToRows(this._currentSearchTerm);
        }

        if (!this._scrollConfigured && this.products.length > 0) {
            this._setupTableScrolling();
            this._scrollConfigured = true;
        }

        setTimeout(() => {
            if (window.uiManager && window.uiManager.forceStyleUpdate) {
                window.uiManager.forceStyleUpdate();
            }
        }, 50);
    },

    _createProductRow(product) {
        const row = document.createElement('tr');

        const stock = product.stock || 0;
        let stockClass = '';
        if (stock <= 0) {
            stockClass = 'stock-low';
        } else if (stock < 5) {
            stockClass = 'stock-medium';
        } else {
            stockClass = 'stock-high';
        }

        const name = product.name || '';
        const barcode = product.barcode || '';
        const sphere = product.sphere || '';
        const cylinder = product.cylinder || '';
        const addition = product.addition || '';

        row.dataset.name = name.toLowerCase();
        row.dataset.barcode = this.normalizarCodigoBarras(barcode);
        row.dataset.sphere = sphere;
        row.dataset.cylinder = cylinder;
        row.dataset.addition = addition;

        row.innerHTML = `
            <td>${barcode}</td>
            <td>${name}</td>
            <td>${sphere}</td>
            <td>${cylinder}</td>
            <td>${addition}</td>
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

    handleSearchInput(event) {
        const searchTerm = event.target.value.trim().toLowerCase();
        this._currentSearchTerm = searchTerm;

        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(() => {
            this._applyFilterToRows(searchTerm);
            this._rafId = null;
        });
    },

    _buildRowCache() {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) return;

        this._rowCache = Array.from(tableBody.children).map(row => ({
            el: row,
            name: row.dataset.name || '',
            barcode: row.dataset.barcode || '',
            sphere: row.dataset.sphere || '',
            cylinder: row.dataset.cylinder || '',
            isData: !!(row.dataset.name || row.dataset.barcode)
        }));
    },

    _applyFilterToRows(searchTerm) {
        if (!this._rowCache || this._rowCache.length === 0) {
            this._buildRowCache();
        }
        if (!this._rowCache || this._rowCache.length === 0) return;

        const tableBody = document.getElementById('products-table-body');

        const existingEmpty = tableBody ? tableBody.querySelector('.no-results-row') : null;
        if (existingEmpty) existingEmpty.remove();

        if (!searchTerm) {
            for (let i = 0; i < this._rowCache.length; i++) {
                this._rowCache[i].el.style.display = '';
            }
            return;
        }

        const formulaBuscada = this.parsearFormulaCompacta(searchTerm);
        let terminoNombre = searchTerm;
        if (formulaBuscada) {
            terminoNombre = searchTerm.replace(formulaBuscada.original.toLowerCase(), '').trim();
        }

        let visibleCount = 0;

        for (let i = 0; i < this._rowCache.length; i++) {
            const cached = this._rowCache[i];

            if (!cached.isData) {
                cached.el.style.display = '';
                continue;
            }

            let visible = true;

            if (formulaBuscada) {
                const formulaProducto = this._normalizarFormulaDesdeDataset(cached.sphere, cached.cylinder);
                if (!formulaProducto || !this.compararFormulas(formulaProducto, formulaBuscada)) {
                    visible = false;
                }
            }

            if (visible && terminoNombre) {
                if (!cached.name.includes(terminoNombre) && !cached.barcode.includes(terminoNombre)) {
                    visible = false;
                }
            }

            cached.el.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        }

        if (visibleCount === 0 && tableBody) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'no-results-row';
            emptyRow.innerHTML = `
                <td colspan="7" class="text-center py-3 text-muted">
                    <i class="bi bi-search me-2"></i>
                    No se encontraron productos con "${searchTerm}"
                </td>
            `;
            tableBody.appendChild(emptyRow);
        }
    },

    _normalizarFormulaDesdeDataset(sphere, cylinder) {
        if (!sphere || sphere === 'N' || sphere === 'N/A' ||
            !cylinder || cylinder === '-' || cylinder === 'N/A') {
            return null;
        }

        const esfera = this.normalizarValorOptico(sphere);
        const cilindro = this.normalizarValorOptico(cylinder);

        if (!esfera || !cilindro) return null;

        return { esfera, cilindro };
    },

    showAddProductModal() {
        const form = document.getElementById('product-form');
        if (form) form.reset();

        this.currentEditingProduct = null;

        const productId = document.getElementById('product-id');
        if (productId) productId.value = '';

        const modalTitle = document.getElementById('product-modal-title');
        if (modalTitle) modalTitle.textContent = 'Nuevo Producto';

        if (this.productModal) this.productModal.show();

        setTimeout(() => {
            const nameField = document.getElementById('product-name');
            if (nameField) nameField.focus();
        }, 300);
    },

    async showEditProductModal(productId) {
        try {
            let product = this.products.find(p => p._id === productId);

            if (!product) {
                const response = await window.api.getProduct(productId);
                product = response.product || response;
            }

            if (!product) throw new Error('Producto no encontrado');

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
                if (element) element.value = value || '';
            });

            const modalTitle = document.getElementById('product-modal-title');
            if (modalTitle) modalTitle.textContent = `Editar: ${product.name}`;

            if (this.productModal) this.productModal.show();

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
        try {
            let product = this.products.find(p => p._id === productId);

            if (!product) {
                const response = await window.api.getProduct(productId);
                product = response.product || response;
            }

            if (!product) throw new Error('Producto no encontrado');

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

            const stockAddInput = document.getElementById('stock-add-quantity');
            if (stockAddInput) stockAddInput.value = '';

            const directUpdateContainer = document.getElementById('stock-direct-update-container');
            if (directUpdateContainer) directUpdateContainer.style.display = 'none';

            const addStockContainer = document.getElementById('stock-add-container');
            if (addStockContainer) addStockContainer.style.display = 'block';

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

            const newStockPreview = document.getElementById('new-stock-preview');
            if (newStockPreview) newStockPreview.textContent = product.stock || 0;

            const currentStockDisplay = document.getElementById('current-stock-display');
            if (currentStockDisplay) {
                currentStockDisplay.innerHTML = `
                    <div class="alert alert-info mb-3">
                        <strong>Stock Actual:</strong> ${product.stock || 0} unidades
                    </div>
                `;
            }

            if (this.stockModal) this.stockModal.show();

            setTimeout(() => {
                const input = document.getElementById('stock-add-quantity');
                if (input) input.focus();
            }, 300);

        } catch (error) {
            console.error('Error al cargar producto para stock:', error);
            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert('Error al cargar los datos del producto: ' + error.message, 'danger');
            }
        }
    },

    switchStockMode(mode) {
        const addContainer = document.getElementById('stock-add-container');
        const directContainer = document.getElementById('stock-direct-update-container');
        const btnAddMode = document.getElementById('btn-stock-add-mode');
        const btnDirectMode = document.getElementById('btn-stock-direct-mode');

        if (mode === 'add') {
            if (addContainer) addContainer.style.display = 'block';
            if (directContainer) directContainer.style.display = 'none';

            if (btnAddMode) {
                btnAddMode.classList.add('active', 'btn-primary');
                btnAddMode.classList.remove('btn-outline-primary');
            }
            if (btnDirectMode) {
                btnDirectMode.classList.remove('active', 'btn-primary');
                btnDirectMode.classList.add('btn-outline-primary');
            }

            const stockAddInput = document.getElementById('stock-add-quantity');
            if (stockAddInput) {
                stockAddInput.value = '';
                stockAddInput.focus();
            }

            this.updateStockPreview();

        } else if (mode === 'direct') {
            if (addContainer) addContainer.style.display = 'none';
            if (directContainer) directContainer.style.display = 'block';

            if (btnAddMode) {
                btnAddMode.classList.remove('active', 'btn-primary');
                btnAddMode.classList.add('btn-outline-primary');
            }
            if (btnDirectMode) {
                btnDirectMode.classList.add('active', 'btn-primary');
                btnDirectMode.classList.remove('btn-outline-primary');
            }

            const currentStock = document.getElementById('stock-current-stock');
            const directInput = document.getElementById('stock-direct-value');
            if (currentStock && directInput) {
                directInput.value = currentStock.textContent || '0';
                directInput.focus();
                directInput.select();
            }
        }
    },

    updateStockPreview() {
        const currentStockEl = document.getElementById('stock-current-stock');
        const addQuantityInput = document.getElementById('stock-add-quantity');
        const newStockPreview = document.getElementById('new-stock-preview');

        if (!currentStockEl || !addQuantityInput || !newStockPreview) return;

        const currentStock = parseInt(currentStockEl.textContent) || 0;
        const addQuantity = parseInt(addQuantityInput.value) || 0;
        newStockPreview.textContent = currentStock + addQuantity;

        newStockPreview.classList.remove('stock-preview-update');
        void newStockPreview.offsetWidth;
        newStockPreview.classList.add('stock-preview-update');
    },

    async updateStock() {
        try {
            const productId = document.getElementById('stock-product-id')?.value;

            if (!productId) {
                if (uiManager && uiManager.showAlert) {
                    uiManager.showAlert('Error: ID del producto no encontrado', 'danger');
                }
                return;
            }

            const addContainer = document.getElementById('stock-add-container');
            const isAddMode = addContainer && addContainer.style.display !== 'none';

            let newStockTotal;
            let cantidadModificada = 0;

            if (isAddMode) {
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

                newStockTotal = currentStock + addQuantity;
                cantidadModificada = addQuantity;

            } else {
                const directValueInput = document.getElementById('stock-direct-value');
                newStockTotal = parseInt(directValueInput?.value);

                if (isNaN(newStockTotal) || newStockTotal < 0) {
                    if (uiManager && uiManager.showAlert) {
                        uiManager.showAlert('Por favor, ingrese un valor de stock válido (0 o mayor)', 'warning');
                    }
                    return;
                }
            }

            const saveBtn = document.getElementById('save-stock-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Actualizando...';
            }

            let currentProduct = this.products.find(p => p._id === productId);
            if (!currentProduct) {
                const response = await window.api.getProduct(productId);
                currentProduct = response.product || response;
            }

            if (!currentProduct) throw new Error('Producto no encontrado');

            const datosAnteriores = {
                nombre: currentProduct.name,
                stock: currentProduct.stock || 0,
                stock_surtido: currentProduct.stock_surtido || 0,
                stock_almacenado: currentProduct.stock_almacenado || 0,
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

            const currentStockSurtido = currentProduct.stock_surtido || 0;
            const newStockSurtido = newStockTotal >= currentStockSurtido
                ? currentStockSurtido
                : newStockTotal;
            const newStockAlmacenado = newStockTotal - newStockSurtido;

            if (newStockSurtido + newStockAlmacenado !== newStockTotal) {
                throw new Error(
                    `Error de cálculo: ${newStockSurtido} + ${newStockAlmacenado} = ${newStockSurtido + newStockAlmacenado}, pero debería ser ${newStockTotal}`
                );
            }

            const stockData = {
                stock: newStockTotal,
                stock_surtido: newStockSurtido,
                stock_almacenado: newStockAlmacenado
            };

            const response = await window.api.updateProductStock(productId, stockData);
            const updatedProduct = response.product || response;

            if (!updatedProduct || !updatedProduct._id) {
                throw new Error('Respuesta del servidor inválida');
            }

            if (window.activityLogger) {
                const accionDescripcion = isAddMode
                    ? `Stock incrementado: ${currentProduct.name} (+${cantidadModificada} unidades)`
                    : `Stock actualizado: ${currentProduct.name} (${datosAnteriores.stock} → ${newStockTotal})`;

                window.activityLogger.log({
                    tipo: 'PRODUCTO',
                    accion: accionDescripcion,
                    entidad: 'producto',
                    entidad_id: updatedProduct._id,
                    datos_anteriores: datosAnteriores,
                    datos_nuevos: {
                        nombre: updatedProduct.name,
                        stock: updatedProduct.stock,
                        stock_surtido: updatedProduct.stock_surtido,
                        stock_almacenado: updatedProduct.stock_almacenado,
                        barcode: updatedProduct.barcode,
                        sphere: updatedProduct.sphere || 'N/A',
                        cylinder: updatedProduct.cylinder || 'N/A',
                        addition: updatedProduct.addition || 'N/A',
                        formula: {
                            sphere: updatedProduct.sphere || 'N/A',
                            cylinder: updatedProduct.cylinder || 'N/A',
                            addition: updatedProduct.addition || 'N/A'
                        },
                        modificacion: isAddMode ? `+${cantidadModificada}` : `Directo: ${newStockTotal}`
                    }
                });
            }

            await this._syncStockUpdateImmediate(updatedProduct, productId);

            const quantityText = isAddMode
                ? `${cantidadModificada} unidades agregadas`
                : `${updatedProduct.stock} unidades`;

            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert(
                    `Stock ${isAddMode ? 'incrementado' : 'actualizado'} correctamente: ${quantityText}`,
                    'success'
                );
            }

            if (this.stockModal) this.stockModal.hide();

            setTimeout(() => { this._highlightUpdatedProduct(productId); }, 300);

        } catch (error) {
            console.error('Error al actualizar stock:', error);

            let errorMessage = 'Error al actualizar el stock';
            if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Error de conexión. Verifique su conexión a internet';
            } else if (error.message.includes('Inconsistencia')) {
                errorMessage = 'Error de cálculo interno. Por favor reporte este problema.';
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

    async saveProduct() {
        try {
            const productId = document.getElementById('product-id')?.value;
            const productData = {
                name: document.getElementById('product-name')?.value?.trim() || '',
                barcode: document.getElementById('product-barcode')?.value?.trim() || '',
                sphere: document.getElementById('product-sphere')?.value?.trim() || '',
                cylinder: document.getElementById('product-cylinder')?.value?.trim() || '',
                addition: document.getElementById('product-addition')?.value?.trim() || '',
                stock: parseInt(document.getElementById('product-stock')?.value) || 0
            };

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

            const saveBtn = document.getElementById('save-product-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Guardando...';
            }

            let response;
            let finalProduct;
            let datosAnteriores = null;

            if (productId) {
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
                    const { stock, ...dataWithoutStock } = productData;
                    await window.api.updateProduct(productId, dataWithoutStock);

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

            } else {
                response = await window.api.createProduct(productData);
                if (!response || !response.success) {
                    throw new Error(response?.message || 'Error al crear producto');
                }
                finalProduct = response.product || response;
            }

            if (!finalProduct || !finalProduct._id) {
                throw new Error('Respuesta del servidor inválida');
            }

            if (productId) {
                await this._syncProductUpdateImmediate(finalProduct, productId);
            } else {
                await this._syncProductCreateImmediate(finalProduct);
            }

            if (window.activityLogger) {
                try {
                    if (productId) {
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
                    console.error('Error guardando log (no crítico):', logError);
                }
            }

            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert(
                    productId ? 'Producto actualizado correctamente' : 'Producto creado correctamente',
                    'success'
                );
            }

            if (this.productModal) this.productModal.hide();
            this.currentEditingProduct = null;

            setTimeout(() => { this._highlightUpdatedProduct(finalProduct._id); }, 300);

        } catch (error) {
            console.error('Error al guardar producto:', error);

            let errorMessage = 'Error al guardar el producto';
            if (error.message.includes('código de barras es obligatorio')) {
                errorMessage = 'El código de barras es obligatorio';
            } else if (error.message.includes('duplicate') || error.message.includes('unique') || error.message.includes('ya existe')) {
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

    async _syncProductUpdateImmediate(updatedProduct, productId) {
        try {
            if (!updatedProduct || !updatedProduct._id) {
                throw new Error('Producto inválido recibido para sincronización');
            }

            if (!Array.isArray(this.products)) this.products = [];

            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index] = { ...this.products[index], ...updatedProduct, _id: productId };
            } else {
                this.products.push(updatedProduct);
                this.sortProductsById();
            }

            this._renderTableImmediate();

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:updated', updatedProduct);
            }

            await this._forceStyleRefresh();

        } catch (error) {
            console.error('Error en sincronización de actualización:', error);
            await this.loadProducts();
        }
    },

    async _syncProductCreateImmediate(newProduct) {
        try {
            if (!newProduct || !newProduct._id) {
                throw new Error('Producto inválido recibido para sincronización de creación');
            }

            if (!Array.isArray(this.products)) this.products = [];

            const exists = this.products.some(p => p._id === newProduct._id);
            if (!exists) {
                this.products.push(newProduct);
                this.sortProductsById();
            } else {
                const index = this.products.findIndex(p => p._id === newProduct._id);
                this.products[index] = newProduct;
            }

            this._renderTableImmediate();

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:created', newProduct);
            }

            await this._forceStyleRefresh();

        } catch (error) {
            console.error('Error en sincronización de creación:', error);
            await this.loadProducts();
        }
    },

    async _syncStockUpdateImmediate(updatedProduct, productId) {
        try {
            if (!updatedProduct || !updatedProduct._id) {
                throw new Error('Producto inválido recibido para sincronización');
            }

            if (!Array.isArray(this.products)) this.products = [];

            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index] = {
                    ...this.products[index],
                    stock: updatedProduct.stock,
                    stock_surtido: updatedProduct.stock_surtido,
                    stock_almacenado: updatedProduct.stock_almacenado,
                    lastUpdated: updatedProduct.lastUpdated
                };
            } else {
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

        } catch (error) {
            console.error('Error en sincronización de stock:', error);
            await this.loadProducts();
        }
    },

    async deleteProduct(productId) {
        if (!Array.isArray(this.products)) this.products = [];

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

        if (modal) modal.style.display = 'flex';
    },

    hideDeleteModal() {
        const modal = document.getElementById('confirm-delete-modal');
        if (modal) modal.style.display = 'none';
        this.productToDeleteId = null;
        this.productToDeleteName = null;
    },

    async executeDelete() {
        if (!this.productToDeleteId) {
            this.hideDeleteModal();
            return;
        }

        try {
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

            await window.api.deleteProduct(this.productToDeleteId);

            if (window.activityLogger && datosEliminados) {
                window.activityLogger.log({
                    tipo: 'PRODUCTO',
                    accion: `Producto eliminado: ${this.productToDeleteName}`,
                    entidad: 'producto',
                    entidad_id: this.productToDeleteId,
                    datos_anteriores: datosEliminados,
                    datos_nuevos: null
                });
            }

            const initialLength = this.products.length;
            this.products = this.products.filter(p => p._id !== this.productToDeleteId);

            if (this.products.length < initialLength) {
                this._renderTableImmediate();
            }

            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit('data:product:deleted', this.productToDeleteId);
            }

            if (uiManager && uiManager.showAlert) {
                uiManager.showAlert(`${this.productToDeleteName} eliminado correctamente`, 'success');
            }

            this.hideDeleteModal();

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

        const barcodeInput = document.getElementById('product-barcode');
        if (barcodeInput) barcodeInput.value = barcodeWithoutChecksum + checkDigit;
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

    normalizarTerminoBusqueda(termino) {
        if (!termino) return '';
        let normalizado = String(termino).trim().toLowerCase();
        normalizado = normalizado.replace(/'/g, '-');
        normalizado = normalizado.replace(/¡/g, '+');
        return normalizado;
    },

    normalizarCodigoBarras(barcode) {
        if (!barcode) return '';
        let codigo = String(barcode).trim();
        codigo = codigo.replace(/'/g, '-');
        codigo = codigo.replace(/¡/g, '+');
        codigo = codigo.toLowerCase();
        codigo = codigo.replace(/\s+/g, '');
        return codigo;
    },

    parsearFormulaCompacta(formulaCompacta) {
        if (!formulaCompacta || typeof formulaCompacta !== 'string') return null;

        let formula = formulaCompacta.trim().toUpperCase();
        const patronFormula = /^([+\-]?)(\d{2,3})([+\-]?)(\d{2,3})$/;
        const match = formula.match(patronFormula);

        if (!match) return null;

        const [, signoEsfera, valorEsfera, signoCilindro, valorCilindro] = match;

        return {
            esfera: this.convertirADecimal(valorEsfera, signoEsfera || '+'),
            cilindro: this.convertirADecimal(valorCilindro, signoCilindro || '-'),
            original: formulaCompacta
        };
    },

    convertirADecimal(valorCompacto, signo) {
        const numero = parseInt(valorCompacto);
        if (isNaN(numero)) return null;

        const decimal = (numero / 100).toFixed(2);
        return signo === '-' ? `-${decimal}` : `+${decimal}`;
    },

    normalizarFormulaProducto(producto) {
        if (!producto) return null;

        const sphere = producto.sphere || '';
        const cylinder = producto.cylinder || '';

        if (!sphere || sphere === 'N' || sphere === 'N/A' ||
            !cylinder || cylinder === '-' || cylinder === 'N/A') {
            return null;
        }

        const esferaNormalizada = this.normalizarValorOptico(sphere);
        const cilindroNormalizado = this.normalizarValorOptico(cylinder);

        if (!esferaNormalizada || !cilindroNormalizado) return null;

        return { esfera: esferaNormalizada, cilindro: cilindroNormalizado };
    },

    normalizarValorOptico(valor) {
        if (!valor || typeof valor !== 'string') return null;

        let normalizado = valor.trim().toUpperCase().replace(/\s+/g, '');

        if (!normalizado.startsWith('+') && !normalizado.startsWith('-')) {
            normalizado = '+' + normalizado;
        }

        if (!normalizado.includes('.')) return null;

        return normalizado;
    },

    compararFormulas(formulaProducto, formulaBuscada) {
        if (!formulaProducto || !formulaBuscada) return false;
        return formulaProducto.esfera === formulaBuscada.esfera &&
               formulaProducto.cilindro === formulaBuscada.cilindro;
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
        if (this.isInitialized) {
            await this.loadProducts();
        }
    },

    async refreshProductsManually() {
        try {
            const freshProducts = await window.api.getProducts();

            if (Array.isArray(freshProducts)) {
                this.products = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                this.products = freshProducts.products;
            } else {
                this.products = [];
            }

            this.sortProductsById();
            this._renderTableImmediate();

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
        try {
            const freshProducts = await window.api.getProducts();

            let validFreshProducts;
            if (Array.isArray(freshProducts)) {
                validFreshProducts = freshProducts;
            } else if (freshProducts && Array.isArray(freshProducts.products)) {
                validFreshProducts = freshProducts.products;
            } else {
                return false;
            }

            if (validFreshProducts.length !== this.products.length) {
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

            let hasChanges = false;
            validFreshProducts.forEach(freshProduct => {
                const localProduct = this.products.find(p => p._id === freshProduct._id);
                if (localProduct && localProduct.lastUpdated !== freshProduct.lastUpdated) {
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                this.products = validFreshProducts;
                this.sortProductsById();
                this._renderTableImmediate();
                return true;
            }

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
        if (this.isInitialized) this.renderProductsTable();
    },

    validateDataIntegrity() {
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

        return issues.length > 0
            ? { valid: false, issues }
            : { valid: true, issues: [] };
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
            stockLevels: { low: lowStock, medium: mediumStock, high: highStock },
            avgStock: totalProducts > 0 ? (totalStock / totalProducts).toFixed(2) : 0
        };
    },

    exportData() {
        return {
            products: Array.isArray(this.products) ? this.products : [],
            metadata: {
                exportDate: new Date().toISOString(),
                totalCount: Array.isArray(this.products) ? this.products.length : 0,
                version: '2.0',
                status: this.getStatus()
            }
        };
    },

    async forceReinit() {
        try {
            this.destroy();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.init();
        } catch (error) {
            console.error('Error en reinicialización forzada:', error);
            throw error;
        }
    },

    destroy() {
        try {
            if (dataSync && typeof dataSync.isSubscribed === 'function' && typeof dataSync.unsubscribe === 'function') {
                if (dataSync.isSubscribed(this.viewName, 'products')) {
                    dataSync.unsubscribe(this.viewName, 'products');
                }
            }

            if (this.productModal) {
                try { this.productModal.dispose(); } catch (e) {}
                this.productModal = null;
            }

            if (this.stockModal) {
                try { this.stockModal.dispose(); } catch (e) {}
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
            this._currentSearchTerm = '';
            this._rowCache = null;
            if (this._rafId) cancelAnimationFrame(this._rafId);
            this._rafId = null;
            this.destroyBarcodeScanner();
            this.isInitialized = false;
            this.initializationPromise = null;

            if (window.productManager === this) delete window.productManager;

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
        if (window.syncCoordinator && typeof window.syncCoordinator.subscribe === 'function') {
            this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
                'productManager',
                (eventType, data) => this.handleSyncEvent(eventType, data)
            );
        }

        eventManager.on('external:product-updated', (product) => {
            this.handleExternalProductUpdate(product);
        });

        eventManager.on('external:stock-updated', (data) => {
            this.handleExternalStockUpdate(data);
        });

        eventManager.on('sync:product-synced', (syncData) => {
            this._highlightUpdatedProduct(syncData.productId);
        });
    },

    handleSyncEvent(eventType, data) {
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

        if (Array.isArray(this.products)) {
            const index = this.products.findIndex(p => p._id === product._id);
            if (index !== -1) {
                this.products[index] = { ...this.products[index], ...product };
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

        if (data.product) {
            this.handleExternalProductUpdate(data.product);
            return;
        }

        if (data.productId && data.newStock !== undefined) {
            const index = this.products.findIndex(p => p._id === data.productId);
            if (index !== -1) {
                this.products[index].stock = data.newStock;
                if (data.product?.stock_surtido !== undefined) {
                    this.products[index].stock_surtido = data.product.stock_surtido;
                }
                this._renderTableImmediate();
                this._highlightUpdatedProduct(data.productId);
            }
        }
    },
    setupBarcodeScanner() {
        this.barcodeBuffer = '';
        this.barcodeTimeout = null;

        this.barcodeListener = (e) => {
            const productsView = document.getElementById('products-view');
            if (!productsView || productsView.style.display === 'none') return;

            const activeElement = document.activeElement;
            const isTextInput = activeElement &&
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
                activeElement.id !== 'product-search';

            if (isTextInput) return;
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;

            if (e.key === 'Enter' && this.barcodeBuffer.length > 0) {
                e.preventDefault();
                this._processBarcodeInput(this.barcodeBuffer.trim());
                this.barcodeBuffer = '';
                return;
            }

            if (e.key.length === 1) {
                this.barcodeBuffer += e.key;
                clearTimeout(this.barcodeTimeout);
                this.barcodeTimeout = setTimeout(() => {
                    if (this.barcodeBuffer.length >= 4) {
                        this._processBarcodeInput(this.barcodeBuffer.trim());
                    }
                    this.barcodeBuffer = '';
                }, 100);
            }
        };

        document.addEventListener('keydown', this.barcodeListener);
    },

    _processBarcodeInput(barcode) {
        if (!barcode || barcode.length < 4) return;

        const barcodeNormalizado = this.normalizarCodigoBarras(barcode);
        this._showBarcodeScanIndicator(barcodeNormalizado, 'searching');

        const product = this._findProductByBarcode(barcodeNormalizado);

        if (product) {
            this._filterTableByBarcode(barcodeNormalizado);
            this._showBarcodeScanIndicator(barcodeNormalizado, 'success', product.name);
        } else {
            this._showBarcodeScanIndicator(barcodeNormalizado, 'error');
        }
    },

    _findProductByBarcode(barcode) {
        if (!Array.isArray(this.products) || this.products.length === 0) return null;

        return this.products.find(product => {
            if (!product || !product.barcode) return false;
            return this.normalizarCodigoBarras(product.barcode) === barcode;
        }) || null;
    },

    _filterTableByBarcode(barcode) {
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.value = barcode;
            this._currentSearchTerm = barcode;
        }

        this._buildRowCache();
        this._applyFilterToRows(barcode);
    },

    _showBarcodeScanIndicator(barcode, status, productName = '') {
        const oldIndicator = document.getElementById('product-barcode-indicator');
        if (oldIndicator) oldIndicator.remove();

        const config = {
            searching: { icon: 'bi-hourglass-split', color: '#3498db', text: 'Buscando...' },
            success: { icon: 'bi-check-circle-fill', color: '#27ae60', text: productName || 'Encontrado' },
            error: { icon: 'bi-x-circle-fill', color: '#e74c3c', text: 'No encontrado' }
        }[status];

        document.body.insertAdjacentHTML('beforeend', `
            <div id="product-barcode-indicator" style="
                position: fixed; top: 20px; right: 20px; background: white;
                border: 2px solid ${config.color}; border-radius: 8px; padding: 15px 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;
                display: flex; align-items: center; gap: 12px; min-width: 300px;
            ">
                <i class="bi ${config.icon}" style="font-size: 1.5rem; color: ${config.color};"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: ${config.color};">${config.text}</div>
                    <div style="font-size: 0.85rem; color: #666; font-family: monospace;">${barcode}</div>
                </div>
            </div>
        `);

        setTimeout(() => {
            const indicator = document.getElementById('product-barcode-indicator');
            if (indicator) indicator.remove();
        }, 2000);
    },

    destroyBarcodeScanner() {
        if (this.barcodeListener) {
            document.removeEventListener('keydown', this.barcodeListener);
            this.barcodeListener = null;
        }
        if (this.barcodeTimeout) {
            clearTimeout(this.barcodeTimeout);
            this.barcodeTimeout = null;
        }
        this.barcodeBuffer = '';
    }
};
