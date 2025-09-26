// Sistema de sincronización de datos - CORREGIDO
import { eventManager } from './eventManager.js';

export const dataSync = {
    cache: new Map(),
    subscriptions: new Map(),
    isInitialized: false,
    refreshTimeouts: new Map(),

    init() {
        if (this.isInitialized) return;

        console.log('🔄 Inicializando sistema de sincronización...');
        
        this.setupEventListeners();
        
        // ✅ NUEVO: Configurar listeners para WebSocket/Socket.io
        this.setupWebSocketListeners();

        this.isInitialized = true;
        console.log('✅ Sistema de sincronización inicializado');
    },

    // ✅ FUNCIÓN CORREGIDA: setupEventListeners debe existir
    setupEventListeners() {
        console.log('🔧 Configurando event listeners del sistema de sincronización...');
        
        // Listener para actualizaciones de productos
        eventManager.on('product:updated', (product) => {
            this.handleProductUpdated(product);
        });

        // Listener para actualizaciones de stock
        eventManager.on('product:stock-updated', (data) => {
            this.handleProductStockUpdated(data);
        });

        // Listener para invalidación de cache
        eventManager.on('cache:invalidate', (dataType) => {
            this.invalidateCache(dataType);
        });

        console.log('✅ Event listeners configurados');
    },

    // ✅ NUEVA FUNCIÓN: Configurar WebSocket listeners
    setupWebSocketListeners() {
        if (window.socket) {
            console.log('🌐 Configurando WebSocket listeners en dataSync...');

            // ✅ CRÍTICO: Listener para actualizaciones de stock desde servidor
            window.socket.on('product:stock-updated', (data) => {
                console.log('📡 DataSync recibió stock actualizado:', data);
                
                // Actualizar cache inmediatamente
                this.updateCacheFromServerEvent('products', data.product || data);
                
                // Emitir evento interno para que las vistas se actualicen
                eventManager.emit('external:stock-updated', data);
                
                // También notificar a suscriptores específicos
                this.notifySubscribersImmediate('products', 'stock-updated', data);
            });

            // ✅ CRÍTICO: Listener para productos actualizados desde servidor
            window.socket.on('product:updated', (product) => {
                console.log('📡 DataSync recibió producto actualizado:', product);
                
                // Actualizar cache
                this.updateCacheFromServerEvent('products', product);
                
                // Emitir evento interno
                eventManager.emit('external:product-updated', product);
                
                // Notificar suscriptores
                this.notifySubscribersImmediate('products', 'updated', product);
            });

            console.log('✅ WebSocket listeners configurados en dataSync');
        } else {
            console.log('⚠️ WebSocket no disponible, omitiendo configuración');
        }
    },

    // ✅ FUNCIÓN REQUERIDA: getData para obtener datos del cache o servidor
    async getData(dataType, forceRefresh = false) {
        console.log(`📊 Obteniendo datos: ${dataType} (force: ${forceRefresh})`);

        // Si no forzamos refresh y tenemos datos en cache, devolverlos
        if (!forceRefresh && this.cache.has(dataType)) {
            const cachedData = this.cache.get(dataType);
            const timestamp = this.cache.get(`${dataType}_timestamp`);
            const maxAge = 5 * 60 * 1000; // 5 minutos

            if (timestamp && (Date.now() - timestamp) < maxAge) {
                console.log(`✅ Datos devueltos desde cache: ${dataType}`);
                return cachedData;
            }
        }

        // Obtener datos del servidor
        try {
            let data;
            switch (dataType) {
                case 'products':
                    data = await window.api.getProducts();
                    break;
                case 'sales':
                    data = await window.api.getSales();
                    break;
                case 'transactions':
                    data = await window.api.getTransactions();
                    break;
                case 'users':
                    data = await window.api.getUsers();
                    break;
                default:
                    throw new Error(`Tipo de datos no soportado: ${dataType}`);
            }

            // Guardar en cache
            this.cache.set(dataType, data);
            this.cache.set(`${dataType}_timestamp`, Date.now());

            console.log(`✅ Datos obtenidos y cacheados: ${dataType} (${data.length} elementos)`);
            return data;

        } catch (error) {
            console.error(`❌ Error obteniendo datos ${dataType}:`, error);
            
            // Devolver datos en cache como fallback
            if (this.cache.has(dataType)) {
                console.log(`⚠️ Devolviendo datos en cache como fallback: ${dataType}`);
                return this.cache.get(dataType);
            }
            
            throw error;
        }
    },

    // ✅ FUNCIÓN REQUERIDA: subscribe para suscripciones
    subscribe(dataType, viewName, callback) {
        const key = `${dataType}:${viewName}`;
        console.log(`📝 Suscripción: ${key}`);
        
        this.subscriptions.set(key, callback);
        
        return () => {
            console.log(`🗑️ Desuscripción: ${key}`);
            this.subscriptions.delete(key);
        };
    },

    // ✅ FUNCIÓN REQUERIDA: invalidateCache
    invalidateCache(dataType, notify = true) {
        console.log(`🗑️ Invalidando cache: ${dataType}`);
        
        this.cache.delete(dataType);
        this.cache.delete(`${dataType}_timestamp`);
        
        if (notify) {
            this.notifySubscribers(dataType, 'cache-invalidated', null);
        }
    },

    // ✅ FUNCIÓN REQUERIDA: notifySubscribers
    notifySubscribers(dataType, action, data) {
        console.log(`📢 Notificando suscriptores: ${dataType} - ${action}`);
        
        let notifiedCount = 0;
        this.subscriptions.forEach((callback, key) => {
            if (key.startsWith(`${dataType}:`)) {
                try {
                    callback({ action, data, dataType });
                    notifiedCount++;
                } catch (error) {
                    console.error(`❌ Error notificando suscriptor ${key}:`, error);
                }
            }
        });

        console.log(`📊 Suscriptores notificados: ${notifiedCount}`);
    },

    // ✅ NUEVA FUNCIÓN: Actualizar cache desde eventos del servidor
    updateCacheFromServerEvent(dataType, data) {
        console.log(`🔄 Actualizando cache desde servidor: ${dataType}`);
        
        if (!this.cache.has(dataType)) {
            console.log('⚠️ Cache no existe para:', dataType);
            return;
        }

        const cachedData = this.cache.get(dataType);
        if (!Array.isArray(cachedData)) {
            console.log('⚠️ Cache no es array para:', dataType);
            return;
        }

        if (dataType === 'products') {
            const productUpdate = data.product || data;
            if (productUpdate && productUpdate._id) {
                const index = cachedData.findIndex(p => p._id === productUpdate._id);
                if (index !== -1) {
                    // Actualizar producto existente
                    cachedData[index] = {
                        ...cachedData[index],
                        ...productUpdate,
                        _id: productUpdate._id,
                        lastUpdated: new Date()
                    };
                    console.log(`✅ Cache actualizado para producto: ${productUpdate.name || productUpdate._id}`);
                } else {
                    console.log('⚠️ Producto no encontrado en cache, agregándolo...');
                    cachedData.push(productUpdate);
                    cachedData.sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
                }
                
                // Actualizar timestamp del cache
                this.cache.set(`${dataType}_timestamp`, Date.now());
            }
        }
    },

    // ✅ FUNCIÓN REQUERIDA: handleProductUpdated
    handleProductUpdated(product) {
        console.log('📦 DataSync manejando producto actualizado:', product);
        
        if (!product || !product._id) {
            console.error('❌ Producto inválido para actualización');
            return;
        }

        // Actualizar cache
        this.updateCacheFromServerEvent('products', product);
        
        // Notificar suscriptores
        this.notifySubscribers('products', 'updated', product);
        
        // Emitir evento global
        eventManager.emit('data:product:updated', product);
    },

    // ✅ FUNCIÓN CORREGIDA: handleProductStockUpdated mejorada
    handleProductStockUpdated({ productId, newStock, product }) {
        console.log('📦 DataSync manejando actualización de stock:', { productId, newStock });

        // ✅ PRIORIDAD: Si tenemos el producto completo, usarlo
        if (product && product._id) {
            console.log('✅ Usando producto completo para actualización');
            this.handleProductUpdated(product);
            
            // ✅ NUEVO: También emitir evento específico de stock
            eventManager.emit('external:stock-updated', {
                productId: product._id,
                newStock: product.stock,
                oldStock: newStock, // Para compatibilidad
                product: product
            });
            
            return;
        }

        // ✅ FALLBACK: Si solo tenemos datos parciales
        if (productId && newStock !== undefined) {
            console.log('⚠️ Usando datos parciales de stock');
            
            // Actualizar cache parcialmente
            if (this.cache.has('products')) {
                const products = this.cache.get('products');
                const productInCache = products.find(p => p._id === productId);
                if (productInCache) {
                    const oldStock = productInCache.stock;
                    productInCache.stock = newStock;
                    productInCache.lastUpdated = new Date();
                    
                    console.log(`📦 Stock actualizado en cache: ${productInCache.name} (${oldStock} → ${newStock})`);
                    
                    // Emitir eventos
                    eventManager.emit('external:stock-updated', {
                        productId,
                        newStock,
                        oldStock,
                        product: productInCache
                    });
                }
            }
            
            this.notifySubscribers('products', 'stock-updated', { productId, newStock });
        } else {
            console.error('❌ Datos insuficientes para actualizar stock:', { productId, newStock, hasValidProduct: !!(product && product._id) });
        }
    },

    // ✅ NUEVA FUNCIÓN: Forzar sincronización desde servidor
    async forceSyncFromServer(dataType) {
        console.log(`🔄 Forzando sincronización desde servidor: ${dataType}`);
        
        try {
            // Invalidar cache actual
            this.invalidateCache(dataType, false);
            
            // Obtener datos frescos
            const freshData = await this.getData(dataType, true);
            
            // Notificar a todas las vistas
            eventManager.emit('sync:products-changed', freshData);
            this.notifySubscribersImmediate(dataType, 'force-synced', freshData);
            
            console.log(`✅ Sincronización forzada completada: ${dataType}`);
            return freshData;
            
        } catch (error) {
            console.error(`❌ Error en sincronización forzada: ${dataType}`, error);
            throw error;
        }
    },

    // ✅ NUEVA FUNCIÓN: Verificar y sincronizar si hay desync
    async checkAndSync(dataType, localData) {
        console.log(`🔍 Verificando sincronización: ${dataType}`);
        
        try {
            const serverData = await window.api.getProducts();
            
            if (localData.length !== serverData.length) {
                console.log(`⚠️ Diferencia en cantidad detectada: local=${localData.length}, servidor=${serverData.length}`);
                return await this.forceSyncFromServer(dataType);
            }
            
            // Verificar timestamps
            let hasChanges = false;
            serverData.forEach(serverItem => {
                const localItem = localData.find(l => l._id === serverItem._id);
                if (localItem && localItem.lastUpdated !== serverItem.lastUpdated) {
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                console.log('⚠️ Cambios en timestamps detectados, sincronizando...');
                return await this.forceSyncFromServer(dataType);
            }
            
            console.log('✅ Datos sincronizados correctamente');
            return localData;
            
        } catch (error) {
            console.error('❌ Error verificando sincronización:', error);
            return localData; // Devolver datos locales como fallback
        }
    },

    // ✅ FUNCIÓN MEJORADA: notifySubscribersImmediate con mejor logging
    notifySubscribersImmediate(dataType, action, data) {
        console.log(`📢 Notificación inmediata: ${dataType} - ${action}`);
        
        let notifiedViews = 0;
        const notifications = [];

        this.subscriptions.forEach((callback, key) => {
            if (key.startsWith(`${dataType}:`)) {
                const viewName = key.split(':')[1];
                try {
                    callback({ action, data, dataType });
                    notifiedViews++;
                    notifications.push(viewName);
                    console.log(`✅ Vista ${viewName} notificada`);
                } catch (error) {
                    console.error(`❌ Error notificando a vista ${viewName}:`, error);
                }
            }
        });

        console.log(`📊 Total notificado: ${notifiedViews} vistas [${notifications.join(', ')}]`);
    },

    // ✅ NUEVAS FUNCIONES REQUERIDAS: Funciones utilitarias
    async refreshAllData() {
        console.log('🔄 Refrescando todos los datos...');
        
        const dataTypes = ['products', 'sales', 'transactions', 'users'];
        const promises = dataTypes.map(type => 
            this.getData(type, true).catch(error => {
                console.error(`❌ Error refrescando ${type}:`, error);
                return null;
            })
        );
        
        const results = await Promise.all(promises);
        console.log('✅ Todos los datos refrescados');
        
        return results;
    },

    getCacheStats() {
        const stats = {};
        this.cache.forEach((value, key) => {
            if (!key.endsWith('_timestamp')) {
                const timestamp = this.cache.get(`${key}_timestamp`);
                stats[key] = {
                    items: Array.isArray(value) ? value.length : 1,
                    lastUpdate: timestamp ? new Date(timestamp).toISOString() : 'Never',
                    age: timestamp ? `${Math.round((Date.now() - timestamp) / 1000)}s` : 'N/A'
                };
            }
        });
        return stats;
    },

    getSubscriberStats() {
        const stats = {};
        this.subscriptions.forEach((callback, key) => {
            const [dataType, viewName] = key.split(':');
            if (!stats[dataType]) stats[dataType] = [];
            stats[dataType].push(viewName);
        });
        return stats;
    },

    destroy() {
        console.log('🧹 Destruyendo dataSync...');
        
        // Limpiar timeouts
        this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
        this.refreshTimeouts.clear();
        
        // Limpiar cache y suscripciones
        this.cache.clear();
        this.subscriptions.clear();
        
        // Remover listeners de WebSocket
        if (window.socket) {
            window.socket.off('product:stock-updated');
            window.socket.off('product:updated');
        }
        
        this.isInitialized = false;
        console.log('✅ dataSync destruido');
    }
};