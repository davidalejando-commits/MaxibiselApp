const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    type: {
        type: String,
        enum: ['purchase', 'sale', 'adjustment', 'return'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false 
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true 
});

transactionSchema.index({ productId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ userId: 1 });

transactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

transactionSchema.methods.toJSON = function() {
    const transaction = this.toObject();
    return transaction;
};

transactionSchema.statics.getByProduct = function(productId, limit = 10) {
    return this.find({ productId })
        .populate('userId', 'username fullName')
        .sort({ createdAt: -1 })
        .limit(limit);
};

transactionSchema.statics.getByDateRange = function(startDate, endDate) {
    return this.find({
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    })
        .populate('productId', 'name barcode')
        .populate('userId', 'username fullName')
        .sort({ createdAt: -1 });
};

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;