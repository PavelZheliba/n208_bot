// index.js
const mongoose = require('mongoose');
const { session, Scenes } = require('telegraf');
const bot = require('./bot');

// --- НАЧАЛО БЛОКА ИМПОРТОВ ---
const { cartScene } = require('./scenes/cartScene');
const { browseProductsScene } = require('./scenes/userScenes');
const { addProductWizard, createCategoryWizard, deleteProductWizard, manageProductWizard, viewCategoryWizard } = require('./scenes/adminScenes');
const { registerAdminHandlers } = require('./handlers/adminHandler');
const { registerUserHandlers } = require('./handlers/userHandler');

// ========================================================================
// ===                   ГЛАВНЫЙ ОТЛАДОЧНЫЙ БЛОК                      ===
// ========================================================================
// Мы снова проверим КАЖДУЮ импортированную сцену перед запуском.
console.log('--- ПРОВЕРКА ИМПОРТОВ СЦЕН (ПОПЫТКА №2) ---');
console.log(`[DEBUG] addProductWizard: ${!!addProductWizard}`);
console.log(`[DEBUG] createCategoryWizard: ${!!createCategoryWizard}`);
console.log(`[DEBUG] deleteProductWizard: ${!!deleteProductWizard}`);
console.log(`[DEBUG] manageProductWizard: ${!!manageProductWizard}`);
console.log(`[DEBUG] viewCategoryWizard: ${!!viewCategoryWizard}`);
console.log(`[DEBUG] browseProductsScene: ${!!browseProductsScene}`);
console.log(`[DEBUG] cartScene: ${!!cartScene}`);
console.log('--- ПРОВЕРКА ЗАВЕРШЕНА ---');
// ========================================================================


async function start() {
    try {
        // Подключение к БД
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB подключена.');

        // Собираем сцены в массив
        const scenes = [
            addProductWizard, createCategoryWizard, deleteProductWizard, manageProductWizard, viewCategoryWizard,
            browseProductsScene, cartScene
        ];

        // Проверяем массив на наличие undefined
        const sceneCheck = scenes.every(scene => scene !== undefined);
        if (!sceneCheck) {
            console.error('!!! ОБНАРУЖЕН UNDEFINED В МАССИВЕ СЦЕН. ЗАПУСК ПРЕРВАН !!!');
            // Мы уже вывели детальный лог выше, так что просто выходим
            process.exit(1);
        }

        const stage = new Scenes.Stage(scenes);

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



// // index.js
// const mongoose = require('mongoose');
// const { session, Scenes } = require('telegraf');
// const bot = require('./bot');
//
// // --- НАЧАЛО БЛОКА ИМПОРТОВ ---
// const { browseProductsScene } = require('./scenes/userScenes');
// const { addProductWizard, createCategoryWizard, deleteProductWizard, manageProductWizard, viewCategoryWizard } = require('./scenes/adminScenes');
// const { registerAdminHandlers } = require('./handlers/adminHandler');
// const { registerUserHandlers } = require('./handlers/userHandler');
// const cartScene = require('./scenes/cartScene');
//
// // ========================================================================
// // ===                   ГЛАВНЫЙ ОТЛАДОЧНЫЙ БЛОК                      ===
// // ========================================================================
// // Сейчас мы проверим КАЖДУЮ импортированную сцену перед запуском.
// console.log('--- ПРОВЕРКА ИМПОРТОВ СЦЕН ---');
// console.log('[DEBUG] addProductWizard:', addProductWizard);
// console.log('[DEBUG] createCategoryWizard:', createCategoryWizard);
// console.log('[DEBUG] deleteProductWizard:', deleteProductWizard);
// console.log('[DEBUG] manageProductWizard:', manageProductWizard);
// console.log('[DEBUG] viewCategoryWizard:', viewCategoryWizard);
// console.log('[DEBUG] browseProductsScene:', browseProductsScene);
// console.log('[DEBUG] cartScene:', cartScene);
// console.log('--- ПРОВЕРКА ЗАВЕРШЕНА ---');
// // ========================================================================
//
// async function start() {
//     try {
//         // Подключение к БД
//         await mongoose.connect(process.env.MONGO_URI);
//         console.log('MongoDB подключена.');
//
//         // Регистрация миддлверов
//         const stage = new Scenes.Stage([
//             // Сцены админа
//             addProductWizard,
//             createCategoryWizard,
//             deleteProductWizard,
//             manageProductWizard,
//             viewCategoryWizard,
//             // Сцены пользователя
//             browseProductsScene,
//             cartScene,
//         ]);
//
//         bot.use(session());
//         bot.use(stage.middleware());
//
//         // Регистрация наших обработчиков
//         registerAdminHandlers();
//         registerUserHandlers();
//
//         // Запуск бота
//         console.log('Запускаю бота...');
//         await bot.launch();
//
//         // Вежливая остановка
//         process.once('SIGINT', () => bot.stop('SIGINT'));
//         process.once('SIGTERM', () => bot.stop('SIGTERM'));
//     } catch (error) {
//         console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', error);
//     }
// }
//
// start();
