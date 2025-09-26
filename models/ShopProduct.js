const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Вложенная схема для управления размерами
const SizeInfo = new Schema({
    techSize: { type: String, required: true }, // Размер, например "42" или "S"
    isAvailable: { type: Boolean, default: true } // В наличии ли этот размер
});

const shopProductSchema = new Schema({
    nmID: { // Ключ для связи с коллекцией Cards
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    price: { // Наша собственная цена
        type: Number,
        required: true
    },
    sizes: [SizeInfo] // Массив размеров и их наличие
}, {
    timestamps: true
});

module.exports = mongoose.model('shop_product', shopProductSchema);