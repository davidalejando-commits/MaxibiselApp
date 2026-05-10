import { activityLogger } from "./activityLogger.js";
import { dataSync } from "./dataSync.js";
import { eventManager } from "./eventManager.js";
import { syncHelper } from "./sync-helper.js";
import { uiManager } from "./ui.js";

export const sales = {
  sales: [],
  viewName: "salesManager",

  init() {
    if (this.isInitialized) {
      this.destroy();
    }
    this.renderView();
    this.attachEventListeners();
    this.loadInitialData();
    this.isInitialized = true;
  },

  handleDataChange({ action, data, dataType }) {
    if (dataType === "sales") {
      if (!Array.isArray(this.sales)) this.sales = [];

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

  handleProductChange({ action, data, dataType }) {},

  async loadSales() {
    try {
      let salesData;
      if (dataSync && typeof dataSync.getData === "function") {
        salesData = await dataSync.getData("sales");
      } else {
        salesData = await window.api.getSales();
      }

      if (Array.isArray(salesData)) {
        this.sales = salesData;
      } else if (salesData && Array.isArray(salesData.sales)) {
        this.sales = salesData.sales;
      } else {
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
      if (!Array.isArray(this.sales)) this.sales = [];
      this.sales.push(newSale);
      if (eventManager && typeof eventManager.emit === "function") {
        eventManager.emit("data:sale:created", newSale);
      }
      uiManager.showAlert("Venta creada correctamente", "success");
    } catch (error) {
      console.error("Error al crear venta:", error);
      uiManager.showAlert("Error al crear la venta", "danger");
    }
  },

  renderSalesTable() {},

  setupEventListeners() {},

  destroy() {
    if (dataSync && typeof dataSync.unsubscribe === "function") {
      dataSync.unsubscribe(this.viewName, "sales");
      dataSync.unsubscribe(this.viewName, "products");
    }
  },
};

function formatLensSpecs(lens) {
  if (!lens) return "";

  const isValidValue = (val) =>
    val && val !== "N/A" && val !== "" && val !== null && val !== undefined;

  const hasSphere = isValidValue(lens.sphere);
  const hasCylinder = isValidValue(lens.cylinder);
  const hasAddition = isValidValue(lens.addition);

  if (hasSphere && hasCylinder) return `${lens.sphere} ${lens.cylinder}`;
  if (hasSphere && hasAddition) return `${lens.sphere} / ${lens.addition}`;
  if (hasSphere) return lens.sphere;

  return "";
}

function getLensTitle(name) {
  if (!name || name.trim() === "" || name === "Sin nombre") return "";
  return `<h6>${name}</h6>`;
}

export const salesManager = {
  isInitialized: false,
  state: {
    availableLenses: [],
    selectedLenses: [],
    searchResults: [],
    currentSale: null,
    isEditMode: false,
    isProcessing: false,
  },

  sortLensesById(lensesArray) {
    if (!Array.isArray(lensesArray) || typeof lensesArray.sort !== "function")
      return;
    try {
      lensesArray.sort((a, b) => {
        if (!a || !a._id) return 1;
        if (!b || !b._id) return -1;
        if (a._id < b._id) return -1;
        if (a._id > b._id) return 1;
        return 0;
      });
    } catch (error) {
      console.error("Error ordenando lentes:", error);
    }
  },

  init() {
    if (this.isInitialized) {
      this.destroy();
    }
    this.renderView();
    this.attachEventListeners();
    this.loadInitialData();
    this.isInitialized = true;
  },

  async loadInitialData() {
    try {
      const productsData = await window.api.getProducts();

      if (Array.isArray(productsData)) {
        this.state.availableLenses = productsData;
      } else if (productsData && Array.isArray(productsData.products)) {
        this.state.availableLenses = productsData.products;
      } else if (productsData && Array.isArray(productsData.data)) {
        this.state.availableLenses = productsData.data;
      } else {
        this.state.availableLenses = [];
      }

      if (Array.isArray(this.state.availableLenses)) {
        this.sortLensesById(this.state.availableLenses);
      } else {
        this.state.availableLenses = [];
      }
    } catch (error) {
      console.error("Error al cargar Productos:", error);
      uiManager.showAlert("Error al cargar el catálogo de productos", "danger");
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
                .selected-counter i { font-size: 1.1rem; }
                #selectedCount { min-width: 20px; text-align: center; font-size: 1.1rem; }
                .spinner-border-sm { width: 1rem; height: 1rem; border-width: 0.15em; }
                .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            </style>
        `;
  },

  attachEventListeners() {
    document
      .getElementById("searchInput")
      .addEventListener("input", (e) => this.handleSearch(e));
    document
      .getElementById("saveButton")
      .addEventListener("click", () => this.handleSave());
    document
      .getElementById("cancelButton")
      .addEventListener("click", () => this.handleCancel());

    const historialFacturasBtn = document.getElementById(
      "ver-historial-facturas-btn",
    );
    if (historialFacturasBtn) {
      historialFacturasBtn.addEventListener("click", () =>
        this.verHistorialFacturas(),
      );
    }

    document
      .getElementById("warehouseCheckbox")
      .addEventListener("change", (e) => {
        this.state.useWarehouseStock = e.target.checked;
      });

    document
      .getElementById("confirmButton")
      .addEventListener("click", () => this.confirmAction());
    document
      .getElementById("cancelModalButton")
      .addEventListener("click", () => this.hideModal());

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

    this.setupBarcodeScanner();
  },

  _scrollToLastSelectedLens() {
    const container = document.getElementById("selectedLenses");
    if (!container) return;
    const items = container.querySelectorAll(".selected-lens[data-id]");
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    lastItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  updateSelectedCounter() {
    const countElement = document.getElementById("selectedCount");
    if (countElement && Array.isArray(this.state.selectedLenses)) {
      const totalItems = this.state.selectedLenses.reduce(
        (sum, lens) => sum + (lens.quantity || 0),
        0,
      );
      countElement.textContent = totalItems;
    }
  },

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

    const warehouseCheckbox = document.getElementById("warehouseCheckbox");
    if (warehouseCheckbox) warehouseCheckbox.checked = false;

    document.getElementById("searchInput").value = "";
    document.getElementById("searchResults").innerHTML = `
            <div class="lens-item" data-id="ejemplo-placeholder">
                <p>Busque Productos para mostrar resultados...</p>
            </div>
        `;

    this.updateSelectedCounter();
  },

  handleSearch(event) {
    const searchTerm = event.target.value.trim();

    if (!searchTerm) {
      document.getElementById("searchResults").innerHTML = `
                <div class="lens-item" data-id="ejemplo-placeholder">
                    <p>Busque productos para mostrar resultados...</p>
                </div>
            `;
      return;
    }

    if (!Array.isArray(this.state.availableLenses)) {
      this.state.availableLenses = [];
      document.getElementById("searchResults").innerHTML = `
                <div class="lens-item"><p>Error: No se pueden buscar productos</p></div>
            `;
      return;
    }

    const searchTermNormalized = this.normalizarTerminoBusqueda(searchTerm);
    const filteredLenses = this.state.availableLenses.filter((lens) =>
      this.productoCoincideConBusqueda(lens, searchTermNormalized),
    );

    this.sortLensesById(filteredLenses);
    this.state.searchResults = filteredLenses;
    this.renderSearchResults();
  },

  normalizarTerminoBusqueda(termino) {
    if (!termino) return "";
    let normalizado = String(termino).trim().toLowerCase();
    normalizado = normalizado.replace(/'/g, "-");
    normalizado = normalizado.replace(/¡/g, "+");
    return normalizado;
  },

  productoCoincideConBusqueda(lens, searchTerm) {
    if (!lens) return false;

    if (lens.barcode) {
      const barcodeNormalizado = this.normalizarCodigoBarras(lens.barcode);
      if (
        barcodeNormalizado === searchTerm ||
        barcodeNormalizado.includes(searchTerm)
      )
        return true;
    }

    if (lens.name) {
      const nombreNormalizado = lens.name.toLowerCase().trim();
      if (nombreNormalizado.includes(searchTerm)) return true;
    }

    if (lens.sphere && lens.sphere !== "N" && lens.sphere !== "N/A") {
      const esferaNormalizada = String(lens.sphere).toLowerCase().trim();
      if (
        esferaNormalizada === searchTerm ||
        esferaNormalizada.includes(searchTerm)
      )
        return true;
      const esferaSinSigno = esferaNormalizada.replace(/[+\-]/g, "");
      const terminoSinSigno = searchTerm.replace(/[+\-]/g, "");
      if (esferaSinSigno === terminoSinSigno) return true;
    }

    if (lens.cylinder && lens.cylinder !== "-" && lens.cylinder !== "N/A") {
      const cilindroNormalizado = String(lens.cylinder).toLowerCase().trim();
      if (
        cilindroNormalizado === searchTerm ||
        cilindroNormalizado.includes(searchTerm)
      )
        return true;
      const cilindroSinSigno = cilindroNormalizado.replace(/[+\-]/g, "");
      const terminoSinSigno = searchTerm.replace(/[+\-]/g, "");
      if (cilindroSinSigno === terminoSinSigno) return true;
    }

    if (lens.addition && lens.addition !== "-" && lens.addition !== "N/A") {
      const adicionNormalizada = String(lens.addition).toLowerCase().trim();
      if (
        adicionNormalizada === searchTerm ||
        adicionNormalizada.includes(searchTerm)
      )
        return true;
      const adicionSinSigno = adicionNormalizada.replace(/[+\-]/g, "");
      const terminoSinSigno = searchTerm.replace(/[+\-]/g, "");
      if (adicionSinSigno === terminoSinSigno) return true;
    }

    return false;
  },

  renderSearchResults() {
    const resultsContainer = document.getElementById("searchResults");

    if (!Array.isArray(this.state.searchResults)) this.state.searchResults = [];

    if (this.state.searchResults.length === 0) {
      resultsContainer.innerHTML = `
                <div class="lens-item"><p>No se encontraron resultados</p></div>
            `;
      return;
    }

    resultsContainer.innerHTML = this.state.searchResults
      .map((lens) => {
        const specsText = formatLensSpecs(lens);
        const titleHTML = getLensTitle(lens.name);
        return `
                <div class="lens-item" data-id="${lens._id}">
                    <div class="lens-details">
                        ${titleHTML}
                        ${specsText ? `<p>${specsText}</p>` : ""}
                    </div>
                </div>
            `;
      })
      .join("");
  },

  addLensToSelection(lensId) {
    if (!Array.isArray(this.state.availableLenses)) return;

    const selectedLens = this.state.availableLenses.find(
      (lens) => lens._id === lensId,
    );
    if (!selectedLens) return;

    if (!Array.isArray(this.state.selectedLenses))
      this.state.selectedLenses = [];

    const existingIndex = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId,
    );

    if (existingIndex >= 0) {
      this.state.selectedLenses[existingIndex].quantity += 1;
    } else {
      this.state.selectedLenses.push({ ...selectedLens, quantity: 1 });
    }

    this.renderSelectedLenses();
    this.updateSelectedCounter();
    this._scrollToLastSelectedLens();
  },

  removeLensFromSelection(lensId) {
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }
    this.state.selectedLenses = this.state.selectedLenses.filter(
      (lens) => lens._id !== lensId,
    );
    this.renderSelectedLenses();
    this.updateSelectedCounter();
  },

  renderSelectedLenses() {
    const selectedContainer = document.getElementById("selectedLenses");

    if (!Array.isArray(this.state.selectedLenses))
      this.state.selectedLenses = [];

    if (this.state.selectedLenses.length === 0) {
      selectedContainer.innerHTML = `
                <div class="selected-lens" id="empty-selection">
                    <p>No hay productos seleccionados</p>
                </div>
            `;
      return;
    }

    selectedContainer.innerHTML = this.state.selectedLenses
      .map((lens) => {
        const specsText = formatLensSpecs(lens);
        const titleHTML = getLensTitle(lens.name);
        return `
                <div class="selected-lens" data-id="${lens._id}">
                    <div class="lens-info">
                        ${titleHTML}
                        ${specsText ? `<p>${specsText}</p>` : ""}
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
  },

  increaseQuantity(lensId) {
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }
    const index = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId,
    );
    if (index < 0) return;
    this.state.selectedLenses[index].quantity += 1;
    this.renderSelectedLenses();
    this.updateSelectedCounter();
    this._scrollToLastSelectedLens();
  },

  decreaseQuantity(lensId) {
    if (!Array.isArray(this.state.selectedLenses)) {
      this.state.selectedLenses = [];
      return;
    }
    const index = this.state.selectedLenses.findIndex(
      (lens) => lens._id === lensId,
    );
    if (index < 0) return;
    if (this.state.selectedLenses[index].quantity <= 1) {
      this.removeLensFromSelection(lensId);
    } else {
      this.state.selectedLenses[index].quantity -= 1;
      this.renderSelectedLenses();
    }
    this.updateSelectedCounter();
  },

  handleSave() {
    if (!Array.isArray(this.state.selectedLenses))
      this.state.selectedLenses = [];

    if (this.state.selectedLenses.length === 0) {
      uiManager.showAlert(
        "No hay productos seleccionados para guardar",
        "warning",
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
        const totalProductsUpdated = this.state.selectedLenses.reduce(
          (sum, lens) => sum + (lens.quantity || 0),
          0,
        );

        activityLogger.log({
          tipo: "SALIDA",
          accion: "Salida registrada",
          entidad: "Salida",
          datos_nuevos: {
            productos_count: this.state.selectedLenses.length,
            cantidad_total: totalProductsUpdated,
            modo_bodega: this.state.useWarehouseStock,
            productos_detalle: this.state.selectedLenses.map((lens) => ({
              id: lens._id,
              nombre: lens.name,
              cantidad: lens.quantity,
              especificaciones: formatLensSpecs(lens),
            })),
          },
        });

        this.showProcessingLoader(false);
        uiManager.showAlert(
          `Registro exitoso. ${totalProductsUpdated} producto${totalProductsUpdated !== 1 ? "s" : ""} actualizado${totalProductsUpdated !== 1 ? "s" : ""}`,
          "success",
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
        "danger",
      );
      return false;
    }
  },

  formatLensSpecsForLog(lens) {
    if (!lens) return "";
    const parts = [];
    if (
      lens.sphere &&
      lens.sphere !== "N/A" &&
      lens.sphere !== "" &&
      lens.sphere !== "N"
    )
      parts.push(`Esf: ${lens.sphere}`);
    if (
      lens.cylinder &&
      lens.cylinder !== "N/A" &&
      lens.cylinder !== "" &&
      lens.cylinder !== "-"
    )
      parts.push(`Cil: ${lens.cylinder}`);
    if (
      lens.addition &&
      lens.addition !== "N/A" &&
      lens.addition !== "" &&
      lens.addition !== "-"
    )
      parts.push(`Add: ${lens.addition}`);
    return parts.length > 0 ? parts.join(", ") : "";
  },

  async updateInventoryIntelligently() {
    try {
      if (
        !Array.isArray(this.state.selectedLenses) ||
        this.state.selectedLenses.length === 0
      ) {
        throw new Error("No hay productos seleccionados para procesar");
      }

      const useWarehouseStock = this.state.useWarehouseStock || false;
      let updatedCount = 0;
      const advertencias = [];

      for (const selectedLens of this.state.selectedLenses) {
        if (!selectedLens || !selectedLens._id) continue;

        const productResponse = await window.api.getProduct(selectedLens._id);
        const product = productResponse?.product || productResponse;

        if (!product || !product._id) {
          advertencias.push(
            `Producto no encontrado: ${selectedLens.name || selectedLens._id}`,
          );
          continue;
        }

        const quantityToSubtract = selectedLens.quantity || 0;
        const currentStock = product.stock || 0;

        if (currentStock < quantityToSubtract) {
          const faltante = quantityToSubtract - currentStock;
          advertencias.push(
            `"${product.name}": Stock insuficiente (Disponible: ${currentStock}, Solicitado: ${quantityToSubtract}, Faltante: ${faltante}). Se registrará como stock negativo.`,
          );
        }
      }

      for (const selectedLens of this.state.selectedLenses) {
        if (!selectedLens || !selectedLens._id) continue;

        const productResponse = await window.api.getProduct(selectedLens._id);
        const product = productResponse?.product || productResponse;

        if (!product || !product._id) {
          console.error(
            `Producto ${selectedLens._id} no encontrado en procesamiento`,
          );
          continue;
        }

        const quantityToSubtract = selectedLens.quantity || 0;
        const currentStock = product.stock || 0;
        const currentStockSurtido = product.stock_surtido || 0;
        const currentStockAlmacenado = product.stock_almacenado || 0;

        let newStockSurtido, newStockAlmacenado, newStock;

        if (useWarehouseStock) {
          newStockSurtido = currentStockSurtido;
          newStockAlmacenado = currentStockAlmacenado - quantityToSubtract;
          newStock = currentStock - quantityToSubtract;
        } else {
          if (currentStockSurtido >= quantityToSubtract) {
            newStockSurtido = currentStockSurtido - quantityToSubtract;
            newStockAlmacenado = currentStockAlmacenado;
            newStock = currentStock - quantityToSubtract;
          } else if (currentStock >= quantityToSubtract) {
            const remainingToSubtract =
              quantityToSubtract - currentStockSurtido;
            newStockSurtido = 0;
            newStockAlmacenado = currentStockAlmacenado - remainingToSubtract;
            newStock = currentStock - quantityToSubtract;
          } else {
            const deficit = quantityToSubtract - currentStock;
            newStockSurtido = 0;
            newStockAlmacenado = -deficit;
            newStock = currentStock - quantityToSubtract;
          }
        }

        const sumaParciales = newStockSurtido + newStockAlmacenado;
        if (sumaParciales !== newStock) {
          throw new Error(
            `"${product.name}": Inconsistencia en cálculo de stock (${sumaParciales} ≠ ${newStock})`,
          );
        }

        const updateResult = await window.api.updateProductStock(
          selectedLens._id,
          {
            stock: newStock,
            stock_surtido: newStockSurtido,
            stock_almacenado: newStockAlmacenado,
          },
        );

        const updatedProduct = updateResult?.product || updateResult;

        if (!updatedProduct || updatedProduct.stock === undefined) {
          throw new Error(
            `"${product.name}": El backend no devolvió datos válidos de actualización`,
          );
        }

        if (syncHelper && typeof syncHelper.notifyProductSold === "function") {
          syncHelper.notifyProductSold(
            selectedLens._id,
            quantityToSubtract,
            newStock,
            updatedProduct,
            "salesView",
          );
        } else if (eventManager && typeof eventManager.emit === "function") {
          eventManager.emit("data:product:stock-updated", {
            productId: selectedLens._id,
            newStock,
            product: updatedProduct,
          });
        }

        updatedCount++;
      }

      await this.loadInitialData();
      return true;
    } catch (error) {
      console.error("Error en actualización de inventario:", error);
      uiManager.showAlert(
        "Error al actualizar el inventario: " + error.message,
        "danger",
      );
      return false;
    }
  },

  handleCancel() {
    if (!Array.isArray(this.state.selectedLenses))
      this.state.selectedLenses = [];
    if (this.state.selectedLenses.length > 0) {
      this.showModal(
        "¿Está seguro que desea cancelar este registro?",
        "cancelSale",
      );
    } else {
      this.resetSale();
    }
  },

  showModal(message, action) {
    const modal = document.getElementById("confirmModal");
    const messageElement = document.getElementById("modalMessage");
    if (messageElement) messageElement.textContent = message;
    this.currentModalAction = action;
    if (modal) {
      modal.classList.add("show");
      modal.style.display = "flex";
    }
  },

  hideModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) {
      modal.classList.remove("show");
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
    }
    this.hideModal();
  },

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
            0,
          )
        : 0,
    };
  },

  validateState() {
    const issues = [];
    if (!Array.isArray(this.state.availableLenses))
      issues.push("availableLenses no es un array");
    if (!Array.isArray(this.state.selectedLenses))
      issues.push("selectedLenses no es un array");
    if (!Array.isArray(this.state.searchResults))
      issues.push("searchResults no es un array");
    return { valid: issues.length === 0, issues };
  },

  reset() {
    this.destroyBarcodeScanner();
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
    try {
      this.destroyBarcodeScanner();
      if (this.barcodeTimeout) {
        clearTimeout(this.barcodeTimeout);
        this.barcodeTimeout = null;
      }
      this.barcodeBuffer = "";
      if (this.unsubscribeFromCoordinator) this.unsubscribeFromCoordinator();
      if (eventManager) {
        eventManager.off("external:product-updated");
        eventManager.off("external:stock-updated");
      }
      this.isInitialized = false;
    } catch (error) {
      console.error("Error destruyendo salesManager:", error);
    }
  },

  setupBarcodeScanner() {
    this.barcodeBuffer = "";
    this.barcodeTimeout = null;

    this.barcodeListener = (e) => {
      const salesView = document.getElementById("sales-view");
      if (!salesView || salesView.style.display === "none") return;

      const activeElement = document.activeElement;
      const isTextInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA") &&
        activeElement.id !== "searchInput";

      if (isTextInput) return;
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt") return;

      if (e.key === "Enter" && this.barcodeBuffer.length > 0) {
        e.preventDefault();
        this.processBarcodeInput(this.barcodeBuffer.trim());
        this.barcodeBuffer = "";
        return;
      }

      if (e.key.length === 1) {
        this.barcodeBuffer += e.key;
        clearTimeout(this.barcodeTimeout);
        this.barcodeTimeout = setTimeout(() => {
          if (this.barcodeBuffer.length >= 4) {
            this.processBarcodeInput(this.barcodeBuffer.trim());
          }
          this.barcodeBuffer = "";
        }, 100);
      }
    };

    document.addEventListener("keydown", this.barcodeListener);
  },

  async processBarcodeInput(barcode) {
    if (!barcode || barcode.length < 4) return;

    const barcodeNormalizado = this.normalizarCodigoBarras(barcode);
    this.showBarcodeIndicator(barcodeNormalizado, "searching");

    try {
      const product = await this.findProductByBarcode(barcodeNormalizado);
      if (product) {
        this.addLensToSelection(product._id);
        this.showBarcodeIndicator(barcodeNormalizado, "success", product.name);
        this.playBeep("success");
      } else {
        this.showBarcodeIndicator(barcodeNormalizado, "error");
        this.playBeep("error");
      }
    } catch (error) {
      console.error("Error procesando código:", error);
      this.showBarcodeIndicator(barcodeNormalizado, "error");
      this.playBeep("error");
    }
  },

  normalizarCodigoBarras(barcode) {
    if (!barcode) return "";
    let codigo = String(barcode).trim();
    codigo = codigo.replace(/'/g, "-");
    codigo = codigo.replace(/¡/g, "+");
    codigo = codigo.toLowerCase();
    codigo = codigo.replace(/\s+/g, "");
    return codigo;
  },

  async findProductByBarcode(barcode) {
    const normalizedBarcode = this.normalizarCodigoBarras(barcode);

    if (
      !Array.isArray(this.state.availableLenses) ||
      this.state.availableLenses.length === 0
    )
      return null;

    return (
      this.state.availableLenses.find((lens) => {
        if (!lens || !lens.barcode) return false;
        return this.normalizarCodigoBarras(lens.barcode) === normalizedBarcode;
      }) || null
    );
  },

  showBarcodeIndicator(barcode, status, productName = "") {
    const oldIndicator = document.getElementById("barcode-indicator");
    if (oldIndicator) oldIndicator.remove();

    const config = {
      searching: {
        icon: "hourglass-split",
        color: "#3498db",
        text: "Buscando...",
      },
      success: {
        icon: "check-circle-fill",
        color: "#27ae60",
        text: productName || "Agregado",
      },
      error: { icon: "x-circle-fill", color: "#e74c3c", text: "No encontrado" },
    }[status];

    document.body.insertAdjacentHTML(
      "beforeend",
      `
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
            <style>@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } }</style>
        `,
    );

    setTimeout(() => {
      const indicator = document.getElementById("barcode-indicator");
      if (indicator) indicator.remove();
    }, 2000);
  },

  playBeep(type = "success") {
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = type === "success" ? 800 : 400;
      oscillator.type = "sine";
      gainNode.gain.value = 0.1;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {}
  },

  destroyBarcodeScanner() {
    if (this.barcodeListener) {
      document.removeEventListener("keydown", this.barcodeListener);
      this.barcodeListener = null;
    }
    if (this.barcodeTimeout) {
      clearTimeout(this.barcodeTimeout);
      this.barcodeTimeout = null;
    }
    this.barcodeBuffer = "";
  },

  setupSyncListeners() {
    if (
      window.syncCoordinator &&
      typeof window.syncCoordinator.subscribe === "function"
    ) {
      this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
        "salesManager",
        (eventType, data) => this.handleSyncEvent(eventType, data),
      );
    }

    eventManager.on("external:product-updated", (product) =>
      this.handleProductUpdated(product),
    );
    eventManager.on("external:stock-updated", (data) =>
      this.handleStockUpdated(data),
    );
  },

  handleSyncEvent(eventType, data) {
    switch (eventType) {
      case "product:updated":
        this.handleProductUpdated(data);
        break;
      case "stock:updated":
        this.handleStockUpdated(data);
        break;
      case "force:refresh":
        this.loadInitialData();
        break;
    }
  },

  handleProductUpdated(product) {
    if (!product || !product._id) return;

    if (Array.isArray(this.state.availableLenses)) {
      const index = this.state.availableLenses.findIndex(
        (p) => p._id === product._id,
      );
      if (index !== -1) this.state.availableLenses[index] = product;
    }

    if (Array.isArray(this.state.selectedLenses)) {
      const selectedIndex = this.state.selectedLenses.findIndex(
        (p) => p._id === product._id,
      );
      if (selectedIndex !== -1) {
        const currentQuantity =
          this.state.selectedLenses[selectedIndex].quantity;
        this.state.selectedLenses[selectedIndex] = {
          ...product,
          quantity: currentQuantity,
        };
        this.renderSelectedLenses();
      }
    }

    if (Array.isArray(this.state.searchResults)) {
      const searchIndex = this.state.searchResults.findIndex(
        (p) => p._id === product._id,
      );
      if (searchIndex !== -1) {
        this.state.searchResults[searchIndex] = product;
        this.renderSearchResults();
      }
    }
  },

  handleStockUpdated(data) {
    if (data.product) {
      this.handleProductUpdated(data.product);
    } else if (data.productId && data.newStock !== undefined) {
      const updateStockInArray = (array) => {
        const index = array.findIndex((p) => p._id === data.productId);
        if (index !== -1) {
          array[index].stock = data.newStock;
          if (data.stock_surtido !== undefined)
            array[index].stock_surtido = data.stock_surtido;
          return true;
        }
        return false;
      };

      updateStockInArray(this.state.availableLenses);
      if (updateStockInArray(this.state.selectedLenses))
        this.renderSelectedLenses();
      if (updateStockInArray(this.state.searchResults))
        this.renderSearchResults();
    }
  },
};

