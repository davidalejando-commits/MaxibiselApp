const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/barcode/:barcode', productController.getProductByBarcode);

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/stock', productController.updateProductStock);
router.delete('/:id', productController.deleteProduct);

module.exports = router;