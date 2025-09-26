// Script de precarga 
const { contextBridge, ipcRenderer } = require('electron');

// Variable temporal para almacenar el token solo durante la sesión
let sessionToken = null;
let sessionUser = null;

// Exponer API segura a la aplicación del lado del cliente
contextBridge.exposeInMainWorld('api', {
    // ===== AUTENTICACIÓN SIN PERSISTENCIA =====
    login: async (credentials) => {
        const response = await ipcRenderer.invoke('api:login', credentials);

        // Almacenar token solo en memoria durante la sesión
        if (response.token) {
            sessionToken = response.token;
            console.log('🔑 Token almacenado en memoria para la sesión');
        }
        if (response.user) {
            sessionUser = response.user;
            console.log('👤 Usuario almacenado en memoria para la sesión');
        }

        return response;
    },

    logout: async () => {
        try {
            await ipcRenderer.invoke('api:request', {
                method: 'post',
                endpoint: 'auth/logout'
            });
        } finally {
            // Limpiar datos de sesión sin importar el resultado
            sessionToken = null;
            sessionUser = null;
            console.log('🧹 Datos de sesión limpiados');
        }
    },

    // ===== PRODUCTOS =====
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

    // ✅ FUNCIÓN ESPECÍFICA: Actualizar stock
    updateProductStock: (productId, updateData) => ipcRenderer.invoke('api:request', {
        method: 'patch',
        endpoint: `products/${productId}/stock`,
        data: updateData
    }),

    deleteProduct: (id) => ipcRenderer.invoke('api:request', {
        method: 'delete',
        endpoint: `products/${id}`
    }),
    getProductByBarcode: (barcode) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `products/barcode/${barcode}`
    }),

    // ===== USUARIOS =====
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

    // ===== VENTAS/SALIDAS =====
    getSales: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'sales'
    }),
    getSale: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `sales/${id}`
    }),
    createSale: (saleData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'sales',
        data: saleData
    }),
    updateSale: (id, saleData) => ipcRenderer.invoke('api:request', {
        method: 'put',
        endpoint: `sales/${id}`,
        data: saleData
    }),
    deleteSale: (id) => ipcRenderer.invoke('api:request', {
        method: 'delete',
        endpoint: `sales/${id}`
    }),

    // ===== TRANSACCIONES =====
    getTransactions: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'transactions'
    }),
    getTransaction: (id) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: `transactions/${id}`
    }),
    createTransaction: (transactionData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'transactions',
        data: transactionData
    }),

    // ===== REPORTES Y ESTADÍSTICAS =====
    getInventoryReport: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'reports/inventory'
    }),
    getSalesReport: (params) => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'reports/sales',
        data: params
    }),

    // ===== SALUD DEL SISTEMA =====
    checkHealth: () => ipcRenderer.invoke('api:health'),

    // ===== CONFIGURACIÓN DE LA APP =====
    getAppConfig: () => ipcRenderer.invoke('app:getConfig'),
    restartApp: () => ipcRenderer.invoke('app:restart'),

    // ===== ALMACENAMIENTO TEMPORAL (solo para la sesión) =====
    store: {
        get: (key) => {
            // Solo devolver datos de sesión temporal
            if (key === 'authToken') return sessionToken;
            if (key === 'user') return sessionUser;
            return null;
        },
        set: (key, value) => {
            // No persistir nada, solo mantener en memoria
            if (key === 'authToken') sessionToken = value;
            if (key === 'user') sessionUser = value;
            return true;
        },
        delete: (key) => {
            // Limpiar datos de memoria
            if (key === 'authToken') sessionToken = null;
            if (key === 'user') sessionUser = null;
            return true;
        },
        clear: () => {
            // Limpiar toda la sesión temporal
            sessionToken = null;
            sessionUser = null;
            return true;
        }
    }
});

// Función para obtener el token actual para las peticiones
function getCurrentToken() {
    return sessionToken;
}

// Exponer función helper para obtener token (uso interno)
contextBridge.exposeInMainWorld('_internal', {
    getCurrentToken: () => sessionToken,
    getCurrentUser: () => sessionUser
});