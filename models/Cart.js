// /models/Cart.js
const { Schema, model } = require('mongoose');

const CartSchema = new Schema({
    // ID пользователя в Telegram, чтобы знать, чья это корзина
    telegramId: {
        type: Number,
        required: true,
        unique: true, // У каждого пользователя только одна корзина
        index: true
    },
    // Массив товаров в корзине
    items: [{
        nmID: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        }
    }]
}, { timestamps: true });

module.exports = model('Cart', CartSchema);
