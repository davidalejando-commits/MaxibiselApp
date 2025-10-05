// Gestión de ventas - CON SINCRONIZACIÓN CORREGIDA
import { dataSync } from "./dataSync.js";
import { eventManager } from "./eventManager.js";
import { syncHelper } from "./sync-helper.js";
import { uiManager } from "./ui.js";

export const sales = {
  sales: [],
  viewName: "salesManager",

  init() {
    console.log("🔧 Inicializando salesManager...");

    // Suscribirse a cambios con validaciones
    if (dataSync && typeof dataSync.subscribe === "function") {
      dataSync.subscribe(
        this.viewName,
        "sales",
        this.handleDataChange.bind(this)
      );
      dataSync.subscribe(
        this.viewName,
        "products",
        this.handleProductChange.bind(this)
      );
    } else {
      console.warn("⚠️ dataSync.subscribe no disponible");
    }

    // Configurar eventos...
    this.setupEventListeners();

    // Cargar datos
    this.loadSales();
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

// Funciones helper para formatear campos de lentes - SIMPLIFICADAS
function formatLensField(label, value) {
  if (
    !value ||
    value === "N/A" ||
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }
  return `${label}: ${value}`;
}

function createInfoLine(fields) {
  const validFields = fields.filter((field) => field !== "");
  return validFields.length > 0 ? `<p>${validFields.join(" | ")}</p>` : "";
}

function getLensTitle(name) {
  if (!name || name.trim() === "" || name === "Sin nombre") {
    return "";
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
    isEditMode: false,
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
    this.renderView();
    this.attachEventListeners();
    // Cargar datos iniciales
    this.loadInitialData();
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
      <button class="action-btn save-btn" id="saveButton">Registrar salida</button>
      <button class="action-btn cancel-btn" id="cancelButton">Cancelar</button>
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
    document
      .getElementById("new-sale-btn")
      .addEventListener("click", () => this.handleNewSale());
    document
      .getElementById("searchInput")
      .addEventListener("input", (e) => this.handleSearch(e));
    document
      .getElementById("saveButton")
      .addEventListener("click", () => this.handleSave());
    document
      .getElementById("cancelButton")
      .addEventListener("click", () => this.handleCancel());
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
  },

  handleNewSale() {
    // ✅ VALIDACIÓN: Asegurar que selectedLenses sea un array
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
    }

    if (this.state.selectedLenses.length > 0) {
      this.showModal(
        "Tiene una lista en progreso. ¿Desea descartarla y comenzar una nueva?",
        "newSale"
      );
    } else {
      this.resetSale();
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

    // ✅ CORRECCIÓN: Usar this.sortLensesById
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
        const sphereField = formatLensField("Esfera", lens.sphere);
        const cylinderField = formatLensField("Cilindro", lens.cylinder);
        const additionField = formatLensField("Adición", lens.addition);

        const specsLine = createInfoLine([
          sphereField,
          cylinderField,
          additionField,
        ]);
        const titleHTML = getLensTitle(lens.name);

        return `
                <div class="lens-item" data-id="${lens._id}">
                    <div class="lens-details">
                        ${titleHTML}
                        ${specsLine}
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
      this.state.selectedLenses.push({
        ...selectedLens,
        quantity: 1,
      });
    }

    // ✅ CORRECCIÓN: Usar this.sortLensesById
    this.sortLensesById(this.state.selectedLenses);
    this.renderSelectedLenses();
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

    const selectedHTML = this.state.selectedLenses
      .map((lens) => {
        const sphereField = formatLensField("Esfera", lens.sphere);
        const cylinderField = formatLensField("Cilindro", lens.cylinder);
        const additionField = formatLensField("Adición", lens.addition);

        const specsLine = createInfoLine([
          sphereField,
          cylinderField,
          additionField,
        ]);
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
      const updateResult = await this.updateInventoryIntelligently();

      if (updateResult) {
        uiManager.showAlert("Registro exitoso", "success");
        this.resetSale();
        return true;
      } else {
        throw new Error("No se pudo actualizar el inventario");
      }
    } catch (error) {
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

        console.log(
          `✅ Inventario actualizado y sincronizado para ${productName}`
        );
      }

      // Recargar datos locales
      await this.loadInitialData();

      console.log("✅ Actualización inteligente de inventario completada");
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
    this.state = {
      availableLenses: [],
      selectedLenses: [],
      searchResults: [],
      currentSale: null,
      isEditMode: false,
    };
    this.resetSale();
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
