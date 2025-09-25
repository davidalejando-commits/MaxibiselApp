//Gestión de productos - VERSIÓN SINCRONIZADA
import { dataSync } from './dataSync.js'; // 🆕 NUEVO
import { eventManager } from './eventManager.js'; // 🆕 NUEVO
import { uiManager } from './ui.js';

export const productManager = {
    products: [],
    productModal: null,
    stockModal: null,
    viewName: 'productManager', // 🆕 Identificador único de vista

    init() {
        console.log('🔧 Inicializando ProductManager...');
        
        // Inicializar referencias
        this.productModal = new bootstrap.Modal(document.getElementById('product-modal'));
        this.stockModal = new bootstrap.Modal(document.getElementById('stock-modal'));

        // 🆕 NUEVO: Suscribirse a cambios de datos
        dataSync.subscribe(this.viewName, 'products', this.handleDataChange.bind(this));

        // Configurar eventos existentes
        this.setupEventListeners();

        // Cargar productos al iniciar
        this.loadProducts();
    },

    // 🆕 NUEVO: Manejar cambios de datos desde otras vistas
    handleDataChange({ action, data, dataType, timestamp }) {
        console.log(`🔄 ProductManager recibió cambio: ${action} en ${dataType} a las ${new Date(timestamp).toLocaleTimeString()}`);
        
        if (dataType === 'products') {
            switch (action) {
                case 'created':
                    // Verificar que no exista ya en el array local
                    if (!this.products.find(p => p._id === data._id)) {
                        this.products.push(data);
                        this.sortProductsById();
                        this.renderProductsTable();
                        console.log(`➕ Producto añadido: ${data.name}`);
                    }
                    break;
                    
                case 'updated':
                    const updateIndex = this.products.findIndex(p => p._id === data._id);
                    if (updateIndex > -1) {
                        this.products[updateIndex] = data;
                        this.sortProductsById();
                        this.renderProductsTable();
                        console.log(`🔄 Producto actualizado: ${data.name}`);
                    }
                    break;
                    
                case 'deleted':
                    const originalLength = this.products.length;
                    this.products = this.products.filter(p => p._id !== data);
                    if (this.products.length < originalLength) {
                        this.renderProductsTable();
                        console.log(`➖ Producto eliminado (ID: ${data})`);
                    }
                    break;
                    
                case 'refreshed':
                    this.products = data;
                    this.sortProductsById();
                    this.renderProductsTable();
                    console.log(`🔄 Lista de productos refrescada (${data.length} elementos)`);
                    break;
            }
        }
    },

    setupEventListeners() {
        document.getElementById('add-product-btn').addEventListener('click', this.showAddProductModal.bind(this));
        document.getElementById('save-product-btn').addEventListener('click', this.saveProduct.bind(this));
        document.getElementById('save-stock-btn').addEventListener('click', this.updateStock.bind(this));
        document.getElementById('products-table-body').addEventListener('click', this.handleProductAction.bind(this));
        document.getElementById('generate-barcode-btn').addEventListener('click', this.generateBarcode.bind(this));
        document.getElementById('barcode-scan-btn').addEventListener('click', this.showBarcodeScannerModal.bind(this));
        document.getElementById('manual-barcode-btn').addEventListener('click', this.searchByManualBarcode.bind(this));
        document.getElementById('product-search').addEventListener('input', this.filterProducts.bind(this));

        // Eventos para manejar Enter en el stock
        document.getElementById('stock-new-value').addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                console.log('Enter presionado - ejecutando updateStock()');
                this.updateStock();
            }
        });

        document.getElementById('stock-form').addEventListener('submit', (event) => {
            event.preventDefault();
            console.log('Form submit interceptado - ejecutando updateStock()');
            this.updateStock();
        });
    },

    async loadProducts() {
        try {
            // 🔄 CAMBIO: Usar dataSync en lugar de API directa
            this.products = await dataSync.getData('products');
            this.sortProductsById();
            this.renderProductsTable();
            console.log('📦 Productos cargados desde dataSync');
        } catch (error) {
            console.error('Error al cargar productos:', error);
            uiManager.showAlert('Error al cargar los productos', 'danger');
        }
    },

    sortProductsById() {
        this.products.sort((a, b) => {
            if (a._id < b._id) return -1;
            if (a._id > b._id) return 1;
            return 0;
        });
    },

    renderProductsTable() {
        const tableBody = document.getElementById('products-table-body');
        tableBody.innerHTML = '';

        if (this.products.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="8" class="text-center">No hay productos registrados</td>`;
            tableBody.appendChild(row);
            return;
        }

        const table = document.getElementById('products-table');
        if (table && !table.classList.contains('table-base')) {
            table.classList.add('table-base');
        }

        const container = table.closest('.table-container');
        if (container && !container.classList.contains('table-container-base')) {
            container.classList.add('table-container-base');
        }

        this.products.forEach(product => {
            const row = document.createElement('tr');

            let stockClass = '';
            if (product.stock <= 0) {
                stockClass = 'stock-low';
            } else if (product.stock < 5) {
                stockClass = 'stock-medium';
            } else {
                stockClass = 'stock-high';
            }

            row.innerHTML = `
                <td>${product.barcode}</td>
                <td>${product.name}</td>      
                <td>${product.sphere}</td>
                <td>${product.cylinder}</td>
                <td>${product.addition}</td>
                <td class="${stockClass}">${product.stock}</td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1 edit-product" data-id="${product._id}">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-info me-1 update-stock" data-id="${product._id}">
                    <i class="bi bi-box"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger delete-product" data-id="${product._id}">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    },

    showAddProductModal() {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-modal-title').textContent = 'Nuevo Lente';
        this.productModal.show();
    },

    async showEditProductModal(productId) {
        try {
            const product = await window.api.getProduct(productId);

            document.getElementById('product-id').value = product._id;
            document.getElementById('product-barcode').value = product.barcode;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-sphere').value = product.sphere;
            document.getElementById('product-cylinder').value = product.cylinder;
            document.getElementById('product-addition').value = product.addition;
            document.getElementById('product-stock').value = product.stock;

            document.getElementById('product-modal-title').textContent = 'Editar Producto';
            this.productModal.show();
        } catch (error) {
            console.error('Error al cargar el producto:', error);
            uiManager.showAlert('Error al cargar los datos del producto', 'danger');
        }
    },

    async showUpdateStockModal(productId) {
        try {
            const product = await window.api.getProduct(productId);

            document.getElementById('stock-product-id').value = product._id;
            document.getElementById('stock-product-name').textContent = product.name;
            document.getElementById('stock-product-barcode').textContent = product.barcode;
            document.getElementById('stock-product-sphere').textContent = product.sphere;
            document.getElementById('stock-product-cylinder').textContent = product.cylinder;
            document.getElementById('stock-product-addition').textContent = product.addition;
            document.getElementById('stock-current-stock').textContent = product.stock;
            document.getElementById('stock-new-value').value = product.stock;

            this.stockModal.show();

            setTimeout(() => {
                const stockInput = document.getElementById('stock-new-value');
                if (stockInput) {
                    stockInput.focus();
                    stockInput.select();
                    console.log('Input enfocado y texto seleccionado');
                }
            }, 300);

        } catch (error) {
            console.error('Error al cargar el producto:', error);
            uiManager.showAlert('Error al cargar los datos del producto', 'danger');
        }
    },

    // 🔄 MODIFICADO: Emitir eventos después de actualizar
    async updateStock() {
        try {
            console.log('🔄 updateStock() iniciado');

            const productId = document.getElementById('stock-product-id').value;
            const newStockValue = document.getElementById('stock-new-value').value;

            if (!productId) {
                uiManager.showAlert('Error: ID del producto no encontrado', 'danger');
                return;
            }

            const newStock = parseInt(newStockValue);
            if (isNaN(newStock) || newStock < 0) {
                uiManager.showAlert('Por favor, ingrese un valor de stock válido', 'warning');
                setTimeout(() => document.getElementById('stock-new-value').focus(), 100);
                return;
            }

            const saveBtn = document.getElementById('save-stock-btn');
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i>Actualizando...';

            const updatedProduct = await window.api.updateProductStock(productId, { stock: newStock });

            // 🚀 EMITIR EVENTO DE ACTUALIZACIÓN
            eventManager.emit('data:product:updated', updatedProduct);

            console.log('✅ Stock actualizado exitosamente:', updatedProduct);
            uiManager.showAlert('Stock actualizado correctamente', 'success');
            this.stockModal.hide();

            return updatedProduct;

        } catch (error) {
            console.error('❌ Error al actualizar stock:', error);
            uiManager.showAlert(`Error al actualizar el stock: ${error.message}`, 'danger');
            setTimeout(() => document.getElementById('stock-new-value').focus(), 100);
            throw error;
        } finally {
            const saveBtn = document.getElementById('save-stock-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Actualizar Stock';
            }
        }
    },

    // 🔄 MODIFICADO: Emitir eventos después de guardar
    async saveProduct() {
        try {
            const productId = document.getElementById('product-id').value;
            const productData = {
                name: document.getElementById('product-name').value,
                barcode: document.getElementById('product-barcode').value,
                sphere: document.getElementById('product-sphere').value,
                cylinder: document.getElementById('product-cylinder').value,
                addition: document.getElementById('product-addition').value,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
            };

            let response;
            if (productId) {
                // Actualizar producto existente
                const currentProduct = await window.api.getProduct(productId);

                if (currentProduct.stock !== productData.stock) {
                    const productDataWithoutStock = {
                        name: productData.name,
                        barcode: productData.barcode,
                        sphere: productData.sphere,
                        cylinder: productData.cylinder,
                        addition: productData.addition,
                        stock: currentProduct.stock
                    };

                    await window.api.updateProduct(productId, productDataWithoutStock);
                    response = await window.api.updateProductStock(productId, { stock: productData.stock });
                } else {
                    response = await window.api.updateProduct(productId, productData);
                }

                // 🚀 EMITIR EVENTO DE ACTUALIZACIÓN
                eventManager.emit('data:product:updated', response);
                uiManager.showAlert('Producto actualizado correctamente', 'success');
            } else {
                // Crear nuevo producto
                response = await window.api.createProduct(productData);
                
                // 🚀 EMITIR EVENTO DE CREACIÓN
                eventManager.emit('data:product:created', response);
                uiManager.showAlert('Producto creado correctamente', 'success');
            }

            this.productModal.hide();
        } catch (error) {
            console.error('Error al guardar el producto:', error);
            uiManager.showAlert('Error al guardar el producto', 'danger');
        }
    },

    // 🔄 MODIFICADO: Emitir eventos después de eliminar
    async deleteProduct(productId) {
        if (confirm('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
            try {
                await window.api.deleteProduct(productId);
                
                // 🚀 EMITIR EVENTO DE ELIMINACIÓN
                eventManager.emit('data:product:deleted', productId);
                
                uiManager.showAlert('Producto eliminado correctamente', 'success');
            } catch (error) {
                console.error('Error al eliminar el producto:', error);
                uiManager.showAlert('Error al eliminar el producto', 'danger');
            }
        }
    },

    handleProductAction(event) {
        const target = event.target.closest('button');
        if (!target) return;

        const productId = target.dataset.id;

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
        document.getElementById('product-barcode').value = barcode;
    },

    showBarcodeScannerModal() {
        const scannerModal = new bootstrap.Modal(document.getElementById('barcode-scanner-modal'));
        scannerModal.show();

        document.getElementById('scanner-placeholder').classList.remove('d-none');
        document.getElementById('scanner-container').classList.add('d-none');

        setTimeout(() => {
            document.getElementById('manual-barcode-input').focus();
        }, 500);
    },

    async searchByManualBarcode() {
        const barcode = document.getElementById('manual-barcode-input').value.trim();

        if (!barcode) {
            uiManager.showAlert('Ingrese un código de barras', 'warning');
            return;
        }

        try {
            const product = await window.api.getProductByBarcode(barcode);

            const scannerModal = bootstrap.Modal.getInstance(document.getElementById('barcode-scanner-modal'));
            scannerModal.hide();

            this.showEditProductModal(product._id);
        } catch (error) {
            uiManager.showAlert('Producto no encontrado', 'warning');
        }
    },

    filterProducts() {
        const searchTerm = document.getElementById('product-search').value.toLowerCase();

        if (!searchTerm) {
            this.renderProductsTable();
            return;
        }

        const filteredProducts = this.products.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.barcode.toLowerCase().includes(searchTerm) ||
            product.sphere.includes(searchTerm)
        );

        const originalProducts = [...this.products];
        this.products = filteredProducts;
        this.renderProductsTable();
        this.products = originalProducts;
    },

    // 🆕 NUEVO: Limpiar suscripciones al destruir la vista
    destroy() {
        console.log('🧹 Destruyendo ProductManager...');
        dataSync.unsubscribe(this.viewName, 'products');
    }
};