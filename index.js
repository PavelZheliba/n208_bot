// index.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Scenes, session } = require('telegraf');
const bot = require('./bot');

// --- ИЗМЕНЕНИЕ ---
const { registerUserHandlers, showMainMenu } = require('./handlers/userHandler');
const { registerAdminHandlers } = require('./handlers/adminHandler');

// Импорт сцен и визардов
const { adminScene } = require('./scenes/adminScenes');
const { browseProductsScene } = require('./scenes/userScenes');
const { showCart, cartScene } = require('./scenes/cartScene');
const addProductWizard = require('./wizards/addProductWizard');
const addCategoryWizard = require('./wizards/addCategoryWizard');
const removeCategoryWizard = require('./wizards/removeCategoryWizard');
const manageProductsWizard = require('./wizards/manageProductsWizard');

async function start() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Успешное подключение к MongoDB');

        const stage = new Scenes.Stage([
            adminScene,
            browseProductsScene,
            cartScene,
            addProductWizard,
            addCategoryWizard,
            removeCategoryWizard,
            manageProductsWizard,
        ]);

        bot.use(session());
        bot.use(stage.middleware());

        bot.command('start', showMainMenu);
        bot.command('cart', (ctx) => showCart(ctx, true));

        bot.command('contacts', async (ctx) => {
            const contactMessage =
                ` <b>Наши контакты</b>\n\n` +
                `Если у вас возникли вопросы по заказам, наличию или сотрудничеству, вы можете связаться с нами любым удобным способом:\n\n` +
                `▪️ <b>📧 Email:</b> shop@n208.ru\n\n` +
                `▪️ <b>📞 Телефон:</b> <code>+7 (936) 208-208-2</code>\n` +
                `▪️ <b>🚀 Telegram магазина:</b> <a href="https://t.me/n208shop">@shop</a>\n` +
                `Мы работаем с 10:00 до 20:00 по Ижевскому времени.`;
            await ctx.replyWithHTML(contactMessage);
        });


        // Нажатие на "🗂 Каталог" запускает сцену просмотра товаров
        // bot.action('show_catalog', (ctx) => {
        //     // Убеждаемся, что выходим из текущей сцены, если она есть
        //     if (ctx.scene) {
        //         ctx.scene.leave();
        //     }
        //     return ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
        // });

        // Нажатие на "🛒 Корзина" вызывает функцию показа корзины
        // bot.action('view_cart', showCart);
        // bot.action('view_cart', async (ctx) => {
        //     try {
        //         await ctx.deleteMessage();
        //     } catch (e) {
        //         console.warn("Не удалось удалить сообщение, возможно, оно уже удалено.", e.message);
        //     }
        //     return showCart(ctx, true);
        // });


        // Нажатие на "ℹ️ Информация" показывает контакты
        // bot.action('show_info', async (ctx) => {
        //     await ctx.answerCbQuery();
        //     const infoMessage = `<b>О магазине</b>\n\nЗдесь вы можете разместить информацию о вашем магазине, условиях доставки, оплаты и т.д.`;
        //     await ctx.replyWithHTML(infoMessage);
        // });

        // Регистрация остальных обработчиков
        registerUserHandlers();
        registerAdminHandlers();

        bot.launch();
        console.log('Бот запущен');

        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

    } catch (e) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', e);
    }
}

start();





