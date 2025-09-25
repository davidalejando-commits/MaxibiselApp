//Rutas para transacciones
const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Product = require('../models/product');

// Obtener todas las transacciones
router.get('/', async (req, res) => {
    try {
        // Parámetros de consulta para filtrado
        const { productId, type, startDate, endDate } = req.query;

        // Construir filtro
        const filter = {};

        if (productId) filter.productId = productId;
        if (type) filter.type = type;

        // Filtro por rango de fechas
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Obtener transacciones con referencias populadas
        const transactions = await Transaction.find(filter)
            .populate('productId', 'name barcode')
            .populate('userId', 'username fullName')
            .sort({ createdAt: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener transacciones', error: error.message });
    }
});

// Registrar nueva transacción
router.post('/', async (req, res) => {
    try {
        const { productId, type, quantity, notes } = req.body;

        // Verificar que el producto exista
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Calcular nuevo stock
        let newStock = product.stock;

        if (type === 'purchase') {
            // Compra: aumenta el stock
            newStock += quantity;
        } else if (type === 'sale') {
            // Venta: reduce el stock
            if (product.stock < quantity) {
                return res.status(400).json({ message: 'Stock insuficiente' });
            }
            newStock -= quantity;
        } else if (type === 'adjustment') {
            // Ajuste: se establece directamente
            newStock = quantity;
        }

        // Crear la transacción
        const transaction = new Transaction({
            productId,
            type,
            quantity: type === 'adjustment' ? newStock - product.stock : quantity,
            previousStock: product.stock,
            newStock,
            userId: req.user.id,
            notes
        });

        // Guardar la transacción
        await transaction.save();

        // Actualizar el stock del producto
        product.stock = newStock;
        product.lastUpdated = Date.now();
        await product.save();

        // Obtener la transacción con referencias populadas
        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('productId', 'name barcode')
            .populate('userId', 'username fullName');

        res.status(201).json(populatedTransaction);
    } catch (error) {
        res.status(400).json({ message: 'Error al registrar transacción', error: error.message });
    }
});

// Obtener transacción por ID
router.get('/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('productId', 'name barcode')
            .populate('userId', 'username fullName');

        if (!transaction) {
            return res.status(404).json({ message: 'Transacción no encontrada' });
        }

        res.status(200).json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener transacción', error: error.message });
    }
});

module.exports = router;