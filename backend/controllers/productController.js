const Product = require('../models/product');
const Transaction = require('../models/transaction');

// ============================================================================
// FUNCIÓN MEJORADA: updateProductStock
// ============================================================================
exports.updateProductStock = async (req, res) => {
    const productId = req.params.id;
    const { stock, stock_surtido, stock_almacenado } = req.body; // ✅ Agregar stock_almacenado
    
    console.log('\n========================================');
    console.log('🔄 [STOCK-UPDATE] INICIO DE ACTUALIZACIÓN');
    console.log('========================================');
    console.log('📦 ProductID:', productId);
    console.log('📝 Datos recibidos:', JSON.stringify({ stock, stock_surtido, stock_almacenado }, null, 2));
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    try {
        // ====================================================================
        // PASO 1: VALIDACIONES INICIALES
        // ====================================================================
        if (stock === undefined && stock_surtido === undefined && stock_almacenado === undefined) {
            console.error('❌ [STOCK-UPDATE] ERROR: No se proporcionaron datos para actualizar');
            return res.status(400).json({
                success: false,
                message: 'Se requiere al menos un valor de stock para actualizar',
                error: 'MISSING_STOCK_DATA'
            });
        }

        // ✅ CAMBIO: Permitir números negativos
        const validarNumero = (valor, nombreCampo) => {
            if (valor === undefined) return null;
            
            const numero = parseInt(valor);
            if (isNaN(numero)) {
                console.error(`❌ [STOCK-UPDATE] ERROR: ${nombreCampo} inválido:`, valor);
                return {
                    error: true,
                    message: `El ${nombreCampo} debe ser un número válido`,
                    receivedValue: valor
                };
            }
            
            // ✅ PERMITIR NEGATIVOS (eliminar validación >= 0)
            if (numero < 0) {
                console.warn(`⚠️ [STOCK-UPDATE] ADVERTENCIA: ${nombreCampo} es negativo: ${numero}`);
            }
            
            return { error: false, value: numero };
        };

        // Validar stock
        if (stock !== undefined) {
            const validacion = validarNumero(stock, 'stock');
            if (validacion.error) {
                return res.status(400).json({
                    success: false,
                    message: validacion.message,
                    error: 'INVALID_STOCK_VALUE',
                    receivedValue: validacion.receivedValue
                });
            }
        }

        // Validar stock_surtido
        if (stock_surtido !== undefined) {
            const validacion = validarNumero(stock_surtido, 'stock_surtido');
            if (validacion.error) {
                return res.status(400).json({
                    success: false,
                    message: validacion.message,
                    error: 'INVALID_STOCK_SURTIDO_VALUE',
                    receivedValue: validacion.receivedValue
                });
            }
        }

        // Validar stock_almacenado
        if (stock_almacenado !== undefined) {
            const validacion = validarNumero(stock_almacenado, 'stock_almacenado');
            if (validacion.error) {
                return res.status(400).json({
                    success: false,
                    message: validacion.message,
                    error: 'INVALID_STOCK_ALMACENADO_VALUE',
                    receivedValue: validacion.receivedValue
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
        console.log('   - Stock almacenado actual:', oldProduct.stock_almacenado);

        // ====================================================================
        // PASO 3: CALCULAR NUEVOS VALORES
        // ====================================================================
        const newStock = stock !== undefined ? parseInt(stock) : oldProduct.stock;
        const newStockSurtido = stock_surtido !== undefined ? parseInt(stock_surtido) : oldProduct.stock_surtido;
        const newStockAlmacenado = stock_almacenado !== undefined ? parseInt(stock_almacenado) : oldProduct.stock_almacenado;

        console.log('📊 [STOCK-UPDATE] Calculando nuevos valores:');
        console.log('   - Nuevo stock total:', newStock);
        console.log('   - Nuevo stock surtido:', newStockSurtido);
        console.log('   - Nuevo stock almacenado:', newStockAlmacenado);

        // ✅ CAMBIO: Permitir stock_surtido mayor que stock si ambos son negativos
        // Solo validar consistencia lógica
        const sumaParciales = newStockSurtido + newStockAlmacenado;
        if (sumaParciales !== newStock) {
            console.error('❌ [STOCK-UPDATE] ERROR: Inconsistencia en suma de stocks');
            console.error('   - Stock total:', newStock);
            console.error('   - Stock surtido + almacenado:', sumaParciales);
            console.error('   - Diferencia:', Math.abs(newStock - sumaParciales));
            
            return res.status(400).json({
                success: false,
                message: `Inconsistencia: stock_surtido (${newStockSurtido}) + stock_almacenado (${newStockAlmacenado}) = ${sumaParciales}, pero stock total es ${newStock}`,
                error: 'STOCK_INCONSISTENCY',
                values: {
                    stock: newStock,
                    stock_surtido: newStockSurtido,
                    stock_almacenado: newStockAlmacenado,
                    suma: sumaParciales,
                    diferencia: newStock - sumaParciales
                }
            });
        }

        // ✅ ADVERTENCIA si hay valores negativos
        const advertencias = [];
        if (newStock < 0) {
            advertencias.push(`Stock total negativo: ${newStock}`);
        }
        if (newStockSurtido < 0) {
            advertencias.push(`Stock surtido negativo: ${newStockSurtido}`);
        }
        if (newStockAlmacenado < 0) {
            advertencias.push(`Stock almacenado negativo: ${newStockAlmacenado}`);
        }

        if (advertencias.length > 0) {
            console.warn('⚠️ [STOCK-UPDATE] ADVERTENCIAS:');
            advertencias.forEach(adv => console.warn('   -', adv));
        }

        // ====================================================================
        // PASO 4: PREPARAR DATOS DE ACTUALIZACIÓN
        // ====================================================================
        const updateData = {
            stock: newStock,
            stock_surtido: newStockSurtido,
            stock_almacenado: newStockAlmacenado,
            lastUpdated: new Date()
        };

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
                new: true,
                runValidators: false, // ✅ Desactivar validadores para permitir negativos
                lean: false
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

        // Verificar valores
        const verificationErrors = [];
        
        if (verifiedProduct.stock !== newStock) {
            verificationErrors.push(`Stock esperado: ${newStock}, guardado: ${verifiedProduct.stock}`);
        }
        
        if (verifiedProduct.stock_surtido !== newStockSurtido) {
            verificationErrors.push(`Stock surtido esperado: ${newStockSurtido}, guardado: ${verifiedProduct.stock_surtido}`);
        }

        if (verifiedProduct.stock_almacenado !== newStockAlmacenado) {
            verificationErrors.push(`Stock almacenado esperado: ${newStockAlmacenado}, guardado: ${verifiedProduct.stock_almacenado}`);
        }

        if (verificationErrors.length > 0) {
            console.error('❌ [STOCK-UPDATE] ERROR: Discrepancia en verificación:');
            verificationErrors.forEach(err => console.error('   -', err));
            
            return res.status(500).json({
                success: false,
                message: 'Los datos no se guardaron correctamente',
                error: 'DATA_MISMATCH',
                details: verificationErrors
            });
        }

        console.log('✅ [STOCK-UPDATE] Verificación exitosa - Datos correctos en BD');

        // ====================================================================
        // PASO 7: REGISTRAR TRANSACCIÓN
        // ====================================================================
        if (newStock !== oldProduct.stock) {
            try {
                console.log('📝 [STOCK-UPDATE] Registrando transacción...');
                
                const transaction = new Transaction({
                    productId: productId,
                    type: newStock < oldProduct.stock ? 'sale' : 'entry',
                    quantity: Math.abs(oldProduct.stock - newStock),
                    previousStock: oldProduct.stock,
                    newStock: newStock,
                    userId: req.user ? req.user.id : null,
                    notes: `Actualización de inventario - Stock ${newStock < oldProduct.stock ? 'reducido' : 'aumentado'}${newStock < 0 ? ' (STOCK NEGATIVO)' : ''}`
                });

                await transaction.save();
                console.log('✅ [STOCK-UPDATE] Transacción registrada:', transaction._id);
                
            } catch (transError) {
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
                
                io.emit('product:stock-updated', {
                    productId: productId,
                    oldStock: oldProduct.stock,
                    newStock: verifiedProduct.stock,
                    oldStockSurtido: oldProduct.stock_surtido,
                    newStockSurtido: verifiedProduct.stock_surtido,
                    oldStockAlmacenado: oldProduct.stock_almacenado,
                    newStockAlmacenado: verifiedProduct.stock_almacenado,
                    product: verifiedProduct,
                    hasNegativeStock: verifiedProduct.stock < 0,
                    timestamp: new Date().toISOString()
                });
                
                io.emit('product:updated', verifiedProduct);
                console.log('✅ [STOCK-UPDATE] Eventos emitidos correctamente');
                
            } catch (socketError) {
                console.warn('⚠️ [STOCK-UPDATE] Advertencia: Error al emitir eventos:', socketError.message);
            }
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
            previousStockAlmacenado: oldProduct.stock_almacenado,
            newStockAlmacenado: verifiedProduct.stock_almacenado,
            stockAlmacenadoChanged: verifiedProduct.stock_almacenado !== oldProduct.stock_almacenado,
            stockReduced: oldProduct.stock - verifiedProduct.stock,
            hasNegativeStock: verifiedProduct.stock < 0,
            warnings: advertencias
        };

        console.log('✅ [STOCK-UPDATE] Cambios aplicados:');
        console.log(JSON.stringify(changes, null, 2));
        console.log('========================================');
        console.log('✅ [STOCK-UPDATE] ACTUALIZACIÓN COMPLETADA');
        console.log('========================================\n');

        res.status(200).json({
            success: true,
            message: 'Stock actualizado correctamente' + (advertencias.length > 0 ? ' (con stock negativo)' : ''),
            product: verifiedProduct,
            changes: changes,
            warnings: advertencias,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('\n========================================');
        console.error('💥 [STOCK-UPDATE] ERROR CRÍTICO');
        console.error('========================================');
        console.error('Error completo:', error);
        console.error('Stack trace:', error.stack);
        console.error('========================================\n');
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al actualizar stock',
            error: error.message,
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