const Product = require('../models/product');
const Transaction = require('../models/transaction');
const { generateBarcode } = require('../utils/barcodeGenerator');

// Obtener todos los productos
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener productos', error: error.message });
    }
};

// Obtener un producto por ID
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el producto', error: error.message });
    }
};

// Crear un nuevo producto
exports.createProduct = async (req, res) => {
    try {
        // Generar código de barras único si no se proporciona
        if (!req.body.barcode) {
            req.body.barcode = await generateBarcode();
        }

        const product = new Product(req.body);
        const savedProduct = await product.save();

        // Registrar transacción de inventario inicial
        if (req.body.stock > 0) {
            const transaction = new Transaction({
                productId: savedProduct._id,
                type: 'purchase',
                quantity: req.body.stock,
                previousStock: 0,
                newStock: req.body.stock,
                userId: req.user ? req.user.id : null,
                notes: 'Inventario inicial'
            });
            await transaction.save();
        }

        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ message: 'Error al crear el producto', error: error.message });
    }
};

// Actualizar un producto
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const oldProduct = await Product.findById(productId);

        if (!oldProduct) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Si el stock cambia, registrar transacción
        if (req.body.stock !== undefined && req.body.stock !== oldProduct.stock) {
            const transaction = new Transaction({
                productId: productId,
                type: 'adjustment',
                quantity: req.body.stock - oldProduct.stock,
                previousStock: oldProduct.stock,
                newStock: req.body.stock,
                userId: req.user ? req.user.id : null,
                notes: 'Ajuste manual de inventario'
            });
            await transaction.save();
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { ...req.body, lastUpdated: Date.now() },
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: 'Error al actualizar el producto', error: error.message });
    }
};

// ✅ FUNCIÓN PRINCIPAL CORREGIDA: Actualizar stock de un producto
exports.updateProductStock = async (req, res) => {
    try {
        const productId = req.params.id;
        const { stock, stock_surtido } = req.body;

        console.log(`🔄 [CONTROLLER] Actualizando stock del producto ${productId}`);
        console.log(`📦 [CONTROLLER] Datos recibidos:`, { stock, stock_surtido });

        // Validaciones básicas
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'ID de producto requerido'
            });
        }

        if (stock === undefined || stock_surtido === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren ambos campos: stock y stock_surtido',
                received: { stock, stock_surtido }
            });
        }

        // Convertir a números
        const stockNumber = Number(stock);
        const stockSurtidoNumber = Number(stock_surtido);

        if (isNaN(stockNumber) || isNaN(stockSurtidoNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Stock y stock_surtido deben ser números válidos'
            });
        }

        if (stockNumber < 0 || stockSurtidoNumber < 0) {
            return res.status(400).json({
                success: false,
                message: 'Los valores de stock no pueden ser negativos'
            });
        }

        if (stockSurtidoNumber > stockNumber) {
            return res.status(400).json({
                success: false,
                message: 'Stock surtido no puede ser mayor que stock total'
            });
        }

        // Buscar el producto actual
        const oldProduct = await Product.findById(productId);
        if (!oldProduct) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        console.log(`📋 [CONTROLLER] Producto encontrado: ${oldProduct.name}`);
        console.log(`📊 [CONTROLLER] Stock anterior:`, {
            stock: oldProduct.stock,
            stock_surtido: oldProduct.stock_surtido,
            stock_almacenado: oldProduct.stock_almacenado
        });

        // Calcular stock_almacenado automáticamente
        const stockAlmacenado = stockNumber - stockSurtidoNumber;

        console.log(`📊 [CONTROLLER] Nuevos valores calculados:`, {
            stock: stockNumber,
            stock_surtido: stockSurtidoNumber,
            stock_almacenado: stockAlmacenado
        });

        // ✅ ACTUALIZACIÓN USANDO MONGOOSE (MÁS CONFIABLE)
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    stock: stockNumber,
                    stock_surtido: stockSurtidoNumber,
                    stock_almacenado: stockAlmacenado,
                    lastUpdated: new Date()
                }
            },
            {
                new: true,           // Retornar el documento actualizado
                runValidators: true  // Ejecutar validaciones del schema
            }
        );

        if (!updatedProduct) {
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar el producto'
            });
        }

        // Registrar transacción si el stock total cambió
        if (stockNumber !== oldProduct.stock) {
            const transaction = new Transaction({
                productId: productId,
                type: 'sale',
                quantity: oldProduct.stock - stockNumber,
                previousStock: oldProduct.stock,
                newStock: stockNumber,
                userId: req.user ? req.user.id : null,
                notes: 'Salida de productos - Actualización de inventario'
            });

            try {
                await transaction.save();
                console.log(`📝 [CONTROLLER] Transacción registrada: ${oldProduct.stock} → ${stockNumber}`);
            } catch (transactionError) {
                console.error('⚠️ Error al registrar transacción:', transactionError);
                // No fallar la actualización por error en transacción
            }
        }

        console.log(`✅ [CONTROLLER] Stock actualizado correctamente:`, {
            anterior: {
                stock: oldProduct.stock,
                stock_surtido: oldProduct.stock_surtido,
                stock_almacenado: oldProduct.stock_almacenado
            },
            nuevo: {
                stock: updatedProduct.stock,
                stock_surtido: updatedProduct.stock_surtido,
                stock_almacenado: updatedProduct.stock_almacenado
            }
        });

        res.status(200).json({
            success: true,
            message: 'Stock actualizado correctamente',
            product: updatedProduct,
            changes: {
                previousStock: oldProduct.stock,
                newStock: updatedProduct.stock,
                stockReduced: oldProduct.stock - updatedProduct.stock
            }
        });

    } catch (error) {
        console.error('💥 [CONTROLLER] Error completo al actualizar stock:', error);

        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Eliminar un producto
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.status(200).json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el producto', error: error.message });
    }
};

// Buscar producto por código de barras
exports.getProductByBarcode = async (req, res) => {
    try {
        const barcode = req.params.barcode;
        const product = await Product.findOne({ barcode });

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar el producto', error: error.message });
    }
};