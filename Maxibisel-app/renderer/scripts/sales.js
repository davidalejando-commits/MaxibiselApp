// Gestión de ventas - CON SINCRONIZACIÓN CORREGIDA
import { dataSync } from "./dataSync.js";
import { eventManager } from "./eventManager.js";
import { syncHelper } from "./sync-helper.js";
import { uiManager } from "./ui.js";

export const sales = {
  sales: [],
  viewName: "salesManager",

  init() {
    console.log('🔧 Inicializando salesManager...');
    
    // ✅ Limpiar primero si ya estaba inicializado
    if (this.isInitialized) {
        console.log('⚠️ salesManager ya estaba inicializado, limpiando primero...');
        this.destroy();
    }
    
    // Renderizar la vista
    this.renderView();
    
    // Configurar event listeners
    this.attachEventListeners();
    
    // Cargar datos iniciales
    this.loadInitialData();
    
    // Marcar como inicializado
    this.isInitialized = true;
    
    console.log('✅ salesManager inicializado correctamente');
},

  handleDataChange({ action, data, dataType }) {
    console.log(
      `🔄 Vista ${this.viewName} recibió cambio de ${dataType}:`,
      action
    );

    if (dataType === "sales") {
      // VALIDACIÓN: Asegurar que sales sea un array
      if (!Array.isArray(this.sales)) {
        console.warn("⚠️ this.sales no es un array, inicializando...");
        this.sales = [];
      }

      switch (action) {
        case "created":
          this.sales.push(data);
          this.renderSalesTable();
          break;
        case "updated":
          const index = this.sales.findIndex((s) => s._id === data._id);
          if (index !== -1) {
            this.sales[index] = data;
            this.renderSalesTable();
          }
          break;
        case "deleted":
          this.sales = this.sales.filter((s) => s._id !== data);
          this.renderSalesTable();
          break;
        case "refreshed":
          this.sales = Array.isArray(data) ? data : [];
          this.renderSalesTable();
          break;
      }
    }
  },

  handleProductChange({ action, data, dataType }) {
    // Reaccionar a cambios de productos si es necesario
    console.log("📦 Producto cambió, revisando impacto en ventas...");
  },

  async loadSales() {
    try {
      // VALIDACIÓN: Verificar método dataSync antes de usar
      let salesData;
      if (dataSync && typeof dataSync.getData === "function") {
        salesData = await dataSync.getData("sales");
      } else {
        console.warn("⚠️ dataSync.getData no disponible, usando API directa");
        salesData = await window.api.getSales();
      }

      // VALIDACIÓN: Verificar formato de respuesta
      if (Array.isArray(salesData)) {
        this.sales = salesData;
      } else if (salesData && Array.isArray(salesData.sales)) {
        this.sales = salesData.sales;
      } else {
        console.warn("⚠️ Datos de ventas no válidos:", salesData);
        this.sales = [];
      }

      this.renderSalesTable();
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      this.sales = [];
      this.renderSalesTable();
    }
  },

  async createSale(saleData) {
    try {
      const newSale = await window.api.createSale(saleData);

      // VALIDACIÓN: Asegurar que sales sea un array
      if (!Array.isArray(this.sales)) {
        this.sales = [];
      }

      // Agregar al cache local
      this.sales.push(newSale);

      // Emitir evento
      if (eventManager && typeof eventManager.emit === "function") {
        eventManager.emit("data:sale:created", newSale);
      }

      uiManager.showAlert("Venta creada correctamente", "success");
    } catch (error) {
      console.error("Error al crear venta:", error);
      uiManager.showAlert("Error al crear la venta", "danger");
    }
  },

  renderSalesTable() {
    // Implementar renderizado de tabla de ventas
    console.log("🔄 Renderizando tabla de ventas...");
    // TODO: Implementar lógica de renderizado
  },

  setupEventListeners() {
    // Implementar event listeners para sales
    console.log("🔧 Configurando event listeners para sales...");
    // TODO: Implementar event listeners
  },

  destroy() {
    if (dataSync && typeof dataSync.unsubscribe === "function") {
      dataSync.unsubscribe(this.viewName, "sales");
      dataSync.unsubscribe(this.viewName, "products");
    }
  },
};

// ✅ FUNCIONES HELPER MEJORADAS PARA FORMATO DE LENTES
function formatLensSpecs(lens) {
  if (!lens) return "";
  
  const sphere = lens.sphere;
  const cylinder = lens.cylinder;
  const addition = lens.addition;
  
  // Validar si los valores son válidos (no vacíos, no "N/A", etc.)
  const isValidValue = (val) => {
    return val && val !== "N/A" && val !== "" && val !== null && val !== undefined;
  };
  
  const hasSphere = isValidValue(sphere);
  const hasCylinder = isValidValue(cylinder);
  const hasAddition = isValidValue(addition);
  
  // Si tiene esfera y cilindro: "-0.25 -2.00"
  if (hasSphere && hasCylinder) {
    return `${sphere} ${cylinder}`;
  }
  
  // Si tiene esfera y adición: "-0.25 / +3.00"
  if (hasSphere && hasAddition) {
    return `${sphere} / ${addition}`;
  }
  
  // Si solo tiene esfera: "-0.25"
  if (hasSphere) {
    return sphere;
  }
  
  return "";
}

function getLensTitle(name) {
  if (!name || name.trim() === "" || name === "Sin nombre") {
    return "";
  }
  return `<h6>${name}</h6>`;
}

