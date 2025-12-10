//Script de precarga - Versión con FACTURAS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // === AUTENTICACIÓN ===
    login: async (credentials) => {
        try {
            const result = await ipcRenderer.invoke('api:login', credentials);
            console.log('✅ Login response recibido en preload:', result);
            
            if (result.token) {
                await ipcRenderer.invoke('store:set', 'authToken', result.token);
                console.log('✅ Token guardado en store');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error en login (preload):', error);
            throw error;
        }
    },
    
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

    // === VENTAS ===
    createSale: (saleData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'transactions',
        data: { ...saleData, type: 'sale' }
    }),

    // === REMISIONES ===
    getRemisiones: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `remisiones?${queryParams}` : 'remisiones';
        
        return ipcRenderer.invoke('api:request', {
            method: 'get',
            endpoint: endpoint
        });
    },

    getRemision: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `remisiones/${id}`
    }),

    createRemision: (remisionData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'remisiones',
        data: remisionData
    }),

    updateRemision: (id, remisionData) => ipcRenderer.invoke('api:request', {
        method: 'put',
        endpoint: `remisiones/${id}`,
        data: remisionData
    }),

    deleteRemision: (id) => ipcRenderer.invoke('api:request', {
        method: 'delete',
        endpoint: `remisiones/${id}`
    }),

    // ========================================
    // 🆕 NUEVO: FACTURAS
    // ========================================
    
    // Obtener todas las facturas
    getFacturas: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `facturas?${queryParams}` : 'facturas';
        
        return ipcRenderer.invoke('api:request', {
            method: 'get',
            endpoint: endpoint
        });
    },

    // Obtener factura por ID
    getFactura: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `facturas/${id}`
    }),

    // Crear factura
    createFactura: (facturaData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'facturas',
        data: facturaData
    }),

    // Actualizar factura
    updateFactura: (id, facturaData) => ipcRenderer.invoke('api:request', {
        method: 'put',
        endpoint: `facturas/${id}`,
        data: facturaData
    }),

    // Anular factura
    anularFactura: (id) => ipcRenderer.invoke('api:request', {
        method: 'patch',
        endpoint: `facturas/${id}/anular`
    }),

    //Eliminar factura 
    deleteFactura: (id) => ipcRenderer.invoke('api:request', {
    method: 'delete',
    endpoint: `facturas/${id}`
    }),

    // Obtener estadísticas de facturas (opcional)
    getFacturasStats: async () => {
        try {
            const response = await ipcRenderer.invoke('api:request', {
                method: 'get',
                endpoint: 'facturas'
            });
            
            const facturas = response.facturas || [];
            const stats = {
                total: facturas.length,
                pendientes: facturas.filter(f => f.estado === 'pendiente').length,
                pagadas: facturas.filter(f => f.estado === 'pagada').length,
                anuladas: facturas.filter(f => f.estado === 'anulada').length,
                totalFacturado: facturas
                    .filter(f => f.estado !== 'anulada')
                    .reduce((sum, f) => sum + (f.total || 0), 0)
            };
            
            return stats;
        } catch (error) {
            console.error('Error obteniendo estadísticas de facturas:', error);
            throw error;
        }
    },

    // === HEALTH CHECK ===
    health: () => ipcRenderer.invoke('api:health'),

    // === STORE (tokens y configuración) ===
    store: {
        get: (key) => ipcRenderer.invoke('store:get', key),
        set: (key, value) => ipcRenderer.invoke('store:set', key, value),
        delete: (key) => ipcRenderer.invoke('store:delete', key),
        clear: () => ipcRenderer.invoke('store:clear')
    }
});

// Exponer métodos de utilidad para el frontend
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    versions: process.versions,
    isDev: process.env.NODE_ENV === 'development',
    
    onWindowClose: (callback) => {
        ipcRenderer.on('window-closing', callback);
    },
    
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Exponer constantes útiles
contextBridge.exposeInMainWorld('constants', {
    TRANSACTION_TYPES: {
        PURCHASE: 'purchase',
        SALE: 'sale',
        ADJUSTMENT: 'adjustment',
        RETURN: 'return'
    },
    
    USER_ROLES: {
        ADMIN: 'admin',
        USER: 'user',
        VIEWER: 'viewer'
    },
    
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