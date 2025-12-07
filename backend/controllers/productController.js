const Product = require('../models/product');
const Transaction = require('../models/transaction');

// ============================================================================
// FUNCIÓN MEJORADA: updateProductStock
// ============================================================================
exports.updateProductStock = async (req, res) => {
    const productId = req.params.id;
    const { stock, stock_surtido } = req.body;
    
    console.log('\n========================================');
    console.log('🔄 [STOCK-UPDATE] INICIO DE ACTUALIZACIÓN');
    console.log('========================================');
    console.log('📦 ProductID:', productId);
    console.log('📝 Datos recibidos:', JSON.stringify({ stock, stock_surtido }, null, 2));
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    try {
        // ====================================================================
        // PASO 1: VALIDACIONES INICIALES
        // ====================================================================
        if (stock === undefined && stock_surtido === undefined) {
            console.error('❌ [STOCK-UPDATE] ERROR: No se proporcionaron datos para actualizar');
            return res.status(400).json({
                success: false,
                message: 'Se requiere al menos un valor de stock para actualizar',
                error: 'MISSING_STOCK_DATA'
            });
        }

        // Validar formato de números
        if (stock !== undefined) {
            const stockNumber = parseInt(stock);
            if (isNaN(stockNumber) || stockNumber < 0) {
                console.error('❌ [STOCK-UPDATE] ERROR: Stock inválido:', stock);
                return res.status(400).json({
                    success: false,
                    message: 'El stock debe ser un número válido mayor o igual a 0',
                    error: 'INVALID_STOCK_VALUE',
                    receivedValue: stock
                });
            }
        }

        if (stock_surtido !== undefined) {
            const stockSurtidoNumber = parseInt(stock_surtido);
            if (isNaN(stockSurtidoNumber) || stockSurtidoNumber < 0) {
                console.error('❌ [STOCK-UPDATE] ERROR: Stock surtido inválido:', stock_surtido);
                return res.status(400).json({
                    success: false,
                    message: 'El stock surtido debe ser un número válido mayor o igual a 0',
                    error: 'INVALID_STOCK_SURTIDO_VALUE',
                    receivedValue: stock_surtido
                });
            }
        }

        // ====================================================================
        // PASO 2: OBTENER PRODUCTO ACTUAL
        // ====================================================================
        console.log('🔍 [STOCK-UPDATE] Buscando producto en BD...');
        const oldProduct = await Product.findById(productId);
        
        if (!oldProduct) {
            console.error('❌ [STOCK-UPDATE] ERROR: Producto no encontrado en BD');
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado',
                error: 'PRODUCT_NOT_FOUND',
                productId: productId
            });
        }

        console.log('✅ [STOCK-UPDATE] Producto encontrado:');
        console.log('   - Nombre:', oldProduct.name);
        console.log('   - Código:', oldProduct.barcode);
        console.log('   - Stock actual:', oldProduct.stock);
        console.log('   - Stock surtido actual:', oldProduct.stock_surtido);

        // ====================================================================
        // PASO 3: CALCULAR NUEVOS VALORES
        // ====================================================================
        const newStock = stock !== undefined ? parseInt(stock) : oldProduct.stock;
        const newStockSurtido = stock_surtido !== undefined ? parseInt(stock_surtido) : oldProduct.stock_surtido;

        console.log('📊 [STOCK-UPDATE] Calculando nuevos valores:');
        console.log('   - Nuevo stock total:', newStock);
        console.log('   - Nuevo stock surtido:', newStockSurtido);

        // VALIDACIÓN CRÍTICA: stock_surtido no puede exceder stock
        if (newStockSurtido > newStock) {
            console.error('❌ [STOCK-UPDATE] ERROR: Stock surtido excede stock total');
            console.error('   - Stock total:', newStock);
            console.error('   - Stock surtido intentado:', newStockSurtido);
            
            return res.status(400).json({
                success: false,
                message: `El stock surtido (${newStockSurtido}) no puede ser mayor que el stock total (${newStock})`,
                error: 'STOCK_SURTIDO_EXCEEDS_TOTAL',
                values: {
                    stock: newStock,
                    stock_surtido: newStockSurtido,
                    difference: newStockSurtido - newStock
                }
            });
        }

        // ====================================================================
        // PASO 4: PREPARAR DATOS DE ACTUALIZACIÓN
        // ====================================================================
        const updateData = {
            lastUpdated: new Date()
        };

        if (stock !== undefined) {
            updateData.stock = newStock;
        }

        if (stock_surtido !== undefined) {
            updateData.stock_surtido = newStockSurtido;
        }

        // Calcular stock almacenado
        updateData.stock_almacenado = newStock - newStockSurtido;

        console.log('📝 [STOCK-UPDATE] Datos de actualización preparados:');
        console.log(JSON.stringify(updateData, null, 2));

        // ====================================================================
        // PASO 5: EJECUTAR ACTUALIZACIÓN EN BD
        // ====================================================================
        console.log('💾 [STOCK-UPDATE] Ejecutando actualización en MongoDB...');
        
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            {
                new: true,          // Retornar documento actualizado
                runValidators: true, // Ejecutar validaciones del schema
                lean: false          // Retornar documento Mongoose completo
            }
        );

        if (!updatedProduct) {
            console.error('❌ [STOCK-UPDATE] ERROR: No se pudo actualizar el producto');
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar el producto en la base de datos',
                error: 'UPDATE_FAILED'
            });
        }

        console.log('✅ [STOCK-UPDATE] Producto actualizado en BD correctamente');

        // ====================================================================
        // PASO 6: VERIFICAR ACTUALIZACIÓN
        // ====================================================================
        console.log('🔍 [STOCK-UPDATE] Verificando actualización...');
        const verifiedProduct = await Product.findById(productId).lean();
        
        if (!verifiedProduct) {
            console.error('❌ [STOCK-UPDATE] ERROR: No se pudo verificar la actualización');
            return res.status(500).json({
                success: false,
                message: 'No se pudo verificar la actualización',
                error: 'VERIFICATION_FAILED'
            });
        }

        // Verificar que los valores se guardaron correctamente
        const verificationErrors = [];
        
        if (stock !== undefined && verifiedProduct.stock !== newStock) {
            verificationErrors.push(`Stock esperado: ${newStock}, guardado: ${verifiedProduct.stock}`);
        }
        
        if (stock_surtido !== undefined && verifiedProduct.stock_surtido !== newStockSurtido) {
            verificationErrors.push(`Stock surtido esperado: ${newStockSurtido}, guardado: ${verifiedProduct.stock_surtido}`);
        }

        if (verificationErrors.length > 0) {
            console.error('❌ [STOCK-UPDATE] ERROR: Discrepancia en verificación:');
            verificationErrors.forEach(err => console.error('   -', err));
            
            return res.status(500).json({
                success: false,
                message: 'Los datos no se guardaron correctamente',
                error: 'DATA_MISMATCH',
                details: verificationErrors,
                expected: { stock: newStock, stock_surtido: newStockSurtido },
                actual: { stock: verifiedProduct.stock, stock_surtido: verifiedProduct.stock_surtido }
            });
        }

        console.log('✅ [STOCK-UPDATE] Verificación exitosa - Datos correctos en BD');

        // ====================================================================
        // PASO 7: REGISTRAR TRANSACCIÓN
        // ====================================================================
        if (stock !== undefined && newStock !== oldProduct.stock) {
            try {
                console.log('📝 [STOCK-UPDATE] Registrando transacción...');
                
                const transaction = new Transaction({
                    productId: productId,
                    type: newStock < oldProduct.stock ? 'sale' : 'entry',
                    quantity: Math.abs(oldProduct.stock - newStock),
                    previousStock: oldProduct.stock,
                    newStock: newStock,
                    userId: req.user ? req.user.id : null,
                    notes: `Actualización de inventario - Stock ${newStock < oldProduct.stock ? 'reducido' : 'aumentado'}`
                });

                await transaction.save();
                console.log('✅ [STOCK-UPDATE] Transacción registrada:', transaction._id);
                
            } catch (transError) {
                // No fallar la actualización si falla el registro de transacción
                console.warn('⚠️ [STOCK-UPDATE] Advertencia: No se pudo registrar transacción:', transError.message);
            }
        }

        // ====================================================================
        // PASO 8: EMITIR EVENTOS SOCKET.IO
        // ====================================================================
        if (req.app.get('io')) {
            try {
                const io = req.app.get('io');
                
                console.log('📡 [STOCK-UPDATE] Emitiendo eventos Socket.IO...');
                
                // Evento específico de actualización de stock
                io.emit('product:stock-updated', {
                    productId: productId,
                    oldStock: oldProduct.stock,
                    newStock: verifiedProduct.stock,
                    oldStockSurtido: oldProduct.stock_surtido,
                    newStockSurtido: verifiedProduct.stock_surtido,
                    product: verifiedProduct,
                    timestamp: new Date().toISOString()
                });
                
                // Evento general de producto actualizado
                io.emit('product:updated', verifiedProduct);
                
                console.log('✅ [STOCK-UPDATE] Eventos emitidos correctamente');
                
            } catch (socketError) {
                console.warn('⚠️ [STOCK-UPDATE] Advertencia: Error al emitir eventos:', socketError.message);
            }
        } else {
            console.warn('⚠️ [STOCK-UPDATE] Socket.IO no disponible');
        }

        // ====================================================================
        // PASO 9: RESPONDER AL CLIENTE
        // ====================================================================
        const changes = {
            previousStock: oldProduct.stock,
            newStock: verifiedProduct.stock,
            stockChanged: verifiedProduct.stock !== oldProduct.stock,
            previousStockSurtido: oldProduct.stock_surtido,
            newStockSurtido: verifiedProduct.stock_surtido,
            stockSurtidoChanged: verifiedProduct.stock_surtido !== oldProduct.stock_surtido,
            stockReduced: oldProduct.stock - verifiedProduct.stock,
            stockAlmacenado: verifiedProduct.stock_almacenado
        };

        console.log('✅ [STOCK-UPDATE] Cambios aplicados:');
        console.log(JSON.stringify(changes, null, 2));
        console.log('========================================');
        console.log('✅ [STOCK-UPDATE] ACTUALIZACIÓN COMPLETADA');
        console.log('========================================\n');

        res.status(200).json({
            success: true,
            message: 'Stock actualizado correctamente',
            product: verifiedProduct,
            changes: changes,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('\n========================================');
        console.error('💥 [STOCK-UPDATE] ERROR CRÍTICO');
        console.error('========================================');
        console.error('Error completo:', error);
        console.error('Stack trace:', error.stack);
        console.error('ProductID afectado:', productId);
        console.error('Datos intentados:', JSON.stringify({ stock, stock_surtido }, null, 2));
        console.error('========================================\n');
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al actualizar stock',
            error: error.message,
            errorType: error.name,
            productId: productId,
            timestamp: new Date().toISOString()
        });
    }
};

