export const activityLogger = {
  logs: [],
  maxLogsInMemory: 100,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    
    console.log('📊 Inicializando Activity Logger...');
    this.setupEventListeners();
    this.loadRecentLogs();
    this.isInitialized = true;
    
    console.log('✅ Activity Logger inicializado');
  },

  setupEventListeners() {
    const logBtn = document.getElementById('activity-log-btn');
    if (logBtn) {
      logBtn.addEventListener('click', () => this.showLogModal());
      console.log('✅ Botón de activity log configurado');
    } else {
      console.warn('⚠️ Botón activity-log-btn no encontrado');
    }
  },

  async log(logData) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const logEntry = {
        tipo: logData.tipo || 'GENERAL',
        accion: logData.accion,
        usuario: user.name || logData.usuario || 'Sistema',
        entidad: logData.entidad || null,
        entidad_id: logData.entidad_id || null,
        datos_anteriores: logData.datos_anteriores || null,
        datos_nuevos: logData.datos_nuevos || null,
        ip_address: null,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      this.logs.unshift(logEntry);
      if (this.logs.length > this.maxLogsInMemory) {
        this.logs.pop();
      }

      this.updateBadge();
      this.saveToBackend(logEntry);

      console.log('📝 Log registrado:', logEntry.accion);
    } catch (error) {
      console.error('❌ Error registrando log:', error);
    }
  },

  async saveToBackend(logEntry) {
    try {
      console.log('💾 Log guardado en memoria:', logEntry.accion);
    } catch (error) {
      console.error('❌ Error guardando log en backend:', error);
    }
  },

  async loadRecentLogs() {
    try {
      console.log('📥 Cargando logs recientes...');
    } catch (error) {
      console.error('❌ Error cargando logs:', error);
    }
  },

  updateBadge() {
    const badge = document.getElementById('log-badge');
    if (badge && this.logs.length > 0) {
      badge.textContent = this.logs.length;
      badge.classList.remove('d-none');
    }
  },

  showLogModal() {
    const existingModal = document.getElementById('activity-log-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = this.generateModalHTML();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.attachModalListeners();
  },

  generateModalHTML() {
    const logsHTML = this.generateLogsHTML(this.logs);

    return `
      <div class="modal fade show" id="activity-log-modal" style="display: flex !important; background: rgba(0,0,0,0.7);" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content" style="border-radius: 12px; box-shadow: 0 10px 40px rgba(255, 255, 255, 0.22);">
            
            <div class="modal-header" style="
              background: linear-gradient(135deg, #1582ffff 0%, #2487ffff 100%);
              color: white;
              border-radius: 12px 12px 0 0;
              padding: 20px 24px;
            ">
              <h5 class="modal-title" style="font-size: 1.3rem; font-weight: 600; color: white;">
                <i class="bi bi-clock-history me-2"></i>
                Registro de Actividad
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="activityLogger.hideModal()"></button>
            </div>

            <div class="modal-body" style="padding: 0;">
              <div style="
                padding: 20px 24px;
                background: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
              ">
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label fw-bold" style="font-size: 0.85rem; color: #495057;">
                      <i class="bi bi-funnel me-1"></i>Tipo de Actividad
                    </label>
                    <select class="form-select" id="log-filter-tipo">
                      <option value="">Todos</option>
                      <option value="SALIDA">Salidas</option>
                      <option value="FACTURA">Facturas</option>
                      <option value="PRODUCTO">Productos</option>
                      <option value="USUARIO">Usuarios</option>
                    </select>
                  </div>
                  
                  <div class="col-md-4">
                    <label class="form-label fw-bold" style="font-size: 0.85rem; color: #495057;">
                      <i class="bi bi-search me-1"></i>Buscar
                    </label>
                    <input 
                      type="text" 
                      class="form-control" 
                      id="log-search-input" 
                      placeholder="Buscar registro..."
                    >
                  </div>

                  <div class="col-md-4">
                    <label class="form-label fw-bold" style="font-size: 0.85rem; color: #495057;">
                      <i class="bi bi-calendar3 me-1"></i>Período
                    </label>
                    <select class="form-select" id="log-filter-periodo">
                      <option value="hoy">Hoy</option>
                      <option value="semana">Última semana</option>
                      <option value="mes">Último mes</option>
                      <option value="todo" selected>Todo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div id="logs-container" style="
                max-height: 500px;
                overflow-y: auto;
                padding: 20px 24px;
              ">
                ${logsHTML}
              </div>
            </div>

            <div class="modal-footer" style="
              background: #f8f9fa;
              padding: 16px 24px;
              border-radius: 0 0 12px 12px;
            ">
              <div class="d-flex justify-content-between align-items-center w-100">
                <span class="text-muted" style="font-size: 0.9rem;">
                  <i class="bi bi-info-circle me-1"></i>
                  Total de registros: <strong>${this.logs.length}</strong>
                </span>
                <button type="button" class="btn btn-secondary" onclick="activityLogger.hideModal()">
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  // ✅ FUNCIÓN MEJORADA CON DETALLES EXPANDIDOS
  generateLogsHTML(logs) {
    if (logs.length === 0) {
      return `
        <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
          <i class="bi bi-inbox" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
          <p style="font-size: 1.1rem;">No hay registros de actividad</p>
        </div>
      `;
    }

    return logs.map(log => {
      const config = this.getLogConfig(log.tipo);
      const timestamp = new Date(log.timestamp);
      const timeStr = timestamp.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="log-item" style="
          background: white;
          border: 1px solid #e9ecef;
          border-left: 4px solid ${config.color};
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          transition: all 0.2s;
        " 
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
        onmouseout="this.style.boxShadow='none'"
        >
          <div style="display: flex; align-items: start; gap: 12px;">
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 8px;
              background: ${config.background};
              color: ${config.color};
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <i class="bi bi-${config.icon}" style="font-size: 1.2rem;"></i>
            </div>

            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                <div>
                  <span class="badge" style="
                    background: ${config.background};
                    color: ${config.color};
                    font-size: 0.7rem;
                    padding: 4px 8px;
                    border-radius: 4px;
                    margin-right: 8px;
                  ">${log.tipo}</span>
                  <strong style="color: #2c3e50; font-size: 0.95rem;">${log.accion}</strong>
                </div>
                <span style="color: #6c757d; font-size: 0.85rem; white-space: nowrap;">
                  <i class="bi bi-clock me-1"></i>${timeStr}
                </span>
              </div>

              <div style="color: #6c757d; font-size: 0.9rem; margin-top: 4px;">
                <i class="bi bi-person me-1"></i>${log.usuario}
                ${log.entidad ? `<span class="mx-2">•</span><i class="bi bi-tag me-1"></i>${log.entidad}` : ''}
              </div>

              ${this.generateLogDetails(log)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ✅ FUNCIÓN COMPLETAMENTE NUEVA CON FORMATO MEJORADO
  generateLogDetails(log) {
    if (!log.datos_nuevos && !log.datos_anteriores) return '';

    // Para SALIDAS
    if (log.tipo === 'SALIDA' && log.datos_nuevos) {
      return this.generateSalidaDetails(log.datos_nuevos);
    }

    // Para FACTURAS
    if (log.tipo === 'FACTURA' && log.datos_nuevos) {
      return this.generateFacturaDetails(log.datos_nuevos);
    }

    // Para PRODUCTOS
    if (log.tipo === 'PRODUCTO' && log.datos_nuevos) {
      return this.generateProductoDetails(log.datos_nuevos, log.datos_anteriores);
    }

    // Formato por defecto (JSON)
    return `
      <div style="
        margin-top: 12px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        font-size: 0.85rem;
      ">
        ${log.datos_nuevos ? `
          <div style="margin-bottom: 4px;">
            <strong style="color: #28a745;">Nuevos datos:</strong>
            <span style="color: #495057;">${JSON.stringify(log.datos_nuevos)}</span>
          </div>
        ` : ''}
        ${log.datos_anteriores ? `
          <div>
            <strong style="color: #dc3545;">Datos anteriores:</strong>
            <span style="color: #495057;">${JSON.stringify(log.datos_anteriores)}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  // ✅ NUEVO: Detalles específicos para SALIDAS
  generateSalidaDetails(datos) {
    if (!datos.productos_detalle || datos.productos_detalle.length === 0) {
      return `
        <div style="
          margin-top: 12px;
          padding: 12px;
          background: #fff5f5;
          border-radius: 6px;
          border: 1px solid #ffdddd;
        ">
          <strong style="color: #e74c3c;">Total: ${datos.cantidad_total || 0} Und(s)</strong>
        </div>
      `;
    }

    const productosHTML = datos.productos_detalle.map(p => `
      <div style="
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #dee2e6;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">
            ${p.nombre || 'Producto'}
          </div>
          ${p.especificaciones ? `
            <div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">
              ${p.especificaciones}
            </div>
          ` : ''}
        </div>
        <div style="
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.85rem;
          white-space: nowrap;
          margin-left: 10px;
        ">
          -${p.cantidad || 0}
        </div>
      </div>
    `).join('');

    return `
      <div style="
        margin-top: 12px;
        padding: 12px;
        background: #fff5f5;
        border-radius: 6px;
        border: 1px solid #ffdddd;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #ffdddd;
        ">
          <strong style="color: #e74c3c; font-size: 0.9rem;">
            <i class="bi bi-box-seam me-1"></i>Productos (${datos.productos_count || 0})
          </strong>
          <span style="
            background: #e74c3c;
            color: white;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 600;
          ">
            Total: ${datos.cantidad_total || 0} Und(s)
          </span>
        </div>
        ${productosHTML}
        ${datos.modo_bodega ? `
          <div style="
            margin-top: 8px;
            padding: 6px 10px;
            background: white;
            border-radius: 4px;
            border-left: 3px solid #f39c12;
            font-size: 0.8rem;
            color: #856404;
          ">
            <i class="bi bi-info-circle me-1"></i>Descontado directamente de bodega
          </div>
        ` : ''}
      </div>
    `;
  },

  // ✅ NUEVO: Detalles específicos para FACTURAS
  generateFacturaDetails(datos) {
    if (!datos.productos_detalle || datos.productos_detalle.length === 0) {
      return `
        <div style="
          margin-top: 12px;
          padding: 12px;
          background: #f0f8ff;
          border-radius: 6px;
          border: 1px solid #cfe2ff;
        ">
          <div style="font-size: 0.9rem;"><strong>Cliente:</strong> ${datos.cliente || 'N/A'}</div>
          <div style="font-size: 0.9rem;"><strong>Total:</strong> $${(datos.total || 0).toLocaleString('es-CO')}</div>
        </div>
      `;
    }

    const productosHTML = datos.productos_detalle.map(p => `
      <div style="
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #cfe2ff;
        margin-bottom: 6px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">
              ${p.nombre || 'Producto'}
            </div>
            ${p.descripcion ? `
              <div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">
                ${p.descripcion}
              </div>
            ` : ''}
            <div style="font-size: 0.8rem; color: #6c757d; margin-top: 4px;">
              Cantidad: ${p.cantidad || 0}
            </div>
          </div>
          <div style="text-align: right; white-space: nowrap; margin-left: 10px;">
            <div style="font-weight: 700; color: #3498db; font-size: 0.95rem;">
              $${(p.subtotal || 0).toLocaleString('es-CO')}
            </div>
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
        <div style="margin-bottom: 10px;">
          <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem; margin-bottom: 4px;">
            <i class="bi bi-person me-1"></i>${datos.cliente || 'Cliente'}
          </div>
          <span style="
            background: #3498db;
            color: white;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 600;
          ">
            ${datos.numero || 'N/A'}
          </span>
        </div>
        
        <div style="
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #cfe2ff;
        ">
          <strong style="color: #3498db; font-size: 0.9rem;">
            <i class="bi bi-box-seam me-1"></i>Productos (${datos.productos_count || 0})
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
          <strong style="color: #3498db; font-size: 1.1rem;">
            $${(datos.total || 0).toLocaleString('es-CO')}
          </strong>
        </div>
      </div>
    `;
  },

  // ✅ NUEVO: Detalles específicos para PRODUCTOS
  generateProductoDetails(datosNuevos, datosAnteriores) {
    const items = [];
    
    if (datosNuevos?.nombre) {
      items.push(`<div style="font-size: 0.85rem;"><strong>Nombre:</strong> ${datosNuevos.nombre}</div>`);
    }
    
    if (datosNuevos?.stock !== undefined) {
      const cambio = datosAnteriores?.stock !== undefined 
        ? datosNuevos.stock - datosAnteriores.stock 
        : null;
      
      items.push(`
        <div style="font-size: 0.85rem;">
          <strong>Stock:</strong> ${datosNuevos.stock}
          ${cambio !== null ? `
            <span style="color: ${cambio >= 0 ? '#28a745' : '#dc3545'}; margin-left: 8px;">
              (${cambio >= 0 ? '+' : ''}${cambio})
            </span>
          ` : ''}
        </div>
      `);
    }
    
    if (datosNuevos?.barcode) {
      items.push(`<div style="font-size: 0.85rem;"><strong>Código:</strong> ${datosNuevos.barcode}</div>`);
    }

    if (items.length === 0) return '';

    return `
      <div style="
        margin-top: 12px;
        padding: 12px;
        background: #f9f3ff;
        border-radius: 6px;
        border: 1px solid #e9d5ff;
      ">
        ${items.join('')}
      </div>
    `;
  },

  getLogConfig(tipo) {
    const configs = {
      'SALIDA': {
        icon: 'box-arrow-right',
        color: '#e74c3c',
        background: '#ffe5e5'
      },
      'FACTURA': {
        icon: 'receipt',
        color: '#3498db',
        background: '#e5f6f9'
      },
      'PRODUCTO': {
        icon: 'box-seam',
        color: '#9b59b6',
        background: '#f3e5f9'
      },
      'USUARIO': {
        icon: 'person-badge',
        color: '#f39c12',
        background: '#fff8e1'
      },
      'ENTRADA': {
        icon: 'box-arrow-in-down',
        color: '#27ae60',
        background: '#e8f8f5'
      },
      'SISTEMA': {
        icon: 'gear',
        color: '#6c757d',
        background: '#f8f9fa'
      }
    };

    return configs[tipo] || configs['SISTEMA'];
  },

  attachModalListeners() {
    document.getElementById('log-filter-tipo')?.addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('log-search-input')?.addEventListener('input', () => {
      this.filterLogs();
    });

    document.getElementById('log-filter-periodo')?.addEventListener('change', () => {
      this.filterLogs();
    });
  },

  filterLogs() {
    const tipo = document.getElementById('log-filter-tipo')?.value || '';
    const search = document.getElementById('log-search-input')?.value.toLowerCase() || '';
    const periodo = document.getElementById('log-filter-periodo')?.value || 'todo';

    let filtered = [...this.logs];

    if (tipo) {
      filtered = filtered.filter(log => log.tipo === tipo);
    }

    if (search) {
      filtered = filtered.filter(log => 
        log.accion.toLowerCase().includes(search) ||
        log.usuario.toLowerCase().includes(search) ||
        (log.entidad && log.entidad.toLowerCase().includes(search))
      );
    }

    const now = new Date();
    if (periodo !== 'todo') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        const diffDays = Math.floor((now - logDate) / (1000 * 60 * 60 * 24));
        
        switch (periodo) {
          case 'hoy': return diffDays === 0;
          case 'semana': return diffDays <= 7;
          case 'mes': return diffDays <= 30;
          default: return true;
        }
      });
    }

    const container = document.getElementById('logs-container');
    if (container) {
      container.innerHTML = this.generateLogsHTML(filtered);
    }
  },

  hideModal() {
    const modal = document.getElementById('activity-log-modal');
    if (modal) {
      modal.remove();
    }
  }
};

window.activityLogger = activityLogger;