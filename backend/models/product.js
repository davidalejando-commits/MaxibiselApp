//Modelo de producto
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sphere: {
        type: String,
        require: false,
        undefined: 'N',
        trim: true
    },
    cylinder: {
        type: String,
        require: false,
        undefined: '-',
        trim: true
    },
    addition: {
        type: String,
        require: false,
        undefinde: '-',
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    barcode: {
        type: String,
        unique: true,
        required: true
    },
    /*price: {
        type: Number,
        required: true,
        min: 0
    },*/
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

/* Método para generar un nombre completo del producto
productSchema.methods.getFullName = function () {
    const filters = this.filters.length > 0 ? ` con ${this.filters.join(', ')}` : '';
    return `${this.lensType} ${this.material}${filters}`;
};*/

// Índice para búsquedas más rápidas
productSchema.index({ name: 1 });
productSchema.index({ barcode: 1 });

module.exports = mongoose.model('Product', productSchema);