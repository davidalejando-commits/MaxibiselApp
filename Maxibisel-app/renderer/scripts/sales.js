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
          background: linear-gradient(135deg, #000000ff 0%, #27292cff 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.95rem;
          box-shadow: 0 2px 8px rgba(38, 0, 255, 1);
          transition: all 0.3s ease;
        }
        
        .selected-counter:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(40, 21, 253, 1);
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
        <!-- Opción 1: Con imagen (reemplaza RUTA_DEL_LOGO) -->
        <img 
          src="data:image/png;base64,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" 
          alt="Logo Maxibisel" 
          style="
            width: 110px;
            height: 110px;
            margin: 0 auto 8px;
            display: block;
            object-fit: contain;
          "
          onerror="this.parentElement.innerHTML='<div style=&quot;width: 70px; height: 70px; border: 2px solid #000; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 9px;&quot;>Distribuidora<br>MAXI BISEL</div>'"
        >
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