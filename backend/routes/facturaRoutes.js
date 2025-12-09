const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/facturaController');

// Crear factura
router.post('/', facturaController.createFactura);

// Obtener todas las facturas
router.get('/', facturaController.getAllFacturas);

// Obtener factura por ID
router.get('/:id', facturaController.getFacturaById);

// Actualizar factura
router.put('/:id', facturaController.updateFactura);

// Anular factura
router.patch('/:id/anular', facturaController.anularFactura);

module.exports = router;