// // index.js
// require('dotenv').config();
// const mongoose = require('mongoose');
// const { Markup } = require('telegraf');
// const { Scenes, session } = require('telegraf');
// const bot = require('./bot');
// const { registerUserHandlers } = require('./handlers/userHandler');
// const { registerAdminHandlers } = require('./handlers/adminHandler');
//
// // Импорт сцен и визардов
// const { adminScene } = require('./scenes/adminScenes');
// const { browseProductsScene } = require('./scenes/userScenes');
// const { showCart, cartScene } = require('./scenes/cartScene');
// const addProductWizard = require('./wizards/addProductWizard');
// const addCategoryWizard = require('./wizards/addCategoryWizard');
// const removeCategoryWizard = require('./wizards/removeCategoryWizard');
// const manageProductsWizard = require('./wizards/manageProductsWizard');
//
// async function start() {
//     try {
//         await mongoose.connect(process.env.MONGO_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });
//         console.log('Успешное подключение к MongoDB');
//
//         // Регистрация всех сцен и визардов
//         const stage = new Scenes.Stage([
//             adminScene,
//             browseProductsScene,
//             cartScene,
//             addProductWizard,
//             addCategoryWizard,
//             removeCategoryWizard,
//             manageProductsWizard,
//         ]);
//
//         bot.use(session());
//         bot.use(stage.middleware());
//
//
//         bot.command('start', async (ctx) => {
//
//
//             await ctx.reply(
//                 'Добро пожаловать в наш магазин! 👋\n\nВыберите интересующий вас раздел:',
//                 Markup.keyboard([
//                     ['Каталог 🛍️'], // Кнопка в первом ряду
//                     ['Корзина 🛒', 'Контакты 📞'] // Две кнопки во втором ряду
//                 ]).resize() // Делает кнопки более компактными
//             );
//         });
//
//         bot.hears('Каталог 🛍️', (ctx) => {
//             return ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
//         });
//
//         // bot.command('start', (ctx) => {
//         //     return ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
//         // });
//         //
//
//
//         bot.command('cart', showCart);
//
//         bot.command('contacts', async (ctx) => {
//             const contactMessage =
//                 ` <b>Наши контакты</b>\n\n` +
//                 `Если у вас возникли вопросы по заказам, наличию или сотрудничеству, вы можете связаться с нами любым удобным способом:\n\n` +
//                 `▪️ <b>📧 Email:</b> shop@n208.ru\n\n` +
//                 `▪️ <b>📞 Телефон:</b> <code>+7 (936) 208-208-2</code>\n` +
//                 `▪️ <b>🚀 Telegram магазина:</b> <a href="https://t.me/n208shop">@shop</a>\n` +
//                 `Мы работаем с 10:00 до 20:00 по Ижевскому времени.`;
//             await ctx.replyWithHTML(contactMessage);
//         });
//
//         // ===============================================================
//
//         // Регистрация остальных обработчиков
//         registerUserHandlers();
//         registerAdminHandlers();
//
//         bot.launch();
//         console.log('Бот запущен');
//
//         process.once('SIGINT', () => bot.stop('SIGINT'));
//         process.once('SIGTERM', () => bot.stop('SIGTERM'));
//
//     } catch (e) {
//         console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', e);
//     }
// }
//
// start();
//
//
//
// // // index.js
// // require('dotenv').config();
// // const mongoose = require('mongoose');
// // const { Scenes, session } = require('telegraf');
// // const bot = require('./bot');
// // const { registerUserHandlers } = require('./handlers/userHandler');
// // const { registerAdminHandlers } = require('./handlers/adminHandler');
// //
// // // Импорт сцен и визардов
// // const { adminScene } = require('./scenes/adminScenes');
// // const { browseProductsScene } = require('./scenes/userScenes');
// // const { showCart, cartScene } = require('./scenes/cartScene');
// // const addProductWizard = require('./wizards/addProductWizard');
// // const addCategoryWizard = require('./wizards/addCategoryWizard');
// // const removeCategoryWizard = require('./wizards/removeCategoryWizard');
// // const manageProductsWizard = require('./wizards/manageProductsWizard');
// //
// // async function start() {
// //     try {
// //         await mongoose.connect(process.env.MONGO_URI, {
// //             useNewUrlParser: true,
// //             useUnifiedTopology: true,
// //         });
// //         console.log('Успешное подключение к MongoDB');
// //
// //         // Регистрация всех сцен и визардов
// //         const stage = new Scenes.Stage([
// //             adminScene,
// //             browseProductsScene,
// //             cartScene,
// //             addProductWizard,
// //             addCategoryWizard,
// //             removeCategoryWizard,
// //             manageProductsWizard,
// //         ]);
// //
// //         bot.use(session());
// //         bot.use(stage.middleware());
// //
// //         registerUserHandlers();
// //         registerAdminHandlers();
// //
// //         bot.launch();
// //         console.log('Бот запущен');
// //
// //         process.once('SIGINT', () => bot.stop('SIGINT'));
// //         process.once('SIGTERM', () => bot.stop('SIGTERM'));
// //
// //     } catch (e) {
// //         console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', e);
// //     }
// // }
// //
// // start();
