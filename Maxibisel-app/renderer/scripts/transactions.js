// Gestión de Surtido - VERSIÓN UNIFICADA CON EXPORTACIÓN CSV - CORREGIDA
import { eventManager } from './eventManager.js';
import { uiManager } from './ui.js';

const loadXLSX = async () => {
  if (typeof XLSX === 'undefined') {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('No se pudo cargar SheetJS'));
      document.head.appendChild(script);
    });
  }
  return window.XLSX;
};
// Sistema unificado de exportación CSV integrado
const unifiedExportSystem = {
  // Verificar que XLSX esté disponible
  // Rangos estándar para la industria óptica
  sphereRanges: {
    positive: [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00],
    negative: ['N', -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00, -4.25, -4.50, -4.75, -5.00, -5.25, -5.50, -5.75, -6.00],
    bifocal: ['N', 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00,]
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
    const cylinder = this.normalizeValue(firstProduct.cylinder);

    console.log('Valores detectados:', { addition, cylinder });

    // MONOFOCAL: Tiene esfera y/o cilindro, pero NO tiene adición
    if (addition === 'N' || addition === 0) {
      console.log('Detectado: MONOFOCAL (sin adición)');
      return 'monofocal';
    }

    // Tiene adición válida, revisar si es bifocal o progresivo
    if (addition > 0) {
      // Verificar lateralidad en el código de barras o adición misma
      const barcodeText = (firstProduct.barcode || '').toUpperCase();
      const additionText = (firstProduct.addition || '').toUpperCase();

      // Los progresivos típicamente tienen R o L al final de la adición
      const hasLaterality =
        additionText.endsWith('R') ||
        additionText.endsWith('L') ||
        barcodeText.includes(' R') ||
        barcodeText.includes(' L') ||
        barcodeText.includes('OD') ||
        barcodeText.includes('OS');

      if (hasLaterality) {
        console.log('Detectado: PROGRESIVO (con lateralidad R/L)');
        return 'progressive';
      } else {
        console.log('Detectado: BIFOCAL (con adición sin lateralidad)');
        return 'bifocal';
      }
    }

    // Por defecto, si no se determina, es monofocal
    console.log('Detectado: MONOFOCAL (por defecto)');
    return 'monofocal';
  }, 

  // Extraer lateralidad del producto (para progresivos)
  extractEye(product) {
    // Revisar primero en la adición misma
    const additionText = (product.addition || '').toUpperCase().trim();

    if (additionText.endsWith('R') || additionText.endsWith(' R')) return 'R';
    if (additionText.endsWith('L') || additionText.endsWith(' L')) return 'L';

    // Si no está en adición, revisar código de barras
    const barcodeText = (product.barcode || '').toUpperCase();

    if (barcodeText.includes('OD') || barcodeText.includes(' R')) return 'R';
    if (barcodeText.includes('OS') || barcodeText.includes(' L')) return 'L';

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

    // ==================== TABLA DE ESFERAS POSITIVAS ====================
    csvLines.push([`INVENTARIO: ${referencia}`]);
    csvLines.push([]);
    csvLines.push(['POSITIVO']);
    csvLines.push([]);

    // Encabezado: ESF \ CIL
    const positiveHeader = ['ESF \\ CIL'];
    this.cylinderRange.forEach(cyl => {
      if (cyl === 'N') {
        positiveHeader.push('N');
      } else {
        positiveHeader.push(cyl.toFixed(2));
      }
    });
    csvLines.push(positiveHeader);

    // Filas de esferas positivas
    this.sphereRanges.positive.forEach(sph => {
      const row = [`+${sph.toFixed(2)}`];

      this.cylinderRange.forEach(cyl => {
        const key = `${sph}_${cyl}`;
        const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
        row.push(stock || '');
      });

      csvLines.push(row);
    });

    csvLines.push([]);
    csvLines.push([]);
    csvLines.push([]);

    // ==================== TABLA DE ESFERAS NEGATIVAS ====================
    csvLines.push(['NEGATIVO']);
    csvLines.push([]);

    // Encabezado
    const negativeHeader = ['ESF \\ CIL'];
    this.cylinderRange.forEach(cyl => {
      if (cyl === 'N') {
        negativeHeader.push('N');
      } else {
        negativeHeader.push(cyl.toFixed(2));
      }
    });
    csvLines.push(negativeHeader);

    // Filas de esferas negativas (incluyendo N/PLANO)
    this.sphereRanges.negative.forEach(sph => {
      const row = [sph === 'N' ? 'N' : sph.toFixed(2)];

      this.cylinderRange.forEach(cyl => {
        const key = `${sph}_${cyl}`;
        const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
        row.push(stock || '');
      });

      csvLines.push(row);
    });

    return csvLines;
  }, 

  // Crear plantilla CSV para bifocales
  createBifocalTemplate(groupedData, referencia) {
    const csvLines = [];

    // ==================== TABLA DE ESFERAS POSITIVAS ====================
    csvLines.push([`INVENTARIO: ${referencia}`]);
    csvLines.push([]);
    csvLines.push(['POSITIVO']);
    csvLines.push([]);

    // Encabezado: ESF \ ADD
    const positiveHeader = ['ESF \\ ADD'];
    this.additionRange.forEach(add => {
      positiveHeader.push(`+${add.toFixed(2)}`);
    });
    csvLines.push(positiveHeader);

    // Filas de esferas positivas (hasta 3.00)
    this.sphereRanges.positive.forEach(sph => {
      if (sph <= 3.00) {
        const row = [`+${sph.toFixed(2)}`];

        this.additionRange.forEach(add => {
          const key = `${sph}_${add}`;
          const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
          row.push(stock || '');
        });

        csvLines.push(row);
      }
    });

    csvLines.push([]);
    csvLines.push([]);
    csvLines.push([]);

    // ==================== TABLA DE ESFERAS NEGATIVAS ====================
    csvLines.push(['NEGATIVO']);
    csvLines.push([]);

    // Encabezado
    const negativeHeader = ['ESF \\ ADD'];
    this.additionRange.forEach(add => {
      negativeHeader.push(`+${add.toFixed(2)}`);
    });
    csvLines.push(negativeHeader);

    // Filas de esferas negativas (N hasta -3.00)
    this.sphereRanges.negative.forEach(sph => {
      if (sph === 'N' || sph >= -3.00) {
        const row = [sph === 'N' ? 'N' : sph.toFixed(2)];

        this.additionRange.forEach(add => {
          const key = `${sph}_${add}`;
          const stock = groupedData[key] ? groupedData[key].stock_surtido : 0;
          row.push(stock || '');
        });

        csvLines.push(row);
      }
    });

    return csvLines;
  },

  
  // Crear plantilla CSV para progresivos
  createProgressiveTemplate(groupedData, referencia) {
    const csvLines = [];

    // ==================== TABLA DE ESFERAS POSITIVAS ====================
    csvLines.push([`INVENTARIO: ${referencia}`]);
    csvLines.push([]);
    csvLines.push(['POSITIVO']);
    csvLines.push([]);

    // Encabezado con columnas R/L para cada adición
    const positiveHeader = ['ESF \\ ADD'];
    this.additionRange.forEach(add => {
      positiveHeader.push(`+${add.toFixed(2)} R`);
      positiveHeader.push(`+${add.toFixed(2)} L`);
    });
    csvLines.push(positiveHeader);

    // Filas de esferas positivas (hasta 3.00)
    this.sphereRanges.positive.forEach(sph => {
      if (sph <= 3.00) {
        const row = [`+${sph.toFixed(2)}`];

        this.additionRange.forEach(add => {
          let stockR = 0;
          let stockL = 0;

          this.cylinderRange.forEach(cyl => {
            const keyR = `${sph}_${cyl}_${add}_R`;
            const keyL = `${sph}_${cyl}_${add}_L`;
            const keyAmbos = `${sph}_${cyl}_${add}_AMBOS`;

            if (groupedData[keyR]) stockR += groupedData[keyR].stock_surtido;
            if (groupedData[keyL]) stockL += groupedData[keyL].stock_surtido;

            if (groupedData[keyAmbos]) {
              const ambosStock = groupedData[keyAmbos].stock_surtido;
              stockR += Math.floor(ambosStock / 2);
              stockL += Math.ceil(ambosStock / 2);
            }
          });

          row.push(stockR || '');
          row.push(stockL || '');
        });

        csvLines.push(row);
      }
    });

    csvLines.push([]);
    csvLines.push([]);
    csvLines.push([]);

    // ==================== TABLA DE ESFERAS NEGATIVAS ====================
    csvLines.push(['NEGATIVO']);
    csvLines.push([]);

    // Encabezado
    const negativeHeader = ['ESF \\ ADD'];
    this.additionRange.forEach(add => {
      negativeHeader.push(`+${add.toFixed(2)} R`);
      negativeHeader.push(`+${add.toFixed(2)} L`);
    });
    csvLines.push(negativeHeader);

    // Filas de esferas negativas (N hasta -3.00)
    this.sphereRanges.negative.forEach(sph => {
      if (sph === 'N' || sph >= -3.00) {
        const row = [sph === 'N' ? 'N' : sph.toFixed(2)];

        this.additionRange.forEach(add => {
          let stockR = 0;
          let stockL = 0;

          this.cylinderRange.forEach(cyl => {
            const keyR = `${sph}_${cyl}_${add}_R`;
            const keyL = `${sph}_${cyl}_${add}_L`;
            const keyAmbos = `${sph}_${cyl}_${add}_AMBOS`;

            if (groupedData[keyR]) stockR += groupedData[keyR].stock_surtido;
            if (groupedData[keyL]) stockL += groupedData[keyL].stock_surtido;

            if (groupedData[keyAmbos]) {
              const ambosStock = groupedData[keyAmbos].stock_surtido;
              stockR += Math.floor(ambosStock / 2);
              stockL += Math.ceil(ambosStock / 2);
            }
          });

          row.push(stockR || '');
          row.push(stockL || '');
        });

        csvLines.push(row);
      }
    });

    return csvLines;
  },

  // Convertir arrays a CSV
  arrayToCSV(data) {
    return data.map(row =>
      row.map(cell => {
        const cellValue = (cell === null || cell === undefined) ? '' : cell.toString();
        // Escapar comillas y envolver en comillas si es necesario
        if (cellValue.includes(';') || cellValue.includes('"') || cellValue.includes('\n')) {
          return '"' + cellValue.replace(/"/g, '""') + '"';
        }
        return cellValue;
      }).join(';')  // ← CAMBIO: Punto y coma en lugar de coma
    ).join('\n');
  },
  // Nueva función: Exportar a Excel con formato
  // Nueva función: Exportar a Excel con formato
  // Función mejorada: Exportar como HTML con formato (Excel lo abre perfectamente)
  async exportToExcel(data, referencia, lensType) {
    try {
      let html = `
        <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="UTF-8">
          <style>
            table { 
              border-collapse: collapse; 
              font-family: Arial, sans-serif; 
              font-size: 10pt;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 4px 8px;
              text-align: center; 
              white-space: nowrap;
            }
            .title { 
              background-color: #4472C4; 
              color: white; 
              font-weight: bold; 
              font-size: 12pt; 
              padding: 8px;
            }
            .section { 
              background-color: #D9E1F2; 
              font-weight: bold; 
              font-size: 11pt; 
              padding: 6px;
            }
            .header { 
              background-color: #5B9BD5; 
              color: white; 
              font-weight: bold; 
              padding: 5px 8px;
            }
            .row-header { 
              font-weight: bold; 
              background-color: #F2F2F2;
            }
            td:first-child {
              width: 80px;
            }
            td:not(:first-child) {
              width: 60px;
            }
          </style>
        </head>
        <body>
          <table>
      `;

      data.forEach((row, rowIndex) => {
        html += '<tr>';

        row.forEach((cell, colIndex) => {
          const cellValue = (cell === null || cell === undefined || cell === '') ? '&nbsp;' : cell;
          const cellStr = cellValue.toString();

          // Determinar clase de la celda
          let cellClass = '';
          if (cellStr.includes('INVENTARIO:')) {
            cellClass = 'title';
          } else if (cellStr.includes('ESFERAS POSITIVAS') || cellStr.includes('ESFERAS NEGATIVAS')) {
            cellClass = 'section';
          } else if (cellStr.includes('ESF \\')) {
            cellClass = 'header';
          } else if (colIndex === 0 && cellStr !== '&nbsp;' && cellStr !== '') {
            cellClass = 'row-header';
          }

          html += `<td class="${cellClass}">${cellValue}</td>`;
        });

        html += '</tr>';
      });

      html += `
          </table>
        </body>
        </html>
      `;

      // Crear y descargar archivo
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${referencia}_inventario_${lensType}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error al generar Excel:', error);
      throw new Error(`No se pudo generar el archivo Excel: ${error.message}`);
    }
  },

  // Función principal de exportación
  async exportUnifiedCSV(products, referencia) {

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

    // Exportar a Excel con formato
    await this.exportToExcel(csvData, referencia, lensType);

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

    this.setupSyncListeners();
    this.loadProducts();
    this.bindEvents();

    console.log('✅ TransactionManager inicializado completamente');
  },

  async loadProducts() {
    try {
      console.log('Cargando productos...');
      const response = await window.api.getProducts();
      
      console.log('📦 Respuesta completa del servidor:', response);
      
      // CORRECCIÓN PRINCIPAL: Extraer el array 'products' de la respuesta
      if (response && response.success && Array.isArray(response.products)) {
        this.products = response.products;
        console.log(`✅ ${this.products.length} productos cargados correctamente`);
      } 
      // Alternativa: Si la respuesta ES directamente un array (por si acaso)
      else if (Array.isArray(response)) {
        this.products = response;
        console.log(`✅ ${this.products.length} productos cargados (formato array directo)`);
      } 
      // Si no hay productos o formato incorrecto
      else {
        console.warn('⚠️ La respuesta no contiene productos válidos:', response);
        this.products = [];
      }
      
      // Continuar con el procesamiento solo si hay productos
      if (this.products.length > 0) {
        this.sortProductsById();
        this.extractUniqueNames();
        this.populateReferenceSelect();
      } else {
        console.warn('⚠️ No hay productos para procesar');
        this.uniqueNames = [];
        this.populateReferenceSelect(); // Limpiar el select
      }
      
    } catch (error) {
      console.error('💥 Error al cargar productos:', error);
      this.products = [];
      this.uniqueNames = [];
      uiManager.showAlert('Error al cargar los productos: ' + error.message, 'danger');
    }
  },

  sortProductsById() {
    // CORRECCIÓN: Verificar que this.products sea un array antes de ordenar
    if (!Array.isArray(this.products)) {
      console.warn('this.products no es un array, inicializando como array vacío');
      this.products = [];
      return;
    }

    try {
      this.products.sort((a, b) => {
        // Manejo seguro de IDs que podrían ser undefined
        const idA = a._id || a.id || '';
        const idB = b._id || b.id || '';
        
        if (idA < idB) return -1;
        if (idA > idB) return 1;
        return 0;
      });
      console.log('Productos ordenados correctamente');
    } catch (error) {
      console.error('Error al ordenar productos:', error);
    }
  },

  extractUniqueNames() {
  if (!Array.isArray(this.products)) {
    console.warn('⚠️ this.products no es un array válido');
    this.uniqueNames = [];
    return;
  }

  const namesSet = new Set();
  
  this.products.forEach(product => {
    // Validar que el producto y su name existen
    if (product && product.name && typeof product.name === 'string') {
      const trimmedName = product.name.trim();
      if (trimmedName.length > 0) {
        namesSet.add(trimmedName);
      }
    }
  });
  
  this.uniqueNames = Array.from(namesSet).sort();
  
  console.log(`📋 Referencias únicas encontradas: ${this.uniqueNames.length}`);
  
  // Mostrar las primeras 5 referencias para verificar
  if (this.uniqueNames.length > 0) {
    console.log('🔤 Primeras referencias:', this.uniqueNames.slice(0, 5));
  }
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
    if (stock_surtido >= 5 && stock_surtido < 10) return { class: 'text-warning', text: 'Bajo', icon: '🟡' };
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

    // CORRECCIÓN: Verificar que this.products sea un array
    if (!Array.isArray(this.products)) {
      console.error('this.products no es un array');
      this.filteredProducts = [];
    } else {
      this.filteredProducts = this.products.filter(product =>
        product && product.name && product.name.trim() === referencia
      );
    }
    
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
        (product.barcode && product.barcode.toLowerCase().includes(term)) ||
        (product.sphere && product.sphere.toLowerCase().includes(term)) ||
        (product.cylinder && product.cylinder.toLowerCase().includes(term)) ||
        (product.addition && product.addition.toLowerCase().includes(term)) ||
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
            <td>${product.barcode || ''}</td>
            <td><strong>${product.name || ''}</strong></td>
            <td>${product.sphere || ''}</td>
            <td>${product.cylinder || ''}</td>
            <td>${product.addition || ''}</td>
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

  async saveProductChanges(productId) {
    console.log('\n========================================');
    console.log('💾 [CLIENT] GUARDANDO CAMBIOS DE PRODUCTO');
    console.log('========================================');
    console.log('📦 ProductID:', productId);
    
    try {
        const product = this.products.find(p => p._id === productId);
        
        if (!product) {
            console.error('❌ [CLIENT] ERROR: Producto no encontrado en cache');
            throw new Error('Producto no encontrado en la memoria local');
        }

        console.log('📝 [CLIENT] Datos del producto antes de guardar:');
        console.log('   - Nombre:', product.name);
        console.log('   - Código:', product.barcode);
        console.log('   - Stock total:', product.stock);
        console.log('   - Stock surtido:', product.stock_surtido);
        console.log('   - Stock almacenado:', (product.stock || 0) - (product.stock_surtido || 0));

        // VALIDACIÓN CRÍTICA en cliente
        const stockTotal = parseInt(product.stock) || 0;
        const stockSurtido = parseInt(product.stock_surtido) || 0;

        if (stockSurtido > stockTotal) {
            const errorMsg = `El stock surtido (${stockSurtido}) no puede exceder el stock total (${stockTotal})`;
            console.error('❌ [CLIENT] ERROR DE VALIDACIÓN:', errorMsg);
            uiManager.showAlert(errorMsg, 'danger');
            return;
        }

        const updateData = {
            stock: stockTotal,
            stock_surtido: stockSurtido
        };

        console.log('📤 [CLIENT] Enviando datos al servidor...');
        console.log('   Datos:', JSON.stringify(updateData, null, 2));

        // Mostrar indicador de carga
        const saveBtn = document.querySelector(`.save-changes-btn[data-id="${productId}"]`);
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        }

        // Realizar petición con timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: El servidor tardó demasiado en responder')), 10000)
        );

        const updatePromise = window.api.updateProductStock(productId, updateData);
        
        const response = await Promise.race([updatePromise, timeoutPromise]);

        console.log('📥 [CLIENT] Respuesta del servidor recibida:');
        console.log(JSON.stringify(response, null, 2));

        // VERIFICAR RESPUESTA
        if (!response || !response.success) {
            console.error('❌ [CLIENT] ERROR: Respuesta inválida del servidor');
            console.error('   Respuesta completa:', response);
            
            throw new Error(
                response?.message || 
                response?.error || 
                'Error desconocido al actualizar el producto'
            );
        }

        // VERIFICAR DATOS ACTUALIZADOS
        if (!response.product) {
            console.error('❌ [CLIENT] ERROR: El servidor no devolvió el producto actualizado');
            throw new Error('Respuesta incompleta del servidor');
        }

        console.log('✅ [CLIENT] Producto actualizado en servidor:');
        console.log('   - Stock guardado:', response.product.stock);
        console.log('   - Stock surtido guardado:', response.product.stock_surtido);
        console.log('   - Stock almacenado:', response.product.stock_almacenado);

        // VERIFICAR CONSISTENCIA
        if (response.product.stock !== stockTotal) {
            console.warn('⚠️ [CLIENT] ADVERTENCIA: Discrepancia en stock total');
            console.warn('   Esperado:', stockTotal);
            console.warn('   Guardado:', response.product.stock);
        }

        if (response.product.stock_surtido !== stockSurtido) {
            console.warn('⚠️ [CLIENT] ADVERTENCIA: Discrepancia en stock surtido');
            console.warn('   Esperado:', stockSurtido);
            console.warn('   Guardado:', response.product.stock_surtido);
        }

        // Actualizar cache local con datos verificados del servidor
        const index = this.products.findIndex(p => p._id === productId);
        if (index !== -1) {
            this.products[index] = {
                ...this.products[index],
                ...response.product
            };
            console.log('✅ [CLIENT] Cache local actualizado');
        }

        // Remover de lista de modificados
        this.modifiedProducts.delete(productId);
        this.updateSaveAllButton();

        // Mensaje de éxito detallado
        let successMsg = 'Stock actualizado correctamente';
        if (response.changes) {
            const { stockChanged, stockSurtidoChanged } = response.changes;
            if (stockChanged && stockSurtidoChanged) {
                successMsg += ' (Stock total y surtido)';
            } else if (stockChanged) {
                successMsg += ' (Stock total)';
            } else if (stockSurtidoChanged) {
                successMsg += ' (Stock surtido)';
            }
        }

        uiManager.showAlert(successMsg, 'success');

        // Restaurar botón
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
        }

        // Actualizar display
        this.updateProductDisplay(productId);

        console.log('========================================');
        console.log('✅ [CLIENT] GUARDADO COMPLETADO');
        console.log('========================================\n');

        // Recargar productos después de un pequeño delay (para asegurar sincronización)
        setTimeout(async () => {
            console.log('🔄 [CLIENT] Recargando productos para verificar...');
            await this.loadProducts();
            
            const selectedRef = document.getElementById('referencia')?.value;
            if (selectedRef) {
                this.loadReferencia(selectedRef);
            }
        }, 500);

    } catch (error) {
        console.error('\n========================================');
        console.error('💥 [CLIENT] ERROR AL GUARDAR');
        console.error('========================================');
        console.error('Error completo:', error);
        console.error('ProductID:', productId);
        console.error('Stack trace:', error.stack);
        console.error('========================================\n');

        // Restaurar botón
        const saveBtn = document.querySelector(`.save-changes-btn[data-id="${productId}"]`);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-x-lg text-danger"></i>';
            
            // Restaurar después de 2 segundos
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
            }, 2000);
        }

        // Mensaje de error detallado
        let errorMsg = 'Error al actualizar el stock';
        
        if (error.message.includes('Timeout')) {
            errorMsg = 'Error: El servidor no respondió a tiempo';
        } else if (error.message.includes('stock surtido')) {
            errorMsg = error.message;
        } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
            errorMsg = 'Error de conexión: Verifica tu conexión a internet';
        } else if (error.message) {
            errorMsg += ': ' + error.message;
        }

        uiManager.showAlert(errorMsg, 'danger');
    }
},