// ============================================================================
// FUNCIÓN AUXILIAR: Obtener todos los productos (también mejorada)
// ============================================================================
exports.getAllProducts = async (req, res) => {
    try {
        console.log('\n📋 [GET-PRODUCTS] Obteniendo todos los productos...');
        
        const products = await Product.find({})
            .sort({ createdAt: -1 })
            .lean();
        
        console.log(`✅ [GET-PRODUCTS] ${products.length} productos obtenidos correctamente`);
        
        res.status(200).json({
            success: true,
            message: 'Productos obtenidos correctamente',
            products: products,
            count: products.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 [GET-PRODUCTS] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
// ============================================================================
// FUNCIÓN: Obtener producto por código de barras
// ============================================================================
exports.getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        
        console.log('\n🔍 [GET-BY-BARCODE] Buscando producto con código:', barcode);
        
        const product = await Product.findOne({ barcode: barcode }).lean();
        
        if (!product) {
            console.log('❌ [GET-BY-BARCODE] Producto no encontrado');
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado',
                error: 'PRODUCT_NOT_FOUND',
                barcode: barcode
            });
        }
        
        console.log('✅ [GET-BY-BARCODE] Producto encontrado:', product.name);
        
        res.status(200).json({
            success: true,
            message: 'Producto encontrado',
            product: product,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 [GET-BY-BARCODE] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// ============================================================================
// OTRAS FUNCIONES QUE TAMBIÉN FALTAN
// ============================================================================
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.status(200).json({
            success: true,
            product: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener producto',
            error: error.message
        });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        
        res.status(201).json({
            success: true,
            message: 'Producto creado correctamente',
            product: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear producto',
            error: error.message
        });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto actualizado',
            product: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar producto',
            error: error.message
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto eliminado correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al eliminar producto',
            error: error.message
        });
    }
};