salesManager._logoBase64 = null;
salesManager._logoPromise = (async function() {
    const rutas = [
        'assets/Logo.png',
        './assets/Logo.png',
        '../assets/Logo.png',
    ];

    for (const ruta of rutas) {
        try {
            const response = await fetch(ruta);
            if (!response.ok) {
                console.warn(`Logo: 404 en "${ruta}"`);
                continue;
            }
            const blob = await response.blob();
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            salesManager._logoBase64 = base64;
            console.log(`✅ Logo cargado desde: "${ruta}"`);
            return base64;
        } catch (e) {
            console.warn(`Logo: error con "${ruta}":`, e.message);
        }
    }

    console.error('❌ Logo no encontrado en ninguna ruta');
    return null;
})();

salesManager.state.requiresFactura = false;
salesManager.state.facturaData = null;

const originalHandleSave = salesManager.handleSave;
salesManager.handleSave = function () {
  if (!Array.isArray(this.state.selectedLenses)) this.state.selectedLenses = [];
  if (this.state.selectedLenses.length === 0) {
    uiManager.showAlert(
      "No hay productos seleccionados para guardar",
      "warning",
    );
    return;
  }
  this.showFacturaModal();
};

salesManager.showFacturaModal = function () {
  const existingModal = document.getElementById("factura-decision-modal");
  if (existingModal) {
    existingModal.style.display = "flex";
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
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
    `,
  );
};

salesManager.inyectarEstilosImpresion = function () {
  const oldStyles = document.getElementById("pos-print-styles");
  if (oldStyles) oldStyles.remove();

  const styles = document.createElement("style");
  styles.id = "pos-print-styles";
  styles.textContent = `
    .factura-pos-oculta { display: none !important; }

    #factura-pos-print {
        display: none;
        width: 80mm;
        margin: 0 auto;
    }

    @page {
        size: 80mm auto;
        margin: 0;
    }

    @media print {
        * { box-sizing: border-box; }

        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            background: white !important;
        }

        body > *:not(#factura-pos-print) { display: none !important; }
        #factura-pos-print.factura-lista-imprimir {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            left: auto !important;
            width: 80mm !important;
            margin: 0 auto !important;
        }

        #factura-pos-print {
            display: block !important;
            visibility: visible !important;
            width: 80mm !important;
            margin: 0 auto !important;
        }

        .factura-contenido {
            width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 2mm 2mm !important;
            font-family: 'Courier New', Consolas, monospace !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
            color: #000 !important;
            background: white !important;
        }

        /* Cabecera centrada */
        .pos-header {
            text-align: center !important;
            margin-bottom: 3mm !important;
        }
        
        .pos-logo {
            display: block !important;
            max-width: 120px !important;
            max-height: 120px !important;
            margin: 0 auto 2mm !important;
            object-fit: contain !important;
        }

        .pos-empresa-nombre {
            font-weight: bold !important;
            font-size: 13px !important;
            text-align: center !important;
            margin-bottom: 1mm !important;
        }
        .pos-empresa-info {
            font-size: 9px !important;
            text-align: center !important;
            line-height: 1.5 !important;
        }

        /* Separadores */
        .pos-linea-punteada {
            border: none !important;
            border-top: 1px dashed #000 !important;
            margin: 2mm 0 !important;
            width: 100% !important;
        }
        .pos-linea-solida {
            border: none !important;
            border-top: 1px solid #000 !important;
            margin: 2mm 0 !important;
            width: 100% !important;
        }

        /* Título remisión */
        .pos-titulo {
            text-align: center !important;
            margin: 2mm 0 !important;
        }
        .pos-titulo-principal {
            font-weight: bold !important;
            font-size: 13px !important;
            text-align: center !important;
            letter-spacing: 1px !important;
        }
        .pos-numero-factura {
            font-weight: bold !important;
            font-size: 11px !important;
            text-align: center !important;
        }

        /* Fecha */
        .pos-fecha {
            text-align: center !important;
            font-size: 9px !important;
            margin-bottom: 2mm !important;
        }

        /* Cliente */
        .pos-cliente {
            font-size: 10px !important;
            margin: 2mm 0 !important;
            text-align: left !important;
        }
        .pos-cliente-label { font-weight: bold !important; }

        /* Tabla de productos */
        .flex-row {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            width: 100% !important;
        }
        .pos-tabla-header {
            font-weight: bold !important;
            font-size: 9px !important;
            padding: 1mm 0 !important;
            border-bottom: 1px solid #000 !important;
            margin-bottom: 1mm !important;
        }
        .pos-col-cant {
            flex: 0 0 10mm !important;
            text-align: center !important;
            font-size: 9px !important;
        }
        .pos-col-desc {
            flex: 1 !important;
            padding: 0 1mm !important;
            font-size: 9px !important;
            word-break: break-word !important;
        }
        .pos-col-total {
            flex: 0 0 18mm !important;
            text-align: right !important;
            font-size: 9px !important;
        }

        /* Productos */
        .pos-producto-item {
            margin-bottom: 2mm !important;
            font-size: 9px !important;
            page-break-inside: avoid !important;
        }
        .pos-producto-nombre {
            font-weight: bold !important;
            font-size: 10px !important;
            word-break: break-word !important;
        }
        .pos-producto-descripcion {
            font-size: 8px !important;
            color: #333 !important;
            margin-top: 0.5mm !important;
        }
        .pos-producto-precio {
            font-size: 8px !important;
            color: #444 !important;
        }

        /* Total */
        .pos-total-container {
            padding: 2mm 0 !important;
            border-top: 2px solid #000 !important;
            border-bottom: 2px solid #000 !important;
            margin: 2mm 0 !important;
            page-break-inside: avoid !important;
        }
        .pos-total-label, .pos-total-valor {
            font-weight: bold !important;
            font-size: 14px !important;
        }

        /* Footer */
        .pos-footer {
            text-align: center !important;
            margin-top: 3mm !important;
            font-size: 9px !important;
        }
        .pos-footer-mensaje {
            font-weight: bold !important;
            font-size: 10px !important;
            margin-bottom: 1mm !important;
        }
        .pos-footer-sistema {
            font-size: 8px !important;
        }
        .pos-espacio-corte {
            height: 10mm !important;
        }
    }
