const mongoose = require('mongoose');

const facturaSchema = new mongoose.Schema({
    empresa: {
        nombre: { type: String, required: true, default: 'MAXI BISEL' },
        nit: { type: String, required: true },
        direccion: { type: String, required: true },
        telefono: { type: String },
        email: { type: String },
        logo: { type: String }
    },
    
    numeroFactura: {
        type: String,
        required: true,
        unique: true
    },
    
    cliente: {
        nombre: { type: String, required: true },
        documento: { type: String },
        telefono: { type: String },
        direccion: { type: String },
        email: { type: String }
    },
    
    productos: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        nombre: { type: String, required: true },
        descripcion: { type: String },
        esfera: { type: String },
        cilindro: { type: String },
        adicion: { type: String },
        cantidad: { type: Number, required: true, min: 1 },
        precioUnitario: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true }
    }],

    subtotal: { type: Number, required: true },
    descuento: { type: Number, default: 0 },
    iva: { type: Number, default: 0 },
    total: { type: Number, required: true },

    observaciones: { type: String },
    fechaEmision: { type: Date, default: Date.now },
    creadoPor: { type: String },
    estado: { 
        type: String, 
        enum: ['pagada', 'pendiente', 'anulada'],
        default: 'pendiente'
    },
   
    salidaId: { type: String },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

facturaSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

facturaSchema.index({ numeroFactura: 1 });
facturaSchema.index({ 'cliente.nombre': 1 });
facturaSchema.index({ fechaEmision: -1 });

module.exports = mongoose.model('Factura', facturaSchema);