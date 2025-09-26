const mongoose = require('mongoose');
const { session, Scenes } = require('telegraf');
const bot = require('./bot');
const { browseProductsScene } = require('./scenes/userScenes');
const { addProductWizard, createCategoryWizard, deleteProductWizard, manageProductWizard, viewCategoryWizard  } = require('./scenes/adminScenes');
const { registerAdminHandlers } = require('./handlers/adminHandler');
const { registerUserHandlers } = require('./handlers/userHandler');
const { cartScene } = require('./scenes/cartScene');


async function start() {
    try {
        // Подключение к БД
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB подключена.');

        // Регистрация миддлверов (промежуточных обработчиков)
        const stage = new Scenes.Stage([
            // Сцены админа
            addProductWizard,
            createCategoryWizard,
            deleteProductWizard,
            manageProductWizard,
            viewCategoryWizard,
            // Сцены пользователя
            browseProductsScene,
            cartScene, // <-- ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем сцену корзины в Stage
        ]);

        bot.use(session());
        bot.use(stage.middleware());

        // Регистрация наших обработчиков
        registerAdminHandlers();
        registerUserHandlers();

        // Запуск бота
        console.log('Запускаю бота...');
        await bot.launch();

        // Вежливая остановка
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', error);
    }
}

start();
