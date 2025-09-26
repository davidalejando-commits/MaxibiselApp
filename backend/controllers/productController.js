const Product = require('../models/product');
const Transaction = require('../models/transaction');

// Obtener todos los productos
exports.getAllProducts = async (req, res) => {
    try {
        console.log('📋 [CONTROLLER] Obteniendo todos los productos');
        
        const products = await Product.find({})
            .sort({ createdAt: -1 })
            .lean();
        
        res.status(200).json({
            success: true,
            message: 'Productos obtenidos correctamente',
            products: products,
            count: products.length
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al obtener productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener producto por ID
exports.getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        console.log(`🔍 [CONTROLLER] Buscando producto con ID: ${productId}`);
        
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto encontrado',
            product: product
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al obtener producto por ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Crear nuevo producto
exports.createProduct = async (req, res) => {
    try {
        console.log('➕ [CONTROLLER] Creando nuevo producto');
        console.log('📝 [CONTROLLER] Datos recibidos:', req.body);
        
        const productData = req.body;
        
        // Verificar si ya existe un producto con el mismo código de barras
        if (productData.barcode) {
            const existingProduct = await Product.findOne({ barcode: productData.barcode });
            if (existingProduct) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un producto con ese código de barras'
                });
            }
        }
        
        const newProduct = new Product(productData);
        const savedProduct = await newProduct.save();
        
        // Emitir evento al frontend
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('product:created', savedProduct);
            console.log('📡 [CONTROLLER] Evento de producto creado emitido');
        }
        
        res.status(201).json({
            success: true,
            message: 'Producto creado correctamente',
            product: savedProduct
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al crear producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar producto
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        console.log(`🔄 [CONTROLLER] Actualizando producto ${productId}`);
        console.log('📝 [CONTROLLER] Datos recibidos:', req.body);
        
        const updateData = req.body;
        updateData.lastUpdated = new Date();
        
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        // Emitir evento al frontend
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('product:updated', updatedProduct);
            console.log('📡 [CONTROLLER] Evento de producto actualizado emitido');
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto actualizado correctamente',
            product: updatedProduct
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al actualizar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Eliminar producto
exports.deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        console.log(`🗑️ [CONTROLLER] Eliminando producto ${productId}`);
        
        const deletedProduct = await Product.findByIdAndDelete(productId);
        
        if (!deletedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        // Emitir evento al frontend
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('product:deleted', { productId, product: deletedProduct });
            console.log('📡 [CONTROLLER] Evento de producto eliminado emitido');
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto eliminado correctamente',
            product: deletedProduct
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al eliminar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener producto por código de barras
exports.getProductByBarcode = async (req, res) => {
    try {
        const barcode = req.params.barcode;
        console.log(`🔍 [CONTROLLER] Buscando producto con código de barras: ${barcode}`);
        
        const product = await Product.findOne({ barcode: barcode });
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado con ese código de barras'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Producto encontrado',
            product: product
        });
        
    } catch (error) {
        console.error('💥 [CONTROLLER] Error al obtener producto por código de barras:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Función updateProductStock (la que ya tienes, corregida)
exports.updateProductStock = async (req, res) => {
    try {
        const productId = req.params.id;
        const { stock, stock_surtido } = req.body;

        console.log(`🔄 [CONTROLLER] Actualizando stock del producto ${productId}`);
        console.log(`📦 [CONTROLLER] Datos recibidos:`, { stock, stock_surtido });

        // Validaciones
        if (stock === undefined && stock_surtido === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere al menos un valor de stock para actualizar'
            });
        }

        const oldProduct = await Product.findById(productId);
        if (!oldProduct) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        // Preparar datos de actualización
        const updateData = {
            lastUpdated: new Date()
        };

        if (stock !== undefined) {
            const stockNumber = parseInt(stock);
            if (isNaN(stockNumber) || stockNumber < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El stock debe ser un número válido mayor o igual a 0'
                });
            }
            updateData.stock = stockNumber;
        }

        if (stock_surtido !== undefined) {
            const stockSurtidoNumber = parseInt(stock_surtido);
            if (isNaN(stockSurtidoNumber) || stockSurtidoNumber < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El stock surtido debe ser un número válido mayor o igual a 0'
                });
            }
            updateData.stock_surtido = stockSurtidoNumber;
        }

        // Calcular stock almacenado
        const finalStock = updateData.stock !== undefined ? updateData.stock : oldProduct.stock;
        const finalStockSurtido = updateData.stock_surtido !== undefined ? updateData.stock_surtido : oldProduct.stock_surtido;
        updateData.stock_almacenado = finalStock - finalStockSurtido;

        // Actualizar producto
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            {
                new: true,
                runValidators: true,
                lean: false
            }
        );

        // Emitir eventos al frontend
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.emit('product:stock-updated', {
                productId,
                oldStock: oldProduct.stock,
                newStock: updatedProduct.stock,
                product: updatedProduct
            });
            
            io.emit('product:updated', updatedProduct);
            
            console.log('📡 [CONTROLLER] Eventos emitidos al frontend');
        }

        // Registrar transacción si el stock cambió
        if (updateData.stock !== undefined && updateData.stock !== oldProduct.stock) {
            const transaction = new Transaction({
                productId: productId,
                type: 'sale',
                quantity: oldProduct.stock - updateData.stock,
                previousStock: oldProduct.stock,
                newStock: updateData.stock,
                userId: req.user ? req.user.id : null,
                notes: 'Salida de productos - Actualización de inventario'
            });

            await transaction.save();
        }

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
            error: error.message
        });
    }
};