`;
  document.head.appendChild(styles);
};


salesManager.imprimirFacturaPOS = function () {
    const modal = document.getElementById('factura-preview-modal');
    const factura = document.getElementById('factura-pos-print');

    if (!factura) {
        console.error('No se encontró el elemento de impresión');
        return;
    }

    if (modal) modal.style.visibility = 'hidden';

    factura.classList.remove('factura-pos-oculta');
    factura.classList.add('factura-lista-imprimir');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.print();
o
        });
    });
};

salesManager.hideVistaPrevia = function () {
  this.cerrarVistaPrevia();
};

salesManager.hideFacturaModal = function () {
  const modal = document.getElementById("factura-decision-modal");
  if (modal) modal.style.display = "none";
};

salesManager.procesarSalidaSinFactura = async function () {
  this.hideFacturaModal();
  this.state.requiresFactura = false;
  await this.finalizeSale();
};

salesManager.procesarSalidaConFactura = function () {
  this.hideFacturaModal();
  this.state.requiresFactura = true;
  this.mostrarFormularioFactura();
};

salesManager.mostrarFormularioFactura = function () {
  const total = this.state.selectedLenses.reduce((sum, lens) => {
    return sum + (parseFloat(lens.precioUnitario) || 0) * lens.quantity;
  }, 0);

  const productosHTML = this.state.selectedLenses
    .map((lens) => {
      const specsText = formatLensSpecs(lens);
      return `
            <div class="precio-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <strong>${lens.name || "Producto sin nombre"}</strong>
                    ${specsText ? `<br><small style="color: #6c757d;">${specsText}</small>` : ""}
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
    })
    .join("");

  const oldModal = document.getElementById("factura-form-modal");
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <div class="modal" id="factura-form-modal" style="display: flex; z-index: 1000;">
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 2px solid #e9ecef; background: #f8f9fa;">
                    <h3 style="margin: 0;"><i class="bi bi-file-text"></i> Datos de la Remisión</h3>
                    <button class="btn-close" onclick="salesManager.hideFormularioFactura()"></button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h5 style="margin-bottom: 15px; color: #495057;"><i class="bi bi-person"></i> Información del Cliente</h5>
                        <div>
                            <label style="font-weight: 600; margin-bottom: 6px; display: block;">Nombre del Cliente <span style="color: #e74c3c;">*</span></label>
                            <input type="text" id="factura-cliente-nombre" class="form-control" placeholder="Nombre completo del cliente" required>
                        </div>
                    </div>
                    <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h5 style="margin-bottom: 15px; color: #495057;"><i class="bi bi-box"></i> Productos y Precios</h5>
                        <div id="factura-productos-precios">${productosHTML}</div>
                    </div>
                    <div style="padding: 15px; background: white; border-radius: 8px; border: 2px solid #e9ecef;">
                        <h5 style="margin-bottom: 15px; color: #495057;"><i class="bi bi-calculator"></i> Total</h5>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 1.3rem; font-weight: 700; color: #3498db; border-top: 2px solid #2c3e50;">
                            <span>TOTAL:</span>
                            <span id="factura-total">$${total.toLocaleString("es-CO")}</span>
                        </div>
                    </div>
                    <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h5 style="margin-bottom: 15px; color: #495057;"><i class="bi bi-chat-text"></i> Observaciones (Opcional)</h5>
                        <textarea id="factura-observaciones" class="form-control" rows="3" placeholder="Observaciones adicionales..."></textarea>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 20px; border-top: 1px solid #e9ecef; background: #f8f9fa;">
                    <button class="btn btn-secondary" onclick="salesManager.hideFormularioFactura()">Cancelar</button>
                    <button class="btn btn-primary" onclick="salesManager.crearFactura()">
                        <i class="bi bi-check-circle"></i> Generar Factura
                    </button>
                </div>
            </div>
        </div>
    `,
  );

  this.state.selectedLenses.forEach((lens) => {
    lens.precioUnitario = lens.precioUnitario || 0;
  });
};

salesManager.hideFormularioFactura = function () {
  const modal = document.getElementById("factura-form-modal");
  if (modal) modal.remove();
};

salesManager.actualizarTotales = function () {
  const inputs = document.querySelectorAll(".precio-input");
  let total = 0;

  inputs.forEach((input) => {
    const lensId = input.dataset.lensId;
    const precio = parseFloat(input.value) || 0;
    const lens = this.state.selectedLenses.find((l) => l._id === lensId);
    if (lens) {
      lens.precioUnitario = precio;
      total += precio * lens.quantity;
    }
  });

  const totalElement = document.getElementById("factura-total");
  if (totalElement)
    totalElement.textContent = `$${total.toLocaleString("es-CO")}`;
};

salesManager.crearFactura = async function () {
  try {
    const clienteNombre = document
      .getElementById("factura-cliente-nombre")
      ?.value.trim();
    if (!clienteNombre) {
      uiManager.showAlert("El nombre del cliente es obligatorio", "warning");
      return;
    }

    const observaciones =
      document.getElementById("factura-observaciones")?.value.trim() || "";

    const inputs = document.querySelectorAll(".precio-input");
    inputs.forEach((input) => {
      const lensId = input.dataset.lensId;
      const precio = parseFloat(input.value) || 0;
      const lens = this.state.selectedLenses.find((l) => l._id === lensId);
      if (lens) lens.precioUnitario = precio;
    });

    const productos = this.state.selectedLenses.map((lens) => ({
      productId: lens._id,
      nombre: lens.name || "Producto sin nombre",
      descripcion: formatLensSpecs(lens),
      esfera: lens.sphere,
      cilindro: lens.cylinder,
      adicion: lens.addition,
      cantidad: lens.quantity,
      precioUnitario: parseFloat(lens.precioUnitario) || 0,
      subtotal: (parseFloat(lens.precioUnitario) || 0) * lens.quantity,
    }));

    const sinPrecio = productos.filter((p) => p.precioUnitario === 0);
    if (sinPrecio.length > 0) {
      uiManager.showAlert(
        "Todos los productos deben tener un precio",
        "warning",
      );
      return;
    }

    const total = productos.reduce((sum, p) => sum + p.subtotal, 0);

    const facturaData = {
      cliente: { nombre: clienteNombre },
      productos,
      subtotal: total,
      iva: 0,
      total,
      observaciones,
      salidaId: "sale-" + Date.now(),
    };

    const response = await window.api.createFactura(facturaData);

    if (response.success || response.factura) {
      const factura = response.factura || response;
      this.state.facturaData = factura;

      activityLogger.log({
        tipo: "FACTURA",
        accion: `Factura ${factura.numeroFactura} generada`,
        entidad: "Factura",
        entidad_id: factura._id || factura.numeroFactura,
        datos_nuevos: {
          numero: factura.numeroFactura,
          cliente: factura.cliente.nombre,
          total: factura.total,
          productos_count: factura.productos.length,
          productos_detalle: factura.productos.map((p) => ({
            nombre: p.nombre,
            cantidad: p.cantidad,
            descripcion: p.descripcion,
            subtotal: p.subtotal,
          })),
          resumen: factura.productos
            .map(
              (p) =>
                `${p.nombre} ${p.descripcion ? `(${p.descripcion})` : ""} x${p.cantidad} = $${p.subtotal.toLocaleString("es-CO")}`,
            )
            .join(", "),
        },
      });

      this.hideFormularioFactura();
      await this.finalizeSale();
      this.mostrarVistaPrevia(factura);
      uiManager.showAlert("Factura generada correctamente", "success");
    } else {
      throw new Error(response.message || "Error al crear factura");
    }
  } catch (error) {
    console.error("Error creando factura:", error);
    uiManager.showAlert(
      "Error al crear la factura: " + error.message,
      "danger",
    );
  }
};

salesManager.limpiarVistaPreviaCompleta = function () {
  try {
    const oldModal = document.getElementById("factura-preview-modal");
    if (oldModal) oldModal.remove();
    const oldFacturaPrint = document.getElementById("factura-pos-print");
    if (oldFacturaPrint) oldFacturaPrint.remove();
    const oldPreview = document.getElementById("factura-preview-display");
    if (oldPreview) oldPreview.remove();
    document.querySelectorAll('.modal[id*="factura"]').forEach((m) => {
      if (m.id !== "factura-decision-modal" && m.id !== "factura-form-modal")
        m.remove();
    });
  } catch (error) {
    console.error("Error limpiando vista previa:", error);
  }
};

salesManager.generarHTMLTicket = function (factura, modoImpresion = false) {
    if (!factura) return '<div>Error: No hay datos de factura</div>';

    const fecha = new Date(factura.fechaEmision);
    const fechaStr = fecha.toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const horaStr = fecha.toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const totalItems = factura.productos
        ? factura.productos.reduce((sum, p) => sum + (p.cantidad || 0), 0)
        : 0;

    const wrapperStyles = modoImpresion ? '' : `
        width: 80mm;
        max-width: 80mm;
        margin: 0 auto;
        padding: 2mm;
        font-family: 'Courier New', Consolas, monospace;
        font-size: 11px;
        line-height: 1.4;
        color: #000;
        background: white;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        border-radius: 4px;
    `;

    const productosHTML = factura.productos ? factura.productos.map(prod => `
        <table style="width:100%; border-collapse:collapse; margin-bottom:2mm; font-size:9px;">
            <tr>
                <td style="width:10mm; text-align:center; vertical-align:top; font-weight:bold;">
                    ${prod.cantidad || 0}
                </td>
                <td style="vertical-align:top; padding:0 1mm; word-break:break-word;">
                    <div style="font-weight:bold; font-size:10px;">${prod.nombre || 'Producto'}</div>
                    ${prod.descripcion ? `<div style="font-size:8px; color:#333;">${prod.descripcion}</div>` : ''}
                    <div style="font-size:8px; color:#444;">P.Unit: $${(prod.precioUnitario || 0).toLocaleString('es-CO')}</div>
                </td>
                <td style="width:18mm; text-align:right; vertical-align:top; font-weight:bold;">
                    $${(prod.subtotal || 0).toLocaleString('es-CO')}
                </td>
            </tr>
        </table>
    `).join('') : '';

    return `
        <div style="${wrapperStyles}
            font-family: 'Courier New', Consolas, monospace;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
        ">
            <!-- Cabecera -->
            <div style="text-align:center; margin-bottom:3mm;">
                ${salesManager._logoBase64
                    ? `<img src="${salesManager._logoBase64}" alt="Logo"
                        style="max-width:120px; max-height:120px; display:block; margin:0 auto 2mm; object-fit:contain;">`
                    : ''}
                <div style="font-size:9px; line-height:1.5;">
                    NIT: ${factura.empresa?.nit || '000.000.000-0'}<br>
                    ${factura.empresa?.direccion || ''}<br>
                    Tel: ${factura.empresa?.telefono || ''}
                </div>
            </div>

            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>

            <!-- Título -->
            <div style="text-align:center; margin:2mm 0;">
                <div style="font-weight:bold; font-size:13px; letter-spacing:1px;">REMISIÓN</div>
                <div style="font-weight:bold; font-size:11px;">${factura.numeroFactura || 'N/A'}</div>
            </div>

            <div style="text-align:center; font-size:9px; margin-bottom:2mm;">
                Fecha: ${fechaStr} &nbsp; Hora: ${horaStr}
            </div>

            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>

            <!-- Cliente -->
            <div style="font-size:10px; margin:2mm 0;">
                <strong>CLIENTE:</strong> ${factura.cliente?.nombre || 'N/A'}
            </div>

            <div style="border-top:1px solid #000; margin:2mm 0;"></div>

            <!-- Encabezado tabla usando <table> para compatibilidad con impresoras térmicas -->
            <table style="width:100%; border-collapse:collapse; font-size:9px; font-weight:bold;
                border-bottom:1px solid #000; margin-bottom:1mm;">
                <tr>
                    <td style="width:10mm; text-align:center; padding:1mm 0;">Cant.</td>
                    <td style="padding:1mm;">Descripción</td>
                    <td style="width:18mm; text-align:right; padding:1mm 0;">Total</td>
                </tr>
            </table>

            <!-- Productos -->
            <div style="margin-bottom:2mm;">
                ${productosHTML}
            </div>

            <div style="border-top:1px solid #000; margin:2mm 0;"></div>

            <div style="font-size:9px; text-align:right; margin-bottom:1mm;">
                Items: ${totalItems}
            </div>

            <!-- Total -->
            <table style="width:100%; border-collapse:collapse;
                border-top:2px solid #000; border-bottom:2px solid #000;
                padding:2mm 0; margin:2mm 0;">
                <tr>
                    <td style="font-weight:bold; font-size:14px; padding:2mm 0;">TOTAL:</td>
                    <td style="font-weight:bold; font-size:14px; text-align:right; padding:2mm 0;">
                        $${(factura.total || 0).toLocaleString('es-CO')}
                    </td>
                </tr>
            </table>

            ${factura.observaciones ? `
                <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
                <div style="font-size:9px;">
                    <strong>OBS:</strong> ${factura.observaciones}
                </div>
            ` : ''}

            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>

            <!-- Footer -->
            <div style="text-align:center; margin-top:3mm; font-size:9px;">
                <div style="font-weight:bold; font-size:10px; margin-bottom:1mm;">¡Gracias por su compra!</div>
                <div style="font-size:8px;">Software Maxibisel</div>
            </div>

            <div style="height:10mm;"></div>
        </div>
    `;
};

salesManager.mostrarVistaPrevia = async function (factura) {
  if (!factura) {
    uiManager.showAlert("Error: No hay datos de factura", "danger");
    return;
  }

  try {
    if (!salesManager._logoBase64 && salesManager._logoPromise) {
        await Promise.race([
            salesManager._logoPromise,
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);
    }

    this.limpiarVistaPreviaCompleta();
    this.inyectarEstilosImpresion();

    document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="factura-pos-print" class="factura-pos-oculta">
        <div class="factura-contenido">
            ${this.generarHTMLTicket(factura, true)}
        </div>
    </div>`
    );

    document.body.insertAdjacentHTML(
      "beforeend",
      `
            <div class="modal" id="factura-preview-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 12px; max-width: 550px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 2px solid #e9ecef; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                        <h3 style="margin: 0; color: white;"><i class="bi bi-receipt"></i> Vista Previa - Factura ${factura.numeroFactura || "N/A"}</h3>
                        <button onclick="salesManager.cerrarVistaPrevia()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; width: 36px; height: 36px; border-radius: 4px; cursor: pointer;">×</button>
                    </div>
                    <div id="preview-container" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: #e5e5e5;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    "></div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px; border-top: 2px solid #e9ecef; background: #f8f9fa;">
                        <button onclick="salesManager.cerrarVistaPrevia()" style="padding: 12px 24px; border-radius: 8px; border: 2px solid #6c757d; background: white; color: #6c757d; font-weight: 600; cursor: pointer;">
                            <i class="bi bi-x-circle"></i> Cerrar
                        </button>
                        <button onclick="salesManager.imprimirFacturaPOS()" style="padding: 12px 24px; border-radius: 8px; border: none; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; font-weight: 600; cursor: pointer;">
                            <i class="bi bi-printer-fill"></i> Imprimir
                        </button>
                    </div>
                </div>
            </div>
        `,
    );

    requestAnimationFrame(() => {
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = this.generarHTMLTicket(factura, false);
    }
    });

  } catch (error) {
    console.error("Error en vista previa:", error);
    uiManager.showAlert("Error al mostrar vista previa", "danger");
  }
};

