// backend/routes/remisionRoutes.js
const express = require('express');
const router = express.Router();
const remisionController = require('../controllers/remisionController');

// Crear remisión
router.post('/', remisionController.createRemision);

// Obtener todas las remisiones
router.get('/', remisionController.getAllRemisiones);

// Obtener remisión por ID
router.get('/:id', remisionController.getRemisionById);

// Actualizar remisión
router.put('/:id', remisionController.updateRemision);

// Eliminar remisión
router.delete('/:id', remisionController.deleteRemision);

module.exports = router;