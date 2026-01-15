// Gestión de ventas - CON SINCRONIZACIÓN CORREGIDA
import { activityLogger } from './activityLogger.js';
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
          <h3 class="modal-title">
            <i class="bi bi-exclamation-triangle-fill" style="color: #e74c3c; margin-right: 8px;"></i>
            Confirmar Acción
          </h3>
          <p class="modal-message" id="modalMessage">
            ¿Está seguro que desea continuar con esta acción?
          </p>
          <div class="modal-buttons">
            <button class="modal-btn confirm-btn" id="confirmButton">
              <i class="bi bi-check-circle"></i>
              Confirmar
            </button>
            <button class="modal-btn cancel-modal-btn" id="cancelModalButton">
              <i class="bi bi-x-circle"></i>
              Cancelar
            </button>
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
    this.showProcessingLoader(true);
    
    const updateResult = await this.updateInventoryIntelligently();

    if (updateResult) {
      // ✅ CALCULAR TOTALES
      const totalProductsUpdated = this.state.selectedLenses.reduce(
        (sum, lens) => sum + (lens.quantity || 0),
        0
      );

      // ✅ CREAR DESCRIPCIÓN DETALLADA DE PRODUCTOS
      const productosDetalle = this.state.selectedLenses.map(lens => {
        const specs = this.formatLensSpecsForLog(lens);
        return {
          nombre: lens.name || 'Producto sin nombre',
          cantidad: lens.quantity,
          especificaciones: specs,
          id: lens._id
        };
      });

      // ✅ CREAR RESUMEN LEGIBLE
      const resumenProductos = productosDetalle.map(p => 
        `${p.nombre} ${p.especificaciones ? `(${p.especificaciones})` : ''} x${p.cantidad}`
      ).join(', ');

      // ✅ LOG ENRIQUECIDO CON TODA LA INFORMACIÓN
      activityLogger.log({
        tipo: 'SALIDA',
        accion: 'Salida registrada',
        entidad: 'Salida',
        datos_nuevos: {
          productos_count: this.state.selectedLenses.length,
          cantidad_total: totalProductsUpdated,
          modo_bodega: this.state.useWarehouseStock,
          productos_detalle: this.state.selectedLenses.map(lens => ({
            id: lens._id,
            nombre: lens.name,
            cantidad: lens.quantity,
            especificaciones: formatLensSpecs(lens)
            }))
        }
      });
      
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
    this.showProcessingLoader(false);
    console.error("Error al finalizar el registro:", error);
    uiManager.showAlert(
      "Error al realizar los cambios: " + error.message,
      "danger"
    );
    return false;
  }
},

formatLensSpecsForLog(lens) {
  if (!lens) return "";
  
  const parts = [];
  
  // Agregar esfera si existe
  if (lens.sphere && lens.sphere !== "N/A" && lens.sphere !== "" && lens.sphere !== "N") {
    parts.push(`Esf: ${lens.sphere}`);
  }
  
  // Agregar cilindro si existe
  if (lens.cylinder && lens.cylinder !== "N/A" && lens.cylinder !== "" && lens.cylinder !== "-") {
    parts.push(`Cil: ${lens.cylinder}`);
  }
  
  // Agregar adición si existe
  if (lens.addition && lens.addition !== "N/A" && lens.addition !== "" && lens.addition !== "-") {
    parts.push(`Add: ${lens.addition}`);
  }
  
  return parts.length > 0 ? parts.join(", ") : "";
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
      modal.classList.add('show');
      modal.style.display = "flex";
    }
  },

  hideModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) {
      modal.classList.remove('show');
      // Pequeño delay para que la animación se complete
      setTimeout(() => {
        modal.style.display = "none";
      }, 300);
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
  console.log('📷 Código escaneado (original):', barcode);
  
  if (!barcode || barcode.length < 4) return;

  // ✅ NORMALIZACIÓN MEJORADA: Usar función centralizada
  const barcodeNormalizado = this.normalizarCodigoBarras(barcode);
  console.log('📷 Código normalizado:', barcodeNormalizado);
  
  this.showBarcodeIndicator(barcodeNormalizado, 'searching');
  
  try {
    const product = await this.findProductByBarcode(barcodeNormalizado);
    
    if (product) {
      console.log('✅ Producto encontrado:', product.name, 'ID:', product._id);
      this.addLensToSelection(product._id);
      this.showBarcodeIndicator(barcodeNormalizado, 'success', product.name);
      this.playBeep('success');
    } else {
      console.log('❌ Producto NO encontrado');
      this.showBarcodeIndicator(barcodeNormalizado, 'error');
      this.playBeep('error');
    }
  } catch (error) {
    console.error('💥 Error procesando código:', error);
    this.showBarcodeIndicator(barcodeNormalizado, 'error');
    this.playBeep('error');
  }
},

