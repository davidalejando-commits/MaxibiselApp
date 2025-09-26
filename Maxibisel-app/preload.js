//Script de precarga - Versión corregida y completa
const { contextBridge, ipcRenderer } = require('electron');

// Exponer API segura a la aplicación del lado del cliente
contextBridge.exposeInMainWorld('api', {
    // === AUTENTICACIÓN ===
    login: (credentials) => ipcRenderer.invoke('api:login', credentials),
    logout: () => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'auth/logout'
    }),

    // === PRODUCTOS ===
    getProducts: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'products'
    }),
    getProduct: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `products/${id}`
    }),
    createProduct: (productData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'products',
        data: productData
    }),
    updateProduct: (id, productData) => ipcRenderer.invoke('api:request', {
        method: 'put',
        endpoint: `products/${id}`,
        data: productData
    }),
    deleteProduct: (id) => ipcRenderer.invoke('api:request', {
        method: 'delete',
        endpoint: `products/${id}`
    }),
    getProductByBarcode: (barcode) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `products/barcode/${barcode}`
    }),
    // CORREGIDO: Stock update con endpoint correcto
    updateProductStock: (productId, stockData) => ipcRenderer.invoke('api:request', {
        method: 'patch',
        endpoint: `products/${productId}/stock`,
        data: stockData
    }),

    // === USUARIOS ===
    getUsers: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'users'
    }),
    getUser: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `users/${id}`
    }),
    createUser: (userData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'users',
        data: userData
    }),
    updateUser: (id, userData) => ipcRenderer.invoke('api:request', {
        method: 'put',
        endpoint: `users/${id}`,
        data: userData
    }),
    deleteUser: (id) => ipcRenderer.invoke('api:request', {
        method: 'delete',
        endpoint: `users/${id}`
    }),

    // === TRANSACCIONES ===
    getTransactions: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `transactions?${queryParams}` : 'transactions';
        
        return ipcRenderer.invoke('api:request', {
            method: 'get',
            endpoint: endpoint
        });
    },
    getTransaction: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `transactions/${id}`
    }),
    createTransaction: (transactionData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'transactions',
        data: transactionData
    }),

    // === VENTAS (Si necesitas crear un endpoint específico para ventas) ===
    createSale: (saleData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'transactions', // Por ahora usa transactions
        data: { ...saleData, type: 'sale' }
    }),

    // === HEALTH CHECK ===
    health: () => ipcRenderer.invoke('api:health'),

    // === CONFIGURACIÓN Y UTILIDADES ===
    getConfig: () => ipcRenderer.invoke('app:getConfig'),
    restart: () => ipcRenderer.invoke('app:restart'),

    // === STORE (para tokens y configuración local) ===
    store: {
        get: (key) => ipcRenderer.invoke('store:get', key),
        set: (key, value) => ipcRenderer.invoke('store:set', key, value),
        delete: (key) => ipcRenderer.invoke('store:delete', key),
        clear: () => ipcRenderer.invoke('store:clear')
    }
});

// Exponer métodos de utilidad para el frontend
contextBridge.exposeInMainWorld('electron', {
    // Información del sistema
    platform: process.platform,
    versions: process.versions,
    
    // Métodos para debugging (solo en desarrollo)
    isDev: process.env.NODE_ENV === 'development',
    
    // Eventos de ventana
    onWindowClose: (callback) => {
        ipcRenderer.on('window-closing', callback);
    },
    
    // Remover listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Exponer constantes útiles
contextBridge.exposeInMainWorld('constants', {
    // Tipos de transacción
    TRANSACTION_TYPES: {
        PURCHASE: 'purchase',
        SALE: 'sale',
        ADJUSTMENT: 'adjustment',
        RETURN: 'return'
    },
    
    // Estados de usuario
    USER_ROLES: {
        ADMIN: 'admin',
        USER: 'user',
        VIEWER: 'viewer'
    },
    
    // Configuraciones por defecto
    DEFAULT_CONFIG: {
        itemsPerPage: 50,
        autoSave: true,
        theme: 'light'
    }
});

// Logging seguro para desarrollo
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('devTools', {
        log: (...args) => console.log('[PRELOAD]', ...args),
        error: (...args) => console.error('[PRELOAD]', ...args),
        warn: (...args) => console.warn('[PRELOAD]', ...args)
    });
}

// Manejo de errores no capturados en preload
process.on('uncaughtException', (error) => {
    console.error('Error no capturado en preload:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rechazada en preload:', reason);
});