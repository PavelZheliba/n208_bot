// models/ShopCategory.js
const mongoose = require('mongoose');

const shopCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    product_nmIDs: [{ type: Number }]
}, { timestamps: true });

module.exports = mongoose.model('shop_category', shopCategorySchema);