// ✅ NUEVA FUNCIÓN: Normalizar códigos de barras
normalizarCodigoBarras(barcode) {
  if (!barcode) return '';
  
  let codigo = String(barcode);
  codigo = codigo.trim();
  
  // ✅ El escáner lee ' en lugar de -
  codigo = codigo.replace(/'/g, '-');
  
  // ✅ El escáner lee ¡ en lugar de +
  codigo = codigo.replace(/¡/g, '+');
  
  codigo = codigo.toLowerCase();
  codigo = codigo.replace(/\s+/g, '');
  
  return codigo;
},

async findProductByBarcode(barcode) {
  const normalizedBarcode = this.normalizarCodigoBarras(barcode);
  console.log('🔍 Buscando código normalizado:', normalizedBarcode);
  
  if (!Array.isArray(this.state.availableLenses)) {
    console.error('❌ availableLenses no es un array');
    return null;
  }
  
  if (this.state.availableLenses.length === 0) {
    console.warn('⚠️ No hay productos cargados');
    return null;
  }
  
  const found = this.state.availableLenses.find(lens => {
    if (!lens || !lens.barcode) return false;
    
    const productBarcode = this.normalizarCodigoBarras(lens.barcode);
    const match = productBarcode === normalizedBarcode;
    
    if (match) {
      console.log('✅ MATCH encontrado:', {
        productoNombre: lens.name,
        codigoBuscado: normalizedBarcode,
        codigoProducto: productBarcode,
        codigoOriginal: lens.barcode
      });
    }
    
    return match;
  });
  
  if (found) {
    console.log('✅ Producto encontrado:', found.name);
  } else {
    console.log('❌ Producto no encontrado');
    console.log('📊 Total productos:', this.state.availableLenses.length);
    console.log('📊 Con código:', this.state.availableLenses.filter(l => l.barcode).length);
    
    // Mostrar muestra de códigos
    const muestra = this.state.availableLenses
      .filter(l => l.barcode)
      .slice(0, 5)
      .map(l => ({
        nombre: l.name,
        original: l.barcode,
        normalizado: this.normalizarCodigoBarras(l.barcode)
      }));
    console.log('📋 Muestra de códigos:', muestra);
  }
  
  return found;
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

// 🎯 PASO 1: Inyectar estilos de impresión
salesManager.inyectarEstilosImpresion = function() {
  console.log('📄 Inyectando estilos de impresión...');
  
  // Remover estilos anteriores si existen
  const oldStyles = document.getElementById('pos-print-styles');
  if (oldStyles) oldStyles.remove();

  const styles = document.createElement('style');
  styles.id = 'pos-print-styles';
  styles.textContent = `
    /* ===== ESTILOS PARA PANTALLA (Vista Previa) ===== */
    .factura-pos-oculta {
      display: none !important;
    }

    /* Estilos para el clon de vista previa */
    #factura-preview-clone {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      background: white !important;
      padding: 25px !important;
      margin: 0 !important;
      font-family: 'Courier New', Consolas, monospace !important;
      color: #000 !important;
      border-radius: 8px !important;
    }

    #factura-preview-clone .factura-contenido {
      display: block !important;
    }

    #factura-preview-clone .pos-header {
      text-align: center;
      margin-bottom: 20px;
    }

    #factura-preview-clone .pos-logo-box {
      width: 100px;
      height: 100px;
      margin: 0 auto 15px;
      border: 3px solid #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }

    #factura-preview-clone .pos-logo-text {
      font-size: 13px;
      font-weight: bold;
      line-height: 1.3;
    }

    #factura-preview-clone .pos-empresa-nombre {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 8px;
    }

    #factura-preview-clone .pos-empresa-info {
      font-size: 13px;
      line-height: 1.6;
    }

    #factura-preview-clone .pos-linea-punteada {
      border-top: 1px dashed #000;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-linea-solida {
      border-top: 2px solid #000;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-titulo {
      text-align: center;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-titulo-principal {
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 8px;
    }

    #factura-preview-clone .pos-numero-factura {
      font-weight: bold;
      font-size: 16px;
    }

    #factura-preview-clone .pos-fecha {
      text-align: center;
      font-size: 13px;
      margin-bottom: 15px;
    }

    #factura-preview-clone .pos-cliente {
      margin: 15px 0;
      font-size: 14px;
    }

    #factura-preview-clone .pos-cliente-label {
      font-weight: bold;
    }

    #factura-preview-clone .flex-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #factura-preview-clone .pos-tabla-header {
      font-weight: bold;
      font-size: 14px;
      padding: 8px 0;
      border-bottom: 2px solid #000;
      margin-bottom: 10px;
    }

    #factura-preview-clone .pos-col-cant {
      flex: 0 0 60px;
      text-align: center;
    }

    #factura-preview-clone .pos-col-desc {
      flex: 1;
      padding: 0 15px;
    }

    #factura-preview-clone .pos-col-total {
      flex: 0 0 120px;
      text-align: right;
    }

    #factura-preview-clone .pos-producto-item {
      margin-bottom: 15px;
      font-size: 13px;
    }

    #factura-preview-clone .pos-producto-nombre {
      font-weight: bold;
      word-wrap: break-word;
      font-size: 14px;
    }

    #factura-preview-clone .pos-producto-descripcion {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
    }

    #factura-preview-clone .pos-producto-precio {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    #factura-preview-clone .pos-resumen {
      font-size: 14px;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-resumen-valor {
      font-weight: bold;
    }

    #factura-preview-clone .pos-total-container {
      padding: 15px 0;
      border-top: 3px solid #000;
      border-bottom: 3px solid #000;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-total-label,
    #factura-preview-clone .pos-total-valor {
      font-weight: bold;
      font-size: 20px;
    }

    #factura-preview-clone .pos-observaciones {
      font-size: 13px;
      margin: 15px 0;
    }

    #factura-preview-clone .pos-obs-titulo {
      font-weight: bold;
      margin-bottom: 8px;
    }

    #factura-preview-clone .pos-footer {
      text-align: center;
      margin-top: 20px;
      font-size: 13px;
    }

    #factura-preview-clone .pos-footer-mensaje {
      font-weight: bold;
      margin-bottom: 8px;
    }

    #factura-preview-clone .pos-footer-sistema {
      font-size: 11px;
    }

    /* ===== ESTILOS PARA IMPRESIÓN ===== */
    @page {
      size: letter;
      margin: 15mm;
    }

    @media print {
  body > *:not(#factura-pos-print) {
    display: none !important;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  #factura-pos-print {
    display: block !important;
    visibility: visible !important;
  }

  #factura-pos-print * {
    visibility: visible !important;
  }

  .factura-contenido {
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 15mm !important;
    margin: 0 auto !important;
    background: white !important;
    font-family: 'Courier New', Consolas, monospace !important;
    font-size: 24px !important;
    line-height: 1.4 !important;
    color: #000 !important;
    box-sizing: border-box !important;
  }

  .flex-row {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
  }

  .pos-header {
    text-align: center !important;
    margin-bottom: 8mm !important;
  }

  .pos-logo-box {
    width: 180px !important;
    height: 180px !important;
    margin: 0 auto 8mm !important;
    border: 5px solid #000 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
  }

  .pos-logo-text {
    font-size: 28px !important;
    font-weight: bold !important;
    line-height: 1.4 !important;
    text-align: center !important;
  }

  .pos-empresa-nombre {
    font-weight: bold !important;
    font-size: 32px !important;
    margin-bottom: 10px !important;
  }

  .pos-empresa-info {
    font-size: 24px !important;
    line-height: 1.5 !important;
  }

  .pos-linea-punteada {
    border-top: 2px dashed #000 !important;
    margin: 8mm 0 !important;
    height: 0 !important;
    width: 100% !important;
  }

  .pos-linea-solida {
    border-top: 3px solid #000 !important;
    margin: 8mm 0 !important;
    height: 0 !important;
    width: 100% !important;
  }

  .pos-titulo {
    text-align: center !important;
    margin: 8mm 0 !important;
  }

  .pos-titulo-principal {
    font-weight: bold !important;
    font-size: 36px !important;
    margin-bottom: 10px !important;
  }

  .pos-numero-factura {
    font-weight: bold !important;
    font-size: 32px !important;
  }

  .pos-fecha {
    text-align: center !important;
    font-size: 24px !important;
    margin-bottom: 8mm !important;
    line-height: 1.5 !important;
  }

  .pos-cliente {
    margin: 8mm 0 !important;
    font-size: 26px !important;
  }

  .pos-cliente-label {
    font-weight: bold !important;
  }

  .pos-tabla-header {
    font-weight: bold !important;
    font-size: 26px !important;
    padding: 15px 0 !important;
    border-bottom: 4px solid #000 !important;
    margin-bottom: 15px !important;
  }

  .pos-col-cant {
    flex: 0 0 100px !important;
    text-align: center !important;
  }

  .pos-col-desc {
    flex: 1 !important;
    padding: 0 20px !important;
  }

  .pos-col-total {
    flex: 0 0 200px !important;
    text-align: right !important;
  }

  .pos-producto-item {
    margin-bottom: 15px !important;
    font-size: 24px !important;
    page-break-inside: avoid !important;
  }

  .pos-producto-nombre {
    font-weight: bold !important;
    word-wrap: break-word !important;
    font-size: 26px !important;
    line-height: 1.3 !important;
  }

  .pos-producto-descripcion {
    font-size: 22px !important;
    color: #333 !important;
    margin-top: 4px !important;
    line-height: 1.3 !important;
  }

  .pos-producto-precio {
    font-size: 22px !important;
    color: #555 !important;
    margin-top: 4px !important;
  }

  .pos-resumen {
    font-size: 26px !important;
    margin: 15px 0 !important;
  }

  .pos-resumen-valor {
    font-weight: bold !important;
  }

  .pos-total-container {
    padding: 20px 0 !important;
    border-top: 5px solid #000 !important;
    border-bottom: 5px solid #000 !important;
    margin: 15px 0 !important;
    page-break-inside: avoid !important;
  }

  .pos-total-label,
  .pos-total-valor {
    font-weight: bold !important;
    font-size: 38px !important;
  }

  .pos-observaciones {
    font-size: 24px !important;
    margin: 10mm 0 !important;
  }

  .pos-obs-titulo {
    font-weight: bold !important;
    margin-bottom: 10px !important;
  }

  .pos-obs-texto {
    word-wrap: break-word !important;
    line-height: 1.4 !important;
  }

  .pos-footer {
    text-align: center !important;
    margin-top: 15mm !important;
    font-size: 24px !important;
  }

  .pos-footer-mensaje {
    font-weight: bold !important;
    margin-bottom: 10px !important;
  }

  .pos-footer-sistema {
    font-size: 20px !important;
  }

  .pos-espacio-corte {
    height: 30px !important;
  }
}
  `;

  document.head.appendChild(styles);
  console.log('✅ Estilos inyectados correctamente');
};

// 🎯 PASO 2: Generar HTML de factura
salesManager.generarHTMLFacturaPOS = function(factura) {
  console.log('🎨 Generando HTML de factura POS...');
  
  if (!factura) {
    console.error('❌ No se proporcionó factura');
    return '<div class="factura-pos-oculta">Error: No hay datos</div>';
  }

  const fecha = new Date(factura.fechaEmision);
  const fechaStr = fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const horaStr = fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const totalItems = factura.productos ? 
    factura.productos.reduce((sum, p) => sum + (p.cantidad || 0), 0) : 0;

  const html = `
    <div id="factura-pos-print" class="factura-pos-oculta">
      <div class="factura-contenido">
        <div class="pos-header">
          <div class="pos-logo-box">
            <div class="pos-logo-text">DISTRIBUIDORA</div>
            <div class="pos-logo-text">MAXI BISEL</div>
          </div>
          <div class="pos-empresa-nombre">${factura.empresa?.nombre || 'DISTRIBUIDORA MAXI BISEL'}</div>
          <div class="pos-empresa-info">
            NIT: ${factura.empresa?.nit || '000.000.000-0'}<br>
            ${factura.empresa?.direccion || 'Dirección'}<br>
            Tel: ${factura.empresa?.telefono || '000-0000000'}
          </div>
        </div>

        <div class="pos-linea-punteada"></div>

        <div class="pos-titulo">
          <div class="pos-titulo-principal">REMISIÓN</div>
          <div class="pos-numero-factura">${factura.numeroFactura || 'N/A'}</div>
        </div>

        <div class="pos-fecha">
          Fecha: ${fechaStr}<br>
          Hora: ${horaStr}
        </div>

        <div class="pos-linea-punteada"></div>

        <div class="pos-cliente">
          <span class="pos-cliente-label">CLIENTE:</span> ${factura.cliente?.nombre || 'N/A'}
        </div>

        <div class="pos-linea-solida"></div>

        <div class="flex-row pos-tabla-header">
          <div class="pos-col-cant">Cant.</div>
          <div class="pos-col-desc">Descripción</div>
          <div class="pos-col-total">Total</div>
        </div>

        <div class="pos-productos-lista">
          ${factura.productos ? factura.productos.map(prod => `
            <div class="pos-producto-item">
              <div class="flex-row">
                <div class="pos-col-cant">${prod.cantidad || 0}</div>
                <div class="pos-col-desc">
                  <div class="pos-producto-nombre">${prod.nombre || 'Producto'}</div>
                  ${prod.descripcion ? `<div class="pos-producto-descripcion">${prod.descripcion}</div>` : ''}
                  <div class="pos-producto-precio">Precio Unit.: $${(prod.precioUnitario || 0).toLocaleString('es-CO')}</div>
                </div>
                <div class="pos-col-total">$${(prod.subtotal || 0).toLocaleString('es-CO')}</div>
              </div>
            </div>
          `).join('') : '<div class="sin-productos">No hay productos</div>'}
        </div>

        <div class="pos-linea-solida"></div>

        <div class="pos-resumen">
          <div class="flex-row">
            <span>Total Items:</span>
            <span class="pos-resumen-valor">${totalItems}</span>
          </div>
        </div>

        <div class="pos-total-container">
          <div class="flex-row">
            <span class="pos-total-label">TOTAL:</span>
            <span class="pos-total-valor">$${(factura.total || 0).toLocaleString('es-CO')}</span>
          </div>
        </div>

        ${factura.observaciones ? `
          <div class="pos-linea-punteada"></div>
          <div class="pos-observaciones">
            <div class="pos-obs-titulo">OBSERVACIONES:</div>
            <div class="pos-obs-texto">${factura.observaciones}</div>
          </div>
        ` : ''}

        <div class="pos-linea-punteada"></div>

        <div class="pos-footer">
          <div class="pos-footer-mensaje">¡Gracias por su compra!</div>
          <div class="pos-footer-sistema">Software propio de Maxibisel</div>
        </div>

        <div class="pos-espacio-corte"></div>
      </div>
    </div>
  `;

  console.log('✅ HTML de factura generado');
  return html;
};

// 🎯 PASO 3: Función para imprimir
salesManager.imprimirFacturaPOS = function() {
  console.log('🖨️ Iniciando impresión...');

  // Cerrar modal
  const modal = document.getElementById('factura-preview-modal');
  if (modal) modal.style.display = 'none';

  // Preparar factura para impresión
  const factura = document.getElementById('factura-pos-print');
  if (factura) {
    factura.style.display = 'block';
    factura.style.visibility = 'visible';
    factura.style.position = 'relative';
    factura.style.left = '0';
    factura.classList.remove('factura-pos-oculta');
    console.log('✅ Factura preparada para impresión');
  }

  // Ejecutar impresión con un delay para asegurar el render
  setTimeout(() => {
    console.log('🖨️ Ejecutando window.print()...');
    window.print();
    
    // Restaurar después de imprimir
    setTimeout(() => {
      if (factura) {
        factura.style.display = 'none';
        factura.style.visibility = 'hidden';
        factura.style.position = 'absolute';
        factura.style.left = '-99999px';
        factura.classList.add('factura-pos-oculta');
      }
      if (modal) modal.style.display = 'flex';
      console.log('✅ Impresión completada, elementos restaurados');
    }, 500);
  }, 300);
};

console.log('✅ Sistema de impresión cargado');
console.log('📋 Funciones disponibles:');
console.log('   • salesManager.inyectarEstilosImpresion()');
console.log('   • salesManager.generarHTMLFacturaPOS(factura)');
console.log('   • salesManager.imprimirFacturaPOS()');

// 🎯 FUNCIÓN 6: Compatibilidad con hideVistaPrevia
salesManager.hideVistaPrevia = function() {
  this.cerrarVistaPrevia();
};

console.log('✅ Sistema de impresión POS cargado en la ubicación correcta');
console.log('   ↳ Funciones disponibles: inyectarEstilosImpresion, generarHTMLFacturaPOS, imprimirFacturaPOS');
console.log('   ↳ Diagnóstico disponible: window.diagnosticarImpresion()');


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
      
      // ✅ AGREGAR LOG DE FACTURA
        activityLogger.log({
        tipo: 'FACTURA',
        accion: `Factura ${factura.numeroFactura} generada`,
        entidad: 'Factura',
        entidad_id: factura._id || factura.numeroFactura,
        datos_nuevos: {
        numero: factura.numeroFactura,
        cliente: factura.cliente.nombre,
        total: factura.total,
        productos_count: factura.productos.length,
        productos_detalle: factura.productos.map(p => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        descripcion: p.descripcion,
        subtotal: p.subtotal
        })),
        resumen: factura.productos.map(p => 
          `${p.nombre} ${p.descripcion ? `(${p.descripcion})` : ''} x${p.cantidad} = $${p.subtotal.toLocaleString('es-CO')}`
         ).join(', ')
        }
      }); 
      
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
salesManager.limpiarVistaPreviaCompleta = function() {
  console.log('🧹 Limpiando vista previa anterior...');
  
  try {
    // Limpiar modal
    const oldModal = document.getElementById('factura-preview-modal');
    if (oldModal) {
      oldModal.remove();
      console.log('  ✓ Modal anterior eliminado');
    }

    // Limpiar factura de impresión
    const oldFacturaPrint = document.getElementById('factura-pos-print');
    if (oldFacturaPrint) {
      oldFacturaPrint.remove();
      console.log('  ✓ Factura de impresión anterior eliminada');
    }

    // Limpiar preview display
    const oldPreview = document.getElementById('factura-preview-display');
    if (oldPreview) {
      oldPreview.remove();
      console.log('  ✓ Preview anterior eliminado');
    }

    // Limpiar cualquier otro modal flotante
    const modals = document.querySelectorAll('.modal[id*="factura"]');
    modals.forEach(m => {
      if (m.id !== 'factura-decision-modal' && m.id !== 'factura-form-modal') {
        m.remove();
      }
    });

  } catch (error) {
    console.error('⚠️ Error limpiando vista previa:', error);
  }
};

