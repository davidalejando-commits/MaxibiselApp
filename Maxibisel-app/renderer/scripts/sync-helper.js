// Helper para sincronización entre vistas - sync-helper.js
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';

export const syncHelper = {
    
    /**
     * Notificar que un producto fue actualizado desde cualquier vista
     * @param {Object} product - Producto actualizado completo
     * @param {string} sourceView - Vista que realizó la actualización
     */
    notifyProductUpdated(product, sourceView = 'unknown') {
        console.log(`🔄 [${sourceView}] Notificando producto actualizado:`, product.name || product._id);
        
        if (!product || !product._id) {
            console.error('❌ Producto inválido para notificación:', product);
            return;
        }

        // Emitir a través del eventManager
        eventManager.emit('data:product:updated', product);
        
        // También emitir evento específico para vistas externas
        eventManager.emit('external:product-updated', {
            ...product,
            sourceView,
            timestamp: Date.now()
        });
    },

    /**
     * Notificar que el stock de un producto cambió
     * @param {string} productId - ID del producto
     * @param {number} oldStock - Stock anterior
     * @param {number} newStock - Stock nuevo
     * @param {Object} fullProduct - Producto completo (opcional)
     * @param {string} sourceView - Vista que realizó el cambio
     */
    notifyStockUpdated(productId, oldStock, newStock, fullProduct = null, sourceView = 'unknown') {
        console.log(`📦 [${sourceView}] Notificando stock actualizado: ${productId} (${oldStock} → ${newStock})`);
        
        const stockData = {
            productId,
            oldStock,
            newStock,
            product: fullProduct,
            sourceView,
            timestamp: Date.now()
        };

        // Emitir eventos específicos de stock
        eventManager.emit('data:product:stock-updated', stockData);
        eventManager.emit('external:stock-updated', stockData);
        
        // Si tenemos el producto completo, también emitir actualización general
        if (fullProduct) {
            this.notifyProductUpdated(fullProduct, sourceView);
        }
    },

    /**
     * Notificar que se realizó una venta/salida que afecta el stock
     * @param {string} productId - ID del producto vendido
     * @param {number} quantitySold - Cantidad vendida
     * @param {number} newStock - Stock resultante
     * @param {Object} fullProduct - Producto completo (opcional)
     * @param {string} sourceView - Vista que procesó la venta
     */
    notifyProductSold(productId, quantitySold, newStock, fullProduct = null, sourceView = 'unknown') {
        console.log(`💰 [${sourceView}] Notificando venta: ${productId} (-${quantitySold}) → ${newStock}`);
        
        const saleData = {
            productId,
            quantitySold,
            newStock,
            product: fullProduct,
            sourceView,
            timestamp: Date.now()
        };

        // Emitir evento específico de venta
        eventManager.emit('external:product-sold', saleData);
        
        // También emitir como actualización de stock
        this.notifyStockUpdated(productId, newStock + quantitySold, newStock, fullProduct, sourceView);
    },

    /**
     * Forzar sincronización completa de productos
     * @param {string} sourceView - Vista que solicita la sincronización
     */
    async forceSyncProducts(sourceView = 'unknown') {
        console.log(`🔄 [${sourceView}] Forzando sincronización completa de productos`);
        
        try {
            // Invalidar cache y recargar datos
            await dataSync.forceSyncFromServer('products');
            
            // Notificar a todas las vistas que se sincronizó
            eventManager.emit('sync:products-changed', {
                sourceView,
                timestamp: Date.now(),
                action: 'force-sync'
            });
            
            console.log(`✅ [${sourceView}] Sincronización completa realizada`);
            
        } catch (error) {
            console.error(`❌ [${sourceView}] Error en sincronización completa:`, error);
            throw error;
        }
    }
};

/**
 * Utilidad para actualizar stock desde vista de ventas/salidas
 * @param {string} productId - ID del producto
 * @param {number} quantityUsed - Cantidad usada/vendida
 * @param {string} sourceView - Vista que realiza la actualización
 */
export const updateProductStockFromSale = async (productId, quantityUsed, sourceView = 'sales') => {
    try {
        // 1. Obtener producto actual
        const currentProduct = await window.api.getProduct(productId);
        const oldStock = currentProduct.stock || 0;
        
        // 2. Calcular nuevo stock
        const newStock = Math.max(0, oldStock - quantityUsed);
        
        // 3. Actualizar en backend
        const stockData = {
            stock: newStock,
            stock_surtido: currentProduct.stock_surtido || 0
        };
        
        const response = await window.api.updateProductStock(productId, stockData);
        const updatedProduct = response.product || response;
        
        // 4. Notificar a todas las vistas usando syncHelper
        syncHelper.notifyProductSold(
            productId,
            quantityUsed,
            newStock,
            updatedProduct,
            sourceView
        );
        
        console.log(`✅ [${sourceView}] Stock actualizado y notificado:`, updatedProduct.name);
        return updatedProduct;
        
    } catch (error) {
        console.error(`❌ [${sourceView}] Error actualizando stock:`, error);
        throw error;
    }
};