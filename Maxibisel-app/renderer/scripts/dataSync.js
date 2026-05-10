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

        this.setupWebSocketListeners();

        this.isInitialized = true;
        console.log('✅ Sistema de sincronización inicializado');
    },

    setupEventListeners() {
        console.log('🔧 Configurando event listeners del sistema de sincronización...');

        eventManager.on('product:updated', (product) => {
            this.handleProductUpdated(product);
        });

        eventManager.on('product:stock-updated', (data) => {
            this.handleProductStockUpdated(data);
        });

        eventManager.on('cache:invalidate', (dataType) => {
            this.invalidateCache(dataType);
        });

        console.log('✅ Event listeners configurados');
    },

    setupWebSocketListeners() {
        if (window.socket) {
            console.log('🌐 Configurando WebSocket listeners en dataSync...');

            window.socket.on('product:stock-updated', (data) => {
                console.log('📡 DataSync recibió stock actualizado:', data);

                this.updateCacheFromServerEvent('products', data.product || data);

                eventManager.emit('external:stock-updated', data);
 
                this.notifySubscribersImmediate('products', 'stock-updated', data);
            });

            window.socket.on('product:updated', (product) => {
                console.log('📡 DataSync recibió producto actualizado:', product);

                this.updateCacheFromServerEvent('products', product);

                eventManager.emit('external:product-updated', product);

                this.notifySubscribersImmediate('products', 'updated', product);
            });

            console.log('✅ WebSocket listeners configurados en dataSync');
        } else {
            console.log('⚠️ WebSocket no disponible, omitiendo configuración');
        }
    },

    async getData(dataType, forceRefresh = false) {
        console.log(`📊 Obteniendo datos: ${dataType} (force: ${forceRefresh})`);

        if (!forceRefresh && this.cache.has(dataType)) {
            const cachedData = this.cache.get(dataType);
            const timestamp = this.cache.get(`${dataType}_timestamp`);
            const maxAge = 5 * 60 * 1000; // 5 minutos

            if (timestamp && (Date.now() - timestamp) < maxAge) {
                console.log(`✅ Datos devueltos desde cache: ${dataType}`);
                return cachedData;
            }
        }

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

            this.cache.set(dataType, data);
            this.cache.set(`${dataType}_timestamp`, Date.now());

            console.log(`✅ Datos obtenidos y cacheados: ${dataType} (${data.length} elementos)`);
            return data;

        } catch (error) {
            console.error(`❌ Error obteniendo datos ${dataType}:`, error);

            if (this.cache.has(dataType)) {
                console.log(`⚠️ Devolviendo datos en cache como fallback: ${dataType}`);
                return this.cache.get(dataType);
            }
            
            throw error;
        }
    },

    subscribe(dataType, viewName, callback) {
        const key = `${dataType}:${viewName}`;
        console.log(`📝 Suscripción: ${key}`);
        
        this.subscriptions.set(key, callback);
        
        return () => {
            console.log(`🗑️ Desuscripción: ${key}`);
            this.subscriptions.delete(key);
        };
    },

    invalidateCache(dataType, notify = true) {
        console.log(`🗑️ Invalidando cache: ${dataType}`);
        
        this.cache.delete(dataType);
        this.cache.delete(`${dataType}_timestamp`);
        
        if (notify) {
            this.notifySubscribers(dataType, 'cache-invalidated', null);
        }
    },

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

                this.cache.set(`${dataType}_timestamp`, Date.now());
            }
        }
    },

    handleProductUpdated(product) {
        console.log('📦 DataSync manejando producto actualizado:', product);
        
        if (!product || !product._id) {
            console.error('❌ Producto inválido para actualización');
            return;
        }

        this.updateCacheFromServerEvent('products', product);

        this.notifySubscribers('products', 'updated', product);

        eventManager.emit('data:product:updated', product);
    },

    handleProductStockUpdated({ productId, newStock, product }) {
        console.log('📦 DataSync manejando actualización de stock:', { productId, newStock });

        if (product && product._id) {
            console.log('✅ Usando producto completo para actualización');
            this.handleProductUpdated(product);

            eventManager.emit('external:stock-updated', {
                productId: product._id,
                newStock: product.stock,
                oldStock: newStock, // Para compatibilidad
                product: product
            });
            
            return;
        }

        if (productId && newStock !== undefined) {
            console.log('⚠️ Usando datos parciales de stock');

            if (this.cache.has('products')) {
                const products = this.cache.get('products');
                const productInCache = products.find(p => p._id === productId);
                if (productInCache) {
                    const oldStock = productInCache.stock;
                    productInCache.stock = newStock;
                    productInCache.lastUpdated = new Date();
                    
                    console.log(`📦 Stock actualizado en cache: ${productInCache.name} (${oldStock} → ${newStock})`);

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
    async forceSyncFromServer(dataType) {
        console.log(`🔄 Forzando sincronización desde servidor: ${dataType}`);
        
        try {
            this.invalidateCache(dataType, false);

            const freshData = await this.getData(dataType, true);

            eventManager.emit('sync:products-changed', freshData);
            this.notifySubscribersImmediate(dataType, 'force-synced', freshData);
            
            console.log(`✅ Sincronización forzada completada: ${dataType}`);
            return freshData;
            
        } catch (error) {
            console.error(`❌ Error en sincronización forzada: ${dataType}`, error);
            throw error;
        }
    },

    async checkAndSync(dataType, localData) {
        console.log(`🔍 Verificando sincronización: ${dataType}`);
        
        try {
            const serverData = await window.api.getProducts();
            
            if (localData.length !== serverData.length) {
                console.log(`⚠️ Diferencia en cantidad detectada: local=${localData.length}, servidor=${serverData.length}`);
                return await this.forceSyncFromServer(dataType);
            }

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
        this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
        this.refreshTimeouts.clear();
        
        this.cache.clear();
        this.subscriptions.clear();
        if (window.socket) {
            window.socket.off('product:stock-updated');
            window.socket.off('product:updated');
        }
        
        this.isInitialized = false;
        console.log('✅ dataSync destruido');
    }
};