// 2. GENERAR HTML DE FACTURA PARA VISTA PREVIA
salesManager.generarHTMLVistaPrevia = function(factura) {
  console.log('🎨 Generando HTML de vista previa...');
  
  if (!factura) {
    console.error('❌ Factura no proporcionada');
    return '<div>Error: No hay datos de factura</div>';
  }

  try {
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
      hour12: false
    });

    const totalItems = factura.productos ? 
      factura.productos.reduce((sum, p) => sum + (p.cantidad || 0), 0) : 0;

    return `
      <div id="factura-preview-display" style="
        width: 210mm;
        max-width: 210mm;
        padding: 18mm;
        font-family: 'Courier New', Consolas, monospace;
        font-size: 24px;
        line-height: 1.7;
        color: #000;
        background: white;
        margin: 0 auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      ">
        
        <!-- ENCABEZADO -->
        <div style="text-align: center; margin-bottom: 10mm;">
          <div style="
            width: 50mm;
            height: 50mm;
            margin: 0 auto 5mm;
            border: 4px solid #000;
            font-size: 18px;
            font-weight: bold;
            line-height: 1.4;
            text-align: center;
            padding: 4mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            <span>DISTRIBUIDORA</span>
            <span>MAXI BISEL</span>
          </div>
          
          <div style="font-weight: bold; font-size: 32px; margin-bottom: 4mm;">
            ${factura.empresa?.nombre || 'DISTRIBUIDORA MAXI BISEL'}
          </div>
          <div style="font-size: 24px; line-height: 1.8;">
            NIT: ${factura.empresa?.nit || '000.000.000-0'}<br>
            ${factura.empresa?.direccion || 'Dirección'}<br>
            Tel: ${factura.empresa?.telefono || '000-0000000'}
          </div>
        </div>

        <div style="border-top: 3px dashed #000; margin: 10mm 0;"></div>

        <!-- TIPO DOCUMENTO -->
        <div style="text-align: center; margin: 10mm 0;">
          <div style="font-weight: bold; font-size: 36px; margin-bottom: 4mm;">
            FACTURA DE VENTA
          </div>
          <div style="font-weight: bold; font-size: 32px;">
            ${factura.numeroFactura || 'N/A'}
          </div>
        </div>

        <!-- FECHA -->
        <div style="text-align: center; font-size: 24px; margin-bottom: 10mm; line-height: 1.8;">
          Fecha: ${fechaStr}<br>
          Hora: ${horaStr}
        </div>

        <div style="border-top: 3px dashed #000; margin: 10mm 0;"></div>

        <!-- CLIENTE -->
        <div style="margin: 10mm 0; font-size: 26px;">
          <div style="font-weight: bold; margin-bottom: 4mm;">CLIENTE:</div>
          <div>${factura.cliente?.nombre || 'Cliente'}</div>
        </div>

        <div style="border-top: 4px solid #000; margin: 10mm 0;"></div>

        <!-- ENCABEZADO TABLA -->
        <div style="display: flex; font-weight: bold; font-size: 26px; padding: 4mm 0; border-bottom: 4px solid #000; margin-bottom: 7mm;">
          <div style="flex: 0 0 30mm; text-align: center;">Cant.</div>
          <div style="flex: 1;">Descripción</div>
          <div style="flex: 0 0 55mm; text-align: right;">Total</div>
        </div>

        <!-- PRODUCTOS -->
        <div style="margin-bottom: 10mm;">
          ${factura.productos ? factura.productos.map(prod => `
            <div style="margin-bottom: 10mm; font-size: 24px;">
              <div style="display: flex;">
                <div style="flex: 0 0 30mm; text-align: center; font-weight: bold; font-size: 26px;">
                  ${prod.cantidad || 0}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: bold; word-wrap: break-word; font-size: 26px; line-height: 1.5;">
                    ${prod.nombre || 'Producto'}
                  </div>
                  ${prod.descripcion ? `<div style="margin-left: 0; font-size: 22px; color: #333; margin-top: 3mm; line-height: 1.5;">${prod.descripcion}</div>` : ''}
                  <div style="margin-left: 0; font-size: 22px; color: #555; margin-top: 3mm;">
                    Precio Unit.: $${(prod.precioUnitario || 0).toLocaleString('es-CO')}
                  </div>
                </div>
                <div style="flex: 0 0 55mm; text-align: right; font-weight: bold; font-size: 26px;">
                  $${(prod.subtotal || 0).toLocaleString('es-CO')}
                </div>
              </div>
            </div>
          `).join('') : '<div>No hay productos</div>'}
        </div>

        <div style="border-top: 4px solid #000; margin: 5mm 0;"></div>

        <!-- RESUMEN -->
        <div style="margin: 5mm 0; font-size: 26px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4mm;">
            <div>Total Items:</div>
            <div style="font-weight: bold;">${totalItems}</div>
          </div>
        </div>

        <!-- TOTAL -->
        <div style="margin: 5mm 0; padding: 6mm 0; border-top: 5px solid #000; border-bottom: 5px solid #000;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 38px;">
            <div>TOTAL:</div>
            <div>$${(factura.total || 0).toLocaleString('es-CO')}</div>
          </div>
        </div>

        ${factura.observaciones ? `
          <div style="border-top: 3px dashed #000; margin: 10mm 0;"></div>
          <div style="margin: 10mm 0; font-size: 24px;">
            <div style="font-weight: bold; margin-bottom: 4mm;">OBSERVACIONES:</div>
            <div style="word-wrap: break-word; line-height: 1.6;">${factura.observaciones}</div>
          </div>
        ` : ''}

        <div style="border-top: 3px dashed #000; margin: 10mm 0;"></div>

        <!-- PIE -->
        <div style="text-align: center; margin-top: 10mm; font-size: 24px; line-height: 1.7;">
          <div style="font-weight: bold; margin-bottom: 4mm;">
            ¡Gracias por su compra!
          </div>
          <div style="font-size: 20px;">
            Software propio de Maxibisel
          </div>
        </div>

        <div style="height: 12mm;"></div>

      </div>
    `;
  } catch (error) {
    console.error('❌ Error generando HTML de vista previa:', error);
    return '<div>Error al generar vista previa</div>';
  }
};