salesManager.cerrarVistaPrevia = function () {
  try {
    const modal = document.getElementById("factura-preview-modal");
    if (modal) {
      modal.style.animation = "fadeOut 0.2s ease";
      setTimeout(() => {
        modal.remove();
      }, 200);
    }
  } catch (error) {
    const modal = document.getElementById("factura-preview-modal");
    if (modal) modal.remove();
  }
};

if (!document.getElementById("animation-styles")) {
  const animStyles = document.createElement("style");
  animStyles.id = "animation-styles";
  animStyles.textContent = `
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
  document.head.appendChild(animStyles);
}

window.addEventListener("afterprint", function () {
    const factura = document.getElementById("factura-pos-print");
    if (factura) {
        factura.classList.remove("factura-lista-imprimir");
        factura.classList.add("factura-pos-oculta");
    }

    const modal = document.getElementById("factura-preview-modal");
    if (modal) {
        modal.style.visibility = 'visible';
        modal.style.display = "flex";
    }
});

salesManager.verHistorialFacturas = async function () {
  try {
    const data = await window.api.getFacturas();
    const facturas = data.facturas || data || [];
    this.mostrarHistorialFacturas(facturas);
  } catch (error) {
    console.error("Error cargando facturas:", error);
    uiManager.showAlert("Error al cargar el historial de facturas", "danger");
  }
};

salesManager.mostrarHistorialFacturas = function (facturas) {
  let contenidoHTML;

  if (facturas.length === 0) {
    contenidoHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                <i class="bi bi-receipt" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <p style="font-size: 1.1rem;">No hay facturas registradas</p>
            </div>
        `;
  } else {
    const facturasOrdenadas = [...facturas].sort(
      (a, b) => new Date(b.fechaEmision) - new Date(a.fechaEmision),
    );

    contenidoHTML = facturasOrdenadas
      .map((factura) => {
        const fecha = new Date(factura.fechaEmision);
        const fechaStr = fecha.toLocaleString("es-CO", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
                <div style="background: white; border: 1px solid #e9ecef; border-left: 4px solid #3498db; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: all 0.2s;"
                    onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                    onmouseout="this.style.boxShadow='none'">
                    <div style="display: flex; align-items: start; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #e5f6f9; color: #3498db; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="bi bi-receipt" style="font-size: 1.2rem;"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                                <div>
                                    <span style="background: #e5f6f9; color: #3498db; font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">FACTURA</span>
                                    <strong style="color: #2c3e50; font-size: 0.95rem;">${factura.numeroFactura}</strong>
                                </div>
                                <span style="color: #6c757d; font-size: 0.85rem; white-space: nowrap;">
                                    <i class="bi bi-clock me-1"></i>${fechaStr}
                                </span>
                            </div>
                            <div style="color: #6c757d; font-size: 0.9rem; margin-top: 4px;">
                                <i class="bi bi-person me-1"></i>${factura.cliente.nombre}
                                <span class="mx-2">•</span>
                                <i class="bi bi-box-seam me-1"></i>${factura.productos.length} producto${factura.productos.length !== 1 ? "s" : ""}
                            </div>
                            ${this.generateFacturaDetallesEstiloLog(factura)}
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0; display: flex; gap: 8px;">
                                <button class="btn btn-sm btn-primary" onclick="salesManager.verDetalleFactura('${factura._id}')"
                                    style="flex: 1; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; background: #3498db; color: white; transition: all 0.2s;"
                                    onmouseover="this.style.background='#2980b9'; this.style.transform='translateY(-1px)'"
                                    onmouseout="this.style.background='#3498db'; this.style.transform='translateY(0)'">
                                    <i class="bi bi-eye"></i> Ver
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="salesManager.confirmarEliminarFactura('${factura._id}')"
                                    style="flex: 1; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; background: #e74c3c; color: white; transition: all 0.2s;"
                                    onmouseover="this.style.background='#c0392b'; this.style.transform='translateY(-1px)'"
                                    onmouseout="this.style.background='#e74c3c'; this.style.transform='translateY(0)'">
                                    <i class="bi bi-trash3"></i> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  const oldModal = document.getElementById("historial-facturas-modal");
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <div class="modal" id="historial-facturas-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 12px; max-width: 900px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 2px solid #e9ecef; background: linear-gradient(135deg, #1582ffff 0%, #2487ffff 100%); border-radius: 12px 12px 0 0;">
                    <h3 style="margin: 0; color: white; font-size: 1.3rem; font-weight: 600;">
                        <i class="bi bi-clock-history me-2"></i>Historial de Facturas
                    </h3>
                    <button class="btn-close btn-close-white" onclick="salesManager.hideHistorialFacturas()" style="filter: brightness(0) invert(1);"></button>
                </div>
                <div style="flex: 1; max-height: 500px; overflow-y: auto; padding: 20px 24px;">${contenidoHTML}</div>
                <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid #e9ecef; background: #f8f9fa; border-radius: 0 0 12px 12px;">
                    <span style="color: #6c757d; font-size: 0.9rem;">
                        <i class="bi bi-info-circle me-1"></i>Total de facturas: <strong>${facturas.length}</strong>
                    </span>
                    <button class="btn btn-secondary" onclick="salesManager.hideHistorialFacturas()" style="padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `,
  );
};

salesManager.generateFacturaDetallesEstiloLog = function (factura) {
  if (!factura.productos || factura.productos.length === 0) {
    return `
            <div style="margin-top: 12px; padding: 12px; background: #f0f8ff; border-radius: 6px; border: 1px solid #cfe2ff;">
                <div style="display: flex; justify-content: space-between; font-size: 1rem;">
                    <strong style="color: #2c3e50;">TOTAL:</strong>
                    <strong style="color: #3498db; font-size: 1.1rem;">$${factura.total.toLocaleString("es-CO")}</strong>
                </div>
            </div>
        `;
  }

  const productosHTML = factura.productos
    .map(
      (prod) => `
        <div style="background: white; padding: 8px 12px; border-radius: 4px; border: 1px solid #cfe2ff; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">${prod.nombre}</div>
                    ${prod.descripcion ? `<div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">${prod.descripcion}</div>` : ""}
                    <div style="font-size: 0.8rem; color: #6c757d; margin-top: 4px;">Cantidad: ${prod.cantidad}</div>
                </div>
                <div style="text-align: right; white-space: nowrap; margin-left: 10px;">
                    <div style="font-weight: 700; color: #3498db; font-size: 0.95rem;">$${prod.subtotal.toLocaleString("es-CO")}</div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");

  return `
        <div style="margin-top: 12px; padding: 12px; background: #f0f8ff; border-radius: 6px; border: 1px solid #cfe2ff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #cfe2ff;">
                <strong style="color: #3498db; font-size: 0.9rem;"><i class="bi bi-box-seam me-1"></i>Productos (${factura.productos.length})</strong>
            </div>
            ${productosHTML}
            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #3498db; display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #2c3e50; font-size: 1rem;">TOTAL:</strong>
                <strong style="color: #3498db; font-size: 1.1rem;">$${factura.total.toLocaleString("es-CO")}</strong>
            </div>
        </div>
    `;
};

salesManager.reimprimirFactura = async function (facturaId) {
  try {
    const data = await window.api.getFactura(facturaId);
    this.mostrarVistaPrevia(data.factura || data);
  } catch (error) {
    console.error("Error reimprimiendo factura:", error);
    uiManager.showAlert("Error al cargar la factura", "danger");
  }
};

salesManager.confirmarEliminarFactura = function (facturaId) {
  const oldModal = document.getElementById("confirmar-eliminar-factura-modal");
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <div class="modal" id="confirmar-eliminar-factura-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;">
            <div style="background: white; border-radius: 12px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: slideUp 0.3s ease; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 25px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 2rem;">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Confirmar Eliminación</h3>
                </div>
                <div style="padding: 30px; text-align: center;">
                    <p style="font-size: 1.1rem; color: #2c3e50; line-height: 1.6; margin: 0 0 10px 0;">
                        ¿Está seguro que desea <strong style="color: #e74c3c;">ELIMINAR</strong> esta factura?
                    </p>
                    <p style="font-size: 0.95rem; color: #7f8c8d; margin: 0;">Esta acción no se puede deshacer.</p>
                </div>
                <div style="display: flex; gap: 12px; padding: 0 30px 30px 30px;">
                    <button id="btn-cancelar-eliminar" style="flex: 1; padding: 12px; border-radius: 8px; border: 2px solid #95a5a6; background: white; color: #7f8c8d; font-weight: 600; cursor: pointer; font-size: 1rem;"
                        onmouseover="this.style.background='#ecf0f1'" onmouseout="this.style.background='white'">
                        <i class="bi bi-x-circle me-1"></i> Cancelar
                    </button>
                    <button id="btn-confirmar-eliminar" style="flex: 1; padding: 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; font-weight: 600; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 12px rgba(231,76,60,0.3);"
                        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <i class="bi bi-trash3-fill me-1"></i> Eliminar
                    </button>
                </div>
            </div>
        </div>
    `,
  );

  document.getElementById("btn-cancelar-eliminar").onclick = () => {
    const modal = document.getElementById("confirmar-eliminar-factura-modal");
    if (modal) {
      modal.style.animation = "fadeOut 0.2s ease";
      setTimeout(() => modal.remove(), 200);
    }
  };

  document.getElementById("btn-confirmar-eliminar").onclick = () => {
    const modal = document.getElementById("confirmar-eliminar-factura-modal");
    if (modal) modal.remove();
    this.eliminarFactura(facturaId);
  };

  const escHandler = (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("confirmar-eliminar-factura-modal");
      if (modal) {
        modal.style.animation = "fadeOut 0.2s ease";
        setTimeout(() => modal.remove(), 200);
      }
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
};

salesManager.eliminarFactura = async function (facturaId) {
  try {
    this.mostrarIndicadorEliminacion();
    const response = await window.api.deleteFactura(facturaId);

    if (response.success) {
      if (response.factura) {
        activityLogger.log({
          tipo: "FACTURA",
          accion: `Factura ${response.factura.numeroFactura} eliminada`,
          entidad: "Factura",
          entidad_id: facturaId,
          datos_anteriores: {
            numero: response.factura.numeroFactura,
            cliente: response.factura.cliente?.nombre || "N/A",
            total: response.factura.total || 0,
          },
        });
      }

      this.ocultarIndicadorEliminacion();
      uiManager.showAlert("Factura eliminada correctamente", "success");
      this.hideHistorialFacturas();
      setTimeout(() => {
        this.verHistorialFacturas();
      }, 300);
    } else {
      throw new Error(response.message || "Error al eliminar factura");
    }
  } catch (error) {
    console.error("Error eliminando factura:", error);
    this.ocultarIndicadorEliminacion();

    let errorMessage = "Error al eliminar la factura";
    if (error.message) {
      if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage = "Factura no encontrada";
      } else if (
        error.message.includes("500") ||
        error.message.includes("servidor")
      ) {
        errorMessage = "Error del servidor. Intente nuevamente";
      } else {
        errorMessage = error.message;
      }
    }

    uiManager.showAlert(errorMessage, "danger");
  }
};

salesManager.mostrarIndicadorEliminacion = function () {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <div id="eliminando-factura-indicator" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 12px; padding: 30px 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10002; text-align: center; animation: fadeIn 0.2s ease;">
            <div class="spinner-border text-danger mb-3" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Eliminando...</span></div>
            <p style="margin: 0; font-weight: 600; color: #2c3e50; font-size: 1.1rem;">Eliminando factura...</p>
        </div>
        <div id="eliminando-factura-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; animation: fadeIn 0.2s ease;"></div>
    `,
  );
};

salesManager.ocultarIndicadorEliminacion = function () {
  const indicator = document.getElementById("eliminando-factura-indicator");
  const overlay = document.getElementById("eliminando-factura-overlay");
  if (indicator) {
    indicator.style.animation = "fadeOut 0.2s ease";
    setTimeout(() => indicator.remove(), 200);
  }
  if (overlay) {
    overlay.style.animation = "fadeOut 0.2s ease";
    setTimeout(() => overlay.remove(), 200);
  }
};

salesManager.hideHistorialFacturas = function () {
  const modal = document.getElementById("historial-facturas-modal");
  if (modal) modal.remove();
};

salesManager.verDetalleFactura = async function (facturaId) {
  try {
    const data = await window.api.getFactura(facturaId);
    this.hideHistorialFacturas();
    this.mostrarVistaPrevia(data.factura || data);
  } catch (error) {
    console.error("Error cargando factura:", error);
    uiManager.showAlert("Error al cargar la factura", "danger");
  }
};
