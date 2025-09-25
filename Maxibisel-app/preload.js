//Script de precarga
const { contextBridge, ipcRenderer } = require('electron');

// Exponer API segura a la aplicación del lado del cliente
contextBridge.exposeInMainWorld('api', {
    // Autenticación
    login: (credentials) => ipcRenderer.invoke('api:login', credentials),
    logout: () => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'auth/logout'
    }),
     
    updateProductStock: (productId, newStock) => ipcRenderer.invoke('update-product-stock', productId, newStock),
    // Productos
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

    // Usuarios
    getUsers: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'users'
    }),

    // Transacciones
    getTransactions: () => ipcRenderer.invoke('api:request', {
        method: 'get',
        endpoint: 'transactions'
    }),
    createTransaction: (transactionData) => ipcRenderer.invoke('api:request', {
        method: 'post',
        endpoint: 'transactions',
        data: transactionData
    })
});