export const salesManager = {
  isInitialized: false,
  // Estado interno para gestionar la venta actual
  state: {
    availableLenses: [],
    selectedLenses: [],
    searchResults: [],
    currentSale: null,
    isEditMode: false,
    isProcessing: false, 
  },


  // ✅ FUNCIÓN CORREGIDA: Mover sortLensesById dentro del objeto
  sortLensesById(lensesArray) {
    if (!Array.isArray(lensesArray)) {
      console.warn(
        "⚠️ sortLensesById recibió un valor que no es array:",
        lensesArray
      );
      return;
    }

    if (typeof lensesArray.sort !== "function") {
      console.error("❌ Array no tiene método sort:", lensesArray);
      return;
    }

    try {
      lensesArray.sort((a, b) => {
        if (!a || !a._id) {
          console.warn("⚠️ Elemento sin _id encontrado:", a);
          return 1;
        }
        if (!b || !b._id) {
          console.warn("⚠️ Elemento sin _id encontrado:", b);
          return -1;
        }
        if (a._id < b._id) return -1;
        if (a._id > b._id) return 1;
        return 0;
      });
    } catch (error) {
      console.error("❌ Error ordenando lentes:", error);
    }
  },

  init() {
    console.log('🔧 Inicializando salesManager...');
    
    // ✅ CRÍTICO: Verificar si ya está inicializado
    if (this.isInitialized) {
        console.log('⚠️ salesManager ya está inicializado, destruyendo primero...');
        this.destroy();
    }
    
    // Renderizar la vista
    this.renderView();
    
    // Configurar event listeners
    this.attachEventListeners();
    
    // Cargar datos iniciales
    this.loadInitialData();
    
    // ✅ Marcar como inicializado
    this.isInitialized = true;
    
    console.log('✅ salesManager inicializado correctamente');
},

  async loadInitialData() {
    try {
      // Cargar productos desde la API
      const productsData = await window.api.getProducts();

      // ✅ VALIDACIÓN ESTRICTA: Verificar formato de respuesta
      if (Array.isArray(productsData)) {
        this.state.availableLenses = productsData;
      } else if (productsData && Array.isArray(productsData.products)) {
        this.state.availableLenses = productsData.products;
      } else if (productsData && Array.isArray(productsData.data)) {
        this.state.availableLenses = productsData.data;
      } else {
        console.error(
          "❌ getProducts() no devolvió un formato válido:",
          productsData
        );
        this.state.availableLenses = [];
      }

      // ✅ CORRECCIÓN: Usar this.sortLensesById en lugar de función global
      if (Array.isArray(this.state.availableLenses)) {
        this.sortLensesById(this.state.availableLenses);
        console.log("Productos cargados:", this.state.availableLenses.length);
      } else {
        console.error(
          "❌ availableLenses no es un array después de la validación"
        );
        this.state.availableLenses = [];
      }
    } catch (error) {
      console.error("Error al cargar Productos:", error);
      uiManager.showAlert("Error al cargar el catálogo de productos", "danger");
      // ✅ FALLBACK: Asegurar que siempre sea un array
      this.state.availableLenses = [];
    }
  },

  renderView() {
    const salesView = document.getElementById("sales-view");
    salesView.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4 ps-2">
        <h2><i class="bi bi-cart-check me-2"></i>Salidas</h2>
        <button id="ver-historial-facturas-btn" class="btn btn-primary">
          <i class="bi bi-receipt me-1"></i>Historial de Facturas
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
        <div class="panel">
          <div class="panel-header">
            <div class="d-flex justify-content-between align-items-center w-100">
              <h2 class="panel-title ps-1 mb-0">Productos Seleccionados</h2>
              <div class="selected-counter" id="selectedCounter">
                <i class="bi bi-box-seam me-1"></i>
                <span id="selectedCount">0</span>
              </div>
            </div>
          </div>
          <div class="selected-container scrollable-content" id="selectedLenses">
            <div class="selected-lens" id="empty-selection">
              <p>No hay Productos seleccionados</p>
            </div>
          </div>
          
          <!-- Opción de descuento desde bodega -->
          <div class="warehouse-option">
            <label class="warehouse-toggle">
              <input type="checkbox" id="warehouseCheckbox">
              <span class="warehouse-label">
                <i class="bi bi-box-seam"></i>
                Descontar directamente de bodega
              </span>
            </label>
          </div>
          
          <div class="panel-footer">
            <div class="action-buttons">
              <button class="action-btn save-btn" id="saveButton">
                <span id="saveButtonText">Registrar salida</span>
                <div class="spinner-border spinner-border-sm ms-2 d-none" id="saveSpinner" role="status">
                  <span class="visually-hidden">Procesando...</span>
                </div>
              </button>
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
      
      <style>
        .selected-counter {
          display: flex;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #2600ffff 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.95rem;
          box-shadow: 0 2px 8px rgba(0, 47, 255, 0.3);
          transition: all 0.3s ease;
        }
        
        .selected-counter:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(87, 113, 233, 0.4);
        }
        
        .selected-counter i {
          font-size: 1.1rem;
        }
        
        #selectedCount {
          min-width: 20px;
          text-align: center;
          font-size: 1.1rem;
        }
        
        .spinner-border-sm {
          width: 1rem;
          height: 1rem;
          border-width: 0.15em;
        }
        
        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      </style>
    `;
  },

  attachEventListeners() {
    // Botones principales
    document
      .getElementById("searchInput")
      .addEventListener("input", (e) => this.handleSearch(e));
    document
      .getElementById("saveButton")
      .addEventListener("click", () => this.handleSave());
    document
      .getElementById("cancelButton")
      .addEventListener("click", () => this.handleCancel());
      // Botón de historial de facturas
    const historialFacturasBtn = document.getElementById("ver-historial-facturas-btn");
    if (historialFacturasBtn) {
      historialFacturasBtn.addEventListener("click", () => this.verHistorialFacturas());
    }
    // Checkbox de bodega
    document.getElementById('warehouseCheckbox').addEventListener('change', (e) => {
      this.state.useWarehouseStock = e.target.checked;
      console.log('📦 Modo bodega:', this.state.useWarehouseStock ? 'ACTIVADO' : 'DESACTIVADO');
    });  

    // Modal
    document
      .getElementById("confirmButton")
      .addEventListener("click", () => this.confirmAction());
    document
      .getElementById("cancelModalButton")
      .addEventListener("click", () => this.hideModal());

    // Delegación de eventos para elementos dinámicos
    document.getElementById("searchResults").addEventListener("click", (e) => {
      const lensItem = e.target.closest(".lens-item");
      if (lensItem && !lensItem.dataset.id.includes("placeholder")) {
        const lensId = lensItem.dataset.id;
        if (lensId) this.addLensToSelection(lensId);
      }
    });

    document.getElementById("selectedLenses").addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".remove-lens");
      if (removeBtn) {
        const lensItem = removeBtn.closest(".selected-lens");
        if (lensItem) {
          const lensId = lensItem.dataset.id;
          if (lensId) this.removeLensFromSelection(lensId);
        }
        return;
      }

      const decreaseBtn = e.target.closest(".qty-decrease");
      if (decreaseBtn) {
        const lensId = decreaseBtn.dataset.id;
        if (lensId) this.decreaseQuantity(lensId);
        return;
      }

      const increaseBtn = e.target.closest(".qty-increase");
      if (increaseBtn) {
        const lensId = increaseBtn.dataset.id;
        if (lensId) this.increaseQuantity(lensId);
        return;
      }
    });
    // ✅ ESCANEO DE CÓDIGOS DE BARRAS
    this.setupBarcodeScanner();
  },

  // ✅ NUEVO: Actualizar contador de productos seleccionados
  updateSelectedCounter() {
    const countElement = document.getElementById("selectedCount");
    if (countElement && Array.isArray(this.state.selectedLenses)) {
      const totalItems = this.state.selectedLenses.reduce(
        (sum, lens) => sum + (lens.quantity || 0),
        0
      );
      countElement.textContent = totalItems;
    }
  },

  // ✅ NUEVO: Mostrar/ocultar loader de procesamiento
  showProcessingLoader(show = true) {
    const saveButton = document.getElementById("saveButton");
    const saveButtonText = document.getElementById("saveButtonText");
    const saveSpinner = document.getElementById("saveSpinner");
    const cancelButton = document.getElementById("cancelButton");

    if (show) {
      this.state.isProcessing = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      saveButtonText.textContent = "Procesando...";
      saveSpinner.classList.remove("d-none");
    } else {
      this.state.isProcessing = false;
      saveButton.disabled = false;
      cancelButton.disabled = false;
      saveButtonText.textContent = "Registrar salida";
      saveSpinner.classList.add("d-none");
    }
  },


  resetSale() {
    this.state.selectedLenses = [];
    this.state.useWarehouseStock = false;
    this.state.currentSale = {
      id: "sale-" + Date.now(),
      date: new Date(),
      items: [],
      total: 0,
    };
    this.state.isEditMode = false;

    document.getElementById("selectedLenses").innerHTML = `
      <div class="selected-lens" id="empty-selection">
        <p>No hay Productos seleccionados</p>
      </div>
    `;

    // Restablecer checkbox de bodega
    const warehouseCheckbox = document.getElementById('warehouseCheckbox');
    if (warehouseCheckbox) {
      warehouseCheckbox.checked = false;
    }

    document.getElementById("searchInput").value = "";
    document.getElementById("searchResults").innerHTML = `
      <div class="lens-item" data-id="ejemplo-placeholder">
        <p>Busque Productos para mostrar resultados...</p>
      </div>
    `;
    
    // ✅ Actualizar contador
    this.updateSelectedCounter();
  },

  handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    if (!searchTerm) {
      document.getElementById("searchResults").innerHTML = `
        <div class="lens-item" data-id="ejemplo-placeholder">
          <p>Busque productos para mostrar resultados...</p>
        </div>
      `;
      return;
    }

    // ✅ VALIDACIÓN: Asegurar que availableLenses sea un array
    if (!Array.isArray(this.state.availableLenses)) {
      console.error(
        "❌ availableLenses no es un array:",
        this.state.availableLenses
      );
      this.state.availableLenses = [];
      document.getElementById("searchResults").innerHTML = `
        <div class="lens-item">
          <p>Error: No se pueden buscar productos</p>
        </div>
      `;
      return;
    }

    const filteredLenses = this.state.availableLenses.filter((lens) => {
      if (!lens) return false;
      return (
        (lens.name && lens.name.toLowerCase().includes(searchTerm)) ||
        (lens.barcode && lens.barcode.toLowerCase().includes(searchTerm)) ||
        (lens.sphere && lens.sphere.includes(searchTerm)) ||
        (lens.cylinder && lens.cylinder.includes(searchTerm))
      );
    });

    // ✅ CORRECCIÓN: Usar this.sortLensesById para el panel izquierdo
    this.sortLensesById(filteredLenses);
    this.state.searchResults = filteredLenses;
    this.renderSearchResults();
  },

  renderSearchResults() {
    const resultsContainer = document.getElementById("searchResults");

    // ✅ VALIDACIÓN: Verificar que searchResults sea un array
    if (!Array.isArray(this.state.searchResults)) {
      console.warn("⚠️ searchResults no es un array, inicializando...");
      this.state.searchResults = [];
    }

    if (this.state.searchResults.length === 0) {
      resultsContainer.innerHTML = `
        <div class="lens-item">
          <p>No se encontraron resultados</p>
        </div>
      `;
      return;
    }

    const resultsHTML = this.state.searchResults
      .map((lens) => {
        const specsText = formatLensSpecs(lens);
        const titleHTML = getLensTitle(lens.name);

        return `
          <div class="lens-item" data-id="${lens._id}">
            <div class="lens-details">
              ${titleHTML}
              ${specsText ? `<p>${specsText}</p>` : ''}
            </div>
          </div>
        `;
      })
      .join("");

    resultsContainer.innerHTML = resultsHTML;
  },

  addLensToSelection(lensId) {
    // ✅ VALIDACIÓN: Asegurar que availableLenses sea un array
    if (!Array.isArray(this.state.availableLenses)) {
      console.error("❌ availableLenses no es un array");
      return;
    }

    const selectedLens = this.state.availableLenses.find(
      (lens) => lens._id === lensId
    );
    if (!selectedLens) {
      console.warn("⚠️ Lente no encontrado:", lensId);
      return;
    }

    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
    }

    const existingIndex = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId
    );

    if (existingIndex >= 0) {
      this.state.selectedLenses[existingIndex].quantity += 1;
    } else {
      // ✅ NO ORDENAR: Simplemente agregar al final
      this.state.selectedLenses.push({
        ...selectedLens,
        quantity: 1,
      });
    }

    this.renderSelectedLenses();
    this.updateSelectedCounter(); // ✅ Actualizar contador
  },

  removeLensFromSelection(lensId) {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }

    this.state.selectedLenses = this.state.selectedLenses.filter(
      (lens) => lens._id !== lensId
    );
    this.renderSelectedLenses();
    this.updateSelectedCounter(); // ✅ Actualizar contador
  },

  renderSelectedLenses() {
    const selectedContainer = document.getElementById("selectedLenses");

    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
    }

    if (this.state.selectedLenses.length === 0) {
      selectedContainer.innerHTML = `
        <div class="selected-lens" id="empty-selection">
          <p>No hay productos seleccionados</p>
        </div>
      `;
      return;
    }

    // ✅ NO ORDENAR: Mantener el orden de selección
    const selectedHTML = this.state.selectedLenses
      .map((lens) => {
        const specsText = formatLensSpecs(lens);
        const titleHTML = getLensTitle(lens.name);

        return `
          <div class="selected-lens" data-id="${lens._id}">
            <div class="lens-info">
              ${titleHTML}
              ${specsText ? `<p>${specsText}</p>` : ''}
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
      })
      .join("");

    selectedContainer.innerHTML = selectedHTML;
  },

  increaseQuantity(lensId) {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }

    const index = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId
    );
    if (index < 0) return;

    this.state.selectedLenses[index].quantity += 1;
    this.renderSelectedLenses();
    this.updateSelectedCounter(); // ✅ Actualizar contador
  },

  decreaseQuantity(lensId) {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }

    const index = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId
    );
    if (index < 0) return;

    if (this.state.selectedLenses[index].quantity <= 1) {
      this.removeLensFromSelection(lensId);
    } else {
      this.state.selectedLenses[index].quantity -= 1;
      this.renderSelectedLenses();
    }
    this.updateSelectedCounter(); // ✅ Actualizar contador
  },

  handleSave() {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
    }

    if (this.state.selectedLenses.length === 0) {
      uiManager.showAlert(
        "No hay productos seleccionados para guardar",
        "warning"
      );
      return;
    }

    this.showModal("¿Está seguro que desea realizar los cambios?", "saveSale");
  },

  async finalizeSale() {
    try {
      // ✅ Mostrar loader
      this.showProcessingLoader(true);
      
      const updateResult = await this.updateInventoryIntelligently();

      if (updateResult) {
        // ✅ Calcular total de productos actualizados
        const totalProductsUpdated = this.state.selectedLenses.reduce(
          (sum, lens) => sum + (lens.quantity || 0),
          0
        );
        
        // ✅ Ocultar loader
        this.showProcessingLoader(false);
        
        uiManager.showAlert(
          `Registro exitoso. ${totalProductsUpdated} producto${totalProductsUpdated !== 1 ? 's' : ''} actualizado${totalProductsUpdated !== 1 ? 's' : ''}`,
          "success"
        );
        this.resetSale();
        return true;
      } else {
        throw new Error("No se pudo actualizar el inventario");
      }
    } catch (error) {
      // ✅ Ocultar loader en caso de error
      this.showProcessingLoader(false);
      
      console.error("Error al finalizar el registro:", error);
      uiManager.showAlert(
        "Error al realizar los cambios: " + error.message,
        "danger"
      );
      return false;
    }
  },

  // ✅ FUNCIÓN CORREGIDA CON SINCRONIZACIÓN Y VALIDACIONES
  async updateInventoryIntelligently() {
    try {
      console.log("🔄 Iniciando actualización inteligente de inventario...");

      // Validación: Asegurar que selectedLenses sea un array
      if (!Array.isArray(this.state.selectedLenses)) {
        throw new Error("No hay productos seleccionados para procesar");
      }

      const useWarehouseStock = this.state.useWarehouseStock || false;
      let updatedCount = 0; // ✅ Contador de productos actualizados

      for (const selectedLens of this.state.selectedLenses) {
        if (!selectedLens || !selectedLens._id) {
          console.warn("⚠️ Lente inválido encontrado:", selectedLens);
          continue;
        }

        // Obtener el producto actual
        const productResponse = await window.api.getProduct(selectedLens._id);

        // CORRECCIÓN: Extraer producto según formato de respuesta
        const product = productResponse?.product || productResponse;

        if (!product || !product._id) {
          throw new Error(
            `No se encontró el producto con ID: ${selectedLens._id}`
          );
        }

        const quantityToSubtract = selectedLens.quantity || 0;
        const currentStockSurtido = product.stock_surtido || 0;
        const currentStock = product.stock || 0;
        const productName = product.name || "Producto sin nombre";

        console.log(`📦 Procesando ${productName}:`, {
          cantidadSalida: quantityToSubtract,
          stockActual: currentStock,
          stockSurtidoActual: currentStockSurtido,
          usarBodega: useWarehouseStock,
        });

        // Validación de stock
        if (currentStock < quantityToSubtract) {
          throw new Error(
            `Stock insuficiente para ${productName}. Disponible: ${currentStock}, Solicitado: ${quantityToSubtract}`
          );
        }

        // Calcular nuevos valores según la opción seleccionada
        let newStockSurtido, newStock;

        if (useWarehouseStock) {
          // MODO BODEGA: Solo descontar del stock general, mantener stock_surtido intacto
          newStockSurtido = currentStockSurtido;
          newStock = currentStock - quantityToSubtract;

          console.log(
            `📦 Modo bodega: Descontando ${quantityToSubtract} solo del stock general`
          );
        } else {
          // MODO NORMAL: Priorizar stock_surtido
          if (currentStockSurtido >= quantityToSubtract) {
            newStockSurtido = currentStockSurtido - quantityToSubtract;
            newStock = currentStock - quantityToSubtract;
          } else {
            const remainingToSubtract =
              quantityToSubtract - currentStockSurtido;
            const currentStockAlmacenado = product.stock_almacenado || 0;

            if (currentStockAlmacenado < remainingToSubtract) {
              throw new Error(
                `Stock insuficiente para ${productName}. Total disponible: ${currentStock}, Solicitado: ${quantityToSubtract}`
              );
            }

            newStockSurtido = 0;
            newStock = currentStock - quantityToSubtract;
          }
        }

        // ACTUALIZAR EN BACKEND
        const updateResult = await window.api.updateProductStock(
          selectedLens._id,
          {
            stock: newStock,
            stock_surtido: newStockSurtido,
          }
        );

        const updatedProduct = updateResult.product || updateResult;

        // SINCRONIZACIÓN INMEDIATA
        if (syncHelper && typeof syncHelper.notifyProductSold === "function") {
          syncHelper.notifyProductSold(
            selectedLens._id,
            quantityToSubtract,
            newStock,
            updatedProduct,
            "salesView"
          );
        } else {
          console.warn("⚠️ syncHelper.notifyProductSold no disponible");
          if (eventManager && typeof eventManager.emit === "function") {
            eventManager.emit("data:product:stock-updated", {
              productId: selectedLens._id,
              newStock,
              product: updatedProduct,
            });
          }
        }

        updatedCount++; // ✅ Incrementar contador
        console.log(
          `✅ Inventario actualizado y sincronizado para ${productName}`
        );
      }

      // Recargar datos locales
      await this.loadInitialData();

      console.log(`✅ Actualización inteligente completada: ${updatedCount} productos actualizados`);
      return true;
    } catch (error) {
      console.error("💥 Error en actualización inteligente:", error);

      let errorMessage = "Error al actualizar el inventario";
      if (error.message) {
        if (error.message.includes("Stock insuficiente")) {
          errorMessage = error.message;
        } else if (
          error.message.includes("400") ||
          error.message.includes("inválido")
        ) {
          errorMessage = "Error de validación: " + error.message;
        } else if (
          error.message.includes("404") ||
          error.message.includes("no encontrado")
        ) {
          errorMessage = "Producto no encontrado";
        } else if (
          error.message.includes("500") ||
          error.message.includes("servidor")
        ) {
          errorMessage = "Error del servidor: Intente nuevamente";
        } else {
          errorMessage = error.message;
        }
      }

      uiManager.showAlert(errorMessage, "danger");
      return false;
    }
  },

  handleCancel() {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
    }

    if (this.state.selectedLenses.length > 0) {
      this.showModal(
        "¿Está seguro que desea cancelar este registro?",
        "cancelSale"
      );
    } else {
      this.resetSale();
    }
  },

  showModal(message, action) {
    const modal = document.getElementById("confirmModal");
    const messageElement = document.getElementById("modalMessage");

    if (messageElement) {
      messageElement.textContent = message;
    }

    this.currentModalAction = action;

    if (modal) {
      modal.style.display = "flex";
    }
  },

  hideModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) {
      modal.style.display = "none";
    }
  },

  confirmAction() {
    switch (this.currentModalAction) {
      case "saveSale":
        this.finalizeSale();
        break;
      case "cancelSale":
      case "newSale":
        this.resetSale();
        break;
      default:
        console.log("Acción no reconocida:", this.currentModalAction);
    }

    this.hideModal();
  },

  // ===== MÉTODOS DE UTILIDAD =====

  getStats() {
    return {
      availableLensesCount: Array.isArray(this.state.availableLenses)
        ? this.state.availableLenses.length
        : 0,
      selectedLensesCount: Array.isArray(this.state.selectedLenses)
        ? this.state.selectedLenses.length
        : 0,
      totalQuantitySelected: Array.isArray(this.state.selectedLenses)
        ? this.state.selectedLenses.reduce(
            (sum, lens) => sum + (lens.quantity || 0),
            0
          )
        : 0,
    };
  },

  validateState() {
    const issues = [];

    if (!Array.isArray(this.state.availableLenses)) {
      issues.push("availableLenses no es un array");
    }

    if (!Array.isArray(this.state.selectedLenses)) {
      issues.push("selectedLenses no es un array");
    }

    if (!Array.isArray(this.state.searchResults)) {
      issues.push("searchResults no es un array");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  },

  reset() {
    console.log("🔄 Reiniciando salesManager...");
    this.destroyBarcodeScanner(); // ✅ Limpiar escáner
    this.state = {
      availableLenses: [],
      selectedLenses: [],
      searchResults: [],
      currentSale: null,
      isEditMode: false,
      isProcessing: false,
    };
    this.resetSale();
  },

  destroy() {
    console.log('🧹 Destruyendo salesManager...');
    
    try {
      // Limpiar escáner de códigos de barras
      this.destroyBarcodeScanner();
      
      // Limpiar timeouts del escáner
      if (this.barcodeTimeout) {
        clearTimeout(this.barcodeTimeout);
        this.barcodeTimeout = null;
      }
      
      // Limpiar buffer
      this.barcodeBuffer = '';
      
      // Limpiar sincronización
      if (this.unsubscribeFromCoordinator) {
        this.unsubscribeFromCoordinator();
      }
      
      // Limpiar event listeners de sincronización
      if (eventManager) {
        eventManager.off('external:product-updated');
        eventManager.off('external:stock-updated');
      }
      
      // ✅ AGREGAR: Limpiar flag de inicialización
      this.isInitialized = false;
      
      console.log('✅ salesManager destruido correctamente');
      
    } catch (error) {
      console.error('❌ Error destruyendo salesManager:', error);
    }
  },
  // ========== ESCANEO DE CÓDIGOS DE BARRAS ==========
  
  setupBarcodeScanner() {
    console.log('📷 Configurando escáner de códigos de barras...');
    
    this.barcodeBuffer = '';
    this.barcodeTimeout = null;
    
    this.barcodeListener = (e) => {
      const activeElement = document.activeElement;
      const isTextInput = activeElement && 
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
        activeElement.id !== 'searchInput';
      
      if (isTextInput) return;
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;
      
      if (e.key === 'Enter' && this.barcodeBuffer.length > 0) {
        e.preventDefault();
        this.processBarcodeInput(this.barcodeBuffer.trim());
        this.barcodeBuffer = '';
        return;
      }
      
      if (e.key.length === 1) {
        this.barcodeBuffer += e.key;
        clearTimeout(this.barcodeTimeout);
        this.barcodeTimeout = setTimeout(() => {
          if (this.barcodeBuffer.length >= 4) {
            this.processBarcodeInput(this.barcodeBuffer.trim());
          }
          this.barcodeBuffer = '';
        }, 100);
      }
    };
    
    document.addEventListener('keydown', this.barcodeListener);
    console.log('✅ Escáner activo');
  },

  async processBarcodeInput(barcode) {
    console.log('📷 Código escaneado:', barcode);
    
    if (!barcode || barcode.length < 4) return;
    
    this.showBarcodeIndicator(barcode, 'searching');
    
    try {
      const product = await this.findProductByBarcode(barcode);
      
      if (product) {
        this.addLensToSelection(product._id);
        this.showBarcodeIndicator(barcode, 'success', product.name);
        this.playBeep('success');
      } else {
        this.showBarcodeIndicator(barcode, 'error');
        this.playBeep('error');
      }
    } catch (error) {
      console.error('Error:', error);
      this.showBarcodeIndicator(barcode, 'error');
      this.playBeep('error');
    }
  },

  async findProductByBarcode(barcode) {
    if (Array.isArray(this.state.availableLenses)) {
      const found = this.state.availableLenses.find(
        lens => lens.barcode && lens.barcode.toLowerCase() === barcode.toLowerCase()
      );
      if (found) return found;
    }
    
    return null;
  },

  showBarcodeIndicator(barcode, status, productName = '') {
    const oldIndicator = document.getElementById('barcode-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    const config = {
      searching: { icon: 'hourglass-split', color: '#3498db', text: 'Buscando...' },
      success: { icon: 'check-circle-fill', color: '#27ae60', text: productName || 'Agregado' },
      error: { icon: 'x-circle-fill', color: '#e74c3c', text: 'No encontrado' }
    }[status];
    
    const indicatorHTML = `
      <div id="barcode-indicator" style="
        position: fixed; top: 20px; right: 20px; background: white;
        border: 2px solid ${config.color}; border-radius: 8px; padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;
        display: flex; align-items: center; gap: 12px; min-width: 300px;
        animation: slideIn 0.3s ease-out;
      ">
        <i class="bi bi-${config.icon}" style="font-size: 1.5rem; color: ${config.color};"></i>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: ${config.color};">${config.text}</div>
          <div style="font-size: 0.85rem; color: #666; font-family: monospace;">${barcode}</div>
        </div>
      </div>
      <style>
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } }
      </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', indicatorHTML);
    
    setTimeout(() => {
      const indicator = document.getElementById('barcode-indicator');
      if (indicator) indicator.remove();
    }, 2000);
  },

  playBeep(type = 'success') {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = type === 'success' ? 800 : 400;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {}
  },

  destroyBarcodeScanner() {
    console.log('🔴 Intentando desactivar escáner...');
    
    // Limpiar listener
    if (this.barcodeListener) {
      document.removeEventListener('keydown', this.barcodeListener);
      this.barcodeListener = null;
      console.log('✅ Listener de escáner removido');
    }
    
    // Limpiar timeout
    if (this.barcodeTimeout) {
      clearTimeout(this.barcodeTimeout);
      this.barcodeTimeout = null;
      console.log('✅ Timeout de escáner limpiado');
    }
    
    // Limpiar buffer
    this.barcodeBuffer = '';
    
    console.log('✅ Escáner completamente desactivado');
  },
  // ========== MÉTODOS DE SINCRONIZACIÓN ==========

  setupSyncListeners() {
    console.log('🔧 SalesManager: Configurando listeners de sincronización...');

    // Suscribirse al coordinador
    if (window.syncCoordinator && typeof window.syncCoordinator.subscribe === 'function') {
      this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
        'salesManager',
        (eventType, data) => this.handleSyncEvent(eventType, data)
      );
    }

    // Escuchar actualizaciones de productos
    eventManager.on('external:product-updated', (product) => {
      this.handleProductUpdated(product);
    });

    eventManager.on('external:stock-updated', (data) => {
      this.handleStockUpdated(data);
    });
  },

  handleSyncEvent(eventType, data) {
    console.log(`🔄 SalesManager recibió evento: ${eventType}`);

    switch (eventType) {
      case 'product:updated':
        this.handleProductUpdated(data);
        break;
      case 'stock:updated':
        this.handleStockUpdated(data);
        break;
      case 'force:refresh':
        this.loadInitialData();
        break;
    }
  },

  handleProductUpdated(product) {
    if (!product || !product._id) return;

    console.log('🔄 SalesManager: Actualizando producto', product._id);

    // Actualizar en availableLenses
    if (Array.isArray(this.state.availableLenses)) {
      const index = this.state.availableLenses.findIndex(p => p._id === product._id);
      if (index !== -1) {
        this.state.availableLenses[index] = product;
        console.log('✅ Producto actualizado en availableLenses');
      }
    }

    // Actualizar en selectedLenses si está ahí
    if (Array.isArray(this.state.selectedLenses)) {
      const selectedIndex = this.state.selectedLenses.findIndex(p => p._id === product._id);
      if (selectedIndex !== -1) {
        const currentQuantity = this.state.selectedLenses[selectedIndex].quantity;
        this.state.selectedLenses[selectedIndex] = {
          ...product,
          quantity: currentQuantity
        };
        this.renderSelectedLenses();
        console.log('✅ Producto actualizado en selectedLenses');
      }
    }

    // Re-renderizar resultados de búsqueda si el producto está visible
    if (Array.isArray(this.state.searchResults)) {
      const searchIndex = this.state.searchResults.findIndex(p => p._id === product._id);
      if (searchIndex !== -1) {
        this.state.searchResults[searchIndex] = product;
        this.renderSearchResults();
      }
    }
  },

  handleStockUpdated(data) {
    console.log('📦 SalesManager: Stock actualizado', data.productId);

    if (data.product) {
      this.handleProductUpdated(data.product);
    } else if (data.productId && data.newStock !== undefined) {
      // Actualizar solo el stock
      const updateStockInArray = (array) => {
        const index = array.findIndex(p => p._id === data.productId);
        if (index !== -1) {
          array[index].stock = data.newStock;
          if (data.stock_surtido !== undefined) {
            array[index].stock_surtido = data.stock_surtido;
          }
          return true;
        }
        return false;
      };

      updateStockInArray(this.state.availableLenses);
      if (updateStockInArray(this.state.selectedLenses)) {
        this.renderSelectedLenses();
      }
      if (updateStockInArray(this.state.searchResults)) {
        this.renderSearchResults();
      }
    }
  }
};
salesManager.state.requiresFactura = false;
salesManager.state.facturaData = null;

// 2. SOBRESCRIBIR handleSave para preguntar si necesita factura
const originalHandleSave = salesManager.handleSave;
salesManager.handleSave = function() {
  if (!Array.isArray(this.state.selectedLenses)) {
    this.state.selectedLenses = [];
  }

  if (this.state.selectedLenses.length === 0) {
    uiManager.showAlert("No hay productos seleccionados para guardar", "warning");
    return;
  }

  // MOSTRAR MODAL DE DECISIÓN
  this.showFacturaModal();
};

// 3. MODAL DE DECISIÓN
salesManager.showFacturaModal = function() {
  const existingModal = document.getElementById('factura-decision-modal');
  if (existingModal) {
    existingModal.style.display = 'flex';
    return;
  }

  // Crear modal si no existe
  const modalHTML = `
    <div class="modal" id="factura-decision-modal" style="display: flex;">
      <div class="modal-content" style="max-width: 500px; padding: 30px;">
        <h3 class="modal-title" style="text-align: center; margin-bottom: 20px;">
          <i class="bi bi-receipt"></i> Confirmar Salida
        </h3>
        <p style="text-align: center; font-size: 1.1rem; margin-bottom: 30px;">
          ¿Esta salida requiere factura?
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn btn-primary" onclick="salesManager.procesarSalidaConFactura()" style="width: 100%; padding: 12px;">
            <i class="bi bi-receipt-cutoff me-2"></i>Sí, generar factura
          </button>
          <button class="btn btn-secondary" onclick="salesManager.procesarSalidaSinFactura()" style="width: 100%; padding: 12px;">
            <i class="bi bi-x-circle me-2"></i>No, solo registrar salida
          </button>
          <button class="btn btn-outline-secondary" onclick="salesManager.hideFacturaModal()" style="width: 100%; padding: 12px;">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

salesManager.hideFacturaModal = function() {
  const modal = document.getElementById('factura-decision-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// 4. PROCESAR SALIDA SIN FACTURA
salesManager.procesarSalidaSinFactura = async function() {
  this.hideFacturaModal();
  this.state.requiresFactura = false;
  await this.finalizeSale();
};

// 5. PROCESAR SALIDA CON FACTURA
salesManager.procesarSalidaConFactura = function() {
  this.hideFacturaModal();
  this.state.requiresFactura = true;
  this.mostrarFormularioFactura();
};

// 6. MOSTRAR FORMULARIO DE FACTURA (SIMPLIFICADO)
salesManager.mostrarFormularioFactura = function() {
  // Calcular total simple (sin IVA)
  const total = this.state.selectedLenses.reduce((sum, lens) => {
    const precio = parseFloat(lens.precioUnitario) || 0;
    return sum + (precio * lens.quantity);
  }, 0);

  // Generar HTML de productos
  const productosHTML = this.state.selectedLenses.map(lens => {
    const specsText = formatLensSpecs(lens);
    return `
      <div class="precio-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 10px;">
        <div style="flex: 1;">
          <strong>${lens.name || 'Producto sin nombre'}</strong>
          ${specsText ? `<br><small style="color: #6c757d;">${specsText}</small>` : ''}
          <br><small style="color: #495057;">Cantidad: ${lens.quantity}</small>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 600;">$</span>
          <input 
            type="number" 
            class="form-control precio-input" 
            placeholder="Precio"
            data-lens-id="${lens._id}"
            value="${lens.precioUnitario || 0}"
            min="0"
            step="1000"
            style="width: 120px; text-align: right;"
            onchange="salesManager.actualizarTotales()"
          >
        </div>
      </div>
    `;
  }).join('');

  const modalHTML = `
    <div class="modal" id="factura-form-modal" style="display: flex; z-index: 1000;">
      <div class="modal-content" style="max-width: 700px; max-height: 90vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 2px solid #e9ecef; background: #f8f9fa;">
          <h3 style="margin: 0;">
            <i class="bi bi-file-text"></i> Datos de la Factura
          </h3>
          <button class="btn-close" onclick="salesManager.hideFormularioFactura()"></button>
        </div>
        
        <!-- Body (scrollable) -->
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
          
          <!-- Cliente -->
          <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h5 style="margin-bottom: 15px; color: #495057;">
              <i class="bi bi-person"></i> Información del Cliente
            </h5>
            <div>
              <label style="font-weight: 600; margin-bottom: 6px; display: block;">
                Nombre del Cliente <span style="color: #e74c3c;">*</span>
              </label>
              <input 
                type="text" 
                id="factura-cliente-nombre" 
                class="form-control" 
                placeholder="Nombre completo del cliente"
                required
              >
            </div>
          </div>
          
          <!-- Productos con precios -->
          <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h5 style="margin-bottom: 15px; color: #495057;">
              <i class="bi bi-box"></i> Productos y Precios
            </h5>
            <div id="factura-productos-precios">
              ${productosHTML}
            </div>
          </div>
          
          <!-- Totales -->
          <div style="padding: 15px; background: white; border-radius: 8px; border: 2px solid #e9ecef;">
            <h5 style="margin-bottom: 15px; color: #495057;">
              <i class="bi bi-calculator"></i> Total
            </h5>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 1.3rem; font-weight: 700; color: #3498db; border-top: 2px solid #2c3e50;">
              <span>TOTAL:</span>
              <span id="factura-total">$${total.toLocaleString('es-CO')}</span>
            </div>
          </div>
          
          <!-- Observaciones -->
          <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h5 style="margin-bottom: 15px; color: #495057;">
              <i class="bi bi-chat-text"></i> Observaciones (Opcional)
            </h5>
            <textarea 
              id="factura-observaciones" 
              class="form-control" 
              rows="3" 
              placeholder="Observaciones adicionales..."
            ></textarea>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid #e9ecef; background: #f8f9fa;">
          <button class="btn btn-secondary" onclick="salesManager.hideFormularioFactura()">
            Cancelar
          </button>
          <button class="btn btn-primary" onclick="salesManager.crearFactura()">
            <i class="bi bi-check-circle"></i> Generar Factura
          </button>
        </div>
        
      </div>
    </div>
  `;

  // Eliminar modal anterior si existe
  const oldModal = document.getElementById('factura-form-modal');
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Copiar precios actuales a los inputs
  this.state.selectedLenses.forEach(lens => {
    lens.precioUnitario = lens.precioUnitario || 0;
  });
};

salesManager.hideFormularioFactura = function() {
  const modal = document.getElementById('factura-form-modal');
  if (modal) {
    modal.remove();
  }
};

// 7. ACTUALIZAR TOTALES EN TIEMPO REAL
salesManager.actualizarTotales = function() {
  const inputs = document.querySelectorAll('.precio-input');
  let total = 0;

  inputs.forEach(input => {
    const lensId = input.dataset.lensId;
    const precio = parseFloat(input.value) || 0;
    
    // Actualizar en el estado
    const lens = this.state.selectedLenses.find(l => l._id === lensId);
    if (lens) {
      lens.precioUnitario = precio;
      total += precio * lens.quantity;
    }
  });

  // Actualizar vista
  const totalElement = document.getElementById('factura-total');
  if (totalElement) {
    totalElement.textContent = `$${total.toLocaleString('es-CO')}`;
  }
};

// 8. CREAR FACTURA (SIMPLIFICADO - SIN IVA)
// 8. CREAR FACTURA (SIMPLIFICADO - SIN IVA)
salesManager.crearFactura = async function() {
  try {
    console.log('💰 Creando factura...');

    // Validar nombre del cliente
    const clienteNombre = document.getElementById('factura-cliente-nombre')?.value.trim();
    if (!clienteNombre) {
      uiManager.showAlert('El nombre del cliente es obligatorio', 'warning');
      return;
    }

    // Obtener observaciones
    const observaciones = document.getElementById('factura-observaciones')?.value.trim() || '';

    // Actualizar precios desde los inputs
    const inputs = document.querySelectorAll('.precio-input');
    inputs.forEach(input => {
      const lensId = input.dataset.lensId;
      const precio = parseFloat(input.value) || 0;
      const lens = this.state.selectedLenses.find(l => l._id === lensId);
      if (lens) {
        lens.precioUnitario = precio;
      }
    });

    // Preparar productos
    const productos = this.state.selectedLenses.map(lens => ({
      productId: lens._id,
      nombre: lens.name || 'Producto sin nombre',
      descripcion: formatLensSpecs(lens),
      esfera: lens.sphere,
      cilindro: lens.cylinder,
      adicion: lens.addition,
      cantidad: lens.quantity,
      precioUnitario: parseFloat(lens.precioUnitario) || 0,
      // ✅ AGREGAR: Calcular subtotal por producto
      subtotal: (parseFloat(lens.precioUnitario) || 0) * lens.quantity
    }));

    // Validar precios
    const sinPrecio = productos.filter(p => p.precioUnitario === 0);
    if (sinPrecio.length > 0) {
      uiManager.showAlert('Todos los productos deben tener un precio', 'warning');
      return;
    }

    // ✅ CORRECCIÓN: Calcular total SIN IVA
    const total = productos.reduce((sum, p) => sum + p.subtotal, 0);

    console.log('📋 Datos de factura:', { clienteNombre, productos, total });

    // Crear factura usando window.api
    const facturaData = {
      cliente: {
        nombre: clienteNombre
      },
      productos,
      subtotal: total,      // ✅ Subtotal = Total
      iva: 0,               // ✅ IVA = 0
      total: total,         // ✅ Total = Subtotal
      observaciones,
      salidaId: 'sale-' + Date.now()
    };

    console.log('📤 Enviando factura al backend...');
    const response = await window.api.createFactura(facturaData);

    console.log('✅ Respuesta del backend:', response);

    if (response.success || response.factura) {
      const factura = response.factura || response;
      this.state.facturaData = factura;
      
      // Cerrar formulario
      this.hideFormularioFactura();
      
      // Procesar salida de inventario
      await this.finalizeSale();
      
      // Mostrar vista previa
      this.mostrarVistaPrevia(factura);
      
      uiManager.showAlert('Factura generada correctamente', 'success');
    } else {
      throw new Error(response.message || 'Error al crear factura');
    }

  } catch (error) {
    console.error('💥 Error creando factura:', error);
    uiManager.showAlert('Error al crear la factura: ' + error.message, 'danger');
  }
};

// 9. VISTA PREVIA DE FACTURA
salesManager.mostrarVistaPrevia = function(factura) {
  const fecha = new Date(factura.fechaEmision);
  const fechaStr = fecha.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const horaStr = fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  // ✅ CLAVE: Generar HTML de la factura SIN el modal
  const facturaHTML = `
    <div class="factura-tirilla" id="factura-para-imprimir" style="
      width: 80mm;
      max-width: 80mm;
      background: white;
      padding: 3mm;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      margin: 0 auto;
      display: none;
    ">
      
      <!-- LOGO -->
      <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
        <div style="
          width: 80px;
          height: 80px;
          border: 2px solid #000;
          margin: 0 auto 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 10px;
        ">
          Distribuidora<br>MAXI BISEL
        </div>
      </div>
      
      <!-- NÚMERO DE FACTURA -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
          FACTURA DE VENTA
        </div>
        <div style="font-weight: bold; font-size: 13px;">
          No. ${factura.numeroFactura}
        </div>
      </div>
      
      <!-- FECHA Y HORA -->
      <div style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #000;">
        <div style="font-size: 11px;">
          ${fechaStr} - ${horaStr}
        </div>
      </div>
      
      <!-- DATOS DE LA EMPRESA -->
      <div style="text-align: center; margin-bottom: 10px; font-size: 11px;">
        <div style="font-weight: bold; margin-bottom: 3px;">
          ${factura.empresa.nombre}
        </div>
        <div>NIT: ${factura.empresa.nit}</div>
        <div>${factura.empresa.direccion}</div>
        <div>Tel: ${factura.empresa.telefono}</div>
      </div>
      
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      
      <!-- CLIENTE -->
      <div style="margin-bottom: 10px; font-size: 11px;">
        <div style="font-weight: bold; margin-bottom: 3px;">CLIENTE:</div>
        <div>${factura.cliente.nombre}</div>
      </div>
      
      <div style="border-top: 2px solid #000; margin: 8px 0;"></div>
      
      <!-- PRODUCTOS -->
      <div style="margin-bottom: 10px;">
        <div style="
          display: grid;
          grid-template-columns: 30px 1fr 60px;
          gap: 4px;
          font-weight: bold;
          font-size: 10px;
          padding-bottom: 4px;
          border-bottom: 1px solid #000;
          margin-bottom: 6px;
        ">
          <div style="text-align: center;">Cant</div>
          <div>Producto</div>
          <div style="text-align: right;">Total</div>
        </div>
        
        ${factura.productos.map(prod => `
          <div style="margin-bottom: 8px; font-size: 11px;">
            <div style="display: grid; grid-template-columns: 30px 1fr 60px; gap: 4px;">
              <div style="text-align: center;">${prod.cantidad}</div>
              <div style="font-weight: bold;">${prod.nombre}</div>
              <div style="text-align: right; font-weight: bold;">$${prod.subtotal.toLocaleString('es-CO')}</div>
            </div>
            ${prod.descripcion ? `
              <div style="font-size: 9px; color: #333; margin-left: 34px; margin-top: 2px;">
                ${prod.descripcion}
              </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 30px 1fr 60px; gap: 4px; font-size: 10px; color: #555; margin-top: 2px;">
              <div></div>
              <div>@ $${prod.precioUnitario.toLocaleString('es-CO')}</div>
              <div></div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="border-top: 2px solid #000; margin: 8px 0;"></div>
      
      <!-- TOTALES -->
      <div style="font-size: 12px; margin-bottom: 10px;">
        <div style="
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          padding-top: 8px;
        ">
          <div>TOTAL:</div>
          <div>$${factura.total.toLocaleString('es-CO')}</div>
        </div>
      </div>
      
      ${factura.observaciones ? `
        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
        <div style="margin-bottom: 10px; font-size: 10px;">
          <div style="font-weight: bold; margin-bottom: 3px;">OBSERVACIONES:</div>
          <div>${factura.observaciones}</div>
        </div>
      ` : ''}
      
      <div style="border-top: 2px dashed #000; margin: 8px 0;"></div>
      
      <!-- PIE DE PÁGINA -->
      <div style="text-align: center; font-size: 10px; margin-top: 10px;">
        <div style="margin-bottom: 4px;">¡Gracias por su compra!</div>
      </div>
      
    </div>
  `;

  // ✅ INSERTAR factura oculta en el DOM
  const oldFactura = document.getElementById('factura-para-imprimir');
  if (oldFactura) oldFactura.remove();
  document.body.insertAdjacentHTML('beforeend', facturaHTML);

  // ✅ CREAR MODAL DE VISTA PREVIA
  const modalHTML = `
    <div class="modal" id="factura-preview-modal" style="
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 1001;
      align-items: center;
      justify-content: center;
    ">
      <div class="modal-content" style="
        background: white;
        border-radius: 8px;
        max-width: 400px;
        width: 95%;
        max-height: 95vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 2px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        ">
          <h3 style="margin: 0; font-size: 1.1rem;">
            <i class="bi bi-receipt"></i> Factura - Vista Previa
          </h3>
          <button 
            class="btn-close" 
            onclick="salesManager.hideVistaPrevia()"
            style="background: none; border: none; font-size: 1.5rem; cursor: pointer;"
          >×</button>
        </div>
        
        <!-- Body con scroll -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #e9ecef;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        ">
          ${facturaHTML.replace('display: none;', 'display: block;')}
        </div>
        
        <!-- Footer -->
        <div style="
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding: 15px 20px;
          border-top: 2px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 0 0 8px 8px;
        ">
          <button 
            class="btn btn-secondary" 
            onclick="salesManager.hideVistaPrevia()"
            style="padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;"
          >
            Cerrar
          </button>
          <button 
            class="btn btn-success" 
            onclick="salesManager.imprimirFacturaPOS()"
            style="
              padding: 8px 16px;
              border-radius: 4px;
              border: none;
              background: #28a745;
              color: white;
              cursor: pointer;
            "
          >
            <i class="bi bi-printer"></i> Imprimir
          </button>
        </div>
        
      </div>
    </div>
  `;

  const oldModal = document.getElementById('factura-preview-modal');
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // ✅ AGREGAR ESTILOS DE IMPRESIÓN
  if (!document.getElementById('print-styles-factura')) {
    const printStyles = document.createElement('style');
    printStyles.id = 'print-styles-factura';
    printStyles.textContent = `
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        body * {
          visibility: hidden !important;
        }
        
        #factura-para-imprimir,
        #factura-para-imprimir * {
          visibility: visible !important;
        }
        
        #factura-para-imprimir {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 80mm !important;
          max-width: 80mm !important;
          margin: 0 !important;
          padding: 3mm !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(printStyles);
  }
};

// ✅ NUEVA FUNCIÓN: Imprimir con timing correcto
salesManager.imprimirFacturaPOS = function() {
  // Ocultar modal temporalmente
  const modal = document.getElementById('factura-preview-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Mostrar factura oculta
  const factura = document.getElementById('factura-para-imprimir');
  if (factura) {
    factura.style.display = 'block';
  }
  
  // Imprimir después de un pequeño delay
  setTimeout(() => {
    window.print();
    
    // Restaurar después de imprimir
    setTimeout(() => {
      if (factura) factura.style.display = 'none';
      if (modal) modal.style.display = 'flex';
    }, 100);
  }, 300);
};

salesManager.hideVistaPrevia = function() {
  const modal = document.getElementById('factura-preview-modal');
  if (modal) {
    modal.remove();
  }
};

// 10. HISTORIAL DE FACTURAS
salesManager.verHistorialFacturas = async function() {
  try {
    console.log('📋 Cargando historial de facturas...');
    const data = await window.api.getFacturas();
    
    const facturas = data.facturas || data || [];
    console.log('✅ Facturas cargadas:', facturas.length);
    
    this.mostrarHistorialFacturas(facturas);
  } catch (error) {
    console.error('💥 Error cargando facturas:', error);
    uiManager.showAlert('Error al cargar el historial de facturas', 'danger');
  }
};

salesManager.mostrarHistorialFacturas = function(facturas) {
  let contenidoHTML;
  
  if (facturas.length === 0) {
    contenidoHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
        <i class="bi bi-receipt" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
        <p style="font-size: 1.1rem;">No hay facturas registradas</p>
      </div>
    `;
  } else {
    // Ordenar facturas por fecha (más recientes primero)
    const facturasOrdenadas = [...facturas].sort((a, b) => 
      new Date(b.fechaEmision) - new Date(a.fechaEmision)
    );
    
    contenidoHTML = facturasOrdenadas.map(factura => {
      const fecha = new Date(factura.fechaEmision);
      const fechaStr = fecha.toLocaleDateString('es-CO');
      const horaStr = fecha.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const estadoConfig = {
        'pagada': { color: 'success', icon: 'check-circle', texto: 'PAGADA' },
        'pendiente': { color: 'warning', icon: 'clock', texto: 'PENDIENTE' },
        'anulada': { color: 'danger', icon: 'x-circle', texto: 'ANULADA' }
      };
      
      const config = estadoConfig[factura.estado] || estadoConfig['pendiente'];
      
      return `
        <div style="
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
          transition: box-shadow 0.2s;
        " 
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
        onmouseout="this.style.boxShadow='none'"
        >
          <!-- Encabezado -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e9ecef;
          ">
            <h5 style="margin: 0; color: #2c3e50; font-size: 1.2rem;">
              ${factura.numeroFactura}
            </h5>
          </div>
          
          <!-- Información -->
          <div style="margin-bottom: 15px;">
            <div style="
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              font-size: 0.9rem;
            ">
              <div>
                <div style="color: #6c757d; font-size: 0.8rem; margin-bottom: 2px;">
                  Cliente
                </div>
                <div style="font-weight: 600; color: #333;">
                  ${factura.cliente.nombre}
                </div>
              </div>
              
              <div>
                <div style="color: #6c757d; font-size: 0.8rem; margin-bottom: 2px;">
                  Fecha y Hora
                </div>
                <div style="font-weight: 600; color: #333;">
                  ${fechaStr} ${horaStr}
                </div>
              </div>
              
              <div>
                <div style="color: #6c757d; font-size: 0.8rem; margin-bottom: 2px;">
                  Productos
                </div>
                <div style="font-weight: 600; color: #333;">
                  ${factura.productos.length} item${factura.productos.length !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div>
                <div style="color: #6c757d; font-size: 0.8rem; margin-bottom: 2px;">
                  Total
                </div>
                <div style="font-weight: 700; color: #3498db; font-size: 1.1rem;">
                  $${factura.total.toLocaleString('es-CO')}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Acciones -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button 
              class="btn btn-sm btn-primary" 
              onclick="salesManager.verDetalleFactura('${factura._id}')"
              style="
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
              "
            >
              <i class="bi bi-eye"></i> Ver
            </button>
            <button 
              class="btn btn-sm btn-success" 
              onclick="salesManager.reimprimirFactura('${factura._id}')"
              style="
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
              "
            >
              <i class="bi bi-printer"></i> Imprimir
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              onclick="salesManager.confirmarEliminarFactura('${factura._id}')"
              style="
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
              "
            >
              <i class="bi bi-trash3"></i> Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const modalHTML = `
    <div class="modal" id="historial-facturas-modal" style="
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    ">
      <div class="modal-content" style="
        background: white;
        border-radius: 8px;
        max-width: 900px;
        width: 95%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 2px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        ">
          <h3 style="margin: 0;">
            <i class="bi bi-clock-history"></i> Historial de Facturas
          </h3>
          <button 
            class="btn-close" 
            onclick="salesManager.hideHistorialFacturas()"
            style="background: none; border: none; font-size: 1.5rem; cursor: pointer;"
          >×</button>
        </div>
        
        <!-- Body con scroll -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8f9fa;
        ">
          ${contenidoHTML}
        </div>
        
        <!-- Footer -->
        <div style="
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding: 20px;
          border-top: 1px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 0 0 8px 8px;
        ">
          <button 
            class="btn btn-secondary" 
            onclick="salesManager.hideHistorialFacturas()"
            style="padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;"
          >
            Cerrar
          </button>
        </div>
        
      </div>
    </div>
  `;

  const oldModal = document.getElementById('historial-facturas-modal');
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// 3. REIMPRIMIR FACTURA
salesManager.reimprimirFactura = async function(facturaId) {
  try {
    console.log('🖨️ Reimprimiendo factura:', facturaId);
    const data = await window.api.getFactura(facturaId);
    const factura = data.factura || data;
    
    this.mostrarVistaPrevia(factura);
  } catch (error) {
    console.error('💥 Error reimprimiendo factura:', error);
    uiManager.showAlert('Error al cargar la factura', 'danger');
  }
};

// ✅ ELIMINAR FACTURA
salesManager.confirmarEliminarFactura = function(facturaId) {
  if (confirm('¿Está seguro que desea ELIMINAR esta factura?\n\nEsta acción no se puede deshacer.')) {
    this.eliminarFactura(facturaId);
  }
};

salesManager.eliminarFactura = async function(facturaId) {
  try {
    console.log('🗑️ Eliminando factura:', facturaId);
    
    // ✅ Si tu backend tiene un endpoint DELETE, úsalo:
    const response = await window.api.deleteFactura(facturaId);
    
    // Si no tienes endpoint DELETE, puedes usar el de anular:
    // const response = await window.api.anularFactura(facturaId);
    
    if (response.success) {
      uiManager.showAlert('Factura eliminada correctamente', 'success');
      
      // Recargar historial
      this.hideHistorialFacturas();
      setTimeout(() => {
        this.verHistorialFacturas();
      }, 500);
    } else {
      throw new Error(response.message || 'Error al eliminar factura');
    }
  } catch (error) {
    console.error('💥 Error eliminando factura:', error);
    uiManager.showAlert('Error al eliminar la factura: ' + error.message, 'danger');
  }
};

salesManager.hideHistorialFacturas = function() {
  const modal = document.getElementById('historial-facturas-modal');
  if (modal) {
    modal.remove();
  }
};

salesManager.verDetalleFactura = async function(facturaId) {
  try {
    console.log('📄 Cargando factura:', facturaId);
    const data = await window.api.getFactura(facturaId);
    const factura = data.factura || data;
    
    this.hideHistorialFacturas();
    this.mostrarVistaPrevia(factura);
  } catch (error) {
    console.error('💥 Error cargando factura:', error);
    uiManager.showAlert('Error al cargar la factura', 'danger');
  }
};