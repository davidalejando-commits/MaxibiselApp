const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Product = require('../models/product');

router.get('/', async (req, res) => {
    try {
        const { productId, type, startDate, endDate } = req.query;

        const filter = {};

        if (productId) filter.productId = productId;
        if (type) filter.type = type;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(filter)
            .populate('productId', 'name barcode')
            .populate('userId', 'username fullName')
            .sort({ createdAt: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener transacciones', error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { productId, type, quantity, notes } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        let newStock = product.stock;

        if (type === 'purchase') {
            newStock += quantity;
        } else if (type === 'sale') {
            if (product.stock < quantity) {
                return res.status(400).json({ message: 'Stock insuficiente' });
            }
            newStock -= quantity;
        } else if (type === 'adjustment') {
            newStock = quantity;
        }

        const transaction = new Transaction({
            productId,
            type,
            quantity: type === 'adjustment' ? newStock - product.stock : quantity,
            previousStock: product.stock,
            newStock,
            userId: req.user.id,
            notes
        });

        await transaction.save();


        product.stock = newStock;
        product.lastUpdated = Date.now();
        await product.save();

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('productId', 'name barcode')
            .populate('userId', 'username fullName');

        res.status(201).json(populatedTransaction);
    } catch (error) {
        res.status(400).json({ message: 'Error al registrar transacción', error: error.message });
    }
});

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