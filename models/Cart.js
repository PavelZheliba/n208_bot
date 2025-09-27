// /models/Cart.js
const { Schema, model } = require('mongoose');

const itemSchema = new Schema({
    nmID: { type: Number, required: true },
    optionId: { type: Number, required: true }, // Уникальный ID размера от WB
    sizeName: { type: String, required: true }, // Название размера для показа ("S", "42-44", etc.)
    quantity: { type: Number, required: true, default: 1 }
}, { _id: false });

const cartSchema = new Schema({
    telegramId: { type: Number, required: true, unique: true },
    items: [itemSchema]
});

module.exports = model('Cart', cartSchema);


// // /models/Cart.js
// const { Schema, model } = require('mongoose');
//
// const CartSchema = new Schema({
//     // ID пользователя в Telegram, чтобы знать, чья это корзина
//     telegramId: {
//         type: Number,
//         required: true,
//         unique: true, // У каждого пользователя только одна корзина
//         index: true
//     },
//     // Массив товаров в корзине
//     items: [{
//         nmID: {
//             type: Number,
//             required: true
//         },
//         quantity: {
//             type: Number,
//             required: true,
//             default: 1
//         }
//     }]
// }, { timestamps: true });
//
// module.exports = model('Cart', CartSchema);
