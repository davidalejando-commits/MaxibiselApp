// Gestión de ventas - CON SINCRONIZACIÓN CORREGIDA
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';
import { syncHelper } from './sync-helper.js'; // ✅ AGREGAR IMPORT
import { uiManager } from './ui.js';

export const sales = {
    sales: [],
    viewName: 'salesManager',

    init() {
        console.log('🔧 Inicializando salesManager...');

        // Suscribirse a cambios
        dataSync.subscribe(this.viewName, 'sales', this.handleDataChange.bind(this));
        dataSync.subscribe(this.viewName, 'products', this.handleProductChange.bind(this));

        // Configurar eventos...
        this.setupEventListeners();

        // Cargar datos
        this.loadSales();
    },

    handleDataChange({ action, data, dataType }) {
        console.log(`🔄 Vista ${this.viewName} recibió cambio de ${dataType}:`, action);

        if (dataType === 'sales') {
            switch (action) {
                case 'created':
                    this.sales.push(data);
                    this.renderSalesTable();
                    break;
                // ... más casos
            }
        }
    },

    handleProductChange({ action, data, dataType }) {
        // Reaccionar a cambios de productos si es necesario
        console.log('📦 Producto cambió, revisando impacto en ventas...');
    },

    async loadSales() {
        try {
            this.sales = await dataSync.getData('sales');
            this.renderSalesTable();
        } catch (error) {
            console.error('Error al cargar ventas:', error);
        }
    },

    async createSale(saleData) {
        try {
            const newSale = await window.api.createSale(saleData);

            // Emitir evento
            eventManager.emit('data:sale:created', newSale);

            uiManager.showAlert('Venta creada correctamente', 'success');
        } catch (error) {
            console.error('Error al crear venta:', error);
        }
    },

    destroy() {
        dataSync.unsubscribe(this.viewName, 'sales');
        dataSync.unsubscribe(this.viewName, 'products');
    }
};

// Funciones helper para formatear campos de lentes - SIMPLIFICADAS
function formatLensField(label, value) {
    if (!value || value === 'N/A' || value === '' || value === null || value === undefined) {
        return '';
    }
    return `${label}: ${value}`;
}

function createInfoLine(fields) {
    const validFields = fields.filter(field => field !== '');
    return validFields.length > 0 ? `<p>${validFields.join(' | ')}</p>` : '';
}

function getLensTitle(name) {
    if (!name || name.trim() === '' || name === 'Sin nombre') {
        return '';
    }
    return `<h6>${name}</h6>`;
}

