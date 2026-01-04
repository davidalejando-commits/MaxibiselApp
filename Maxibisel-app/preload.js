//Script de precarga - Versión CORREGIDA para FACTURAS
const { contextBridge, ipcRenderer } = require('electron');

// ✅ FUNCIÓN MEJORADA: No lanza error si success no está presente
async function handleApiRequest(config) {
    try {
        const response = await ipcRenderer.invoke('api:request', config);
        
        // ✅ CORRECCIÓN: Solo lanzar error si success está explícitamente en false
        // Si success no existe, asumimos que es exitoso
        if (response && response.success === false) {
            const error = new Error(response.message || 'Error en la solicitud');
            error.response = response;
            throw error;
        }
        
        return response;
    } catch (error) {
        console.error('❌ Error en handleApiRequest:', error);
        throw error;
    }
}

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
    getProducts: () => handleApiRequest({
        method: 'get',
        endpoint: 'products'
    }),
    
    getProduct: (id) => handleApiRequest({
        method: 'get',
        endpoint: `products/${id}`
    }),
    
    createProduct: (productData) => handleApiRequest({
        method: 'post',
        endpoint: 'products',
        data: productData
    }),
    
    updateProduct: (id, productData) => handleApiRequest({
        method: 'put',
        endpoint: `products/${id}`,
        data: productData
    }),
    
    deleteProduct: (id) => handleApiRequest({
        method: 'delete',
        endpoint: `products/${id}`
    }),
    
    getProductByBarcode: (barcode) => handleApiRequest({
        method: 'get',
        endpoint: `products/barcode/${barcode}`
    }),
    
    updateProductStock: (productId, stockData) => handleApiRequest({
        method: 'patch',
        endpoint: `products/${productId}/stock`,
        data: stockData
    }),

    // === USUARIOS ===
    getUsers: () => handleApiRequest({
        method: 'get',
        endpoint: 'users'
    }),
    
    getUser: (id) => handleApiRequest({
        method: 'get',
        endpoint: `users/${id}`
    }),
    
    createUser: (userData) => handleApiRequest({
        method: 'post',
        endpoint: 'users',
        data: userData
    }),
    
    updateUser: (id, userData) => handleApiRequest({
        method: 'put',
        endpoint: `users/${id}`,
        data: userData
    }),
    
    deleteUser: (id) => handleApiRequest({
        method: 'delete',
        endpoint: `users/${id}`
    }),

    // === TRANSACCIONES ===
    getTransactions: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `transactions?${queryParams}` : 'transactions';
        
        return handleApiRequest({
            method: 'get',
            endpoint: endpoint
        });
    },
    
    getTransaction: (id) => handleApiRequest({
        method: 'get',
        endpoint: `transactions/${id}`
    }),
    
    createTransaction: (transactionData) => handleApiRequest({
        method: 'post',
        endpoint: 'transactions',
        data: transactionData
    }),

    // === VENTAS ===
    createSale: (saleData) => handleApiRequest({
        method: 'post',
        endpoint: 'transactions',
        data: { ...saleData, type: 'sale' }
    }),

    // === REMISIONES ===
    getRemisiones: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `remisiones?${queryParams}` : 'remisiones';
        
        return handleApiRequest({
            method: 'get',
            endpoint: endpoint
        });
    },

    getRemision: (id) => handleApiRequest({
        method: 'get',
        endpoint: `remisiones/${id}`
    }),

    createRemision: (remisionData) => handleApiRequest({
        method: 'post',
        endpoint: 'remisiones',
        data: remisionData
    }),

    updateRemision: (id, remisionData) => handleApiRequest({
        method: 'put',
        endpoint: `remisiones/${id}`,
        data: remisionData
    }),

    deleteRemision: (id) => handleApiRequest({
        method: 'delete',
        endpoint: `remisiones/${id}`
    }),
    
    // === FACTURAS - VERSIÓN CORREGIDA ===
    
    // ✅ Obtener todas las facturas (CORREGIDO)
    getFacturas: (params) => {
        const queryParams = params ? new URLSearchParams(params).toString() : '';
        const endpoint = queryParams ? `facturas?${queryParams}` : 'facturas';
        
        console.log('📋 [PRELOAD] Solicitando facturas...');
        return handleApiRequest({
            method: 'get',
            endpoint: endpoint
        });
    },

    // ✅ Obtener factura por ID (CORREGIDO)
    getFactura: (id) => {
        console.log('📄 [PRELOAD] Solicitando factura:', id);
        return handleApiRequest({
            method: 'get',
            endpoint: `facturas/${id}`
        });
    },

    // ✅ Crear factura (CORREGIDO)
    createFactura: (facturaData) => {
        console.log('💰 [PRELOAD] Creando factura...');
        return handleApiRequest({
            method: 'post',
            endpoint: 'facturas',
            data: facturaData
        });
    },

    // ✅ Actualizar factura (CORREGIDO)
    updateFactura: (id, facturaData) => {
        console.log('✏️ [PRELOAD] Actualizando factura:', id);
        return handleApiRequest({
            method: 'put',
            endpoint: `facturas/${id}`,
            data: facturaData
        });
    },

    // ✅ Anular factura (CORREGIDO)
    anularFactura: (id) => {
        console.log('🚫 [PRELOAD] Anulando factura:', id);
        return handleApiRequest({
            method: 'patch',
            endpoint: `facturas/${id}/anular`
        });
    },

    // ✅ Eliminar factura (CORREGIDO)
    deleteFactura: (id) => {
        console.log('🗑️ [PRELOAD] Eliminando factura:', id);
        return handleApiRequest({
            method: 'delete',
            endpoint: `facturas/${id}`
        });
    },

    // ✅ Obtener estadísticas de facturas (CORREGIDO)
    getFacturasStats: async () => {
        try {
            console.log('📊 [PRELOAD] Solicitando estadísticas de facturas...');
            const response = await handleApiRequest({
                method: 'get',
                endpoint: 'facturas'
            });
            
            const facturas = response.facturas || response || [];
            
            const stats = {
                total: facturas.length,
                pendientes: facturas.filter(f => f.estado === 'pendiente').length,
                pagadas: facturas.filter(f => f.estado === 'pagada').length,
                anuladas: facturas.filter(f => f.estado === 'anulada').length,
                totalFacturado: facturas
                    .filter(f => f.estado !== 'anulada')
                    .reduce((sum, f) => sum + (f.total || 0), 0)
            };
            
            console.log('✅ [PRELOAD] Estadísticas calculadas:', stats);
            return stats;
        } catch (error) {
            console.error('❌ [PRELOAD] Error obteniendo estadísticas de facturas:', error);
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
    console.error('❌ Error no capturado en preload:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada en preload:', reason);
});

console.log('✅ Preload.js cargado correctamente - Versión con facturas corregida');