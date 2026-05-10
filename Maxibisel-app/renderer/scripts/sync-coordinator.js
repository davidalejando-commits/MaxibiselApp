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

        this.setupCentralListeners();

        this.setupWebSocketSync();

        this.isInitialized = true;
        console.log('✅ SyncCoordinator inicializado');
    },

    setupCentralListeners() {
        eventManager.on('data:product:updated', (product) => {
            console.log('🔄 SyncCoordinator: Producto actualizado', product._id);
            this.broadcastProductUpdate(product);
        });

        eventManager.on('data:product:stock-updated', (data) => {
            console.log('📦 SyncCoordinator: Stock actualizado', data.productId);
            this.broadcastStockUpdate(data);
        });

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

        window.socket.on('product:updated', (product) => {
            console.log('📡 WebSocket: Producto actualizado recibido', product._id);

            eventManager.emit('external:product-updated', {
                ...product,
                sourceView: 'websocket',
                timestamp: Date.now()
            });
        });

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

    broadcastProductUpdate(product) {
        if (!product || !product._id) {
            console.error('❌ Producto inválido para broadcast');
            return;
        }

        console.log('📢 Broadcasting actualización de producto:', product._id);

        if (dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', product);
        }

        this.notifyAllSubscribers('product:updated', product);

        eventManager.emit('sync:product-synced', {
            productId: product._id,
            timestamp: Date.now()
        });
    },

    broadcastStockUpdate(data) {
        console.log('📢 Broadcasting actualización de stock:', data.productId);

        if (data.product && dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', data.product);
        }
        this.notifyAllSubscribers('stock:updated', data);

        eventManager.emit('sync:stock-synced', {
            productId: data.productId,
            timestamp: Date.now()
        });
    },

    handleExternalUpdate(product) {
        console.log('🔄 Procesando actualización externa:', product._id);

        if (dataSync && typeof dataSync.updateCacheFromServerEvent === 'function') {
            dataSync.updateCacheFromServerEvent('products', product);
        }

        this.notifyAllSubscribers('product:updated', product);

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

        return () => {
            this.subscribers.delete(subscriberId);
            console.log(`🗑️ Vista ${viewName} desuscrita`);
        };
    },

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

    async forceGlobalSync() {
        console.log('🔄 Forzando sincronización global...');

        try {
            if (dataSync && typeof dataSync.forceSyncFromServer === 'function') {
                await dataSync.forceSyncFromServer('products');
            }

            this.notifyAllSubscribers('force:refresh', null);

            console.log('✅ Sincronización global completada');
            return true;

        } catch (error) {
            console.error('❌ Error en sincronización global:', error);
            return false;
        }
    },
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
        if (window.socket) {
            window.socket.off('product:updated');
            window.socket.off('product:stock-updated');
        }

        this.subscribers.clear();
        
        this.isInitialized = false;
        console.log('✅ SyncCoordinator destruido');
    }
};

window.debugSyncCoordinator = () => {
    console.group('🔍 SYNC COORDINATOR DEBUG');
    console.table(syncCoordinator.getStats());
    console.groupEnd();
};