export const salesManager = {
    // Estado interno para gestionar la venta actual
    state: {
        availableLenses: [],
        selectedLenses: [],
        searchResults: [],
        currentSale: null,
        isEditMode: false
    },

    init() {
        this.renderView();
        this.attachEventListeners();
        // Cargar datos iniciales
        this.loadInitialData();
    },

    async loadInitialData() {
        try {
            // Cargar productos desde la API
            this.state.availableLenses = await window.api.getProducts();
            // Ordenar productos disponibles por _id
            this.sortLensesById(this.state.availableLenses);
            console.log('Productos cargados:', this.state.availableLenses.length);
        } catch (error) {
            console.error('Error al cargar Productos:', error);
            uiManager.showAlert('Error al cargar el catálogo de productos', 'danger');
        }
    },

    // Nueva función para ordenar lentes por _id
    sortLensesById(lensesArray) {
        lensesArray.sort((a, b) => {
            if (a._id < b._id) return -1;
            if (a._id > b._id) return 1;
            return 0;
        });
    },

    renderView() {
        const salesView = document.getElementById('sales-view');
        salesView.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4 ps-2">
        <h2><i class="bi bi-cart-check me-2"></i>Salidas</h2>
        <button class="btn btn-primary" id="new-sale-btn">
          <i class="bi bi-plus-circle me-1"></i>Nueva lista
        </button>
      </div>
      
      <div class="container-sale">
        <!-- Panel izquierdo -->
        <div class="panel">
          <div class="panel-header">
            <h2 class="panel-title ps-1">Búsqueda de Productos</h2>
            <div class="search-container">
              <input type="text" class="search-input" id="searchInput" placeholder="Buscar por nombre o caracteristica del producto...">
            </div>
          </div>
          <div class="results-container scrollable-content" id="searchResults">
            <div class="lens-item" data-id="ejemplo-placeholder">
              <p>Busque productos para mostrar resultados...</p>
            </div>
          </div>
        </div>

        <!-- Panel derecho -->
        <div class="panel" >
          <div class="panel-header">
            <h2 class="panel-title ps-1">Productos Seleccionados</h2>
          </div>
          <div class="selected-container scrollable-content" id="selectedLenses">
            <div class="selected-lens" id="empty-selection">
              <p>No hay Productos seleccionados</p>
            </div>
          </div>
          <div class="panel-footer">
            <div class="action-buttons">
              <button class="action-btn save-btn" id="saveButton">Registrar salida</button>
              <button class="action-btn cancel-btn" id="cancelButton">Cancelar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de confirmación -->
      <div class="modal" id="confirmModal">
        <div class="modal-content">
          <h3 class="modal-title">Confirmar Acción</h3>
          <p class="modal-message" id="modalMessage">¿Está seguro que desea continuar con esta acción?</p>
          <div class="modal-buttons">
            <button class="modal-btn confirm-btn" id="confirmButton">Confirmar</button>
            <button class="modal-btn cancel-modal-btn" id="cancelModalButton">Cancelar</button>
          </div>
        </div>
      </div>
    `;
    },

    attachEventListeners() {
        // Botones principales
        document.getElementById('new-sale-btn').addEventListener('click', () => this.handleNewSale());
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));
        document.getElementById('saveButton').addEventListener('click', () => this.handleSave());
        document.getElementById('cancelButton').addEventListener('click', () => this.handleCancel());

        // Modal
        document.getElementById('confirmButton').addEventListener('click', () => this.confirmAction());
        document.getElementById('cancelModalButton').addEventListener('click', () => this.hideModal());

        // Delegación de eventos para elementos dinámicos
        document.getElementById('searchResults').addEventListener('click', (e) => {
            const lensItem = e.target.closest('.lens-item');
            if (lensItem && !lensItem.dataset.id.includes('placeholder')) {
                const lensId = lensItem.dataset.id;
                if (lensId) this.addLensToSelection(lensId);
            }
        });

        document.getElementById('selectedLenses').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-lens');
            if (removeBtn) {
                const lensItem = removeBtn.closest('.selected-lens');
                if (lensItem) {
                    const lensId = lensItem.dataset.id;
                    if (lensId) this.removeLensFromSelection(lensId);
                }
                return;
            }

            const decreaseBtn = e.target.closest('.qty-decrease');
            if (decreaseBtn) {
                const lensId = decreaseBtn.dataset.id;
                if (lensId) this.decreaseQuantity(lensId);
                return;
            }

            const increaseBtn = e.target.closest('.qty-increase');
            if (increaseBtn) {
                const lensId = increaseBtn.dataset.id;
                if (lensId) this.increaseQuantity(lensId);
                return;
            }
        });
    },

    handleNewSale() {
        if (this.state.selectedLenses.length > 0) {
            this.showModal('Tiene una lista en progreso. ¿Desea descartarla y comenzar una nueva?', 'newSale');
        } else {
            this.resetSale();
        }
    },

    resetSale() {
        this.state.selectedLenses = [];
        this.state.currentSale = {
            id: 'sale-' + Date.now(),
            date: new Date(),
            items: [],
            total: 0
        };
        this.state.isEditMode = false;

        document.getElementById('selectedLenses').innerHTML = `
            <div class="selected-lens" id="empty-selection">
                <p>No hay Productos seleccionados</p>
            </div>
        `;

        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = `
            <div class="lens-item" data-id="ejemplo-placeholder">
                <p>Busque Productos para mostrar resultados...</p>
            </div>
        `;
    },

    handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        if (!searchTerm) {
            document.getElementById('searchResults').innerHTML = `
                <div class="lens-item" data-id="ejemplo-placeholder">
                    <p>Busque productos para mostrar resultados...</p>
                </div>
            `;
            return;
        }

        const filteredLenses = this.state.availableLenses.filter(lens => {
            return (
                (lens.name && lens.name.toLowerCase().includes(searchTerm)) ||
                (lens.barcode && lens.barcode.toLowerCase().includes(searchTerm)) ||
                (lens.sphere && lens.sphere.includes(searchTerm)) ||
                (lens.cylinder && lens.cylinder.includes(searchTerm))
            );
        });

        this.sortLensesById(filteredLenses);
        this.state.searchResults = filteredLenses;
        this.renderSearchResults();
    },

    renderSearchResults() {
        const resultsContainer = document.getElementById('searchResults');

        if (this.state.searchResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="lens-item">
                    <p>No se encontraron resultados</p>
                </div>
            `;
            return;
        }

        const resultsHTML = this.state.searchResults.map(lens => {
            const sphereField = formatLensField('Esfera', lens.sphere);
            const cylinderField = formatLensField('Cilindro', lens.cylinder);
            const additionField = formatLensField('Adición', lens.addition);

            const specsLine = createInfoLine([sphereField, cylinderField, additionField]);
            const titleHTML = getLensTitle(lens.name);

            return `
                <div class="lens-item" data-id="${lens._id}">
                    <div class="lens-details">
                        ${titleHTML}
                        ${specsLine}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHTML;
    },

    addLensToSelection(lensId) {
        const selectedLens = this.state.availableLenses.find(lens => lens._id === lensId);
        if (!selectedLens) return;

        const existingIndex = this.state.selectedLenses.findIndex(lens => lens._id === lensId);

        if (existingIndex >= 0) {
            this.state.selectedLenses[existingIndex].quantity += 1;
        } else {
            this.state.selectedLenses.push({
                ...selectedLens,
                quantity: 1
            });
        }

        this.sortLensesById(this.state.selectedLenses);
        this.renderSelectedLenses();
    },

    removeLensFromSelection(lensId) {
        this.state.selectedLenses = this.state.selectedLenses.filter(lens => lens._id !== lensId);
        this.renderSelectedLenses();
    },

    renderSelectedLenses() {
        const selectedContainer = document.getElementById('selectedLenses');

        if (this.state.selectedLenses.length === 0) {
            selectedContainer.innerHTML = `
                <div class="selected-lens" id="empty-selection">
                    <p>No hay productos seleccionados</p>
                </div>
            `;
            return;
        }

        const selectedHTML = this.state.selectedLenses.map(lens => {
            const sphereField = formatLensField('Esfera', lens.sphere);
            const cylinderField = formatLensField('Cilindro', lens.cylinder);
            const additionField = formatLensField('Adición', lens.addition);

            const specsLine = createInfoLine([sphereField, cylinderField, additionField]);
            const titleHTML = getLensTitle(lens.name);

            return `
                <div class="selected-lens" data-id="${lens._id}">
                    <div class="lens-info">
                        ${titleHTML}
                        ${specsLine}
                        <div class="quantity-control">
                            <button class="qty-btn qty-decrease" data-id="${lens._id}">
                                <i class="bi bi-dash-lg"></i>
                            </button>
                            <span class="qty-value">${lens.quantity}</span>
                            <button class="qty-btn qty-increase" data-id="${lens._id}">
                                <i class="bi bi-plus-lg"></i>
                            </button>
                        </div>
                    </div>
                    <button class="remove-lens" data-id="${lens._id}">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            `;
        }).join('');

        selectedContainer.innerHTML = selectedHTML;
    },

    increaseQuantity(lensId) {
        const index = this.state.selectedLenses.findIndex(lens => lens._id === lensId);
        if (index < 0) return;

        this.state.selectedLenses[index].quantity += 1;
        this.renderSelectedLenses();
    },

    decreaseQuantity(lensId) {
        const index = this.state.selectedLenses.findIndex(lens => lens._id === lensId);
        if (index < 0) return;

        if (this.state.selectedLenses[index].quantity <= 1) {
            this.removeLensFromSelection(lensId);
        } else {
            this.state.selectedLenses[index].quantity -= 1;
            this.renderSelectedLenses();
        }
    },

    handleSave() {
        if (this.state.selectedLenses.length === 0) {
            uiManager.showAlert('No hay productos seleccionados para guardar', 'warning');
            return;
        }

        this.showModal('¿Está seguro que desea realizar los cambios?', 'saveSale');
    },

    async finalizeSale() {
        try {
            const updateResult = await this.updateInventoryIntelligently();

            if (updateResult) {
                uiManager.showAlert('Registro exitoso', 'success');
                this.resetSale();
                return true;
            } else {
                throw new Error('No se pudo actualizar el inventario');
            }
        } catch (error) {
            console.error('Error al finalizar el registro:', error);
            uiManager.showAlert('Error al realizar los cambios: ' + error.message, 'danger');
            return false;
        }
    },

    // ✅ FUNCIÓN CORREGIDA CON SINCRONIZACIÓN
    async updateInventoryIntelligently() {
        try {
            console.log('🔄 Iniciando actualización inteligente de inventario...');

            for (const selectedLens of this.state.selectedLenses) {
                // Obtener el producto actual
                const product = await window.api.getProduct(selectedLens._id);

                if (!product) {
                    throw new Error(`No se encontró el producto con ID: ${selectedLens._id}`);
                }

                const quantityToSubtract = selectedLens.quantity;
                const currentStockSurtido = product.stock_surtido || 0;
                const currentStock = product.stock || 0;
                const oldStock = currentStock; // ✅ GUARDAR STOCK ANTERIOR

                console.log(`📦 Procesando ${product.name}:`, {
                    cantidadSalida: quantityToSubtract,
                    stockActual: currentStock,
                    stockSurtidoActual: currentStockSurtido
                });

                // Validación de stock
                if (currentStock < quantityToSubtract) {
                    throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}, Solicitado: ${quantityToSubtract}`);
                }

                // Calcular nuevos valores
                let newStockSurtido, newStock;

                if (currentStockSurtido >= quantityToSubtract) {
                    // Hay suficiente en stock_surtido
                    newStockSurtido = currentStockSurtido - quantityToSubtract;
                    newStock = currentStock - quantityToSubtract;
                } else {
                    // No hay suficiente en stock_surtido
                    const remainingToSubtract = quantityToSubtract - currentStockSurtido;
                    const currentStockAlmacenado = product.stock_almacenado || 0;

                    if (currentStockAlmacenado < remainingToSubtract) {
                        throw new Error(`Stock insuficiente para ${product.name}. Total disponible: ${currentStock}, Solicitado: ${quantityToSubtract}`);
                    }

                    newStockSurtido = 0;
                    newStock = currentStock - quantityToSubtract;
                }

                // ✅ ACTUALIZAR EN BACKEND
                const updateResult = await window.api.updateProductStock(selectedLens._id, {
                    stock: newStock,
                    stock_surtido: newStockSurtido
                });

                const updatedProduct = updateResult.product || updateResult;

                // ✅ SINCRONIZACIÓN INMEDIATA: Notificar a todas las vistas
                syncHelper.notifyProductSold(
                    selectedLens._id,
                    quantityToSubtract,
                    newStock,
                    updatedProduct,
                    'salesView' // ← Identificar que viene de la vista de ventas
                );

                console.log(`✅ Inventario actualizado y sincronizado para ${product.name}`);
            }

            // Recargar datos locales
            await this.loadInitialData();

            console.log('✅ Actualización inteligente de inventario completada');
            return true;

        } catch (error) {
            console.error('💥 Error en actualización inteligente:', error);

            let errorMessage = 'Error al actualizar el inventario';
            if (error.message) {
                if (error.message.includes('Stock insuficiente')) {
                    errorMessage = error.message;
                } else if (error.message.includes('400') || error.message.includes('inválido')) {
                    errorMessage = 'Error de validación: ' + error.message;
                } else if (error.message.includes('404') || error.message.includes('no encontrado')) {
                    errorMessage = 'Producto no encontrado';
                } else if (error.message.includes('500') || error.message.includes('servidor')) {
                    errorMessage = 'Error del servidor: Intente nuevamente';
                } else {
                    errorMessage = error.message;
                }
            }

            uiManager.showAlert(errorMessage, 'danger');
            return false;
        }
    },

    handleCancel() {
        if (this.state.selectedLenses.length > 0) {
            this.showModal('¿Está seguro que desea cancelar este registro?', 'cancelSale');
        } else {
            this.resetSale();
        }
    },

    showModal(message, action) {
        const modal = document.getElementById('confirmModal');
        document.getElementById('modalMessage').textContent = message;
        this.currentModalAction = action;
        modal.style.display = 'flex';
    },

    hideModal() {
        const modal = document.getElementById('confirmModal');
        modal.style.display = 'none';
    },

    confirmAction() {
        switch (this.currentModalAction) {
            case 'saveSale':
                this.finalizeSale();
                break;
            case 'cancelSale':
            case 'newSale':
                this.resetSale();
                break;
            default:
                console.log('Acción no reconocida');
        }

        this.hideModal();
    }
};