// 3. MOSTRAR VISTA PREVIA (VERSIÓN ROBUSTA)
salesManager.mostrarVistaPrevia = function(factura) {
  console.log('👁️ Mostrando vista previa...');

  if (!factura) {
    console.error('❌ No hay factura');
    uiManager.showAlert('Error: No hay datos de factura', 'danger');
    return;
  }

  try {
    // Limpiar todo
    this.limpiarVistaPreviaCompleta();

    // Inyectar estilos
    this.inyectarEstilosImpresion();

    // Generar HTML de factura para impresión
    const facturaHTML = this.generarHTMLFacturaPOS(factura);

    // Insertar factura en el DOM (oculta)
    document.body.insertAdjacentHTML('beforeend', facturaHTML);

    // Crear modal con vista previa
    const modalHTML = `
      <div class="modal" id="factura-preview-modal" style="
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        z-index: 10000;
        align-items: center;
        justify-content: center;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          max-width: 550px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        ">
          
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 2px solid #e9ecef;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px 12px 0 0;
          ">
            <h3 style="margin: 0; color: white;">
              <i class="bi bi-receipt"></i> Vista Previa - Factura ${factura.numeroFactura || 'N/A'}
            </h3>
            <button 
              onclick="salesManager.cerrarVistaPrevia()"
              style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 1.5rem;
                width: 36px;
                height: 36px;
                border-radius: 4px;
                cursor: pointer;
              ">×</button>
          </div>
          
          <div id="preview-container" style="
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #e5e5e5;
          ">
            <!-- Aquí se clonará la factura -->
          </div>
          
          <div style="
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 20px;
            border-top: 2px solid #e9ecef;
            background: #f8f9fa;
          ">
            <button 
              onclick="salesManager.cerrarVistaPrevia()"
              style="
                padding: 12px 24px;
                border-radius: 8px;
                border: 2px solid #6c757d;
                background: white;
                color: #6c757d;
                font-weight: 600;
                cursor: pointer;
              ">
              <i class="bi bi-x-circle"></i> Cerrar
            </button>
            <button 
              onclick="salesManager.imprimirFacturaPOS()"
              style="
                padding: 12px 24px;
                border-radius: 8px;
                border: none;
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                font-weight: 600;
                cursor: pointer;
              ">
              <i class="bi bi-printer-fill"></i> Imprimir
            </button>
          </div>
          
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Clonar factura en preview (con un pequeño delay para asegurar el render)
    setTimeout(() => {
      const facturaOriginal = document.getElementById('factura-pos-print');
      const previewContainer = document.getElementById('preview-container');
      
      if (facturaOriginal && previewContainer) {
        console.log('📋 Clonando factura en vista previa...');
        const clone = facturaOriginal.cloneNode(true);
        clone.id = 'factura-preview-clone';
        clone.classList.remove('factura-pos-oculta');
        clone.style.display = 'block';
        clone.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
        previewContainer.appendChild(clone);
        console.log('✅ Factura clonada exitosamente');
      } else {
        console.error('❌ No se pudo encontrar factura original o contenedor de preview');
      }
    }, 100);

    console.log('✅ Vista previa mostrada');

  } catch (error) {
    console.error('💥 Error en vista previa:', error);
    uiManager.showAlert('Error al mostrar vista previa', 'danger');
  }
};

// 4. CERRAR VISTA PREVIA (VERSIÓN MEJORADA)
salesManager.cerrarVistaPrevia = function() {
  console.log('❌ Cerrando vista previa...');
  
  try {
    const modal = document.getElementById('factura-preview-modal');
    if (modal) {
      // Animación de salida
      modal.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => {
        modal.remove();
        console.log('✓ Modal cerrado');
      }, 200);
    }
    
    // NO eliminar la factura de impresión aquí
    // La necesitamos para imprimir después
    
  } catch (error) {
    console.error('⚠️ Error cerrando vista previa:', error);
    // Forzar cierre
    const modal = document.getElementById('factura-preview-modal');
    if (modal) modal.remove();
  }
};

// 5. AGREGAR ESTILOS DE ANIMACIÓN
if (!document.getElementById('animation-styles')) {
  const animStyles = document.createElement('style');
  animStyles.id = 'animation-styles';
  animStyles.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(animStyles);
}

console.log('✅ Sistema de vista previa robusto cargado');


// 🎯 FUNCIÓN 4: Listeners de impresión
window.addEventListener('afterprint', function() {
  console.log('📋 Impresión finalizada');
  
  const factura = document.getElementById('factura-pos-print');
  if (factura) {
    factura.style.display = 'none';
    factura.style.left = '-9999px';
  }
  
  const modal = document.getElementById('factura-preview-modal');
  if (modal) modal.style.display = 'flex';
});

window.addEventListener('beforeprint', function() {
  console.log('🖨️ Iniciando proceso de impresión...');
});

// 🎯 FUNCIÓN 5: Diagnóstico
salesManager.diagnosticarImpresion = function() {
  console.log('🔍 === DIAGNÓSTICO DE IMPRESIÓN ===');
  
  const factura = document.getElementById('factura-pos-print');
  const estilos = document.getElementById('pos-print-styles');
  
  console.log('1. Factura existe:', !!factura);
  console.log('2. Estilos inyectados:', !!estilos);
  
  if (factura) {
    const computed = window.getComputedStyle(factura);
    console.log('3. Display:', computed.display);
    console.log('4. Visibility:', computed.visibility);
    console.log('5. Position:', computed.position);
    console.log('6. Left:', computed.left);
    console.log('7. Contenido length:', factura.innerHTML.length);
    console.log('8. Width:', computed.width);
  }
  
  console.log('9. Web Serial disponible:', 'serial' in navigator);
  console.log('================================');
};

// Exponer globalmente
window.diagnosticarImpresion = () => salesManager.diagnosticarImpresion();

console.log('✅ Sistema de impresión POS cargado correctamente');

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
      const fechaStr = fecha.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="log-item" style="
          background: white; 
          border: 1px solid #e9ecef; 
          border-left: 4px solid #3498db; 
          border-radius: 8px; 
          padding: 16px; 
          margin-bottom: 12px; 
          transition: all 0.2s;
        " 
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
        onmouseout="this.style.boxShadow='none'">
          
          <div style="display: flex; align-items: start; gap: 12px;">
            <!-- Ícono -->
            <div style="
              width: 40px; 
              height: 40px; 
              border-radius: 8px; 
              background: #e5f6f9; 
              color: #3498db; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              flex-shrink: 0;
            ">
              <i class="bi bi-receipt" style="font-size: 1.2rem;"></i>
            </div>

            <!-- Contenido -->
            <div style="flex: 1;">
              <!-- Header: Badge y Número -->
              <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: start; 
                margin-bottom: 4px;
              ">
                <div>
                  <span class="badge" style="
                    background: #e5f6f9; 
                    color: #3498db; 
                    font-size: 0.7rem; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    margin-right: 8px;
                  ">FACTURA</span>
                  <strong style="color: #2c3e50; font-size: 0.95rem;">${factura.numeroFactura}</strong>
                </div>
                <span style="color: #6c757d; font-size: 0.85rem; white-space: nowrap;">
                  <i class="bi bi-clock me-1"></i>${fechaStr}
                </span>
              </div>

              <!-- Info del cliente -->
              <div style="color: #6c757d; font-size: 0.9rem; margin-top: 4px;">
                <i class="bi bi-person me-1"></i>${factura.cliente.nombre}
                <span class="mx-2">•</span>
                <i class="bi bi-box-seam me-1"></i>${factura.productos.length} producto${factura.productos.length !== 1 ? 's' : ''}
              </div>

              <!-- Detalles de productos (similar a logs) -->
              ${this.generateFacturaDetallesEstiloLog(factura)}

              <!-- Botones de acción -->
              <div style="
                margin-top: 12px; 
                padding-top: 12px; 
                border-top: 1px solid #f0f0f0; 
                display: flex; 
                gap: 8px;
              ">
                <button 
                  class="btn btn-sm btn-primary" 
                  onclick="salesManager.verDetalleFactura('${factura._id}')"
                  style="
                    flex: 1;
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    font-size: 0.85rem;
                    background: #3498db;
                    color: white;
                    transition: all 0.2s;
                  "
                  onmouseover="this.style.background='#2980b9'; this.style.transform='translateY(-1px)'"
                  onmouseout="this.style.background='#3498db'; this.style.transform='translateY(0)'"
                >
                  <i class="bi bi-eye"></i> Ver
                </button>
                <button 
                  class="btn btn-sm btn-danger" 
                  onclick="salesManager.confirmarEliminarFactura('${factura._id}')"
                  style="
                    flex: 1;
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    font-size: 0.85rem;
                    background: #e74c3c;
                    color: white;
                    transition: all 0.2s;
                  "
                  onmouseover="this.style.background='#c0392b'; this.style.transform='translateY(-1px)'"
                  onmouseout="this.style.background='#e74c3c'; this.style.transform='translateY(0)'"
                >
                  <i class="bi bi-trash3"></i> Eliminar
                </button>
              </div>
            </div>
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
        border-radius: 12px;
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
          background: linear-gradient(135deg, #1582ffff 0%, #2487ffff 100%);
          border-radius: 12px 12px 0 0;
        ">
          <h3 style="margin: 0; color: white; font-size: 1.3rem; font-weight: 600;">
            <i class="bi bi-clock-history me-2"></i>Historial de Facturas
          </h3>
          <button 
            class="btn-close btn-close-white"
            onclick="salesManager.hideHistorialFacturas()"
            style="filter: brightness(0) invert(1);"
          ></button>
        </div>
        
        <!-- Body con scroll -->
        <div id="logs-container" style="
          flex: 1;
          max-height: 500px;
          overflow-y: auto;
          padding: 20px 24px;
        ">
          ${contenidoHTML}
        </div>
        
        <!-- Footer -->
        <div style="
          display: flex;
          gap: 10px;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-top: 1px solid #e9ecef;
          background: #f8f9fa;
          border-radius: 0 0 12px 12px;
        ">
          <span style="color: #6c757d; font-size: 0.9rem;">
            <i class="bi bi-info-circle me-1"></i>Total de facturas: <strong>${facturas.length}</strong>
          </span>
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

// Función auxiliar para generar detalles de factura estilo log
salesManager.generateFacturaDetallesEstiloLog = function(factura) {
  if (!factura.productos || factura.productos.length === 0) {
    return `
      <div style="
        margin-top: 12px; 
        padding: 12px; 
        background: #f0f8ff; 
        border-radius: 6px; 
        border: 1px solid #cfe2ff;
      ">
        <div style="
          display: flex; 
          justify-content: space-between; 
          font-size: 1rem;
        ">
          <strong style="color: #2c3e50;">TOTAL:</strong>
          <strong style="color: #3498db; font-size: 1.1rem;">$${factura.total.toLocaleString('es-CO')}</strong>
        </div>
      </div>
    `;
  }

  const productosHTML = factura.productos.map(prod => `
    <div style="
      background: white; 
      padding: 8px 12px; 
      border-radius: 4px; 
      border: 1px solid #cfe2ff; 
      margin-bottom: 6px;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">${prod.nombre}</div>
          ${prod.descripcion ? `<div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">${prod.descripcion}</div>` : ''}
          <div style="font-size: 0.8rem; color: #6c757d; margin-top: 4px;">Cantidad: ${prod.cantidad}</div>
        </div>
        <div style="text-align: right; white-space: nowrap; margin-left: 10px;">
          <div style="font-weight: 700; color: #3498db; font-size: 0.95rem;">$${prod.subtotal.toLocaleString('es-CO')}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div style="
      margin-top: 12px; 
      padding: 12px; 
      background: #f0f8ff; 
      border-radius: 6px; 
      border: 1px solid #cfe2ff;
    ">
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 10px; 
        padding-bottom: 8px; 
        border-bottom: 1px solid #cfe2ff;
      ">
        <strong style="color: #3498db; font-size: 0.9rem;">
          <i class="bi bi-box-seam me-1"></i>Productos (${factura.productos.length})
        </strong>
      </div>
      ${productosHTML}
      <div style="
        margin-top: 10px; 
        padding-top: 10px; 
        border-top: 2px solid #3498db; 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
      ">
        <strong style="color: #2c3e50; font-size: 1rem;">TOTAL:</strong>
        <strong style="color: #3498db; font-size: 1.1rem;">$${factura.total.toLocaleString('es-CO')}</strong>
      </div>
    </div>
  `;
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
  console.log('⚠️ Solicitando confirmación para eliminar factura:', facturaId);
  
  // Crear modal de confirmación estilizado
  const modalHTML = `
    <div class="modal" id="confirmar-eliminar-factura-modal" style="
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 10001;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    ">
      <div class="modal-content" style="
        background: white;
        border-radius: 12px;
        max-width: 450px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        overflow: hidden;
      ">
        
        <!-- Header con ícono de advertencia -->
        <div style="
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 25px;
          text-align: center;
        ">
          <div style="
            width: 60px;
            height: 60px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 2rem;
          ">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <h3 style="margin: 0; font-size: 1.5rem; font-weight: 700;">
            Confirmar Eliminación
          </h3>
        </div>
        
        <!-- Body -->
        <div style="padding: 30px; text-align: center;">
          <p style="
            font-size: 1.1rem;
            color: #2c3e50;
            line-height: 1.6;
            margin: 0 0 10px 0;
          ">
            ¿Está seguro que desea <strong style="color: #e74c3c;">ELIMINAR</strong> esta factura?
          </p>
          <p style="
            font-size: 0.95rem;
            color: #7f8c8d;
            margin: 0;
          ">
            Esta acción no se puede deshacer.
          </p>
        </div>
        
        <!-- Footer con botones -->
        <div style="
          display: flex;
          gap: 12px;
          padding: 0 30px 30px 30px;
        ">
          <button 
            id="btn-cancelar-eliminar"
            style="
              flex: 1;
              padding: 12px;
              border-radius: 8px;
              border: 2px solid #95a5a6;
              background: white;
              color: #7f8c8d;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              font-size: 1rem;
            "
            onmouseover="this.style.background='#ecf0f1'; this.style.borderColor='#7f8c8d'"
            onmouseout="this.style.background='white'; this.style.borderColor='#95a5a6'"
          >
            <i class="bi bi-x-circle me-1"></i> Cancelar
          </button>
          <button 
            id="btn-confirmar-eliminar"
            style="
              flex: 1;
              padding: 12px;
              border-radius: 8px;
              border: none;
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              color: white;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
              font-size: 1rem;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(231, 76, 60, 0.4)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(231, 76, 60, 0.3)'"
          >
            <i class="bi bi-trash3-fill me-1"></i> Eliminar
          </button>
        </div>
        
      </div>
    </div>

    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;

  // Eliminar modal anterior si existe
  const oldModal = document.getElementById('confirmar-eliminar-factura-modal');
  if (oldModal) oldModal.remove();

  // Insertar modal
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Event listeners
  document.getElementById('btn-cancelar-eliminar').onclick = () => {
    const modal = document.getElementById('confirmar-eliminar-factura-modal');
    if (modal) {
      modal.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => modal.remove(), 200);
    }
  };

  document.getElementById('btn-confirmar-eliminar').onclick = () => {
    const modal = document.getElementById('confirmar-eliminar-factura-modal');
    if (modal) modal.remove();
    this.eliminarFactura(facturaId);
  };

  // Cerrar con ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('confirmar-eliminar-factura-modal');
      if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
      }
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
};

