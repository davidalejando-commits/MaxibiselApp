//Rutas para productos
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Rutas para gestión de productos
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.patch('/:id/stock', productController.updateProductStock);

module.exports = router;