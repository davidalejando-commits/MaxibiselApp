// renderer/js/dataSync.js
// Sistema de sincronización de datos entre vistas
// Versión completa y optimizada

import { eventManager } from './eventManager.js';

export const dataSync = {
    cache: new Map(),
    subscribers: new Map(),
    isInitialized: false,
    syncQueue: [],
    isProcessingQueue: false,
    lastRefreshTime: new Map(),
    refreshInterval: 5 * 60 * 1000, // 5 minutos por defecto
    maxCacheAge: 10 * 60 * 1000, // 10 minutos
    stats: {
        cacheHits: 0,
        cacheMisses: 0,
        apiCalls: 0,
        errors: 0,
        syncOperations: 0
    },

    // Inicializar el sistema
    init() {
        if (this.isInitialized) {
            console.warn('DataSync ya estaba inicializado');
            return;
        }

        console.log('🔄 Inicializando DataSync...');
        
        try {
            this.setupEventListeners();
            this.setupPeriodicRefresh();
            this.isInitialized = true;
            
            console.log('✅ DataSync inicializado correctamente');
            
            // Emitir evento de inicialización
            eventManager.emit('datasync:initialized', {
                timestamp: Date.now(),
                version: '1.0.0'
            });
            
        } catch (error) {
            console.error('❌ Error inicializando DataSync:', error);
            throw error;
        }
    },

    // Configurar listeners centrales de eventos
    setupEventListeners() {
        console.log('🔧 Configurando listeners de DataSync...');

        // Eventos de productos
        eventManager.on('data:product:created', (product) => {
            this.handleDataEvent('products', 'created', product);
        }, { priority: 10 });

        eventManager.on('data:product:updated', (product) => {
            this.handleDataEvent('products', 'updated', product);
        }, { priority: 10 });

        eventManager.on('data:product:deleted', (productId) => {
            this.handleDataEvent('products', 'deleted', productId);
        }, { priority: 10 });

        // Eventos de ventas/salidas
        eventManager.on('data:sale:created', (sale) => {
            this.handleDataEvent('sales', 'created', sale);
        }, { priority: 10 });

        eventManager.on('data:sale:updated', (sale) => {
            this.handleDataEvent('sales', 'updated', sale);
        }, { priority: 10 });

        // Eventos de transacciones
        eventManager.on('data:transaction:created', (transaction) => {
            this.handleDataEvent('transactions', 'created', transaction);
        }, { priority: 10 });

        // Eventos de usuarios
        eventManager.on('data:user:created', (user) => {
            this.handleDataEvent('users', 'created', user);
        }, { priority: 10 });

        eventManager.on('data:user:updated', (user) => {
            this.handleDataEvent('users', 'updated', user);
        }, { priority: 10 });

        eventManager.on('data:user:deleted', (userId) => {
            this.handleDataEvent('users', 'deleted', userId);
        }, { priority: 10 });

        // Evento de refresco general
        eventManager.on('data:refresh:all', async () => {
            console.log('🔄 Refrescando todos los datos...');
            await this.refreshAllData();
        });

        // Eventos de conexión
        eventManager.on('connection:restored', async () => {
            console.log('🌐 Conexión restaurada, sincronizando datos...');
            await this.processOfflineQueue();
        });

        eventManager.on('connection:lost', () => {
            console.log('📡 Conexión perdida, activando modo offline...');
        });
    },

    // Configurar refresco periódico automático
    setupPeriodicRefresh() {
        setInterval(async () => {
            try {
                await this.checkAndRefreshStaleData();
            } catch (error) {
                console.error('Error en refresco periódico:', error);
            }
        }, this.refreshInterval);

        console.log(`⏰ Refresco automático configurado cada ${this.refreshInterval / 1000}s`);
    },

    // Verificar y refrescar datos obsoletos
    async checkAndRefreshStaleData() {
        const now = Date.now();
        const staleDataTypes = [];

        this.lastRefreshTime.forEach((lastRefresh, dataType) => {
            if (now - lastRefresh > this.maxCacheAge) {
                staleDataTypes.push(dataType);
            }
        });

        if (staleDataTypes.length > 0) {
            console.log(`⏰ Refrescando datos obsoletos: ${staleDataTypes.join(', ')}`);
            
            for (const dataType of staleDataTypes) {
                try {
                    await this.refreshData(dataType);
                } catch (error) {
                    console.error(`Error refrescando ${dataType}:`, error);
                }
            }
        }
    },

    // Manejar evento de datos centralizado
    handleDataEvent(dataType, action, data) {
        try {
            console.log(`🔄 Procesando evento: ${dataType}:${action}`);
            
            // Actualizar caché
            this.updateCache(dataType, action, data);
            
            // Notificar suscriptores
            this.notifySubscribers(dataType, action, data);
            
            // Actualizar estadísticas
            this.stats.syncOperations++;
            
            // Marcar tiempo de última actualización
            this.lastRefreshTime.set(dataType, Date.now());
            
        } catch (error) {
            console.error(`Error procesando evento ${dataType}:${action}:`, error);
            this.stats.errors++;
            
            // Emitir evento de error
            eventManager.emit('datasync:error', {
                dataType,
                action,
                error: error.message,
                data
            });
        }
    },

    // Suscribir una vista a cambios de datos específicos
    subscribe(viewName, dataType, callback) {
        if (typeof viewName !== 'string' || typeof dataType !== 'string' || typeof callback !== 'function') {
            throw new Error('DataSync.subscribe: parámetros inválidos');
        }

        const key = `${dataType}:${viewName}`;
        
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        
        const subscriptionInfo = {
            callback,
            subscriptionTime: Date.now(),
            callCount: 0,
            lastCalled: null,
            errors: 0
        };
        
        this.subscribers.get(key).push(subscriptionInfo);
        console.log(`📝 Vista '${viewName}' suscrita a cambios de '${dataType}' (Total callbacks: ${this.subscribers.get(key).length})`);
        
        // Retornar función de desuscripción
        return () => this.unsubscribe(viewName, dataType, subscriptionInfo);
    },

    // Desuscribir una vista
    unsubscribe(viewName, dataType, specificCallback = null) {
        const key = `${dataType}:${viewName}`;
        
        if (specificCallback) {
            // Remover callback específico
            if (this.subscribers.has(key)) {
                const callbacks = this.subscribers.get(key);
                const index = callbacks.indexOf(specificCallback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                    if (callbacks.length === 0) {
                        this.subscribers.delete(key);
                    }
                }
            }
        } else {
            // Remover toda la suscripción
            this.subscribers.delete(key);
        }
        
        console.log(`🚫 Vista '${viewName}' desuscrita de '${dataType}'`);
    },

    // Notificar a todas las vistas suscritas
    notifySubscribers(dataType, action, data) {
        const notifiedViews = [];
        const failedNotifications = [];
        
        this.subscribers.forEach((subscriptionInfos, key) => {
            if (key.startsWith(`${dataType}:`)) {
                const viewName = key.split(':')[1];
                
                subscriptionInfos.forEach((subscriptionInfo, index) => {
                    try {
                        const notificationData = {
                            action,
                            data,
                            dataType,
                            timestamp: Date.now(),
                            source: 'dataSync'
                        };
                        
                        subscriptionInfo.callback(notificationData);
                        subscriptionInfo.callCount++;
                        subscriptionInfo.lastCalled = Date.now();
                        
                        if (!notifiedViews.includes(viewName)) {
                            notifiedViews.push(viewName);
                        }
                        
                    } catch (error) {
                        subscriptionInfo.errors++;
                        console.error(`❌ Error en callback de vista '${viewName}' (índice ${index}):`, error);
                        
                        failedNotifications.push({
                            viewName,
                            error: error.message
                        });
                        
                        // Si hay demasiados errores, remover el callback
                        if (subscriptionInfo.errors >= 5) {
                            console.warn(`🚫 Removiendo callback problemático de vista '${viewName}' después de 5 errores`);
                            subscriptionInfos.splice(index, 1);
                        }
                    }
                });
            }
        });

        if (notifiedViews.length > 0) {
            console.log(`📢 Vistas notificadas para ${dataType}:${action}: ${notifiedViews.join(', ')}`);
        }

        if (failedNotifications.length > 0) {
            eventManager.emit('datasync:notification:failed', {
                dataType,
                action,
                failures: failedNotifications
            });
        }
    },

    // Actualizar caché local
    updateCache(dataType, action, data) {
        let cacheData = this.cache.get(dataType) || [];
        const originalLength = cacheData.length;

        try {
            switch (action) {
                case 'created':
                case 'add':
                    // Verificar que no exista ya (evitar duplicados)
                    if (!cacheData.find(item => item._id === data._id)) {
                        cacheData.push({
                            ...data,
                            _cacheTimestamp: Date.now()
                        });
                        console.log(`➕ Elemento añadido al caché de ${dataType}: ${data.name || data._id}`);
                    } else {
                        console.log(`⚠️ Elemento ya existe en caché de ${dataType}: ${data._id}`);
                    }
                    break;
                    
                case 'updated':
                case 'update':
                    const updateIndex = cacheData.findIndex(item => item._id === data._id);
                    if (updateIndex > -1) {
                        // Preservar timestamp original si existe
                        const originalTimestamp = cacheData[updateIndex]._cacheTimestamp;
                        cacheData[updateIndex] = {
                            ...data,
                            _cacheTimestamp: originalTimestamp || Date.now(),
                            _lastModified: Date.now()
                        };
                        console.log(`🔄 Elemento actualizado en caché de ${dataType}: ${data.name || data._id}`);
                    } else {
                        // Si no existe, agregarlo
                        cacheData.push({
                            ...data,
                            _cacheTimestamp: Date.now()
                        });
                        console.log(`➕ Elemento añadido al caché de ${dataType} (no existía): ${data.name || data._id}`);
                    }
                    break;
                    
                case 'deleted':
                case 'remove':
                    const beforeDelete = cacheData.length;
                    cacheData = cacheData.filter(item => item._id !== data);
                    if (cacheData.length < beforeDelete) {
                        console.log(`➖ Elemento removido del caché de ${dataType}: ${data}`);
                    } else {
                        console.log(`⚠️ Intento de remover elemento inexistente del caché de ${dataType}: ${data}`);
                    }
                    break;
                    
                case 'replace':
                case 'refreshed':
                    cacheData = Array.isArray(data) ? data.map(item => ({
                        ...item,
                        _cacheTimestamp: Date.now()
                    })) : [{
                        ...data,
                        _cacheTimestamp: Date.now()
                    }];
                    console.log(`🔄 Caché de ${dataType} reemplazado completamente (${cacheData.length} elementos)`);
                    break;
                    
                default:
                    console.warn(`⚠️ Acción de caché desconocida: ${action}`);
                    return;
            }

            this.cache.set(dataType, cacheData);
            this.lastRefreshTime.set(dataType, Date.now());
            
            // Emitir evento de cambio de caché si hay listeners interesados
            eventManager.emit('datasync:cache:updated', {
                dataType,
                action,
                previousSize: originalLength,
                newSize: cacheData.length,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error actualizando caché de ${dataType}:`, error);
            this.stats.errors++;
            throw error;
        }
    },

    // Obtener datos del caché o cargar desde API
    async getData(dataType) {
        console.log(`📊 Solicitando datos de: ${dataType}`);
        
        try {
            // Verificar si está en caché y no es muy viejo
            if (this.cache.has(dataType)) {
                const cachedData = this.cache.get(dataType);
                const lastRefresh = this.lastRefreshTime.get(dataType) || 0;
                const age = Date.now() - lastRefresh;
                
                if (age < this.maxCacheAge) {
                    this.stats.cacheHits++;
                    console.log(`📚 Datos obtenidos del caché: ${dataType} (${cachedData.length} elementos, edad: ${Math.round(age/1000)}s)`);
                    return cachedData.map(item => {
                        // Remover metadatos de caché antes de devolver
                        const { _cacheTimestamp, _lastModified, ...cleanItem } = item;
                        return cleanItem;
                    });
                } else {
                    console.log(`⏰ Caché de ${dataType} obsoleto (edad: ${Math.round(age/1000)}s), refrescando...`);
                }
            }

            this.stats.cacheMisses++;
            
            // Cargar desde API
            console.log(`🌐 Cargando ${dataType} desde API...`);
            let data = [];
            
            this.stats.apiCalls++;
            const startTime = performance.now();
            
            switch (dataType) {
                case 'products':
                    data = await window.api.getProducts();
                    break;
                case 'sales':
                    data = await window.api.getSales?.() || [];
                    break;
                case 'transactions':
                    data = await window.api.getTransactions();
                    break;
                case 'users':
                    data = await window.api.getUsers?.() || [];
                    break;
                default:
                    console.warn(`⚠️ Tipo de datos no reconocido: ${dataType}`);
                    return [];
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Carga de ${dataType} completada en ${loadTime.toFixed(2)}ms (${data.length} elementos)`);
            
            // Guardar en caché con metadatos
            const cachedData = data.map(item => ({
                ...item,
                _cacheTimestamp: Date.now()
            }));
            
            this.cache.set(dataType, cachedData);
            this.lastRefreshTime.set(dataType, Date.now());
            
            console.log(`💾 ${dataType} guardado en caché (${data.length} elementos)`);
            return data;
            
        } catch (error) {
            this.stats.errors++;
            console.error(`❌ Error cargando ${dataType}:`, error);
            
            // Intentar devolver datos en caché aunque sean viejos
            if (this.cache.has(dataType)) {
                const staleData = this.cache.get(dataType);
                console.warn(`⚠️ Devolviendo datos obsoletos de ${dataType} debido a error en API`);
                return staleData.map(item => {
                    const { _cacheTimestamp, _lastModified, ...cleanItem } = item;
                    return cleanItem;
                });
            }
            
            // Si no hay caché, devolver array vacío
            console.error(`💥 No hay datos disponibles para ${dataType}`);
            return [];
        }
    },

    // Forzar recarga de datos desde API
    async refreshData(dataType) {
        console.log(`🔄 Refrescando datos de: ${dataType}`);
        
        try {
            // Limpiar caché
            this.cache.delete(dataType);
            this.lastRefreshTime.delete(dataType);
            
            // Recargar datos
            const data = await this.getData(dataType);
            
            // Notificar a todas las vistas suscritas
            this.notifySubscribers(dataType, 'refreshed', data);
            
            console.log(`✅ Datos de ${dataType} refrescados (${data.length} elementos)`);
            
            // Emitir evento de refresco completado
            eventManager.emit('datasync:refreshed', {
                dataType,
                count: data.length,
                timestamp: Date.now()
            });
            
            return data;
            
        } catch (error) {
            this.stats.errors++;
            console.error(`❌ Error refrescando ${dataType}:`, error);
            
            // Emitir evento de error
            eventManager.emit('datasync:refresh:failed', {
                dataType,
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        }
    },

    // Refrescar todos los tipos de datos
    async refreshAllData() {
        console.log('🔄 Refrescando todos los datos...');
        
        const dataTypes = ['products', 'sales', 'transactions', 'users'];
        const results = [];
        
        for (const dataType of dataTypes) {
            try {
                const data = await this.refreshData(dataType);
                results.push({ dataType, success: true, count: data.length });
            } catch (error) {
                results.push({ dataType, success: false, error: error.message });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        console.log(`📊 Refresco completo: ${successCount} exitosos, ${failCount} fallidos`);
        
        // Emitir evento de refresco completo
        eventManager.emit('datasync:refresh:all:completed', {
            results,
            successCount,
            failCount,
            timestamp: Date.now()
        });
        
        return results;
    },

    // Invalidar caché de un tipo específico
    invalidateCache(dataType) {
        if (this.cache.has(dataType)) {
            const data = this.cache.get(dataType);
            this.cache.delete(dataType);
            this.lastRefreshTime.delete(dataType);
            
            console.log(`🗑️ Caché invalidado para: ${dataType} (${data.length} elementos removidos)`);
            
            // Emitir evento de invalidación
            eventManager.emit('datasync:cache:invalidated', {
                dataType,
                previousSize: data.length,
                timestamp: Date.now()
            });
        } else {
            console.log(`⚠️ Intento de invalidar caché inexistente: ${dataType}`);
        }
    },

    // Limpiar todo el caché
    clearAllCache() {
        const dataTypes = Array.from(this.cache.keys());
        const totalItems = Array.from(this.cache.values()).reduce((total, data) => total + data.length, 0);
        
        this.cache.clear();
        this.lastRefreshTime.clear();
        
        console.log(`🗑️ Todo el caché limpiado (${dataTypes.length} tipos de datos, ${totalItems} elementos)`);
        
        // Emitir evento de limpieza completa
        eventManager.emit('datasync:cache:cleared', {
            clearedTypes: dataTypes,
            totalItems,
            timestamp: Date.now()
        });
    },

    // Obtener estadísticas del caché
    getCacheStats() {
        const stats = {
            totalTypes: this.cache.size,
            totalItems: 0,
            types: {},
            performance: {
                cacheHits: this.stats.cacheHits,
                cacheMisses: this.stats.cacheMisses,
                hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 ? 
                    Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100) + '%' : '0%',
                apiCalls: this.stats.apiCalls,
                errors: this.stats.errors,
                syncOperations: this.stats.syncOperations
            },
            memoryUsage: this.estimateMemoryUsage()
        };

        this.cache.forEach((data, dataType) => {
            const count = Array.isArray(data) ? data.length : 1;
            stats.totalItems += count;
            
            const lastRefresh = this.lastRefreshTime.get(dataType);
            const age = lastRefresh ? Date.now() - lastRefresh : null;
            
            stats.types[dataType] = {
                count,
                lastRefresh: lastRefresh ? new Date(lastRefresh).toISOString() : null,
                age: age ? Math.round(age / 1000) + 's' : null,
                isStale: age ? age > this.maxCacheAge : false
            };
        });

        return stats;
    },

    // Obtener estadísticas de suscriptores
    getSubscriberStats() {
        const stats = {
            totalSubscriptions: this.subscribers.size,
            totalCallbacks: 0,
            byDataType: {},
            byView: {}
        };

        this.subscribers.forEach((subscriptionInfos, key) => {
            const [dataType, viewName] = key.split(':');
            const callbackCount = subscriptionInfos.length;
            
            stats.totalCallbacks += callbackCount;
            
            // Agrupar por tipo de datos
            if (!stats.byDataType[dataType]) {
                stats.byDataType[dataType] = {
                    views: [],
                    totalCallbacks: 0
                };
            }
            stats.byDataType[dataType].views.push({
                viewName,
                callbackCount,
                totalCalls: subscriptionInfos.reduce((sum, info) => sum + info.callCount, 0),
                errors: subscriptionInfos.reduce((sum, info) => sum + info.errors, 0)
            });
            stats.byDataType[dataType].totalCallbacks += callbackCount;
            
            // Agrupar por vista
            if (!stats.byView[viewName]) {
                stats.byView[viewName] = {
                    dataTypes: [],
                    totalCallbacks: 0
                };
            }
            stats.byView[viewName].dataTypes.push({
                dataType,
                callbackCount,
                totalCalls: subscriptionInfos.reduce((sum, info) => sum + info.callCount, 0),
                errors: subscriptionInfos.reduce((sum, info) => sum + info.errors, 0)
            });
            stats.byView[viewName].totalCallbacks += callbackCount;
        });

        return stats;
    },

    // Estimación de uso de memoria
    estimateMemoryUsage() {
        let totalSize = 0;
        
        // Estimar tamaño del caché
        this.cache.forEach((data, dataType) => {
            totalSize += dataType.length * 2; // UTF-16
            totalSize += JSON.stringify(data).length * 2; // Estimación de datos
        });
        
        // Estimar tamaño de suscriptores
        this.subscribers.forEach((callbacks, key) => {
            totalSize += key.length * 2; // UTF-16
            totalSize += callbacks.length * 200; // Estimación por callback
        });
        
        // Convertir a unidades legibles
        if (totalSize < 1024) {
            return totalSize + ' B';
        } else if (totalSize < 1024 * 1024) {
            return Math.round(totalSize / 1024) + ' KB';
        } else {
            return Math.round(totalSize / (1024 * 1024)) + ' MB';
        }
    },

    // Cola offline para operaciones cuando no hay conexión
    offlineQueue: [],

    // Agregar operación a la cola offline
    addToOfflineQueue(operation) {
        this.offlineQueue.push({
            ...operation,
            queuedAt: Date.now(),
            id: this.generateOperationId()
        });
        
        console.log(`📴 Operación agregada a cola offline: ${operation.description} (${this.offlineQueue.length} en cola)`);
        
        // Emitir evento de operación encolada
        eventManager.emit('datasync:offline:queued', {
            operation,
            queueSize: this.offlineQueue.length
        });
    },

    // Procesar cola offline cuando se restaura la conexión
    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) {
            console.log('📤 Cola offline vacía, nada que procesar');
            return;
        }

        console.log(`📤 Procesando cola offline (${this.offlineQueue.length} operaciones)`);
        
        const results = [];
        const startTime = Date.now();
        
        // Procesar operaciones en orden
        while (this.offlineQueue.length > 0) {
            const operation = this.offlineQueue.shift();
            
            try {
                console.log(`⏳ Ejecutando operación offline: ${operation.description}`);
                const result = await operation.execute();
                
                results.push({
                    id: operation.id,
                    success: true,
                    result,
                    description: operation.description
                });
                
                console.log(`✅ Operación offline completada: ${operation.description}`);
                
            } catch (error) {
                console.error(`❌ Error en operación offline: ${operation.description}`, error);
                
                results.push({
                    id: operation.id,
                    success: false,
                    error: error.message,
                    description: operation.description
                });
                
                // Si la operación falló, podríamos reencolarla o descartarla
                // Por ahora la descartamos para evitar bucles infinitos
            }
            
            // Pausa breve entre operaciones para no sobrecargar
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        console.log(`📤 Procesamiento de cola offline completado: ${successCount} exitosas, ${failCount} fallidas (${duration}ms)`);
        
        // Emitir evento de procesamiento completado
        eventManager.emit('datasync:offline:processed', {
            results,
            successCount,
            failCount,
            duration,
            timestamp: Date.now()
        });
        
        return results;
    },

    // Generar ID único para operaciones
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Verificar salud del sistema
    healthCheck() {
        const cacheStats = this.getCacheStats();
        const subscriberStats = this.getSubscriberStats();
        const issues = [];
        const warnings = [];

        // Verificar caché
        if (cacheStats.totalTypes === 0) {
            issues.push('No hay datos en caché');
        }

        Object.entries(cacheStats.types).forEach(([dataType, info]) => {
            if (info.isStale) {
                warnings.push(`Datos obsoletos en caché: ${dataType}`);
            }
        });

        // Verificar suscriptores
        if (subscriberStats.totalSubscriptions === 0) {
            warnings.push('No hay suscriptores activos');
        }

        // Verificar rendimiento
        if (this.stats.errors > this.stats.syncOperations * 0.1) {
            issues.push(`Alta tasa de errores: ${this.stats.errors}/${this.stats.syncOperations}`);
        }

        // Verificar memoria
        const memoryMB = parseFloat(cacheStats.memoryUsage);
        if (cacheStats.memoryUsage.includes('MB') && memoryMB > 10) {
            warnings.push(`Alto uso de memoria: ${cacheStats.memoryUsage}`);
        }

        // Verificar cola offline
        if (this.offlineQueue.length > 0) {
            warnings.push(`Operaciones pendientes en cola offline: ${this.offlineQueue.length}`);
        }

        return {
            healthy: issues.length === 0,
            issues,
            warnings,
            stats: {
                cache: cacheStats,
                subscribers: subscriberStats,
                uptime: this.isInitialized ? 'OK' : 'Not initialized'
            }
        };
    },

    // Reset de estadísticas
    resetStats() {
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            apiCalls: 0,
            errors: 0,
            syncOperations: 0
        };
        
        console.log('📊 Estadísticas de DataSync reseteadas');
        
        // Emitir evento de reset
        eventManager.emit('datasync:stats:reset', {
            timestamp: Date.now()
        });
    },

    // Destruir el sistema
    destroy() {
        console.log('🧹 Destruyendo DataSync...');
        
        // Limpiar datos
        this.clearAllCache();
        this.subscribers.clear();
        this.syncQueue = [];
        this.offlineQueue = [];
        
        // Reset de estadísticas
        this.resetStats();
        
        // Marcar como no inicializado
        this.isInitialized = false;
        
        // Emitir evento de destrucción
        eventManager.emit('datasync:destroyed', {
            timestamp: Date.now()
        });
        
        console.log('✅ DataSync destruido correctamente');
    }
};