salesManager.eliminarFactura = async function(facturaId) {
  try {
    console.log('🗑️ Eliminando factura:', facturaId);
    
    // Mostrar indicador de carga
    this.mostrarIndicadorEliminacion();
    
    // ✅ CORRECCIÓN: Solo eliminar de SQLite (local)
    const response = await window.api.deleteFactura(facturaId);
    
    console.log('📡 Respuesta del servidor:', response);
    
    if (response.success) {
      console.log('✅ Factura eliminada correctamente');
      
      // ✅ AGREGAR LOG DE ELIMINACIÓN
      if (response.factura) {
        activityLogger.log({
          tipo: 'FACTURA',
          accion: `Factura ${response.factura.numeroFactura} eliminada`,
          entidad: 'Factura',
          entidad_id: facturaId,
          datos_anteriores: {
            numero: response.factura.numeroFactura,
            cliente: response.factura.cliente?.nombre || 'N/A',
            total: response.factura.total || 0
          }
        });
      }
      
      // Ocultar indicador
      this.ocultarIndicadorEliminacion();
      
      // Mostrar alerta de éxito
      uiManager.showAlert('Factura eliminada correctamente', 'success');
      
      // ✅ CORRECCIÓN: Cerrar historial y recargar después de un breve delay
      this.hideHistorialFacturas();
      
      setTimeout(() => {
        this.verHistorialFacturas();
      }, 300);
      
    } else {
      throw new Error(response.message || 'Error al eliminar factura');
    }
    
  } catch (error) {
    console.error('💥 Error eliminando factura:', error);
    
    // Ocultar indicador
    this.ocultarIndicadorEliminacion();
    
    // Mostrar error específico
    let errorMessage = 'Error al eliminar la factura';
    
    if (error.message) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = 'Factura no encontrada';
      } else if (error.message.includes('500') || error.message.includes('servidor')) {
        errorMessage = 'Error del servidor. Intente nuevamente';
      } else {
        errorMessage = error.message;
      }
    }
    
    uiManager.showAlert(errorMessage, 'danger');
  }
};

