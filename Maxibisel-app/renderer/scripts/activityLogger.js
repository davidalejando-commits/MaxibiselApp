import { uiManager } from './ui.js';

export const activityLogger = {
  logs: [],
  maxLogsInMemory: 100,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    
    console.log('📊 Inicializando Activity Logger...');
    
    // 1. Cargar logs locales primero
    this.loadLogsFromLocalStorage();
    
    // 2. Limpiar logs antiguos (más de 30 días)
    this.cleanOldLocalLogs(30);
    
    // 3. Configurar botón
    this.setupEventListeners();
    
    // 4. Procesar logs pendientes si hay token
    if (this.hasValidToken()) {
      setTimeout(() => {
        this.processPendingLogs();
      }, 1000);
    }
    
    // 5. Cargar logs del servidor
    setTimeout(() => {
      this.loadRecentLogs();
    }, 2000);
    
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

  hasValidToken() {
    const token = localStorage.getItem('authToken');
    return token && token !== 'null' && token !== 'undefined';
  },

  async log(logData) {
    try {
      const userStr = localStorage.getItem('user');
      let user = {};
      
      try {
        user = userStr ? JSON.parse(userStr) : {};
      } catch (e) {
        console.warn('⚠️ Error parseando usuario:', e);
      }
      
      const logEntry = {
        tipo: logData.tipo || 'GENERAL',
        accion: logData.accion,
        usuario: user.name || user.username || logData.usuario || 'Sistema',
        entidad: logData.entidad || null,
        entidad_id: logData.entidad_id || null,
        datos_anteriores: logData.datos_anteriores || null,
        datos_nuevos: logData.datos_nuevos || null,
        ip_address: null,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // Agregar a memoria
      this.logs.unshift(logEntry);
      if (this.logs.length > this.maxLogsInMemory) {
        this.logs.pop();
      }

      // Guardar en localStorage
      this.saveLogsToLocalStorage();
      this.updateBadge();

      // Guardar en backend si hay token
      if (this.hasValidToken()) {
        await this.saveToBackend(logEntry);
        await this.processPendingLogs();
      } else {
        console.log('⏳ Sin token, guardando en cola:', logEntry.accion);
        this.addToPendingQueue(logEntry);
      }

      console.log('📝 Log registrado:', logEntry.accion);
    } catch (error) {
      console.error('❌ Error registrando log:', error);
    }
  },

  saveLogsToLocalStorage() {
    try {
      localStorage.setItem('activityLogs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('❌ Error guardando logs en localStorage:', error);
    }
  },

  loadLogsFromLocalStorage() {
    try {
      const stored = localStorage.getItem('activityLogs');
      if (stored) {
        this.logs = JSON.parse(stored);
        console.log('✅ Logs cargados desde localStorage:', this.logs.length);
        this.updateBadge();
      }
    } catch (error) {
      console.error('❌ Error cargando logs desde localStorage:', error);
      this.logs = [];
    }
  },

  addToPendingQueue(logEntry) {
    try {
      const queue = this.getPendingQueue();
      queue.push(logEntry);
      localStorage.setItem('pendingLogs', JSON.stringify(queue));
      console.log('💾 Log en cola pendiente:', queue.length);
    } catch (error) {
      console.error('❌ Error guardando log pendiente:', error);
    }
  },

  getPendingQueue() {
    try {
      const stored = localStorage.getItem('pendingLogs');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error obteniendo cola pendiente:', error);
      return [];
    }
  },

  async processPendingLogs() {
    try {
      const queue = this.getPendingQueue();
      if (queue.length === 0) return;
      
      console.log(`📤 Procesando ${queue.length} logs pendientes...`);
      
      const successfulIds = [];
      
      for (let i = 0; i < queue.length; i++) {
        try {
          await this.saveToBackend(queue[i]);
          successfulIds.push(i);
        } catch (error) {
          console.error('❌ Error procesando log pendiente:', error);
          break;
        }
      }
      
      if (successfulIds.length > 0) {
        const remaining = queue.filter((_, index) => !successfulIds.includes(index));
        localStorage.setItem('pendingLogs', JSON.stringify(remaining));
        console.log(`✅ ${successfulIds.length} logs pendientes procesados`);
      }
    } catch (error) {
      console.error('❌ Error procesando logs pendientes:', error);
    }
  },

  async saveToBackend(logEntry) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token || token === 'null' || token === 'undefined') return;

      if (window.api && typeof window.api.createLog === 'function') {
        await window.api.createLog(logEntry);
        console.log('✅ Log guardado en backend:', logEntry.accion);
        return;
      }

      const response = await fetch('http://localhost:5000/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        console.log('✅ Log guardado en backend:', logEntry.accion);
      }
    } catch (error) {
      console.error('❌ Error guardando log en backend:', error);
    }
  },

  async loadRecentLogs() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token || token === 'null' || token === 'undefined') {
        console.log('ℹ️ No hay token, usando logs locales');
        return;
      }

      console.log('📥 Cargando logs del backend...');

      if (window.api && typeof window.api.getLogs === 'function') {
        const data = await window.api.getLogs({ limit: 50 });
        if (data.success && data.logs) {
          this.mergeLogs(data.logs);
          this.updateBadge();
          console.log('✅ Logs del backend cargados:', data.logs.length);
        }
        return;
      }

      const response = await fetch('http://localhost:5000/api/logs?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success && data.logs) {
        this.mergeLogs(data.logs);
        this.updateBadge();
        console.log('✅ Logs del backend cargados:', data.logs.length);
      }
    } catch (error) {
      console.error('❌ Error cargando logs del backend:', error);
    }
  },

  mergeLogs(serverLogs) {
    try {
      const existingTimestamps = new Set(this.logs.map(log => log.timestamp));
      const newLogs = serverLogs.filter(log => !existingTimestamps.has(log.timestamp));
      
      this.logs = [...this.logs, ...newLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, this.maxLogsInMemory);
      
      this.saveLogsToLocalStorage();
      console.log(`✅ Logs combinados: ${newLogs.length} nuevos del servidor`);
    } catch (error) {
      console.error('❌ Error combinando logs:', error);
    }
  },

  cleanOldLocalLogs(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const before = this.logs.length;
      this.logs = this.logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      });
      
      const removed = before - this.logs.length;
      if (removed > 0) {
        this.saveLogsToLocalStorage();
        console.log(`🧹 ${removed} logs antiguos eliminados (más de ${days} días)`);
      }
    } catch (error) {
      console.error('❌ Error limpiando logs antiguos:', error);
    }
  },

  updateBadge() {
    const badge = document.getElementById('log-badge');
    if (badge && this.logs.length > 0) {
      badge.textContent = this.logs.length;
      badge.classList.remove('d-none');
    }
  },

  async refreshLogs() {
    const container = document.getElementById('logs-container');
    if (container) {
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2">Actualizando...</p></div>';
    }
    
    if (this.hasValidToken()) {
      await this.processPendingLogs();
    }
    
    await this.loadRecentLogs();
    
    if (container) {
      container.innerHTML = this.generateLogsHTML(this.logs);
    }
    
    uiManager.showAlert('Logs actualizados', 'success');
  },

  showLogModal() {
    const existingModal = document.getElementById('activity-log-modal');
    if (existingModal) existingModal.remove();

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
            
            <div class="modal-header" style="background: linear-gradient(135deg, #1582ffff 0%, #2487ffff 100%); color: white; border-radius: 12px 12px 0 0; padding: 20px 24px;">
              <h5 class="modal-title" style="font-size: 1.3rem; font-weight: 600; color: white;">
                <i class="bi bi-clock-history me-2"></i>Registro de Actividad
              </h5>
              <button type="button" class="btn-close btn-close-white" onclick="activityLogger.hideModal()"></button>
            </div>

            <div class="modal-body" style="padding: 0;">
              <div style="padding: 20px 24px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
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
                    <input type="text" class="form-control" id="log-search-input" placeholder="Buscar registro...">
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

              <div id="logs-container" style="max-height: 500px; overflow-y: auto; padding: 20px 24px;">
                ${logsHTML}
              </div>
            </div>

            <div class="modal-footer" style="background: #f8f9fa; padding: 16px 24px; border-radius: 0 0 12px 12px;">
              <div class="d-flex justify-content-between align-items-center w-100">
                <span class="text-muted" style="font-size: 0.9rem;">
                  <i class="bi bi-info-circle me-1"></i>Total de registros: <strong>${this.logs.length}</strong>
                </span>
                <div>
                  <button type="button" class="btn btn-sm btn-outline-primary me-2" onclick="activityLogger.refreshLogs()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
                  </button>
                  <button type="button" class="btn btn-secondary" onclick="activityLogger.hideModal()">Cerrar</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  },

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
        <div class="log-item" style="background: white; border: 1px solid #e9ecef; border-left: 4px solid ${config.color}; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: all 0.2s;" 
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
        onmouseout="this.style.boxShadow='none'">
          <div style="display: flex; align-items: start; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 8px; background: ${config.background}; color: ${config.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i class="bi bi-${config.icon}" style="font-size: 1.2rem;"></i>
            </div>

            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                <div>
                  <span class="badge" style="background: ${config.background}; color: ${config.color}; font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">${log.tipo}</span>
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

  generateLogDetails(log) {
    if (!log.datos_nuevos && !log.datos_anteriores) return '';

    if (log.tipo === 'SALIDA' && log.datos_nuevos) {
      return this.generateSalidaDetails(log.datos_nuevos);
    }

    if (log.tipo === 'FACTURA' && log.datos_nuevos) {
      return this.generateFacturaDetails(log.datos_nuevos);
    }

    if (log.tipo === 'PRODUCTO' && log.datos_nuevos) {
      return this.generateProductoDetails(log.datos_nuevos, log.datos_anteriores);
    }

    return '';
  },

  generateSalidaDetails(datos) {
    if (!datos.productos_detalle || datos.productos_detalle.length === 0) {
      return `
        <div style="margin-top: 12px; padding: 12px; background: #fff5f5; border-radius: 6px; border: 1px solid #ffdddd;">
          <strong style="color: #e74c3c;">Total: ${datos.cantidad_total || 0} Und(s)</strong>
        </div>
      `;
    }

    const productosHTML = datos.productos_detalle.map(p => `
      <div style="background: white; padding: 8px 12px; border-radius: 4px; border: 1px solid #dee2e6; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">${p.nombre || 'Producto'}</div>
          ${p.especificaciones ? `<div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">${p.especificaciones}</div>` : ''}
        </div>
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.85rem; white-space: nowrap; margin-left: 10px;">
          -${p.cantidad || 0}
        </div>
      </div>
    `).join('');

    return `
      <div style="margin-top: 12px; padding: 12px; background: #fff5f5; border-radius: 6px; border: 1px solid #ffdddd;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ffdddd;">
          <strong style="color: #e74c3c; font-size: 0.9rem;"><i class="bi bi-box-seam me-1"></i>Productos (${datos.productos_count || 0})</strong>
          <span style="background: #e74c3c; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">
            Total: ${datos.cantidad_total || 0} Und(s)
          </span>
        </div>
        ${productosHTML}
      </div>
    `;
  },

  generateFacturaDetails(datos) {
    if (!datos.productos_detalle || datos.productos_detalle.length === 0) {
      return `
        <div style="margin-top: 12px; padding: 12px; background: #f0f8ff; border-radius: 6px; border: 1px solid #cfe2ff;">
          <div style="font-size: 0.9rem;"><strong>Cliente:</strong> ${datos.cliente || 'N/A'}</div>
          <div style="font-size: 0.9rem;"><strong>Total:</strong> $${(datos.total || 0).toLocaleString('es-CO')}</div>
        </div>
      `;
    }

    const productosHTML = datos.productos_detalle.map(p => `
      <div style="background: white; padding: 8px 12px; border-radius: 4px; border: 1px solid #cfe2ff; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem;">${p.nombre || 'Producto'}</div>
            ${p.descripcion ? `<div style="font-size: 0.8rem; color: #6c757d; margin-top: 2px;">${p.descripcion}</div>` : ''}
            <div style="font-size: 0.8rem; color: #6c757d; margin-top: 4px;">Cantidad: ${p.cantidad || 0}</div>
          </div>
          <div style="text-align: right; white-space: nowrap; margin-left: 10px;">
            <div style="font-weight: 700; color: #3498db; font-size: 0.95rem;">$${(p.subtotal || 0).toLocaleString('es-CO')}</div>
          </div>
        </div>
      </div>
    `).join('');

    return `
      <div style="margin-top: 12px; padding: 12px; background: #f0f8ff; border-radius: 6px; border: 1px solid #cfe2ff;">
        <div style="margin-bottom: 10px;">
          <div style="font-weight: 600; color: #2c3e50; font-size: 0.9rem; margin-bottom: 4px;">
            <i class="bi bi-person me-1"></i>${datos.cliente || 'Cliente'}
          </div>
          <span style="background: #3498db; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">${datos.numero || 'N/A'}</span>
        </div>
        <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #cfe2ff;">
          <strong style="color: #3498db; font-size: 0.9rem;"><i class="bi bi-box-seam me-1"></i>Productos (${datos.productos_count || 0})</strong>
        </div>
        ${productosHTML}
        <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #3498db; display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #2c3e50; font-size: 1rem;">TOTAL:</strong>
          <strong style="color: #3498db; font-size: 1.1rem;">$${(datos.total || 0).toLocaleString('es-CO')}</strong>
        </div>
      </div>
    `;
  },

  generateProductoDetails(datosNuevos, datosAnteriores) {
    const items = [];
    
    // Nombre del producto
    if (datosNuevos?.nombre) {
        items.push(`
            <div style="font-size: 0.85rem; margin-bottom: 6px;">
                <strong style="color: #9b59b6;">📦 Producto:</strong> ${datosNuevos.nombre}
            </div>
        `);
    }
    
    // ====================================================================
    // 🔬 FÓRMULA DEL PRODUCTO EN ESPAÑOL
    // ====================================================================
    if (datosNuevos?.formula) {
        const formula = datosNuevos.formula;
        const hasFormula = formula.sphere !== 'N/A' || formula.cylinder !== 'N/A' || formula.addition !== 'N/A';
        
        if (hasFormula) {
            items.push(`
                <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e9d5ff;">
                    <div style="font-weight: 600; color: #7c3aed; font-size: 0.8rem; margin-bottom: 6px; display: flex; align-items: center;">
                        <i class="bi bi-diagram-3 me-2"></i>Fórmula del Producto
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        <div style="background: white; padding: 6px 8px; border-radius: 4px; text-align: center;">
                            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 2px;">Esfera</div>
                            <div style="font-weight: 600; color: #7c3aed;">${formula.sphere}</div>
                        </div>
                        <div style="background: white; padding: 6px 8px; border-radius: 4px; text-align: center;">
                            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 2px;">Cilindro</div>
                            <div style="font-weight: 600; color: #7c3aed;">${formula.cylinder}</div>
                        </div>
                        <div style="background: white; padding: 6px 8px; border-radius: 4px; text-align: center;">
                            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 2px;">Adición</div>
                            <div style="font-weight: 600; color: #7c3aed;">${formula.addition}</div>
                        </div>
                    </div>
                </div>
            `);
        }
    }
    
    // Stock con comparación
    if (datosNuevos?.stock !== undefined) {
        const cambio = datosAnteriores?.stock !== undefined ? datosNuevos.stock - datosAnteriores.stock : null;
        const cambioHTML = cambio !== null ? `
            <span style="color: ${cambio >= 0 ? '#28a745' : '#dc3545'}; margin-left: 8px; font-weight: 600;">
                (${cambio >= 0 ? '+' : ''}${cambio})
            </span>
        ` : '';
        
        items.push(`
            <div style="font-size: 0.85rem; margin-bottom: 6px;">
                <strong style="color: #9b59b6;">📊 Stock:</strong> ${datosNuevos.stock} unidades${cambioHTML}
            </div>
        `);
    }
    
    // Código de barras
    if (datosNuevos?.barcode) {
        items.push(`
            <div style="font-size: 0.85rem; margin-bottom: 6px;">
                <strong style="color: #9b59b6;">🔢 Código:</strong> 
                <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-size: 0.8rem;">${datosNuevos.barcode}</code>
            </div>
        `);
    }
    
    // Tipo de modificación (para logs de stock)
    if (datosNuevos?.modificacion) {
        items.push(`
            <div style="font-size: 0.85rem; margin-top: 8px; padding: 6px 10px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px;">
                <strong style="color: #856404;">📝 Modificación:</strong> ${datosNuevos.modificacion}
            </div>
        `);
    }

    if (items.length === 0) return '';

    return `
        <div style="margin-top: 12px; padding: 12px; background: #f9f3ff; border-radius: 6px; border: 1px solid #e9d5ff;">
            ${items.join('')}
        </div>
    `;
  },

  getLogConfig(tipo) {
    const configs = {
      'SALIDA': { icon: 'box-arrow-right', color: '#e74c3c', background: '#ffe5e5' },
      'FACTURA': { icon: 'receipt', color: '#3498db', background: '#e5f6f9' },
      'PRODUCTO': { icon: 'box-seam', color: '#9b59b6', background: '#f3e5f9' },
      'USUARIO': { icon: 'person-badge', color: '#f39c12', background: '#fff8e1' },
      'ENTRADA': { icon: 'box-arrow-in-down', color: '#27ae60', background: '#e8f8f5' },
      'SISTEMA': { icon: 'gear', color: '#6c757d', background: '#f8f9fa' }
    };
    return configs[tipo] || configs['SISTEMA'];
  },

  attachModalListeners() {
    document.getElementById('log-filter-tipo')?.addEventListener('change', () => this.filterLogs());
    document.getElementById('log-search-input')?.addEventListener('input', () => this.filterLogs());
    document.getElementById('log-filter-periodo')?.addEventListener('change', () => this.filterLogs());
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
    if (modal) modal.remove();
  }
};

window.activityLogger = activityLogger;