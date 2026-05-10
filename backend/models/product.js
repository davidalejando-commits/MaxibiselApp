const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sphere: {
        type: String,
        required: false,
        default: 'N',
        trim: true
    },
    cylinder: {
        type: String,
        required: false,
        default: '-',
        trim: true
    },
    addition: {
        type: String,
        required: false,
        default: '-',
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        
    },
    stock_surtido: {
        type: Number,
        required: true,
        default: 0,
        
    },
    stock_almacenado: {
        type: Number,
        required: true,
        default: 0,
        
    },
    barcode: {
        type: String,
        unique: true,
        required: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


productSchema.index({ name: 1 });
productSchema.index({ barcode: 1 });

productSchema.pre('save', function (next) {
    if (this.stock_surtido === undefined) this.stock_surtido = 0;
    if (this.stock_almacenado === undefined) this.stock_almacenado = this.stock;

    if (this.isNew && this.stock_surtido === 0 && this.stock_almacenado === 0) {
        this.stock_almacenado = this.stock;
    }

    const total = (this.stock_surtido || 0) + (this.stock_almacenado || 0);
    if (total !== this.stock) {
        const error = new Error(
            `❌ Inconsistencia en stock para ${this.name}: ` +
            `surtido(${this.stock_surtido}) + almacenado(${this.stock_almacenado}) = ${total} ≠ total(${this.stock})`
        );
        return next(error);
    }

    next();
});

productSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();

    if (update.$set || update) {
        const updateData = update.$set || update;
        const stock = updateData.stock;
        const stockSurtido = updateData.stock_surtido;
        const stockAlmacenado = updateData.stock_almacenado;

        if (stock !== undefined && stockSurtido !== undefined && stockAlmacenado !== undefined) {
            if (stockSurtido + stockAlmacenado !== stock) {
                const error = new Error(
                    `❌ Inconsistencia en actualización: surtido(${stockSurtido}) + almacenado(${stockAlmacenado}) ≠ total(${stock})`
                );
                return next(error);
            }
        }
    }

    next();
});

module.exports = mongoose.model('Product', productSchema);