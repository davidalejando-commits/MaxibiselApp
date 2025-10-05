// sync-coordinator.js - Coordinador central de sincronización
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';

export const syncCoordinator = {
    isInitialized: false,
    subscribers: new Map(),

    init() {
        if (this.isInitialized) {
            console.warn('SyncCoordinator ya inicializado');
            return;
        }

        console.log('🎯 Inicializando SyncCoordinator...');

        // Configurar listeners centralizados
        this.setupCentralListeners();
        
        // Configurar WebSocket listeners
        this.setupWebSocketSync();

        this.isInitialized = true;
        console.log('✅ SyncCoordinator inicializado');
    },

    setupCentralListeners() {
        // Escuchar eventos de actualización de productos desde CUALQUIER fuente
        eventManager.on('data:product:updated', (product) => {
            console.log('🔄 SyncCoordinator: Producto actualizado', product._id);
            this.broadcastProductUpdate(product);
        });

        // Escuchar eventos de actualización de stock
        eventManager.on('data:product:stock-updated', (data) => {
            console.log('📦 SyncCoordinator: Stock actualizado', data.productId);
            this.broadcastStockUpdate(data);
        });

        // Escuchar eventos externos (de WebSocket)
        eventManager.on('external:product-updated', (product) => {
            console.log('🌐 SyncCoordinator: Actualización externa recibida', product._id);
            this.handleExternalUpdate(product);
        });

        eventManager.on('external:stock-updated', (data) => {
            console.log('🌐 SyncCoordinator: Actualización de stock externa', data.productId);
            this.handleExternalStockUpdate(data);
        });

        console.log('✅ Listeners centralizados configurados');
    },

    setupWebSocketSync() {
        if (!window.socket) {
            console.warn('⚠️ WebSocket no disponible');
            return;
        }

        console.log('🌐 Configurando sincronización WebSocket...');

        // Listener para productos actualizados desde servidor
        window.socket.on('product:updated', (product) => {
            console.log('📡 WebSocket: Producto actualizado recibido', product._id);
            
            // Emitir como evento externo para que todas las vistas se enteren
            eventManager.emit('external:product-updated', {
                ...product,
                sourceView: 'websocket',
                timestamp: Date.now()
            });
        });

        // Listener para stock actualizado desde servidor
        window.socket.on('product:stock-updated', (data) => {
            console.log('📡 WebSocket: Stock actualizado recibido', data);
            
            eventManager.emit('external:stock-updated', {
                ...data,
                sourceView: 'websocket',
                timestamp: Date.now()
            });
        });

        console.log('✅ WebSocket configurado');
    },

    // Broadcast a TODAS las vistas cuando un producto se actualiza
    broadcastProductUpdate(product) {
        if (!product || !product._id) {
            console.error('❌ Producto inválido para broadcast');
            return;
        }

        console.log('📢 Broadcasting actualización de producto:', product._id);

        // Actualizar cache en dataSync
        if (dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', product);
        }

        // Notificar a todos los suscriptores registrados
        this.notifyAllSubscribers('product:updated', product);

        // Emitir evento de sincronización completada
        eventManager.emit('sync:product-synced', {
            productId: product._id,
            timestamp: Date.now()
        });
    },

    // Broadcast para actualizaciones de stock
    broadcastStockUpdate(data) {
        console.log('📢 Broadcasting actualización de stock:', data.productId);

        // Actualizar cache
        if (data.product && dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', data.product);
        }

        // Notificar suscriptores
        this.notifyAllSubscribers('stock:updated', data);

        eventManager.emit('sync:stock-synced', {
            productId: data.productId,
            timestamp: Date.now()
        });
    },

    // Manejar actualizaciones externas (de otros usuarios/pestañas)
    handleExternalUpdate(product) {
        console.log('🔄 Procesando actualización externa:', product._id);

        // Actualizar cache
        if (dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', product);
        }

        // Notificar a todas las vistas para que se actualicen
        this.notifyAllSubscribers('product:updated', product);

        // Mostrar notificación al usuario
        if (window.uiManager && typeof window.uiManager.showToast === 'function') {
            window.uiManager.showToast('Producto actualizado desde otra ubicación', 'info');
        }
    },

    handleExternalStockUpdate(data) {
        console.log('🔄 Procesando actualización externa de stock:', data.productId);

        if (data.product && dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', data.product);
        }

        this.notifyAllSubscribers('stock:updated', data);
    },

    // Registrar suscriptor (vista)
    subscribe(viewName, callback) {
        if (!viewName || typeof callback !== 'function') {
            console.error('❌ Parámetros inválidos para subscribe');
            return null;
        }

        const subscriberId = `${viewName}_${Date.now()}`;
        this.subscribers.set(subscriberId, {
            viewName,
            callback,
            registeredAt: Date.now()
        });

        console.log(`📝 Vista ${viewName} suscrita (ID: ${subscriberId})`);

        // Retornar función de desuscripción
        return () => {
            this.subscribers.delete(subscriberId);
            console.log(`🗑️ Vista ${viewName} desuscrita`);
        };
    },

    // Notificar a todos los suscriptores
    notifyAllSubscribers(eventType, data) {
        let notifiedCount = 0;

        this.subscribers.forEach((subscriber, id) => {
            try {
                subscriber.callback(eventType, data);
                notifiedCount++;
            } catch (error) {
                console.error(`❌ Error notificando a ${subscriber.viewName}:`, error);
            }
        });

        console.log(`📊 ${notifiedCount} vistas notificadas para ${eventType}`);
    },

    // Forzar sincronización completa
    async forceGlobalSync() {
        console.log('🔄 Forzando sincronización global...');

        try {
            // Recargar datos desde servidor
            if (dataSync && typeof dataSync.forceSyncFromServer === 'function') {
                await dataSync.forceSyncFromServer('products');
            }

            // Notificar a todas las vistas
            this.notifyAllSubscribers('force:refresh', null);

            console.log('✅ Sincronización global completada');
            return true;

        } catch (error) {
            console.error('❌ Error en sincronización global:', error);
            return false;
        }
    },

    // Estadísticas
    getStats() {
        return {
            isInitialized: this.isInitialized,
            subscribersCount: this.subscribers.size,
            subscribers: Array.from(this.subscribers.values()).map(s => ({
                viewName: s.viewName,
                registeredAt: new Date(s.registeredAt).toISOString()
            })),
            hasWebSocket: !!window.socket
        };
    },

    destroy() {
        console.log('🧹 Destruyendo SyncCoordinator...');
        
        // Remover listeners de WebSocket
        if (window.socket) {
            window.socket.off('product:updated');
            window.socket.off('product:stock-updated');
        }

        // Limpiar suscriptores
        this.subscribers.clear();
        
        this.isInitialized = false;
        console.log('✅ SyncCoordinator destruido');
    }
};

// Utilidad global para debugging
window.debugSyncCoordinator = () => {
    console.group('🔍 SYNC COORDINATOR DEBUG');
    console.table(syncCoordinator.getStats());
    console.groupEnd();
};