// /models/ShopProduct.js
const { Schema, model } = require('mongoose');

// Вложенная схема для размеров внутри товара магазина
const sizeSchema = new Schema({
    // ======================= ИЗМЕНЕНИЕ =======================
    sku: { type: String, required: true },  // баркод
    name: { type: String, required: true }, // Это techSize, который видит пользователь
    amount: { type: Number, default: 0 }
}, { _id: false });

const shopProductSchema = new Schema({
    nmID: { type: Number, required: true, unique: true },
    price: { type: Number, required: true },
    active: { type: Boolean, default: true },
    sizes: [sizeSchema]
});

module.exports = model('ShopProduct', shopProductSchema, 'shop_products');

// module.exports = model('ShopProduct', shopProductSchema);
