// Gestión de Surtido - VERSIÓN UNIFICADA CON EXPORTACIÓN CSV - CORREGIDA
import { uiManager } from './ui.js';

// Sistema unificado de exportación CSV integrado
const unifiedExportSystem = {

  // Rangos estándar para la industria óptica
  sphereRanges: {
    positive: [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00],
    negative: ['N', -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00, -4.25, -4.50, -4.75, -5.00, -5.25, -5.50, -5.75, -6.00],
    bifocal: ['N', 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00]
  },

  cylinderRange: ['N', -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00],

  additionRange: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00],

  // Función para normalizar valores de string a número
  normalizeValue(value) {
    if (!value || value === 'N' || value === '-' || value.toString().trim() === '') {
      return 'N';
    }

    // Limpiar el string y convertir a número
    const cleanValue = value.toString().replace(/[^\d.-]/g, '');
    const numValue = parseFloat(cleanValue);

    return isNaN(numValue) ? 'N' : parseFloat(numValue.toFixed(2));
  },

  // Detectar tipo de lente basado en el primer producto
  detectLensType(firstProduct) {
    console.log('Analizando primer producto para detectar tipo:', firstProduct);

    const addition = this.normalizeValue(firstProduct.addition);

    console.log('Adición normalizada:', addition);

    // Si tiene adición válida (no es 'N' ni 0), determinar si es bifocal o progresivo
    if (addition !== 'N' && addition > 0) {
      // Verificar en el código de barras o nombre si indica lateralidad
      const productInfo = (firstProduct.name || '').toLowerCase() + ' ' + (firstProduct.barcode || '').toLowerCase();

      // Buscar indicadores de lateralidad (progresivos)
      if (productInfo.includes('od') || productInfo.includes('os') ||
        productInfo.includes('derech') || productInfo.includes('izquier') ||
        productInfo.includes('right') || productInfo.includes('left') ||
        productInfo.includes('r') || productInfo.includes('l')) {
        console.log('Detectado: PROGRESIVO');
        return 'progressive';
      } else {
        console.log('Detectado: BIFOCAL');
        return 'bifocal';
      }
    }

    console.log('Detectado: MONOFOCAL');
    return 'monofocal';
  },

  // Extraer lateralidad del producto (para progresivos)
  extractEye(product) {
    const text = ((product.name || '') + ' ' + (product.barcode || '')).toLowerCase();

    if (text.includes('od') || text.includes('derech') || text.includes('right')) return 'R';
    if (text.includes('os') || text.includes('izquier') || text.includes('left')) return 'L';

    return 'AMBOS';
  },

  // Agrupar productos según tipo de lente
  groupProducts(products, lensType) {
    const groups = {};

    console.log(`Agrupando ${products.length} productos como ${lensType.toUpperCase()}`);

    products.forEach((product, index) => {
      const sphere = this.normalizeValue(product.sphere);
      const cylinder = this.normalizeValue(product.cylinder);
      const addition = this.normalizeValue(product.addition);

      console.log(`Producto ${index + 1}:`, {
        barcode: product.barcode,
        sphere: `${product.sphere} -> ${sphere}`,
        cylinder: `${product.cylinder} -> ${cylinder}`,
        addition: `${product.addition} -> ${addition}`,
        stock_surtido: product.stock_surtido || 0
      });

      let key;

      if (lensType === 'monofocal') {
        key = `${sphere}_${cylinder}`;
      } else if (lensType === 'bifocal') {
        key = `${sphere}_${addition}`;
      } else if (lensType === 'progressive') {
        const eye = this.extractEye(product);
        key = `${sphere}_${cylinder}_${addition}_${eye}`;
      }

      if (!groups[key]) {
        groups[key] = {
          sphere,
          cylinder,
          addition,
          eye: lensType === 'progressive' ? this.extractEye(product) : null,
          stock_surtido: 0,
          products: []
        };
      }

      groups[key].stock_surtido += (product.stock_surtido || 0);
      groups[key].products.push(product);
    });

    console.log('Grupos generados:', Object.keys(groups).length);
    return groups;
  },

  // Crear plantilla CSV para monofocales
  createMonofocalTemplate(groupedData, referencia) {
    const csvLines = [];

    // Crear tabla para esferas positivas
    csvLines.push([`${referencia} - MONOFOCALES - ESFERAS POSITIVAS`]);
    csvLines.push([]);

    // Encabezados para positivas
    const positiveHeader = ['ESF\\CIL'];
    this.cylinderRange.forEach(cyl => {
      positiveHeader.push(cyl === 'N' ? 'N' : (cyl >= 0 ? `+${cyl.toFixed(2)}` : cyl.toFixed(2)));
    });
    csvLines.push(positiveHeader);

    // Filas de esferas positivas
    this.sphereRanges.positive.forEach(sph => {
      const row = [sph >= 0 ? `+${sph.toFixed(2)}` : sph.toFixed(2)];

      this.cylinderRange.forEach(cyl => {
        const key = `${sph}_${cyl}`;
        const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
        row.push(stock > 0 ? stock : '');
      });

      csvLines.push(row);
    });

    csvLines.push([]);
    csvLines.push([]);

    // Crear tabla para esferas negativas
    csvLines.push([`${referencia} - MONOFOCALES - ESFERAS NEGATIVAS`]);
    csvLines.push([]);

    // Encabezados para negativas
    const negativeHeader = ['ESF\\CIL'];
    this.cylinderRange.forEach(cyl => {
      negativeHeader.push(cyl === 'N' ? 'N' : (cyl >= 0 ? `+${cyl.toFixed(2)}` : cyl.toFixed(2)));
    });
    csvLines.push(negativeHeader);

    // Filas de esferas negativas
    this.sphereRanges.negative.forEach(sph => {
      const row = [sph === 'N' ? 'N' : (sph >= 0 ? `+${sph.toFixed(2)}` : sph.toFixed(2))];

      this.cylinderRange.forEach(cyl => {
        const key = `${sph}_${cyl}`;
        const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
        row.push(stock > 0 ? stock : '');
      });

      csvLines.push(row);
    });

    return csvLines;
  },

  // Crear plantilla CSV para bifocales
  createBifocalTemplate(groupedData, referencia) {
    const csvLines = [];

    csvLines.push([`${referencia} - BIFOCALES`]);
    csvLines.push([]);

    // Encabezados (ESF\ADD)
    const header = ['ESF\\ADD'];
    this.additionRange.forEach(add => {
      header.push(`+${add.toFixed(2)}`);
    });
    csvLines.push(header);

    // Filas de esferas
    this.sphereRanges.bifocal.forEach(sph => {
      const row = [sph === 'N' ? 'N' : (sph >= 0 ? `+${sph.toFixed(2)}` : sph.toFixed(2))];

      this.additionRange.forEach(add => {
        const key = `${sph}_${add}`;
        const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
        row.push(stock > 0 ? stock : '');
      });

      csvLines.push(row);
    });

    return csvLines;
  },

  // Crear plantilla CSV para progresivos
  createProgressiveTemplate(groupedData, referencia) {
    const csvLines = [];

    csvLines.push([`${referencia} - PROGRESIVOS`]);
    csvLines.push([]);

    // Encabezados con doble columna por adición (R/L)
    const header = ['ESF\\ADD'];
    this.additionRange.forEach(add => {
      header.push(`+${add.toFixed(2)} R`);
      header.push(`+${add.toFixed(2)} L`);
    });
    csvLines.push(header);

    // Filas de esferas
    this.sphereRanges.bifocal.forEach(sph => {
      const row = [sph === 'N' ? 'N' : (sph >= 0 ? `+${sph.toFixed(2)}` : sph.toFixed(2))];

      this.additionRange.forEach(add => {
        // Buscar stock para ojo derecho y izquierdo
        let stockR = 0;
        let stockL = 0;

        // Buscar en todas las combinaciones de cilindros para esta esfera y adición
        this.cylinderRange.forEach(cyl => {
          const keyR = `${sph}_${cyl}_${add}_R`;
          const keyL = `${sph}_${cyl}_${add}_L`;
          const keyAmbos = `${sph}_${cyl}_${add}_AMBOS`;

          if (groupedData[keyR]) stockR += groupedData[keyR].stock_surtido;
          if (groupedData[keyL]) stockL += groupedData[keyL].stock_surtido;
          if (groupedData[keyAmbos]) {
            // Si es "AMBOS", dividir entre R y L
            const ambosStock = groupedData[keyAmbos].stock_surtido;
            stockR += Math.floor(ambosStock / 2);
            stockL += Math.ceil(ambosStock / 2);
          }
        });

        row.push(stockR > 0 ? stockR : '');
        row.push(stockL > 0 ? stockL : '');
      });

      csvLines.push(row);
    });

    return csvLines;
  },

  // Convertir arrays a CSV
  arrayToCSV(data) {
    return data.map(row =>
      row.map(cell => {
        const cellValue = (cell === null || cell === undefined) ? '' : cell.toString();
        // Escapar comillas y envolver en comillas si es necesario
        if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
          return '"' + cellValue.replace(/"/g, '""') + '"';
        }
        return cellValue;
      }).join(',')
    ).join('\n');
  },

  // Función principal de exportación
  exportUnifiedCSV(products, referencia) {
    if (!products || products.length === 0) {
      throw new Error('No hay productos para exportar');
    }

    console.log(`Iniciando exportación unificada para ${products.length} productos`);

    // Detectar tipo de lente
    const lensType = this.detectLensType(products[0]);
    console.log(`Tipo de lente detectado: ${lensType.toUpperCase()}`);

    // Agrupar productos
    const groupedData = this.groupProducts(products, lensType);

    // Crear plantilla según el tipo
    let csvData;
    switch (lensType) {
      case 'monofocal':
        csvData = this.createMonofocalTemplate(groupedData, referencia);
        break;
      case 'bifocal':
        csvData = this.createBifocalTemplate(groupedData, referencia);
        break;
      case 'progressive':
        csvData = this.createProgressiveTemplate(groupedData, referencia);
        break;
      default:
        throw new Error('Tipo de lente no reconocido');
    }

    // Convertir a CSV
    const csvContent = this.arrayToCSV(csvData);

    // Crear y descargar archivo
    const BOM = '\uFEFF'; // BOM para UTF-8
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${referencia}_inventario_${lensType}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      lensType,
      totalProducts: products.length,
      groupsCount: Object.keys(groupedData).length
    };
  }
};

