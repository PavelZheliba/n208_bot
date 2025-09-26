// /db.js
const mongoose = require('mongoose');
require('dotenv').config(); // Убедимся, что переменные окружения доступны

const connectDB = async () => {
    try {
        // Пытаемся подключиться к MongoDB используя строку из файла .env
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Подключение к MongoDB установлено...');
    } catch (err) {
        // Если произошла ошибка, выводим её в консоль и останавливаем приложение
        console.error('Ошибка подключения к MongoDB:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