// ✅ INDICADORES DE CARGA PARA ELIMINACIÓN
salesManager.mostrarIndicadorEliminacion = function() {
  const indicatorHTML = `
    <div id="eliminando-factura-indicator" style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      padding: 30px 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10002;
      text-align: center;
      animation: fadeIn 0.2s ease;
    ">
      <div class="spinner-border text-danger mb-3" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Eliminando...</span>
      </div>
      <p style="margin: 0; font-weight: 600; color: #2c3e50; font-size: 1.1rem;">
        Eliminando factura...
      </p>
    </div>
    
    <div id="eliminando-factura-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      animation: fadeIn 0.2s ease;
    "></div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', indicatorHTML);
};

salesManager.ocultarIndicadorEliminacion = function() {
  const indicator = document.getElementById('eliminando-factura-indicator');
  const overlay = document.getElementById('eliminando-factura-overlay');
  
  if (indicator) {
    indicator.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => indicator.remove(), 200);
  }
  
  if (overlay) {
    overlay.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  }
};

// ✅ AGREGAR ESTILOS DE ANIMACIÓN SI NO EXISTEN
if (!document.getElementById('delete-animation-styles')) {
  const deleteStyles = document.createElement('style');
  deleteStyles.id = 'delete-animation-styles';
  deleteStyles.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(deleteStyles);
}

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

console.log('✅ Sistema de impresión POS cargado correctamente');
  
};