async saveAllChanges() {
    if (this.modifiedProducts.size === 0) {
        uiManager.showAlert('No hay cambios para guardar', 'info');
        return;
    }

    console.log('\n========================================');
    console.log('💾 [CLIENT] GUARDANDO TODOS LOS CAMBIOS');
    console.log('========================================');
    console.log('📦 Total de productos modificados:', this.modifiedProducts.size);

    try {
        const saveAllBtn = document.getElementById('save-all-changes-btn');
        if (saveAllBtn) {
            saveAllBtn.disabled = true;
            saveAllBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> Guardando ${this.modifiedProducts.size} productos...`;
        }

        const results = {
            successful: [],
            failed: []
        };

        // Guardar productos uno por uno (con logging detallado)
        for (const productId of Array.from(this.modifiedProducts)) {
            const product = this.products.find(p => p._id === productId);
            
            if (!product) {
                console.warn(`⚠️ [CLIENT] Producto ${productId} no encontrado en cache`);
                results.failed.push({ productId, error: 'No encontrado en cache' });
                continue;
            }

            console.log(`\n📝 [CLIENT] Guardando producto ${product.name} (${product.barcode})`);

            try {
                // Validación
                const stockTotal = parseInt(product.stock) || 0;
                const stockSurtido = parseInt(product.stock_surtido) || 0;

                if (stockSurtido > stockTotal) {
                    throw new Error(`Stock surtido (${stockSurtido}) excede stock total (${stockTotal})`);
                }

                const updateData = {
                    stock: stockTotal,
                    stock_surtido: stockSurtido
                };

                console.log(`   📤 Enviando:`, updateData);

                const response = await window.api.updateProductStock(productId, updateData);

                if (response && response.success) {
                    console.log(`   ✅ Guardado exitosamente`);
                    results.successful.push({
                        productId,
                        name: product.name,
                        changes: response.changes
                    });

                    // Actualizar cache
                    const index = this.products.findIndex(p => p._id === productId);
                    if (index !== -1 && response.product) {
                        this.products[index] = {
                            ...this.products[index],
                            ...response.product
                        };
                    }
                } else {
                    throw new Error(response?.message || 'Respuesta inválida del servidor');
                }

            } catch (error) {
                console.error(`   ❌ Error al guardar:`, error.message);
                results.failed.push({
                    productId,
                    name: product.name,
                    error: error.message
                });
            }
        }

        console.log('\n========================================');
        console.log('📊 [CLIENT] RESUMEN DE GUARDADO');
        console.log('========================================');
        console.log('✅ Exitosos:', results.successful.length);
        console.log('❌ Fallidos:', results.failed.length);
        
        if (results.failed.length > 0) {
            console.log('\n❌ Productos que fallaron:');
            results.failed.forEach(f => {
                console.log(`   - ${f.name || f.productId}: ${f.error}`);
            });
        }
        console.log('========================================\n');

        // Limpiar productos guardados exitosamente
        results.successful.forEach(r => {
            this.modifiedProducts.delete(r.productId);
        });

        this.updateSaveAllButton();

        // Mensaje final
        if (results.failed.length === 0) {
            uiManager.showAlert(
                `✅ ${results.successful.length} productos actualizados correctamente`,
                'success'
            );
        } else if (results.successful.length === 0) {
            uiManager.showAlert(
                `❌ No se pudo actualizar ningún producto`,
                'danger'
            );
        } else {
            uiManager.showAlert(
                `⚠️ ${results.successful.length} productos actualizados, ${results.failed.length} fallaron`,
                'warning'
            );
        }

        // Recargar datos
        await this.loadProducts();
        const selectedRef = document.getElementById('referencia')?.value;
        if (selectedRef) {
            this.loadReferencia(selectedRef);
        }

    } catch (error) {
        console.error('💥 [CLIENT] Error crítico en saveAllChanges:', error);
        uiManager.showAlert(`Error crítico: ${error.message}`, 'danger');
        this.updateSaveAllButton();
    }
},

  // FUNCIÓN DE EXPORTACIÓN UNIFICADA CSV - CORREGIDA
  async exportUnifiedCSV() {
    const referencia = document.getElementById('referencia').value;
    if (!referencia) {
      uiManager.showAlert('Por favor selecciona una referencia primero', 'warning');
      return;
    }

    // CORRECCIÓN: Verificar que this.products sea un array
    if (!Array.isArray(this.products)) {
      uiManager.showAlert('Error: No se han cargado los productos correctamente', 'danger');
      return;
    }

    const filteredProducts = this.products.filter(product =>
      product && product.name && product.name.trim() === referencia
    );

    if (filteredProducts.length === 0) {
      uiManager.showAlert('No hay productos para exportar', 'warning');
      return;
    }

    try {
      const result = await unifiedExportSystem.exportUnifiedCSV(filteredProducts, referencia);

      uiManager.showAlert(
        `Plantilla ${result.lensType.toUpperCase()} exportada correctamente - ${result.totalProducts} productos procesados`,
        'success'
      );
    } catch (error) {
      console.error('Error en exportación:', error);
      uiManager.showAlert(`Error al generar plantilla: ${error.message}`, 'danger');
    }
  },
  // ========== SINCRONIZACIÓN ==========

  setupSyncListeners() {
    console.log('🔧 TransactionManager: Configurando sincronización...');

    // Suscribirse al coordinador
    if (window.syncCoordinator && typeof window.syncCoordinator.subscribe === 'function') {
      this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
        'transactionManager',
        (eventType, data) => this.handleSyncEvent(eventType, data)
      );
      console.log('✅ Suscrito a syncCoordinator');
    } else {
      console.warn('⚠️ syncCoordinator no disponible');
    }

    // Escuchar eventos de producto actualizado
    eventManager.on('external:product-updated', (product) => {
      console.log('📡 TransactionManager recibió external:product-updated:', product._id);
      this.handleProductUpdated(product);
    });

    // Escuchar eventos de stock actualizado
    eventManager.on('external:stock-updated', (data) => {
      console.log('📡 TransactionManager recibió external:stock-updated:', data.productId);
      this.handleStockUpdated(data);
    });

    // ✅ NUEVO: Escuchar evento directo de actualización de producto
    eventManager.on('data:product:updated', (product) => {
      console.log('📡 TransactionManager recibió data:product:updated:', product._id);
      this.handleProductUpdated(product);
    });

    // ✅ NUEVO: Escuchar evento directo de actualización de stock
    eventManager.on('data:product:stock-updated', (data) => {
      console.log('📡 TransactionManager recibió data:product:stock-updated:', data.productId);
      this.handleStockUpdated(data);
    });

    console.log('✅ Listeners de sincronización configurados en TransactionManager');
  },

  handleSyncEvent(eventType, data) {
    console.log(`🔄 TransactionManager recibió evento: ${eventType}`);

    switch (eventType) {
      case 'product:updated':
        this.handleProductUpdated(data);
        break;
      case 'stock:updated':
        this.handleStockUpdated(data);
        break;
      case 'force:refresh':
        this.loadProducts();
        break;
    }
  },

  handleProductUpdated(product) {
    if (!product || !product._id) return;

    console.log('🔄 TransactionManager: Actualizando producto', product._id);

    if (!Array.isArray(this.products)) {
      console.warn('⚠️ TransactionManager.products no es un array');
      return;
    }

    const index = this.products.findIndex(p => p._id === product._id);
    if (index !== -1) {
      // Actualizar producto en cache
      this.products[index] = {
        ...this.products[index],
        ...product
      };

      console.log(`✅ Producto actualizado en cache: ${product.name}`);

      // CORRECCIÓN: Re-renderizar vista activa
      if (this.currentReference) {
        // Actualizar filteredProducts también
        const filteredIndex = this.filteredProducts.findIndex(p => p._id === product._id);
        if (filteredIndex !== -1) {
          this.filteredProducts[filteredIndex] = this.products[index];
          console.log('✅ Producto actualizado en filteredProducts');

          // Re-renderizar solo si el producto pertenece a la referencia actual
          if (product.name === this.currentReference) {
            this.updateSingleProductRow(product._id);
          }
        }
      }
    } else {
      console.log('⚠️ Producto no encontrado en cache, agregándolo...');
      this.products.push(product);
      this.sortProductsById();

      // Si pertenece a la referencia actual, recargar
      if (product.name === this.currentReference) {
        this.loadReferencia(this.currentReference);
      }
    }
  }, 

  handleStockUpdated(data) {
    console.log('📦 TransactionManager: Stock actualizado', data.productId);

    // Priorizar producto completo
    if (data.product) {
      this.handleProductUpdated(data.product);
      return;
    }

    // Fallback: actualizar solo stock
    if (data.productId && (data.newStock !== undefined || data.stock_surtido !== undefined)) {
      const index = this.products.findIndex(p => p._id === data.productId);
      if (index !== -1) {
        if (data.newStock !== undefined) {
          this.products[index].stock = data.newStock;
        }
        if (data.stock_surtido !== undefined) {
          this.products[index].stock_surtido = data.stock_surtido;
        }

        // Si está en la vista actual, actualizar
        if (this.currentReference === this.products[index].name) {
          this.updateSingleProductRow(data.productId);
        }
      }
    }
  },
  // ✅ NUEVA FUNCIÓN: Actualizar una sola fila de la tabla (más eficiente)
  updateSingleProductRow(productId) {
    const product = this.products.find(p => p._id === productId);
    if (!product) return;

    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    // Buscar la fila del producto
    const rows = tableBody.querySelectorAll('tr');
    let targetRow = null;

    for (const row of rows) {
      const input = row.querySelector(`input[data-id="${productId}"]`);
      if (input) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      console.log('⚠️ Fila no encontrada, re-renderizando tabla completa');
      this.renderFilteredProducts(this.filteredProducts);
      return;
    }

    // Actualizar valores en la fila
    const stockSurtidoInput = targetRow.querySelector('input[data-field="stock_surtido"]');
    if (stockSurtidoInput) {
      stockSurtidoInput.value = product.stock_surtido || 0;
      stockSurtidoInput.max = product.stock || 0;
    }

    const stockAlmacenado = (product.stock || 0) - (product.stock_surtido || 0);
    const stockAlmacenadoCell = targetRow.children[6];
    if (stockAlmacenadoCell) {
      stockAlmacenadoCell.innerHTML = `<span class="text-muted">${stockAlmacenado}</span>`;
    }

    const status = this.getStatusInfo(product.stock_surtido || 0);
    const statusCell = targetRow.children[7];
    if (statusCell) {
      statusCell.innerHTML = `<span class="${status.class}">${status.icon} ${status.text}</span>`;
    }

    // Efecto visual de actualización
    targetRow.style.backgroundColor = '#e8f5e8';
    targetRow.style.transition = 'background-color 0.5s ease';

    setTimeout(() => {
      targetRow.style.backgroundColor = '';
    }, 2000);

    console.log(`✅ Fila actualizada para producto: ${product.name}`);
  }

};