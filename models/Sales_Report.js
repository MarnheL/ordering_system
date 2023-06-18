const mongoose = require('mongoose')

const salesReportSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    product_name: {
        type: String,
    },
    product_quantity: {
        type: Number
    },
    sub_total: {
        type: Number,
    },
    img_name: {
        type: String,
    },
    image: {
        data: Buffer,
        contentType: String,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    }
})

const Sales = mongoose.model('Sales', salesReportSchema)
module.exports = Sales;