// backend/models/remision.js
const mongoose = require('mongoose');

const remisionSchema = new mongoose.Schema({
    // Información de la empresa
    empresa: {
        nombre: { type: String, required: true },
        nit: { type: String, required: true },
        direccion: { type: String, required: true },
        telefono: { type: String },
        email: { type: String },
        logo: { type: String }
    },
    
    // Número consecutivo
    numeroRemision: {
        type: String,
        required: true,
        unique: true
    },
    
    // Cliente
    cliente: {
        nombre: { type: String, required: true },
        documento: { type: String },
        telefono: { type: String },
        direccion: { type: String }
    },
    
    // Productos
    productos: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        nombre: { type: String, required: true },
        descripcion: { type: String },
        cantidad: { type: Number, required: true, min: 1 },
        precioUnitario: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true }
    }],
    
    // Totales
    subtotal: { type: Number, required: true },
    descuento: { type: Number, default: 0 },
    iva: { type: Number, default: 0 },
    total: { type: Number, required: true },
    
    // Metadata
    observaciones: { type: String },
    fechaEmision: { type: Date, default: Date.now },
    creadoPor: { type: String },
    estado: { 
        type: String, 
        enum: ['pendiente', 'entregada', 'anulada'],
        default: 'pendiente'
    },
    salidaId: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware para actualizar fecha
remisionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Índices para búsquedas rápidas
remisionSchema.index({ numeroRemision: 1 });
remisionSchema.index({ 'cliente.nombre': 1 });
remisionSchema.index({ fechaEmision: -1 });

module.exports = mongoose.model('Remision', remisionSchema);