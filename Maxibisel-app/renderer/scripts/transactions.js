import { eventManager } from './eventManager.js';
import { uiManager } from './ui.js';

const unifiedExportSystem = {
    sphereRanges: {
        positive: [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00],
        negative: ['N', -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00, -4.25, -4.50, -4.75, -5.00, -5.25, -5.50, -5.75, -6.00],
        bifocal: ['N', 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00]
    },
    cylinderRange: ['N', -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00],
    additionRange: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00],

    normalizeValue(value) {
        if (!value || value === 'N' || value === '-' || value.toString().trim() === '') return 'N';
        const cleanValue = value.toString().replace(/[^\d.-]/g, '');
        const numValue = parseFloat(cleanValue);
        return isNaN(numValue) ? 'N' : parseFloat(numValue.toFixed(2));
    },

    detectLensType(firstProduct) {
        const addition = this.normalizeValue(firstProduct.addition);
        const cylinder = this.normalizeValue(firstProduct.cylinder);

        if (addition === 'N' || addition === 0) return 'monofocal';

        if (addition > 0) {
            const barcodeText = (firstProduct.barcode || '').toUpperCase();
            const additionText = (firstProduct.addition || '').toUpperCase();

            const hasLaterality =
                additionText.endsWith('R') || additionText.endsWith('L') ||
                barcodeText.includes(' R') || barcodeText.includes(' L') ||
                barcodeText.includes('OD') || barcodeText.includes('OS');

            return hasLaterality ? 'progressive' : 'bifocal';
        }

        return 'monofocal';
    },

    extractEye(product) {
        const additionText = (product.addition || '').toUpperCase().trim();
        if (additionText.endsWith('R') || additionText.endsWith(' R')) return 'R';
        if (additionText.endsWith('L') || additionText.endsWith(' L')) return 'L';

        const barcodeText = (product.barcode || '').toUpperCase();
        if (barcodeText.includes('OD') || barcodeText.includes(' R')) return 'R';
        if (barcodeText.includes('OS') || barcodeText.includes(' L')) return 'L';

        return 'AMBOS';
    },

    groupProducts(products, lensType) {
        const groups = {};

        products.forEach((product) => {
            const sphere = this.normalizeValue(product.sphere);
            const cylinder = this.normalizeValue(product.cylinder);
            const addition = this.normalizeValue(product.addition);

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
                    sphere, cylinder, addition,
                    eye: lensType === 'progressive' ? this.extractEye(product) : null,
                    stock_surtido: 0,
                    products: []
                };
            }

            groups[key].stock_surtido += (product.stock_surtido || 0);
            groups[key].products.push(product);
        });

        return groups;
    },

    createMonofocalTemplate(groupedData, referencia) {
        const csvLines = [];

        csvLines.push([`INVENTARIO: ${referencia}`]);
        csvLines.push([]);
        csvLines.push(['POSITIVO']);
        csvLines.push([]);

        const positiveHeader = ['ESF \\ CIL'];
        this.cylinderRange.forEach(cyl => positiveHeader.push(cyl === 'N' ? 'N' : cyl.toFixed(2)));
        csvLines.push(positiveHeader);

        this.sphereRanges.positive.forEach(sph => {
            const row = [`+${sph.toFixed(2)}`];
            this.cylinderRange.forEach(cyl => {
                const key = `${sph}_${cyl}`;
                row.push(groupedData[key] ? groupedData[key].stock_surtido || '' : '');
            });
            csvLines.push(row);
        });

        csvLines.push([], [], []);
        csvLines.push(['NEGATIVO']);
        csvLines.push([]);

        const negativeHeader = ['ESF \\ CIL'];
        this.cylinderRange.forEach(cyl => negativeHeader.push(cyl === 'N' ? 'N' : cyl.toFixed(2)));
        csvLines.push(negativeHeader);

        this.sphereRanges.negative.forEach(sph => {
            const row = [sph === 'N' ? 'N' : sph.toFixed(2)];
            this.cylinderRange.forEach(cyl => {
                const key = `${sph}_${cyl}`;
                row.push(groupedData[key] ? groupedData[key].stock_surtido || '' : '');
            });
            csvLines.push(row);
        });

        return csvLines;
    },

    createBifocalTemplate(groupedData, referencia) {
        const csvLines = [];

        csvLines.push([`INVENTARIO: ${referencia}`]);
        csvLines.push([]);
        csvLines.push(['POSITIVO']);
        csvLines.push([]);

        const positiveHeader = ['ESF \\ ADD'];
        this.additionRange.forEach(add => positiveHeader.push(`+${add.toFixed(2)}`));
        csvLines.push(positiveHeader);

        this.sphereRanges.positive.forEach(sph => {
            if (sph <= 3.00) {
                const row = [`+${sph.toFixed(2)}`];
                this.additionRange.forEach(add => {
                    const key = `${sph}_${add}`;
                    row.push(groupedData[key] ? groupedData[key].stock_surtido || '' : '');
                });
                csvLines.push(row);
            }
        });

        csvLines.push([], [], []);
        csvLines.push(['NEGATIVO']);
        csvLines.push([]);

        const negativeHeader = ['ESF \\ ADD'];
        this.additionRange.forEach(add => negativeHeader.push(`+${add.toFixed(2)}`));
        csvLines.push(negativeHeader);

        this.sphereRanges.negative.forEach(sph => {
            if (sph === 'N' || sph >= -3.00) {
                const row = [sph === 'N' ? 'N' : sph.toFixed(2)];
                this.additionRange.forEach(add => {
                    const key = `${sph}_${add}`;
                    row.push(groupedData[key] ? groupedData[key].stock_surtido || '' : '');
                });
                csvLines.push(row);
            }
        });

        return csvLines;
    },

    createProgressiveTemplate(groupedData, referencia) {
        const csvLines = [];

        csvLines.push([`INVENTARIO: ${referencia}`]);
        csvLines.push([]);
        csvLines.push(['POSITIVO']);
        csvLines.push([]);

        const positiveHeader = ['ESF \\ ADD'];
        this.additionRange.forEach(add => {
            positiveHeader.push(`+${add.toFixed(2)} R`);
            positiveHeader.push(`+${add.toFixed(2)} L`);
        });
        csvLines.push(positiveHeader);

        this.sphereRanges.positive.forEach(sph => {
            if (sph <= 3.00) {
                const row = [`+${sph.toFixed(2)}`];
                this.additionRange.forEach(add => {
                    let stockR = 0, stockL = 0;
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

        csvLines.push([], [], []);
        csvLines.push(['NEGATIVO']);
        csvLines.push([]);

        const negativeHeader = ['ESF \\ ADD'];
        this.additionRange.forEach(add => {
            negativeHeader.push(`+${add.toFixed(2)} R`);
            negativeHeader.push(`+${add.toFixed(2)} L`);
        });
        csvLines.push(negativeHeader);

        this.sphereRanges.negative.forEach(sph => {
            if (sph === 'N' || sph >= -3.00) {
                const row = [sph === 'N' ? 'N' : sph.toFixed(2)];
                this.additionRange.forEach(add => {
                    let stockR = 0, stockL = 0;
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

    async exportToExcel(data, referencia, lensType) {
        try {
            let html = `
                <html xmlns:x="urn:schemas-microsoft-com:office:excel">
                <head>
                    <meta charset="UTF-8">
                    <style>
                        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
                        th, td { border: 1px solid #000; padding: 4px 8px; text-align: center; white-space: nowrap; }
                        .title { background-color: #4472C4; color: white; font-weight: bold; font-size: 12pt; padding: 8px; }
                        .section { background-color: #D9E1F2; font-weight: bold; font-size: 11pt; padding: 6px; }
                        .header { background-color: #5B9BD5; color: white; font-weight: bold; padding: 5px 8px; }
                        .row-header { font-weight: bold; background-color: #F2F2F2; }
                        td:first-child { width: 80px; }
                        td:not(:first-child) { width: 60px; }
                    </style>
                </head>
                <body><table>
            `;

            data.forEach((row) => {
                html += '<tr>';
                row.forEach((cell, colIndex) => {
                    const cellValue = (cell === null || cell === undefined || cell === '') ? '&nbsp;' : cell;
                    const cellStr = cellValue.toString();
                    let cellClass = '';
                    if (cellStr.includes('INVENTARIO:')) cellClass = 'title';
                    else if (cellStr.includes('ESFERAS POSITIVAS') || cellStr.includes('ESFERAS NEGATIVAS')) cellClass = 'section';
                    else if (cellStr.includes('ESF \\')) cellClass = 'header';
                    else if (colIndex === 0 && cellStr !== '&nbsp;' && cellStr !== '') cellClass = 'row-header';
                    html += `<td class="${cellClass}">${cellValue}</td>`;
                });
                html += '</tr>';
            });

            html += '</table></body></html>';

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
            throw new Error(`No se pudo generar el archivo Excel: ${error.message}`);
        }
    },

    async exportUnifiedCSV(products, referencia) {
        if (!products || products.length === 0) throw new Error('No hay productos para exportar');

        const lensType = this.detectLensType(products[0]);
        const groupedData = this.groupProducts(products, lensType);

        let csvData;
        switch (lensType) {
            case 'monofocal': csvData = this.createMonofocalTemplate(groupedData, referencia); break;
            case 'bifocal':   csvData = this.createBifocalTemplate(groupedData, referencia);   break;
            case 'progressive': csvData = this.createProgressiveTemplate(groupedData, referencia); break;
            default: throw new Error('Tipo de lente no reconocido');
        }

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
    _searchRafId: null,

    init() {
        this.destroyBarcodeScanner();
        const transactionsView = document.getElementById('transactions-view');

        transactionsView.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 ps-2">
                <h2><i class="bi bi-clock-history me-2"></i>Almacenamiento de productos</h2>
            </div>
            <div class="search-section">
                <div class="search-container">
                    <label class="search-label" for="referencia">Buscar por referencia</label>
                    <div style="position: relative;">
                        <select class="search-select form-select" id="referencia">
                            <option value="">Elegir referencia...</option>
                        </select>
                        <div id="referencia-loader" style="
                            display: none;
                            position: absolute;
                            right: 40px;
                            top: 50%;
                            transform: translateY(-50%);
                            pointer-events: none;
                        ">
                            <div style="
                                width: 18px; height: 18px;
                                border: 2px solid #dee2e6;
                                border-top-color: #0d6efd;
                                border-radius: 50%;
                                animation: tm-spin 0.7s linear infinite;
                            "></div>
                        </div>
                    </div>
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
                            <span class="badge bg-primary fs-6" id="selected-reference">-</span>
                        </div>
                        <div class="button-group">
                            <button class="btn btn-warning me-2" id="save-all-changes-btn" disabled>
                                <i class="bi bi-save"></i> Guardar todos los cambios
                            </button>
                            <button class="btn btn-success" id="export-csv-btn">
                                <i class="bi bi-file-earmark-spreadsheet"></i> Exportar Plantilla CSV
                            </button>
                        </div>
                    </div>

                    <div class="search-bar-container" style="position: relative; margin-bottom: 12px;">
                        <input type="text"
                               class="search-bar form-control"
                               id="products-search-bar"
                               placeholder="🔍 Buscar por código, fórmula (ej: +200-125), esfera, cilindro, estado...">
                        <div id="search-bar-loader" style="
                            display: none;
                            position: absolute;
                            right: 12px;
                            top: 50%;
                            transform: translateY(-50%);
                            pointer-events: none;
                            align-items: center;
                            gap: 8px;
                        ">
                            <span style="font-size: 0.78rem; color: #6c757d; font-style: italic;">Buscando...</span>
                            <div style="
                                width: 16px; height: 16px;
                                border: 2px solid #dee2e6;
                                border-top-color: #0d6efd;
                                border-radius: 50%;
                                animation: tm-spin 0.7s linear infinite;
                            "></div>
                        </div>
                    </div>

                    <div id="table-loading-overlay" style="display: none; text-align: center; padding: 48px 0;">
                        <div style="
                            display: inline-flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 16px;
                            background: white;
                            border-radius: 12px;
                            padding: 32px 48px;
                            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                        ">
                            <div style="position: relative; width: 48px; height: 48px;">
                                <div style="
                                    position: absolute; inset: 0;
                                    border: 3px solid #e9ecef;
                                    border-top-color: #0d6efd;
                                    border-radius: 50%;
                                    animation: tm-spin 0.8s linear infinite;
                                "></div>
                                <div style="
                                    position: absolute; inset: 8px;
                                    border: 2px solid transparent;
                                    border-top-color: #6ea8fe;
                                    border-radius: 50%;
                                    animation: tm-spin 1.2s linear infinite reverse;
                                "></div>
                            </div>
                            <div>
                                <div style="font-weight: 600; color: #212529; margin-bottom: 4px;" id="loading-label">Cargando productos...</div>
                                <div style="font-size: 0.82rem; color: #6c757d;" id="loading-sub">Por favor espere</div>
                            </div>
                        </div>
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
                            <tbody id="table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>
                @keyframes tm-spin {
                    to { transform: rotate(360deg); }
                }
                .save-row-btn-success {
                    animation: tm-flash-success 0.4s ease;
                }
                @keyframes tm-flash-success {
                    0%   { background-color: #198754; color: white; }
                    100% { background-color: transparent; }
                }
            </style>
        `;

        this.setupSyncListeners();
        this.loadProducts();
        this.bindEvents();
        this.setupBarcodeScanner();
    },

    async loadProducts() {
        try {
            const response = await window.api.getProducts();

            if (response && response.success && Array.isArray(response.products)) {
                this.products = response.products;
            } else if (Array.isArray(response)) {
                this.products = response;
            } else {
                this.products = [];
            }

            if (this.products.length > 0) {
                this.sortProductsById();
                this.extractUniqueNames();
                this.populateReferenceSelect();
            } else {
                this.uniqueNames = [];
                this.populateReferenceSelect();
            }
        } catch (error) {
            console.error('Error al cargar productos:', error);
            this.products = [];
            this.uniqueNames = [];
            uiManager.showAlert('Error al cargar los productos: ' + error.message, 'danger');
        }
    },

    sortProductsById() {
        if (!Array.isArray(this.products)) { this.products = []; return; }
        try {
            this.products.sort((a, b) => {
                const idA = a._id || a.id || '';
                const idB = b._id || b.id || '';
                if (idA < idB) return -1;
                if (idA > idB) return 1;
                return 0;
            });
        } catch (error) {
            console.error('Error al ordenar productos:', error);
        }
    },

    extractUniqueNames() {
        if (!Array.isArray(this.products)) { this.uniqueNames = []; return; }
        const namesSet = new Set();
        this.products.forEach(product => {
            if (product && product.name && typeof product.name === 'string') {
                const trimmedName = product.name.trim();
                if (trimmedName.length > 0) namesSet.add(trimmedName);
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
            referenciaSelect.addEventListener('change', (e) => this.loadReferencia(e.target.value));
        }

        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportUnifiedCSV());
        }

        const saveAllBtn = document.getElementById('save-all-changes-btn');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', () => this.saveAllChanges());
        }

        const searchBar = document.getElementById('products-search-bar');
        if (searchBar) {
            searchBar.addEventListener('input', (e) => this._handleSearchInput(e.target.value));
        }
    },

    _showReferenciaLoader(show) {
        const loader = document.getElementById('referencia-loader');
        if (loader) loader.style.display = show ? 'block' : 'none';
    },

    _showTableLoader(show, label = 'Cargando productos...', sub = 'Por favor espere') {
        const overlay = document.getElementById('table-loading-overlay');
        const tableWrapper = document.querySelector('.table-wrapper');
        if (!overlay) return;

        if (show) {
            document.getElementById('loading-label').textContent = label;
            document.getElementById('loading-sub').textContent = sub;
            overlay.style.display = 'block';
            if (tableWrapper) tableWrapper.style.display = 'none';
        } else {
            overlay.style.display = 'none';
            if (tableWrapper) tableWrapper.style.display = '';
        }
    },

    _showSearchLoader(show) {
        const loader = document.getElementById('search-bar-loader');
        if (loader) loader.style.display = show ? 'flex' : 'none';
    },

    _handleSearchInput(value) {
        if (this._searchRafId) cancelAnimationFrame(this._searchRafId);

        const term = value.trim();

        if (!term) {
            this._showSearchLoader(false);
            this.renderFilteredProducts(this.filteredProducts);
            return;
        }

        this._showSearchLoader(true);

        this._searchRafId = requestAnimationFrame(() => {
            this.filterTableResults(term);
            this._showSearchLoader(false);
            this._searchRafId = null;
        });
    },

    getStatusInfo(stock_surtido) {
        if (stock_surtido >= 10) return { class: 'text-success', text: 'Bueno', icon: '🟢' };
        if (stock_surtido >= 5)  return { class: 'text-warning', text: 'Bajo',  icon: '🟡' };
        return { class: 'text-danger', text: 'Crítico', icon: '🔴' };
    },

    async loadReferencia(referencia) {
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

        this._showReferenciaLoader(true);

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        if (!Array.isArray(this.products)) {
            this.filteredProducts = [];
        } else {
            this.filteredProducts = this.products.filter(product =>
                product && product.name && product.name.trim() === referencia
            );
        }

        this.currentReference = referencia;
        this._showReferenciaLoader(false);

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

        if (searchBar) searchBar.value = '';

        this._showTableLoader(true, `Cargando ${referencia}...`, `${this.filteredProducts.length} productos encontrados`);

        await new Promise(resolve => setTimeout(resolve, 80));

        this.renderFilteredProducts(this.filteredProducts);
        this._showTableLoader(false);

        if (window.activityLogger) {
            window.activityLogger.log({
                tipo: 'PRODUCTO',
                accion: `Visualización de inventario: ${referencia}`,
                entidad: 'Consulta',
                entidad_id: referencia,
                datos_nuevos: {
                    referencia,
                    total_productos: this.filteredProducts.length,
                    accion: 'Visualización de productos por referencia'
                }
            }).catch(() => {});
        }
    },

    filterTableResults(searchTerm) {
        if (!this.filteredProducts.length) return;

        const term = searchTerm.trim();
        if (!term) {
            this.renderFilteredProducts(this.filteredProducts);
            return;
        }

        const searchTermNormalized = this.normalizarTerminoBusqueda(term);
        const searchResults = this.filteredProducts.filter(product =>
            this.productoCoincideConBusqueda(product, searchTermNormalized)
        );

        this.renderFilteredProducts(searchResults);
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
        return codigo.toLowerCase().replace(/\s+/g, '');
    },

    parsearFormulaCompacta(formulaCompacta) {
        if (!formulaCompacta || typeof formulaCompacta !== 'string') return null;

        const formula = formulaCompacta.trim().toUpperCase();
        const patron = /^([+\-]?)(\d{2,3})([+\-]?)(\d{2,3})$/;
        const match = formula.match(patron);
        if (!match) return null;

        const [, signoEsfera, valorEsfera, signoCilindro, valorCilindro] = match;

        return {
            esfera:   this._compactoADecimal(valorEsfera,   signoEsfera   || '+'),
            cilindro: this._compactoADecimal(valorCilindro, signoCilindro || '-'),
            original: formulaCompacta
        };
    },

    _compactoADecimal(valorCompacto, signo) {
        const numero = parseInt(valorCompacto);
        if (isNaN(numero)) return null;
        const decimal = (numero / 100).toFixed(2);
        return signo === '-' ? `-${decimal}` : `+${decimal}`;
    },

    normalizarValorOptico(valor) {
        if (!valor || typeof valor !== 'string') return null;
        let normalizado = valor.trim().toUpperCase().replace(/\s+/g, '');
        if (!normalizado.startsWith('+') && !normalizado.startsWith('-')) normalizado = '+' + normalizado;
        if (!normalizado.includes('.')) return null;
        return normalizado;
    },

    compararFormulas(formulaProducto, formulaBuscada) {
        if (!formulaProducto || !formulaBuscada) return false;
        return formulaProducto.esfera === formulaBuscada.esfera &&
               formulaProducto.cilindro === formulaBuscada.cilindro;
    },

    productoCoincideConBusqueda(product, searchTerm) {
        if (!product) return false;

        const formulaBuscada = this.parsearFormulaCompacta(searchTerm);
        if (formulaBuscada) {
            const sphere = product.sphere || '';
            const cylinder = product.cylinder || '';

            if (!sphere || sphere === 'N' || sphere === 'N/A' ||
                !cylinder || cylinder === '-' || cylinder === 'N/A') {
                return false;
            }

            const esfera   = this.normalizarValorOptico(sphere);
            const cilindro = this.normalizarValorOptico(cylinder);

            if (!esfera || !cilindro) return false;

            return this.compararFormulas({ esfera, cilindro }, formulaBuscada);
        }

        if (product.barcode) {
            const barcodeNormalizado = this.normalizarCodigoBarras(product.barcode);
            if (barcodeNormalizado === searchTerm || barcodeNormalizado.includes(searchTerm)) return true;
        }

        if (product.name) {
            if (product.name.toLowerCase().trim().includes(searchTerm)) return true;
        }

        if (product.sphere && product.sphere !== 'N' && product.sphere !== 'N/A') {
            const esfera = String(product.sphere).toLowerCase().trim();
            if (esfera === searchTerm || esfera.includes(searchTerm)) return true;
            if (esfera.replace(/[+\-]/g, '') === searchTerm.replace(/[+\-]/g, '')) return true;
        }

        if (product.cylinder && product.cylinder !== '-' && product.cylinder !== 'N/A') {
            const cilindro = String(product.cylinder).toLowerCase().trim();
            if (cilindro === searchTerm || cilindro.includes(searchTerm)) return true;
            if (cilindro.replace(/[+\-]/g, '') === searchTerm.replace(/[+\-]/g, '')) return true;
        }

        if (product.addition && product.addition !== '-' && product.addition !== 'N/A') {
            const adicion = String(product.addition).toLowerCase().trim();
            if (adicion === searchTerm || adicion.includes(searchTerm)) return true;
            if (adicion.replace(/[+\-]/g, '') === searchTerm.replace(/[+\-]/g, '')) return true;
        }

        const status = this.getStatusInfo(product.stock_surtido || 0);
        if (status.text.toLowerCase().includes(searchTerm)) return true;

        return false;
    },

    renderFilteredProducts(productsToRender) {
        const tableBody = document.getElementById('table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        const table = document.getElementById('products-table');
        if (table && !table.classList.contains('table-base')) table.classList.add('table-base');

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

        const fragment = document.createDocumentFragment();

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
                               data-id="${product._id}" data-field="stock_surtido"
                               min="0" max="${product.stock || 0}">
                        <button class="btn btn-sm btn-outline-secondary ms-1 quantity-btn"
                                data-id="${product._id}" data-field="stock_surtido" data-change="1">
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                </td>
                <td><span class="text-muted">${stockAlmacenado}</span></td>
                <td><span class="${status.class}">${status.icon} ${status.text}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary save-changes-btn"
                            data-id="${product._id}" title="Guardar cambios">
                        <i class="bi bi-check-lg"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(row);
        });

        tableBody.appendChild(fragment);
        this.bindTableEvents();
    },

    bindTableEvents() {
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const el = e.target.closest('.quantity-btn');
                this.updateQuantity(el.dataset.id, el.dataset.field, parseInt(el.dataset.change));
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.setQuantity(e.target.dataset.id, e.target.dataset.field, parseInt(e.target.value) || 0);
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
        if (!product || field !== 'stock_surtido') return;

        const currentValue = product.stock_surtido || 0;
        const maxStock = product.stock || 0;
        let newValue = Math.max(0, Math.min(currentValue + change, maxStock));

        product.stock_surtido = newValue;
        this.modifiedProducts.add(productId);
        this.updateSaveAllButton();
        this.updateProductDisplay(productId);
    },

    setQuantity(productId, field, value) {
        const product = this.products.find(p => p._id === productId);
        if (!product || field !== 'stock_surtido') return;

        product.stock_surtido = Math.max(0, Math.min(value, product.stock || 0));
        this.modifiedProducts.add(productId);
        this.updateSaveAllButton();
        this.updateProductDisplay(productId);
    },

    updateProductDisplay(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        const stockSurtidoInput = document.querySelector(`input[data-id="${productId}"][data-field="stock_surtido"]`);
        if (stockSurtidoInput) stockSurtidoInput.value = product.stock_surtido || 0;

        const stockAlmacenado = (product.stock || 0) - (product.stock_surtido || 0);
        const row = stockSurtidoInput?.closest('tr');
        if (row) {
            if (row.children[6]) row.children[6].innerHTML = `<span class="text-muted">${stockAlmacenado}</span>`;
            const status = this.getStatusInfo(product.stock_surtido || 0);
            if (row.children[7]) row.children[7].innerHTML = `<span class="${status.class}">${status.icon} ${status.text}</span>`;
        }
    },

    updateSaveAllButton() {
        const saveAllBtn = document.getElementById('save-all-changes-btn');
        if (!saveAllBtn) return;

        if (this.modifiedProducts.size > 0) {
            saveAllBtn.disabled = false;
            saveAllBtn.innerHTML = `<i class="bi bi-save"></i> Guardar cambios (${this.modifiedProducts.size})`;
            saveAllBtn.classList.replace('btn-warning', 'btn-warning');
        } else {
            saveAllBtn.disabled = true;
            saveAllBtn.innerHTML = '<i class="bi bi-save"></i> Guardar todos los cambios';
        }
    },

    _calcularStockValues(product) {
        const stockTotal    = parseInt(product.stock) || 0;
        const stockSurtido  = Math.max(0, parseInt(product.stock_surtido) || 0);

        if (stockSurtido > stockTotal) {
            throw new Error(`Stock surtido (${stockSurtido}) excede el stock total (${stockTotal})`);
        }

        const stockAlmacenado = stockTotal - stockSurtido;

        if (stockSurtido + stockAlmacenado !== stockTotal) {
            throw new Error(`Error de cálculo: ${stockSurtido} + ${stockAlmacenado} ≠ ${stockTotal}`);
        }

        return { stockTotal, stockSurtido, stockAlmacenado };
    },

    async saveProductChanges(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) {
            uiManager.showAlert('Producto no encontrado en la memoria local', 'danger');
            return;
        }

        const saveBtn = document.querySelector(`.save-changes-btn[data-id="${productId}"]`);

        try {
            let stockValues;
            try {
                stockValues = this._calcularStockValues(product);
            } catch (validationError) {
                uiManager.showAlert(validationError.message, 'danger');
                return;
            }

            const { stockTotal, stockSurtido, stockAlmacenado } = stockValues;

            const datosAnteriores = {
                stock: stockTotal,
                stock_surtido: product.stock_surtido || 0,
                stock_almacenado: (product.stock || 0) - (product.stock_surtido || 0)
            };

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
            }

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: El servidor tardó demasiado en responder')), 10000)
            );

            const response = await Promise.race([
                window.api.updateProductStock(productId, { stock: stockTotal, stock_surtido: stockSurtido, stock_almacenado: stockAlmacenado }),
                timeoutPromise
            ]);

            if (!response || !response.success || !response.product) {
                throw new Error(response?.message || 'Respuesta inválida del servidor');
            }

            const serverProduct = response.product;

            const index = this.products.findIndex(p => p._id === productId);
            if (index !== -1) {
                this.products[index] = {
                    ...this.products[index],
                    stock: serverProduct.stock,
                    stock_surtido: serverProduct.stock_surtido,
                    stock_almacenado: serverProduct.stock_almacenado
                };
            }

            const filteredIndex = this.filteredProducts.findIndex(p => p._id === productId);
            if (filteredIndex !== -1) {
                this.filteredProducts[filteredIndex] = { ...this.filteredProducts[filteredIndex], ...this.products[index] };
            }

            this.modifiedProducts.delete(productId);
            this.updateSaveAllButton();

            if (window.activityLogger) {
                const cambios = [];
                if (datosAnteriores.stock_surtido !== serverProduct.stock_surtido) {
                    const diff = serverProduct.stock_surtido - datosAnteriores.stock_surtido;
                    cambios.push(`Surtido: ${datosAnteriores.stock_surtido} → ${serverProduct.stock_surtido} (${diff > 0 ? '+' : ''}${diff})`);
                }
                if (datosAnteriores.stock_almacenado !== serverProduct.stock_almacenado) {
                    const diff = serverProduct.stock_almacenado - datosAnteriores.stock_almacenado;
                    cambios.push(`Almacenado: ${datosAnteriores.stock_almacenado} → ${serverProduct.stock_almacenado} (${diff > 0 ? '+' : ''}${diff})`);
                }

                window.activityLogger.log({
                    tipo: 'PRODUCTO',
                    accion: `Redistribución de stock: ${product.name}${cambios.length ? ` - ${cambios.join(' | ')}` : ''}`,
                    entidad: 'Producto',
                    entidad_id: productId,
                    datos_anteriores: datosAnteriores,
                    datos_nuevos: {
                        nombre: product.name,
                        barcode: product.barcode,
                        stock: serverProduct.stock,
                        stock_surtido: serverProduct.stock_surtido,
                        stock_almacenado: serverProduct.stock_almacenado
                    }
                }).catch(() => {});
            }

            uiManager.showAlert('Stock actualizado correctamente', 'success');

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
                setTimeout(() => { saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>'; }, 2000);
            }

            this.updateProductDisplay(productId);

        } catch (error) {
            console.error('Error al guardar producto:', error);

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
                setTimeout(() => { saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>'; }, 2500);
            }

            let errorMsg = 'Error al actualizar el stock';
            if (error.message.includes('Timeout'))        errorMsg = 'El servidor no respondió a tiempo';
            else if (error.message.includes('stock'))     errorMsg = error.message;
            else if (error.message.includes('Network') || error.message.includes('fetch')) errorMsg = 'Error de conexión';
            else if (error.message)                       errorMsg = error.message;

            uiManager.showAlert(errorMsg, 'danger');
        }
    },

    async saveAllChanges() {
        if (this.modifiedProducts.size === 0) {
            uiManager.showAlert('No hay cambios para guardar', 'info');
            return;
        }

        const productsToSave = Array.from(this.modifiedProducts);
        const saveAllBtn = document.getElementById('save-all-changes-btn');

        try {
            if (saveAllBtn) {
                saveAllBtn.disabled = true;
                saveAllBtn.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Guardando ${productsToSave.length} productos...
                `;
            }

            const results = { successful: [], failed: [] };
            const productosModificados = [];

            for (const productId of productsToSave) {
                const product = this.products.find(p => p._id === productId);
                if (!product) {
                    results.failed.push({ productId, error: 'No encontrado en cache' });
                    continue;
                }

                const datosAnteriores = {
                    stock: product.stock || 0,
                    stock_surtido: product.stock_surtido || 0,
                    stock_almacenado: (product.stock || 0) - (product.stock_surtido || 0)
                };

                try {
                    const { stockTotal, stockSurtido, stockAlmacenado } = this._calcularStockValues(product);

                    const response = await window.api.updateProductStock(productId, {
                        stock: stockTotal,
                        stock_surtido: stockSurtido,
                        stock_almacenado: stockAlmacenado
                    });

                    if (response && response.success && response.product) {
                        const serverProduct = response.product;

                        const index = this.products.findIndex(p => p._id === productId);
                        if (index !== -1) {
                            this.products[index] = {
                                ...this.products[index],
                                stock: serverProduct.stock,
                                stock_surtido: serverProduct.stock_surtido,
                                stock_almacenado: serverProduct.stock_almacenado
                            };
                        }

                        const filteredIndex = this.filteredProducts.findIndex(p => p._id === productId);
                        if (filteredIndex !== -1) {
                            this.filteredProducts[filteredIndex] = { ...this.filteredProducts[filteredIndex], ...this.products[index] };
                        }

                        productosModificados.push({
                            nombre: product.name,
                            barcode: product.barcode,
                            anterior: { surtido: datosAnteriores.stock_surtido, almacenado: datosAnteriores.stock_almacenado },
                            nuevo: { surtido: serverProduct.stock_surtido, almacenado: serverProduct.stock_almacenado }
                        });

                        results.successful.push({ productId, name: product.name });
                        this.modifiedProducts.delete(productId);
                    } else {
                        throw new Error(response?.message || 'Respuesta inválida del servidor');
                    }
                } catch (error) {
                    results.failed.push({ productId, name: product.name, error: error.message });
                }
            }

            if (results.successful.length > 0 && window.activityLogger) {
                window.activityLogger.log({
                    tipo: 'PRODUCTO',
                    accion: `Actualización masiva de stock: ${results.successful.length} productos en "${this.currentReference}"`,
                    entidad: 'Productos (Lote)',
                    entidad_id: this.currentReference,
                    datos_nuevos: {
                        referencia: this.currentReference,
                        productos_count: results.successful.length,
                        productos_detalle: productosModificados.slice(0, 10)
                    }
                }).catch(() => {});
            }

            this.updateSaveAllButton();
            results.successful.forEach(r => this.updateSingleProductRow(r.productId));

            if (results.failed.length === 0) {
                uiManager.showAlert(`${results.successful.length} productos actualizados correctamente`, 'success');
            } else if (results.successful.length === 0) {
                uiManager.showAlert('No se pudo actualizar ningún producto', 'danger');
            } else {
                uiManager.showAlert(`${results.successful.length} actualizados, ${results.failed.length} fallaron`, 'warning');
            }

        } catch (error) {
            console.error('Error crítico en saveAllChanges:', error);
            uiManager.showAlert(`Error crítico: ${error.message}`, 'danger');
            this.updateSaveAllButton();
        }
    },

    async exportUnifiedCSV() {
        const referencia = document.getElementById('referencia').value;
        if (!referencia) {
            uiManager.showAlert('Por favor selecciona una referencia primero', 'warning');
            return;
        }

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

            if (window.activityLogger) {
                window.activityLogger.log({
                    tipo: 'PRODUCTO',
                    accion: `Exportación de plantilla CSV - ${result.lensType.toUpperCase()}`,
                    entidad: 'Exportación',
                    entidad_id: referencia,
                    datos_nuevos: {
                        referencia,
                        tipo_lente: result.lensType,
                        total_productos: result.totalProducts,
                        grupos_generados: result.groupsCount
                    }
                }).catch(() => {});
            }

            uiManager.showAlert(
                `Plantilla ${result.lensType.toUpperCase()} exportada — ${result.totalProducts} productos procesados`,
                'success'
            );
        } catch (error) {
            console.error('Error en exportación:', error);
            uiManager.showAlert(`Error al generar plantilla: ${error.message}`, 'danger');
        }
    },

    setupSyncListeners() {
        if (window.syncCoordinator && typeof window.syncCoordinator.subscribe === 'function') {
            this.unsubscribeFromCoordinator = window.syncCoordinator.subscribe(
                'transactionManager',
                (eventType, data) => this.handleSyncEvent(eventType, data)
            );
        }

        eventManager.on('external:product-updated',       (product) => this.handleProductUpdated(product));
        eventManager.on('external:stock-updated',         (data)    => this.handleStockUpdated(data));
        eventManager.on('data:product:updated',           (product) => this.handleProductUpdated(product));
        eventManager.on('data:product:stock-updated',     (data)    => this.handleStockUpdated(data));
    },

    handleSyncEvent(eventType, data) {
        switch (eventType) {
            case 'product:updated': this.handleProductUpdated(data); break;
            case 'stock:updated':   this.handleStockUpdated(data);   break;
            case 'force:refresh':   this.loadProducts();              break;
        }
    },

    handleProductUpdated(product) {
        if (!product || !product._id) return;
        if (!Array.isArray(this.products)) return;
        if (this.modifiedProducts.has(product._id)) return;

        const index = this.products.findIndex(p => p._id === product._id);
        if (index !== -1) {
            this.products[index] = { ...this.products[index], ...product };

            const filteredIndex = this.filteredProducts.findIndex(p => p._id === product._id);
            if (filteredIndex !== -1) {
                this.filteredProducts[filteredIndex] = this.products[index];
                if (product.name === this.currentReference) {
                    this.updateSingleProductRow(product._id);
                }
            }
        } else {
            this.products.push(product);
            this.sortProductsById();
            if (product.name === this.currentReference) {
                this.loadReferencia(this.currentReference);
            }
        }
    },

    handleStockUpdated(data) {
        if (data.product) {
            this.handleProductUpdated(data.product);
            return;
        }

        if (data.productId && (data.newStock !== undefined || data.stock_surtido !== undefined)) {
            const index = this.products.findIndex(p => p._id === data.productId);
            if (index !== -1) {
                if (data.newStock !== undefined) this.products[index].stock = data.newStock;
                if (data.stock_surtido !== undefined) this.products[index].stock_surtido = data.stock_surtido;
                if (this.currentReference === this.products[index].name) {
                    this.updateSingleProductRow(data.productId);
                }
            }
        }
    },

    updateSingleProductRow(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        const tableBody = document.getElementById('table-body');
        if (!tableBody) return;

        let targetRow = null;
        for (const row of tableBody.querySelectorAll('tr')) {
            if (row.querySelector(`input[data-id="${productId}"]`)) {
                targetRow = row;
                break;
            }
        }

        if (!targetRow) {
            this.renderFilteredProducts(this.filteredProducts);
            return;
        }

        const stockSurtidoInput = targetRow.querySelector('input[data-field="stock_surtido"]');
        if (stockSurtidoInput) {
            stockSurtidoInput.value = product.stock_surtido || 0;
            stockSurtidoInput.max = product.stock || 0;
        }

        const stockAlmacenado = (product.stock || 0) - (product.stock_surtido || 0);
        if (targetRow.children[6]) {
            targetRow.children[6].innerHTML = `<span class="text-muted">${stockAlmacenado}</span>`;
        }

        const status = this.getStatusInfo(product.stock_surtido || 0);
        if (targetRow.children[7]) {
            targetRow.children[7].innerHTML = `<span class="${status.class}">${status.icon} ${status.text}</span>`;
        }

        targetRow.style.backgroundColor = '#e8f5e8';
        targetRow.style.transition = 'background-color 0.5s ease';
        setTimeout(() => { targetRow.style.backgroundColor = ''; }, 2000);
    },

    setupBarcodeScanner() {
        this.barcodeBuffer = '';
        this.barcodeTimeout = null;

        this.barcodeListener = (e) => {
            const transactionsView = document.getElementById('transactions-view');
            if (!transactionsView || transactionsView.style.display === 'none') return;
            if (!this.currentReference) return;

            const activeElement = document.activeElement;
            const isTextInput = activeElement &&
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

            if (isTextInput) return;
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;

            if (e.key === 'Enter' && this.barcodeBuffer.length > 0) {
                e.preventDefault();
                this.processBarcodeFilter(this.barcodeBuffer.trim());
                this.barcodeBuffer = '';
                return;
            }

            if (e.key.length === 1) {
                this.barcodeBuffer += e.key;
                clearTimeout(this.barcodeTimeout);
                this.barcodeTimeout = setTimeout(() => {
                    if (this.barcodeBuffer.length >= 4) {
                        this.processBarcodeFilter(this.barcodeBuffer.trim());
                    }
                    this.barcodeBuffer = '';
                }, 100);
            }
        };

        document.addEventListener('keydown', this.barcodeListener);
    },

    processBarcodeFilter(barcode) {
        if (!barcode || barcode.length < 4) return;

        const searchBar = document.getElementById('products-search-bar');
        const normalizado = this.normalizarCodigoBarras(barcode);

        if (searchBar) {
            searchBar.value = normalizado;
            searchBar.blur();
        }

        this._handleSearchInput(normalizado);
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