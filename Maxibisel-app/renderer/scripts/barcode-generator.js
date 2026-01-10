// barcode-generator.js - Módulo para gestionar la generación de códigos de barra
// AJUSTADO PARA HOJA CROQUELADA: Carta, 7x12, 30x22mm, márgenes 6mm/3mm

export class BarcodeGenerator {
    constructor() {
        this.products = [];
        this.references = [];
        this.selectedProducts = [];
        this.filteredProducts = [];
        this.selectedReference = '';
        this.searchTerm = '';
        this.BARCODES_PER_PAGE = 84; // 7 columnas x 12 filas (AJUSTADO A HOJA CROQUELADA)
    }

    async init() {
        console.log('🔄 Inicializando generador de códigos de barra...');
        await this.loadJsBarcode();
        await this.loadProducts();
        this.setupEventListeners();
        this.extractReferences();
        this.render();
    }

    async loadJsBarcode() {
        return new Promise((resolve, reject) => {
            if (window.JsBarcode) {
                console.log('✅ JsBarcode ya está cargado');
                resolve();
                return;
            }

            console.log('📦 Cargando librería JsBarcode...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
            script.onload = () => {
                console.log('✅ JsBarcode cargado correctamente');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Error al cargar JsBarcode');
                reject(new Error('No se pudo cargar JsBarcode'));
            };
            document.head.appendChild(script);
        });
    }

    async loadProducts() {
        try {
            console.log('📦 Cargando productos desde la API...');
            
            const response = await window.api.getProducts();
            
            console.log('📦 Respuesta de la API:', response);
            
            if (response && response.success && Array.isArray(response.products)) {
                this.products = response.products;
            } else if (Array.isArray(response)) {
                this.products = response;
            } else {
                this.products = [];
            }
            
            if (this.products.length > 0) {
                this.products = this.products.filter(p => p.barcode && p.name);
                
                this.products.sort((a, b) => {
                    const idA = a._id || a.id || '';
                    const idB = b._id || b.id || '';
                    if (idA < idB) return -1;
                    if (idA > idB) return 1;
                    return 0;
                });
                
                console.log(`✅ ${this.products.length} productos válidos (ordenados por ID)`);
            }
            
        } catch (error) {
            console.error('💥 Error al cargar productos:', error);
            this.products = [];
            
            if (window.uiManager && window.uiManager.showAlert) {
                window.uiManager.showAlert('Error al cargar productos: ' + error.message, 'danger');
            } else {
                alert('Error al cargar productos: ' + error.message);
            }
        }
    }

    extractReferences() {
        if (!Array.isArray(this.products)) {
            this.references = [];
            return;
        }

        const namesSet = new Set();
        this.products.forEach(product => {
            if (product && product.name && typeof product.name === 'string') {
                const trimmedName = product.name.trim();
                if (trimmedName.length > 0) {
                    namesSet.add(trimmedName);
                }
            }
        });
        
        this.references = Array.from(namesSet).sort();
        console.log(`📋 Referencias únicas: ${this.references.length}`);
    }

    setupEventListeners() {
        const container = document.getElementById('users-view');
        
        container.addEventListener('change', (e) => {
            if (e.target.id === 'barcode-reference-select') {
                this.selectedReference = e.target.value;
                this.filterProductsByReference();
            }
        });

        container.addEventListener('input', (e) => {
            if (e.target.id === 'barcode-search-input') {
                this.searchTerm = e.target.value;
                this.renderProductList();
            }
        });

        container.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard && !e.target.closest('.remove-product-btn, .decrease-qty-btn, .increase-qty-btn, .quantity-input')) {
                const productId = productCard.dataset.productId;
                if (productId) this.addProduct(productId);
            }

            const removeBtn = e.target.closest('.remove-product-btn');
            if (removeBtn) {
                this.removeProduct(removeBtn.dataset.productId);
            }

            const decreaseBtn = e.target.closest('.decrease-qty-btn');
            if (decreaseBtn) {
                this.changeQuantity(decreaseBtn.dataset.productId, -1);
            }

            const increaseBtn = e.target.closest('.increase-qty-btn');
            if (increaseBtn) {
                this.changeQuantity(increaseBtn.dataset.productId, 1);
            }

            if (e.target.id === 'generate-preview-btn') {
                this.generatePreview();
            }

            if (e.target.id === 'clear-selection-btn') {
                this.clearSelection();
            }

            if (e.target.id === 'print-barcodes-btn') {
                this.printBarcodes();
            }

            if (e.target.id === 'close-preview-btn') {
                this.closePreview();
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('quantity-input')) {
                const productId = e.target.dataset.productId;
                const newQty = parseInt(e.target.value) || 1;
                this.setQuantity(productId, newQty);
            }
        });
    }

    filterProductsByReference() {
        if (this.selectedReference) {
            this.filteredProducts = this.products.filter(p => 
                p && p.name && p.name.trim() === this.selectedReference
            );
            console.log(`🔍 ${this.filteredProducts.length} productos para "${this.selectedReference}"`);
        } else {
            this.filteredProducts = [];
        }
        this.renderProductList();
    }

    addProduct(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        const exists = this.selectedProducts.find(p => p._id === productId);
        if (!exists) {
            this.selectedProducts.push({ ...product, quantity: 1 });
            this.renderSelectedProducts();
            console.log(`✅ Producto agregado: ${product.name}`);
        }
    }

    removeProduct(productId) {
        this.selectedProducts = this.selectedProducts.filter(p => p._id !== productId);
        this.renderSelectedProducts();
    }

    changeQuantity(productId, delta) {
        const product = this.selectedProducts.find(p => p._id === productId);
        if (product) {
            product.quantity = Math.max(1, Math.min(1000, product.quantity + delta));
            this.renderSelectedProducts();
        }
    }

    setQuantity(productId, quantity) {
        const product = this.selectedProducts.find(p => p._id === productId);
        if (product) {
            product.quantity = Math.max(1, Math.min(1000, quantity));
            this.renderSelectedProducts();
        }
    }

    clearSelection() {
        this.selectedProducts = [];
        this.renderSelectedProducts();
    }

    formatSpecs(product) {
        const parts = [];
        
        const isValidValue = (val) => {
            return val && val !== "N/A" && val !== "" && val !== null && val !== undefined;
        };
        
        const hasSphere = isValidValue(product.sphere);
        const hasCylinder = isValidValue(product.cylinder);
        const hasAddition = isValidValue(product.addition);
        
        if (hasSphere && hasCylinder) {
            return `${product.sphere} ${product.cylinder}`;
        }
        
        if (hasSphere && hasAddition) {
            return `${product.sphere} / ${product.addition}`;
        }
        
        if (hasSphere) {
            return product.sphere;
        }
        
        return 'Sin especificaciones';
    }

    getTotalBarcodes() {
        return this.selectedProducts.reduce((sum, p) => sum + p.quantity, 0);
    }

    getTotalPages() {
        const total = this.getTotalBarcodes();
        return Math.ceil(total / this.BARCODES_PER_PAGE);
    }

    generatePreview() {
        if (this.selectedProducts.length === 0) {
            if (window.uiManager && window.uiManager.showAlert) {
                window.uiManager.showAlert('Seleccione al menos un producto', 'warning');
            } else {
                alert('Seleccione al menos un producto');
            }
            return;
        }

        const barcodes = [];
        this.selectedProducts.forEach(product => {
            for (let i = 0; i < product.quantity; i++) {
                barcodes.push({
                    barcode: product.barcode,
                    name: product.name,
                    specs: this.formatSpecs(product)
                });
            }
        });

        console.log(`📄 Generando ${barcodes.length} códigos en ${this.getTotalPages()} páginas (7x12)`);
        this.renderPreview(barcodes);
    }

    renderPreview(barcodes) {
        const section = document.getElementById('barcode-preview-section');
        const container = document.getElementById('barcode-pages-container');
        
        if (!section || !container) return;

        const totalPages = Math.ceil(barcodes.length / this.BARCODES_PER_PAGE);
        
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = `${barcodes.length} código${barcodes.length !== 1 ? 's' : ''} en ${totalPages} página${totalPages !== 1 ? 's' : ''} (7x12 por página)`;
        }

        let html = '';
        for (let page = 0; page < totalPages; page++) {
            const startIdx = page * this.BARCODES_PER_PAGE;
            const endIdx = Math.min(startIdx + this.BARCODES_PER_PAGE, barcodes.length);
            const pageBarcodes = barcodes.slice(startIdx, endIdx);

            html += `
                <div class="barcode-page">
                    <div class="page-header no-print">
                        <span class="badge bg-secondary">Página ${page + 1} de ${totalPages} • 7 columnas x 12 filas</span>
                    </div>
                    <div class="barcode-grid">
                        ${pageBarcodes.map((item, idx) => `
                            <div class="barcode-item">
                                <svg class="barcode-svg" id="barcode-${page}-${idx}"></svg>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        setTimeout(() => {
            for (let page = 0; page < totalPages; page++) {
                const startIdx = page * this.BARCODES_PER_PAGE;
                const endIdx = Math.min(startIdx + this.BARCODES_PER_PAGE, barcodes.length);
                const pageBarcodes = barcodes.slice(startIdx, endIdx);

                pageBarcodes.forEach((item, idx) => {
                    const svg = document.getElementById(`barcode-${page}-${idx}`);
                    if (svg && window.JsBarcode) {
                        try {
                            const code = item.barcode.toString().trim();
                            
                            let format = 'CODE128';
                            let options = {
                                width: 1.4,
                                height: 35,
                                displayValue: true,
                                fontSize: 27,
                                margin: 1,
                                background: '#ffffff',
                                lineColor: '#000000'
                            };
                            
                            if (/^\d{13}$/.test(code)) {
                                format = 'EAN13';
                            } else if (/^\d{8}$/.test(code)) {
                                format = 'EAN8';
                            } else if (/^\d{12}$/.test(code)) {
                                format = 'UPC';
                            }
                            
                            window.JsBarcode(svg, code, {
                                format: format,
                                ...options
                            });
                        } catch (error) {
                            console.error(`❌ Error con código "${item.barcode}":`, error.message);
                            try {
                                window.JsBarcode(svg, item.barcode, {
                                    format: 'CODE39',
                                    width: 1.4,
                                    height: 35,
                                    displayValue: true,
                                    fontSize: 27,
                                    margin: 1
                                });
                            } catch (e) {
                                svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" font-size="8" fill="red">Error</text>`;
                            }
                        }
                    }
                });
            }

            section.classList.remove('d-none');
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    printBarcodes() {
        console.log('🖨️ Imprimiendo en hoja carta croquelada...');
        window.print();
    }

    closePreview() {
        const section = document.getElementById('barcode-preview-section');
        if (section) {
            section.classList.add('d-none');
        }
    }

    render() {
        const container = document.getElementById('users-view');
        container.innerHTML = this.getMainHTML();
        this.renderReferences();
        this.renderProductList();
        this.renderSelectedProducts();
    }

    renderReferences() {
        const select = document.getElementById('barcode-reference-select');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar referencia...</option>';
        
        if (this.references.length === 0) {
            select.innerHTML += '<option value="" disabled>No hay referencias</option>';
        } else {
            this.references.forEach(ref => {
                select.innerHTML += `<option value="${ref}">${ref}</option>`;
            });
        }
    }

    renderProductList() {
        const container = document.getElementById('barcode-products-list');
        if (!container) return;

        const searchResults = this.filteredProducts.filter(p => {
            if (!this.searchTerm) return true;
            const term = this.searchTerm.toLowerCase();
            return (
                (p.sphere && p.sphere.toLowerCase().includes(term)) ||
                (p.cylinder && p.cylinder.toLowerCase().includes(term)) ||
                (p.addition && p.addition.toLowerCase().includes(term)) ||
                (p.barcode && p.barcode.includes(term))
            );
        });

        if (searchResults.length > 0) {
            container.innerHTML = searchResults.map(product => `
                <div class="card mb-2 product-card" data-product-id="${product._id}">
                    <div class="card-body p-3">
                        <h6 class="mb-1 fw-bold">${product.name}</h6>
                        <p class="mb-1 text-muted small">${this.formatSpecs(product)}</p>
                        <p class="mb-0 text-muted" style="font-family: monospace; font-size: 0.75rem;">
                            ${product.barcode}
                        </p>
                        <small class="text-info">
                            <i class="bi bi-box"></i> Stock: ${product.stock || 0}
                        </small>
                    </div>
                </div>
            `).join('');
        } else if (this.selectedReference) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-search" style="font-size: 3rem;"></i>
                    <p class="mt-2">${this.searchTerm ? 'No hay resultados' : 'Busque por fórmula'}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-box-seam" style="font-size: 3rem;"></i>
                    <p class="mt-2">Seleccione una referencia</p>
                </div>
            `;
        }
    }

    renderSelectedProducts() {
        const container = document.getElementById('barcode-selected-list');
        const badge = document.getElementById('barcode-total-badge');
        
        if (!container || !badge) return;

        const total = this.getTotalBarcodes();
        const pages = this.getTotalPages();
        badge.textContent = `${total} código${total !== 1 ? 's' : ''} (${pages} pág${pages !== 1 ? 's' : ''})`;

        if (this.selectedProducts.length > 0) {
            container.innerHTML = this.selectedProducts.map(product => `
                <div class="card mb-2">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between mb-2">
                            <div class="flex-grow-1">
                                <h6 class="mb-1 fw-bold">${product.name}</h6>
                                <p class="mb-0 text-muted small">${this.formatSpecs(product)}</p>
                            </div>
                            <button class="btn btn-sm btn-danger remove-product-btn" data-product-id="${product._id}">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-muted small">Cantidad:</span>
                            <button class="btn btn-sm btn-outline-secondary decrease-qty-btn" data-product-id="${product._id}">
                                <i class="bi bi-dash"></i>
                            </button>
                            <input type="number" class="form-control form-control-sm quantity-input" 
                                   value="${product.quantity}" min="1" max="100" 
                                   data-product-id="${product._id}" style="width: 70px;">
                            <button class="btn btn-sm btn-outline-secondary increase-qty-btn" data-product-id="${product._id}">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-box" style="font-size: 3rem;"></i>
                    <p class="mt-2">No hay productos seleccionados</p>
                </div>
            `;
        }

        const generateBtn = document.getElementById('generate-preview-btn');
        const clearBtn = document.getElementById('clear-selection-btn');
        
        if (generateBtn) generateBtn.disabled = this.selectedProducts.length === 0;
        if (clearBtn) clearBtn.disabled = this.selectedProducts.length === 0;
    }

    getMainHTML() {
        return `
            <style>
                /* 
                 * CONFIGURACIÓN PARA HOJA CROQUELADA TAMAÑO CARTA
                 * - Tamaño: 215.9mm x 279.4mm
                 * - Márgenes: Superior/Inferior 6mm, Laterales 3mm
                 * - Cuadritos: 30mm x 22mm (sin espaciado entre ellos)
                 * - Distribución: 7 columnas x 12 filas = 84 códigos por página
                 */
                
                @media screen {
                    .barcode-page {
                        background: white;
                        width: 215.9mm;
                        padding: 6mm 3mm;
                        margin: 0 auto 20px;
                        border: 1px solid #dee2e6;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .page-header {
                        text-align: center;
                        margin-bottom: 10px;
                    }
                }

                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #barcode-pages-container, #barcode-pages-container * {
                        visibility: visible;
                    }
                    #barcode-pages-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .barcode-page {
                        page-break-after: always;
                        width: 215.9mm;
                        height: 279.4mm;
                        padding: 6mm 3mm;
                        margin: 0;
                        border: none;
                        box-shadow: none;
                    }
                    .barcode-page:last-child {
                        page-break-after: auto;
                    }
                    .barcode-grid {
                        gap: 0;
                    }
                    .barcode-item {
                        border: none;
                        padding: 0;
                        margin: 0;
                    }
                    @page {
                        size: letter;
                        margin: 0;
                    }
                }
                
                /* Grid de 7 columnas x 12 filas, sin espaciado */
                .barcode-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 30mm);
                    grid-template-rows: repeat(12, 22mm);
                    gap: 0;
                    width: 100%;
                }
                
                /* Cada cuadrito exactamente 30mm x 22mm */
                .barcode-item {
                    width: 30mm;
                    height: 22mm;
                    border: 1px solid #e0e0e0;
                    padding: 2mm;
                    text-align: center;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                
                .barcode-svg {
                    max-width: 100%;
                    max-height: 100%;
                    height: auto;
                }

                .product-card {
                    cursor: pointer;
                    transition: all 0.2s;
                    border-left: 3px solid transparent;
                }

                .product-card:hover {
                    background-color: #e8f4ff;
                    border-left-color: #0d6efd;
                    box-shadow: 0 2px 6px rgba(13, 110, 253, 0.2);
                    transform: translateX(2px);
                }
            </style>

            <div class="no-print">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2><i class="bi bi-upc-scan me-2"></i>Generador de Códigos de Barra</h2>
                        <small class="text-muted">
                            <i class="bi bi-info-circle"></i> 
                            Optimizado para hoja carta croquelada • 7x12 (84 códigos/página) • 30x22mm
                        </small>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-6 mb-4">
                        <div class="card shadow-sm">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0"><i class="bi bi-search me-2"></i>Búsqueda</h5>
                                <small class="text-white-50">Click para agregar</small>
                            </div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Referencia</label>
                                    <select id="barcode-reference-select" class="form-select">
                                        <option value="">Seleccionar...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Buscar</label>
                                    <input type="text" id="barcode-search-input" class="form-control" 
                                           placeholder="Fórmula o código...">
                                </div>

                                <div id="barcode-products-list" style="max-height: 400px; overflow-y: auto;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6 mb-4">
                        <div class="card shadow-sm">
                            <div class="card-header bg-success text-white">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0"><i class="bi bi-check2-square me-2"></i>Seleccionados</h5>
                                    <span class="badge bg-white text-success" id="barcode-total-badge">0 códigos</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <div id="barcode-selected-list" style="max-height: 400px; overflow-y: auto;" class="mb-3">
                                </div>

                                <div class="d-grid gap-2">
                                    <button id="generate-preview-btn" class="btn btn-primary" disabled>
                                        <i class="bi bi-eye me-2"></i>Generar Vista Previa
                                    </button>
                                    <button id="clear-selection-btn" class="btn btn-outline-secondary" disabled>
                                        <i class="bi bi-trash me-2"></i>Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="barcode-preview-section" class="d-none">
                <div class="card shadow-sm no-print mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h4 class="mb-0"><i class="bi bi-eye me-2"></i>Vista Previa</h4>
                                <small class="text-muted" id="page-info">Generando...</small>
                            </div>
                            <div class="btn-group">
                                <button id="print-barcodes-btn" class="btn btn-success">
                                    <i class="bi bi-printer me-2"></i>Imprimir
                                </button>
                                <button id="close-preview-btn" class="btn btn-secondary">
                                    <i class="bi bi-x-lg me-2"></i>Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="barcode-pages-container">
                </div>
            </div>
        `;
    }
}