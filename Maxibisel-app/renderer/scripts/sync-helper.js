import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';

export const syncHelper = {
    
    notifyProductUpdated(product, sourceView = 'unknown') {
        console.log(`🔄 [${sourceView}] Notificando producto actualizado:`, product.name || product._id);
        
        if (!product || !product._id) {
            console.error('❌ Producto inválido para notificación:', product);
            return;
        }

        eventManager.emit('data:product:updated', product);

        eventManager.emit('external:product-updated', {
            ...product,
            sourceView,
            timestamp: Date.now()
        });
    },

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

        eventManager.emit('data:product:stock-updated', stockData);
        eventManager.emit('external:stock-updated', stockData);

        if (fullProduct) {
            this.notifyProductUpdated(fullProduct, sourceView);
        }
    },

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

        eventManager.emit('external:product-sold', saleData);

        this.notifyStockUpdated(productId, newStock + quantitySold, newStock, fullProduct, sourceView);
    },
    async forceSyncProducts(sourceView = 'unknown') {
        console.log(`🔄 [${sourceView}] Forzando sincronización completa de productos`);
        
        try {
            await dataSync.forceSyncFromServer('products');
            

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


export const updateProductStockFromSale = async (productId, quantityUsed, sourceView = 'sales') => {
    try {
        const currentProduct = await window.api.getProduct(productId);
        const oldStock = currentProduct.stock || 0;
        const newStock = Math.max(0, oldStock - quantityUsed);
        const stockData = {
            stock: newStock,
            stock_surtido: currentProduct.stock_surtido || 0
        };
        
        const response = await window.api.updateProductStock(productId, stockData);
        const updatedProduct = response.product || response;

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