export const transactionManager = {
  products: [],
  uniqueNames: [],
  modifiedProducts: new Set(),
  filteredProducts: [],
  currentReference: '',

  init() {
    const transactionsView = document.getElementById('transactions-view');

    transactionsView.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 ps-2">
                 <h2><i class="bi bi-clock-history me-2"></i>Almacenamiento de productos</h2>
            </div>
            <div class="search-section">
                <div class="search-container">
                    <label class="search-label" for="referencia">Buscar por referencia</label>
                    <select class="search-select form-select" id="referencia">
                        <option value="">Elegir referencia...</option>
                    </select>
                </div>
            </div>

            <div class="content-section">
                <div id="no-selection" class="no-selection text-center py-5">
                    <div class="icon mb-3" style="font-size: 3rem;">👓</div>
                    <p class="text-muted">Elija una referencia para mostrar resultados...</p>
                </div>

                <div id="table-content" class="table-container" style="display: none;">
    <div class="table-header d-flex justify-content-between align-items-center mb-3">
        <div class="table-title">
            <span class="badge bg-primary fs-6" id="selected-reference">Mon Cr</span>
        </div>
        <div class="button-group">
            <button class="btn btn-warning me-2" id="save-all-changes-btn">
                <i class="bi bi-save"></i> Guardar todos los cambios
            </button>
            <button class="btn btn-success" id="export-csv-btn">
                <i class="bi bi-file-earmark-spreadsheet"></i> Exportar Plantilla CSV
            </button>
        </div>
    </div>

    <!-- BARRA DE BÚSQUEDA -->
    <div class="search-bar-container">
        <input type="text"
               class="search-bar"
               id="products-search-bar"
               placeholder="🔍 Buscar por código, esfera, cilindro, adición o estado...">
    </div>
                    <div class="table-wrapper" style="max-height: calc(100vh - 400px); min-height: 400px; overflow-y: auto; padding-bottom: 20px;">
                        <table class="table table-striped" id="products-table">
                            <thead class="table-dark sticky-top">
                              <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Esfera</th>
                                <th>Cilindro</th>
                                <th>Adición</th>
                                <th>Stock Surtido</th>
                                <th>Stock Almacenado</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                            <tbody id="table-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

    this.loadProducts();
    this.bindEvents();
  },

  async loadProducts() {
    try {
      this.products = await window.api.getProducts();
      this.sortProductsById();
      this.extractUniqueNames();
      this.populateReferenceSelect();
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

  extractUniqueNames() {
    const namesSet = new Set();
    this.products.forEach(product => {
      if (product.name && product.name.trim()) {
        namesSet.add(product.name.trim());
      }
    });
    this.uniqueNames = Array.from(namesSet).sort();
  },

  populateReferenceSelect() {
    const referenciaSelect = document.getElementById('referencia');
    if (!referenciaSelect) return;

    referenciaSelect.innerHTML = '<option value="">Elegir referencia...</option>';

    this.uniqueNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      referenciaSelect.appendChild(option);
    });
  },

  bindEvents() {
    const referenciaSelect = document.getElementById('referencia');
    if (referenciaSelect) {
      referenciaSelect.addEventListener('change', (e) => {
        this.loadReferencia(e.target.value);
      });
    }

    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportUnifiedCSV();
      });
    }

    const saveAllBtn = document.getElementById('save-all-changes-btn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        this.saveAllChanges();
      });
    }

    const searchBar = document.getElementById('products-search-bar');
    if (searchBar) {
      searchBar.addEventListener('input', (e) => {
        this.filterTableResults(e.target.value);
      });
    }
  },

  getStatusInfo(stock_surtido) {
    if (stock_surtido >= 10) return { class: 'text-success', text: 'Bueno', icon: '🟢' };
    if (stock_surtido >= 5 & stock_surtido < 10) return { class: 'text-warning', text: 'Bajo', icon: '🟡' };
    return { class: 'text-danger', text: 'Crítico', icon: '🔴' };
  },

  loadReferencia(referencia) {
    const noSelection = document.getElementById('no-selection');
    const tableContent = document.getElementById('table-content');
    const selectedReference = document.getElementById('selected-reference');
    const searchBar = document.getElementById('products-search-bar');

    if (!referencia) {
      noSelection.style.display = 'block';
      tableContent.style.display = 'none';
      this.modifiedProducts.clear();
      this.updateSaveAllButton();
      return;
    }

    this.filteredProducts = this.products.filter(product =>
      product.name && product.name.trim() === referencia
    );
    this.currentReference = referencia;

    if (this.filteredProducts.length === 0) {
      noSelection.style.display = 'block';
      tableContent.style.display = 'none';
      this.modifiedProducts.clear();
      this.updateSaveAllButton();
      return;
    }

    noSelection.style.display = 'none';
    tableContent.style.display = 'block';
    selectedReference.textContent = referencia;

    this.modifiedProducts.clear();
    this.updateSaveAllButton();

    if (searchBar) {
      searchBar.value = '';
    }

    this.renderFilteredProducts(this.filteredProducts);
  },

  filterTableResults(searchTerm) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody || !this.filteredProducts.length) return;

    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.renderFilteredProducts(this.filteredProducts);
      return;
    }

    const searchResults = this.filteredProducts.filter(product => {
      return (
        product.barcode.toLowerCase().includes(term) ||
        product.sphere.toLowerCase().includes(term) ||
        product.cylinder.toLowerCase().includes(term) ||
        product.addition.toLowerCase().includes(term) ||
        this.getStatusInfo(product.stock_surtido || 0).text.toLowerCase().includes(term)
      );
    });

    this.renderFilteredProducts(searchResults);
  },

  renderFilteredProducts(productsToRender) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const table = document.getElementById('products-table');
    if (table && !table.classList.contains('table-base')) {
      table.classList.add('table-base');
    }

    const container = table.closest('.table-container');
    if (container && !container.classList.contains('table-container-base')) {
      container.classList.add('table-container-base');
    }

    if (productsToRender.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `
            <td colspan="9" class="text-center text-muted py-4">
                <i class="bi bi-search"></i> No se encontraron productos con los criterios de búsqueda
            </td>
        `;
      tableBody.appendChild(row);
      return;
    }

    productsToRender.forEach(product => {
      const status = this.getStatusInfo(product.stock_surtido || 0);
      const stockAlmacenado = (product.stock || 0) - (product.stock_surtido || 0);

      const row = document.createElement('tr');
      row.innerHTML = `
            <td>${product.barcode}</td>
            <td><strong>${product.name}</strong></td>
            <td>${product.sphere}</td>
            <td>${product.cylinder}</td>
            <td>${product.addition}</td>
            <td>
                <div class="d-flex align-items-center">
                    <button class="btn btn-sm btn-outline-secondary me-1 quantity-btn" 
                            data-id="${product._id}" data-field="stock_surtido" data-change="-1">
                        <i class="bi bi-dash"></i>
                    </button>
                    <input type="number" class="form-control form-control-sm quantity-input mx-1" 
                           value="${product.stock_surtido || 0}" style="width: 80px;"
                           data-id="${product._id}" data-field="stock_surtido" min="0" max="${product.stock || 0}">
                    <button class="btn btn-sm btn-outline-secondary ms-1 quantity-btn" 
                            data-id="${product._id}" data-field="stock_surtido" data-change="1">
                        <i class="bi bi-plus"></i>
                    </button>
                </div>
            </td>
            <td>
                <span class="text-muted">${stockAlmacenado}</span>
            </td>
            <td>
                <span class="${status.class}">
                    ${status.icon} ${status.text}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary save-changes-btn" 
                        data-id="${product._id}" title="Guardar cambios">
                    <i class="bi bi-check-lg"></i>
                </button>
            </td>
        `;
      tableBody.appendChild(row);
    });

    this.bindTableEvents();
  },

  bindTableEvents() {
    document.querySelectorAll('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('.quantity-btn').dataset.id;
        const field = e.target.closest('.quantity-btn').dataset.field;
        const change = parseInt(e.target.closest('.quantity-btn').dataset.change);
        this.updateQuantity(productId, field, change);
      });
    });

    document.querySelectorAll('.quantity-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const productId = e.target.dataset.id;
        const field = e.target.dataset.field;
        const value = parseInt(e.target.value) || 0;
        this.setQuantity(productId, field, value);
      });
    });

    document.querySelectorAll('.save-changes-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.closest('.save-changes-btn').dataset.id;
        this.saveProductChanges(productId);
      });
    });
  },

  updateQuantity(productId, field, change) {
    const product = this.products.find(p => p._id === productId);
    if (!product) return;

    if (field !== 'stock_surtido') return;

    const currentValue = product.stock_surtido || 0;
    const maxStock = product.stock || 0;

    let newValue = currentValue + change;

    if (newValue < 0) newValue = 0;
    if (newValue > maxStock) newValue = maxStock;

    product.stock_surtido = newValue;

    this.modifiedProducts.add(productId);
    this.updateSaveAllButton();

    this.updateProductDisplay(productId);
  },

  setQuantity(productId, field, value) {
    const product = this.products.find(p => p._id === productId);
    if (!product) return;

    if (field !== 'stock_surtido') return;

    const maxValue = product.stock || 0;

    value = Math.max(0, Math.min(value, maxValue));

    product.stock_surtido = value;

    this.modifiedProducts.add(productId);
    this.updateSaveAllButton();

    this.updateProductDisplay(productId);
  },

  updateProductDisplay(productId) {
    const product = this.products.find(p => p._id === productId);
    if (!product) return;

    const stockSurtidoInput = document.querySelector(`input[data-id="${productId}"][data-field="stock_surtido"]`);
    if (stockSurtidoInput) {
      stockSurtidoInput.value = product.stock_surtido || 0;
    }

    const stockAlmacenado = (product.stock || 0) - (product.stock_surtido || 0);
    const stockAlmacenadoCell = stockSurtidoInput?.closest('tr')?.children[6];
    if (stockAlmacenadoCell) {
      stockAlmacenadoCell.innerHTML = `<span class="text-muted">${stockAlmacenado}</span>`;
    }

    const status = this.getStatusInfo(product.stock_surtido || 0);
    const statusCell = stockSurtidoInput?.closest('tr')?.children[7];
    if (statusCell) {
      statusCell.innerHTML = `<span class="${status.class}">${status.icon} ${status.text}</span>`;
    }
  },

  updateSaveAllButton() {
    const saveAllBtn = document.getElementById('save-all-changes-btn');
    if (saveAllBtn) {
      if (this.modifiedProducts.size > 0) {
        saveAllBtn.disabled = false;
        saveAllBtn.innerHTML = `<i class="bi bi-save"></i> Guardar cambios (${this.modifiedProducts.size})`;
      } else {
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<i class="bi bi-save"></i> Guardar todos los cambios';
      }
    }
  },

  async saveAllChanges() {
    if (this.modifiedProducts.size === 0) {
      uiManager.showAlert('No hay cambios para guardar', 'info');
      return;
    }

    try {
      const saveAllBtn = document.getElementById('save-all-changes-btn');
      saveAllBtn.disabled = true;
      saveAllBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

      const promises = Array.from(this.modifiedProducts).map(productId => {
        const product = this.products.find(p => p._id === productId);
        if (!product) return Promise.resolve();

        const updateData = {
          stock: product.stock || 0,
          stock_surtido: product.stock_surtido || 0
        };

        console.log(`Enviando datos para producto ${productId}:`, updateData);
        return window.api.updateProductStock(productId, updateData);
      });

      await Promise.all(promises);

      uiManager.showAlert(`${this.modifiedProducts.size} productos actualizados correctamente`, 'success');

      this.modifiedProducts.clear();
      this.updateSaveAllButton();

      await this.loadProducts();

      const selectedRef = document.getElementById('referencia').value;
      if (selectedRef) {
        this.loadReferencia(selectedRef);
      }

    } catch (error) {
      console.error('Error al guardar cambios:', error);
      uiManager.showAlert(`Error al guardar los cambios: ${error.message}`, 'danger');
      this.updateSaveAllButton();
    }
  },

  async saveProductChanges(productId) {
    try {
      const product = this.products.find(p => p._id === productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      const updateData = {
        stock: product.stock || 0,
        stock_surtido: product.stock_surtido || 0
      };

      console.log(`Enviando datos individuales para producto ${productId}:`, updateData);

      if (typeof window.api.updateProductStock === 'function') {
        await window.api.updateProductStock(productId, updateData);
      } else if (typeof window.api.updateProduct === 'function') {
        await window.api.updateProduct(productId, updateData);
      } else {
        throw new Error('Función de actualización no disponible');
      }

      uiManager.showAlert('Stock actualizado correctamente', 'success');

      this.modifiedProducts.delete(productId);
      this.updateSaveAllButton();

      await this.loadProducts();

      const selectedRef = document.getElementById('referencia').value;
      if (selectedRef) {
        this.loadReferencia(selectedRef);
      }

    } catch (error) {
      console.error('Error al actualizar stock:', error);
      uiManager.showAlert(`Error al actualizar el stock: ${error.message}`, 'danger');
    }
  },

  // FUNCIÓN DE EXPORTACIÓN UNIFICADA CSV - CORREGIDA
  exportUnifiedCSV() {
    const referencia = document.getElementById('referencia').value;
    if (!referencia) {
      uiManager.showAlert('Por favor selecciona una referencia primero', 'warning');
      return;
    }

    const filteredProducts = this.products.filter(product =>
      product.name && product.name.trim() === referencia
    );

    if (filteredProducts.length === 0) {
      uiManager.showAlert('No hay productos para exportar', 'warning');
      return;
    }

    try {
      // CORREGIDO: Usar exportUnifiedCSV en lugar de exportUnifiedHTML
      const result = unifiedExportSystem.exportUnifiedCSV(filteredProducts, referencia);

      uiManager.showAlert(
        `Plantilla ${result.lensType.toUpperCase()} exportada correctamente - ${result.totalProducts} productos procesados`,
        'success'
      );
    } catch (error) {
      console.error('Error en exportación:', error);
      uiManager.showAlert(`Error al generar plantilla: ${error.message}`, 'danger');
    }
  }
};