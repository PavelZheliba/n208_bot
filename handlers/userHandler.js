// /handlers/userHandler.js
const { Markup, Input } = require('telegraf');
const bot = require('../bot');
const ShopCategory = require('../models/ShopCategory');
const Cart = require('../models/Cart');

// ========================================================================
// ===                   ИЗМЕНЕНИЕ №1: Улучшаем функцию               ===
// ========================================================================
// Добавляем второй параметр 'forceReply', по умолчанию он false
async function showMainMenu(ctx, forceReply = false) {
    const logoPath = './assets/full_logo.png';
    const message = 'Добро пожаловать в наш магазин!';
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🗂 Каталог', 'show_catalog')],
        [Markup.button.callback('🛒 Корзина', 'view_cart')],
        [Markup.button.callback('ℹ️ Информация', 'show_info')]
    ]);
    try {
        const photo = Input.fromLocalFile(logoPath);
        // Теперь мы редактируем сообщение, только если это callback И forceReply НЕ установлен в true
        if (ctx.callbackQuery && !forceReply) {
            await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
        } else {
            await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
        }
    } catch (e) {
        // Защита от ошибки, если сообщение уже было изменено или удалено
        if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {} else {
            console.error('Ошибка при показе главного меню:', e);
        }
    }
}


function registerUserHandlers() {
    // Прослушку можно убрать, но пусть пока будет, она не мешает.
    bot.on('callback_query', (ctx, next) => {
        console.log(`[userHandler.js | ПРОСЛУШКА] Получено нажатие кнопки. DATA: >>>${ctx.callbackQuery.data}<<<`);
        return next();
    });

    bot.start(showMainMenu);

    // ========================================================================
    // ===                 ИЗМЕНЕНИЕ №2: Обновляем обработчик             ===
    // ========================================================================
    bot.action('back_to_main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        if (ctx.scene && ctx.scene.current) {
            await ctx.scene.leave();
        }
        try {
            // Удаляем сообщение, на котором была кнопка "Главное меню"
            await ctx.deleteMessage();
        } catch (e) {
            console.warn("Не удалось удалить сообщение при возврате в меню (возможно, оно уже удалено).", e.message);
        }
        // Вызываем главное меню с флагом forceReply: true, чтобы оно отправилось новым сообщением
        await showMainMenu(ctx, true);
    });

    bot.action('show_catalog', async (ctx) => {
        await ctx.answerCbQuery();
        const categories = await ShopCategory.find({});
        const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
        buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
        const keyboard = Markup.inlineKeyboard(buttons);
        await ctx.editMessageCaption('Выберите категорию:', keyboard);
    });

    bot.action(/^select_category:(.+)$/, async (ctx) => {
        console.log('[userHandler.js | ACTION] Обработчик select_category сработал!');
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
        const categoryCode = ctx.match[1];

        console.log(`[userHandler.js] Передаем в сцену categoryCode: >>>${categoryCode}<<<`);

        await ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
    });

    bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
        const nmID = parseInt(ctx.match[1], 10);
        const telegramId = ctx.from.id;
        try {
            let cart = await Cart.findOne({ telegramId });
            if (!cart) {
                cart = new Cart({ telegramId, items: [] });
            }
            const itemIndex = cart.items.findIndex(item => item.nmID === nmID);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += 1;
            } else {
                cart.items.push({ nmID, quantity: 1 });
            }
            await cart.save();
            await ctx.answerCbQuery('✅ Добавлено в корзину!');
        } catch (error) {
            console.error('Ошибка добавления в корзину:', error);
            await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
        }
    });

    bot.action('view_cart', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
        await ctx.scene.enter('CART_SCENE');
    });
}

module.exports = { registerUserHandlers, showMainMenu };



// // /handlers/userHandler.js
// const { Markup, Input } = require('telegraf');
// const bot = require('../bot');
// const ShopCategory = require('../models/ShopCategory');
// const Cart = require('../models/Cart');
//
// async function showMainMenu(ctx) {
//     const logoPath = './assets/full_logo.png';
//     const message = 'Добро пожаловать в наш магазин!';
//     const keyboard = Markup.inlineKeyboard([
//         [Markup.button.callback('🗂 Каталог', 'show_catalog')],
//         [Markup.button.callback('🛒 Корзина', 'view_cart')],
//         [Markup.button.callback('ℹ️ Информация', 'show_info')]
//     ]);
//     try {
//         const photo = Input.fromLocalFile(logoPath);
//         if (ctx.callbackQuery) {
//             await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
//         } else {
//             await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
//         }
//     } catch (e) {
//         if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {} else {
//             console.error('Ошибка при показе главного меню:', e);
//         }
//     }
// }
//
//
// function registerUserHandlers() {
//     // Этот код больше не нужен для отладки, но пусть пока останется, он не мешает
//     bot.on('callback_query', (ctx, next) => {
//         console.log(`[userHandler.js | ПРОСЛУШКА] Получено нажатие кнопки. DATA: >>>${ctx.callbackQuery.data}<<<`);
//         return next();
//     });
//
//     bot.start(showMainMenu);
//
//     bot.action('back_to_main_menu', async (ctx) => {
//         await ctx.answerCbQuery();
//         if (ctx.scene && ctx.scene.current) {
//             await ctx.scene.leave();
//         }
//         await showMainMenu(ctx);
//     });
//
//     bot.action('show_catalog', async (ctx) => {
//         await ctx.answerCbQuery();
//         const categories = await ShopCategory.find({});
//         const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
//         buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
//         const keyboard = Markup.inlineKeyboard(buttons);
//         await ctx.editMessageCaption('Выберите категорию:', keyboard);
//     });
//
//     bot.action(/^select_category:(.+)$/, async (ctx) => {
//         console.log('[userHandler.js | ACTION] Обработчик select_category сработал!');
//         await ctx.answerCbQuery();
//         await ctx.deleteMessage();
//         const categoryCode = ctx.match[1];
//
//         console.log(`[userHandler.js] Передаем в сцену categoryCode: >>>${categoryCode}<<<`);
//
//         // ========================================================================
//         // ===                       ГЛАВНОЕ ИСПРАВЛЕНИЕ                      ===
//         // ========================================================================
//         // НЕПРАВИЛЬНО: ctx.scene.state.categoryCode = categoryCode;
//         // ПРАВИЛЬНО: Передаем state вторым аргументом в .enter()
//         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
//         // ========================================================================
//     });
//
//     bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
//         const nmID = parseInt(ctx.match[1], 10);
//         const telegramId = ctx.from.id;
//         try {
//             let cart = await Cart.findOne({ telegramId });
//             if (!cart) {
//                 cart = new Cart({ telegramId, items: [] });
//             }
//             const itemIndex = cart.items.findIndex(item => item.nmID === nmID);
//             if (itemIndex > -1) {
//                 cart.items[itemIndex].quantity += 1;
//             } else {
//                 cart.items.push({ nmID, quantity: 1 });
//             }
//             await cart.save();
//             await ctx.answerCbQuery('✅ Добавлено в корзину!');
//         } catch (error) {
//             console.error('Ошибка добавления в корзину:', error);
//             await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
//         }
//     });
//
//     bot.action('view_cart', async (ctx) => {
//         await ctx.answerCbQuery();
//         await ctx.deleteMessage();
//         await ctx.scene.enter('CART_SCENE');
//     });
// }
//
// module.exports = { registerUserHandlers, showMainMenu };
//
//
// // // /handlers/userHandler.js
// // const { Markup, Input } = require('telegraf');
// // const bot = require('../bot');
// // const ShopCategory = require('../models/ShopCategory');
// // const Cart = require('../models/Cart');
// //
// // async function showMainMenu(ctx) {
// //     const logoPath = './assets/full_logo.png';
// //     const message = 'Добро пожаловать в наш магазин!';
// //     const keyboard = Markup.inlineKeyboard([
// //         [Markup.button.callback('🗂 Каталог', 'show_catalog')],
// //         [Markup.button.callback('🛒 Корзина', 'view_cart')],
// //         [Markup.button.callback('ℹ️ Информация', 'show_info')]
// //     ]);
// //     try {
// //         const photo = Input.fromLocalFile(logoPath);
// //         if (ctx.callbackQuery) {
// //             await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
// //         } else {
// //             await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
// //         }
// //     } catch (e) {
// //         if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {} else {
// //             console.error('Ошибка при показе главного меню:', e);
// //         }
// //     }
// // }
// //
// //
// // function registerUserHandlers() {
// //
// //     // ========================================================================
// //     // ===                 ГЛАВНЫЙ ОТЛАДОЧНЫЙ БЛОК                         ===
// //     // ========================================================================
// //     // Этот код перехватит ЛЮБОЕ нажатие инлайн-кнопки
// //     bot.on('callback_query', (ctx, next) => {
// //         console.log(`[userHandler.js | ПРОСЛУШКА] Получено нажатие кнопки. DATA: >>>${ctx.callbackQuery.data}<<<`);
// //         // next() передает управление дальше, другим обработчикам
// //         return next();
// //     });
// //     // ========================================================================
// //
// //
// //     bot.start(showMainMenu);
// //
// //     bot.action('back_to_main_menu', async (ctx) => {
// //         await ctx.answerCbQuery();
// //         if (ctx.scene && ctx.scene.current) {
// //             await ctx.scene.leave();
// //         }
// //         await showMainMenu(ctx);
// //     });
// //
// //     bot.action('show_catalog', async (ctx) => {
// //         await ctx.answerCbQuery();
// //         const categories = await ShopCategory.find({});
// //         const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
// //         buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
// //         const keyboard = Markup.inlineKeyboard(buttons);
// //         await ctx.editMessageCaption('Выберите категорию:', keyboard);
// //     });
// //
// //     bot.action(/^select_category:(.+)$/, async (ctx) => {
// //         console.log('[userHandler.js | ACTION] Обработчик select_category сработал!'); // Добавили лог сюда
// //         await ctx.answerCbQuery();
// //         await ctx.deleteMessage();
// //         const categoryCode = ctx.match[1];
// //
// //         console.log(`[userHandler.js] Передаем в сцену categoryCode: >>>${categoryCode}<<<`);
// //
// //         ctx.scene.state.categoryCode = categoryCode;
// //         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
// //     });
// //
// //     bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
// //         const nmID = parseInt(ctx.match[1], 10);
// //         const telegramId = ctx.from.id;
// //         try {
// //             let cart = await Cart.findOne({ telegramId });
// //             if (!cart) {
// //                 cart = new Cart({ telegramId, items: [] });
// //             }
// //             const itemIndex = cart.items.findIndex(item => item.nmID === nmID);
// //             if (itemIndex > -1) {
// //                 cart.items[itemIndex].quantity += 1;
// //             } else {
// //                 cart.items.push({ nmID, quantity: 1 });
// //             }
// //             await cart.save();
// //             await ctx.answerCbQuery('✅ Добавлено в корзину!');
// //         } catch (error) {
// //             console.error('Ошибка добавления в корзину:', error);
// //             await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
// //         }
// //     });
// //
// //     bot.action('view_cart', async (ctx) => {
// //         await ctx.answerCbQuery();
// //         await ctx.deleteMessage();
// //         await ctx.scene.enter('CART_SCENE');
// //     });
// // }
// //
// // module.exports = { registerUserHandlers, showMainMenu };
// //
// //
// //
// // // // /handlers/userHandler.js
// // // const { Markup, Input } = require('telegraf'); // <-- Добавляем Input для работы с локальными файлами
// // // const bot = require('../bot');
// // // const ShopCategory = require('../models/ShopCategory');
// // // const Cart = require('../models/Cart');
// // //
// // // async function showMainMenu(ctx) {
// // //     // --- ИСПРАВЛЕНО: Возвращаем ваш локальный путь к логотипу ---
// // //     const logoPath = './assets/full_logo.png';
// // //     const message = 'Добро пожаловать в наш магазин!';
// // //     const keyboard = Markup.inlineKeyboard([
// // //         [Markup.button.callback('🗂 Каталог', 'show_catalog')],
// // //         [Markup.button.callback('🛒 Корзина', 'view_cart')],
// // //         [Markup.button.callback('ℹ️ Информация', 'show_info')]
// // //     ]);
// // //
// // //     try {
// // //         const photo = Input.fromLocalFile(logoPath); // <-- Правильно готовим файл для отправки
// // //
// // //         if (ctx.callbackQuery) {
// // //             // Редактируем сообщение, заменяя медиа и подпись
// // //             await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
// // //         } else {
// // //             // Отправляем новое сообщение с фото
// // //             await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
// // //         }
// // //     } catch (e) {
// // //         if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {
// // //             // Игнорируем эту ошибку
// // //         } else {
// // //             console.error('Ошибка при показе главного меню:', e);
// // //         }
// // //     }
// // // }
// // //
// // // function registerUserHandlers() {
// // //     bot.start(showMainMenu);
// // //
// // //     bot.action('back_to_main_menu', async (ctx) => {
// // //         await ctx.answerCbQuery();
// // //         if (ctx.scene && ctx.scene.current) {
// // //             await ctx.scene.leave();
// // //         }
// // //         await showMainMenu(ctx);
// // //     });
// // //
// // //     bot.action('show_catalog', async (ctx) => {
// // //         await ctx.answerCbQuery();
// // //         const categories = await ShopCategory.find({});
// // //         const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
// // //         buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
// // //         const keyboard = Markup.inlineKeyboard(buttons);
// // //         await ctx.editMessageCaption('Выберите категорию:', keyboard);
// // //     });
// // //
// // //     bot.action(/^select_category:(.+)$/, async (ctx) => {
// // //         await ctx.answerCbQuery();
// // //         await ctx.deleteMessage();
// // //         const categoryCode = ctx.match[1];
// // //         ctx.scene.state.categoryCode = categoryCode;
// // //         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
// // //     });
// // //
// // //     // --- ОБРАБОТЧИК ДОБАВЛЕНИЯ В КОРЗИНУ (тот же, что и раньше) ---
// // //     bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
// // //         const nmID = parseInt(ctx.match[1], 10);
// // //         const telegramId = ctx.from.id;
// // //         try {
// // //             let cart = await Cart.findOne({ telegramId });
// // //             if (!cart) {
// // //                 cart = new Cart({ telegramId, items: [] });
// // //             }
// // //             const itemIndex = cart.items.findIndex(item => item.nmID === nmID);
// // //             if (itemIndex > -1) {
// // //                 cart.items[itemIndex].quantity += 1;
// // //             } else {
// // //                 cart.items.push({ nmID, quantity: 1 });
// // //             }
// // //             await cart.save();
// // //             await ctx.answerCbQuery('✅ Добавлено в корзину!');
// // //         } catch (error) {
// // //             console.error('Ошибка добавления в корзину:', error);
// // //             await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
// // //         }
// // //     });
// // //
// // //     // --- ОБРАБОТЧИК ДЛЯ КНОПКИ "КОРЗИНА" (тот же, что и раньше) ---
// // //     bot.action('view_cart', async (ctx) => {
// // //         await ctx.answerCbQuery();
// // //         await ctx.deleteMessage();
// // //         await ctx.scene.enter('CART_SCENE');
// // //     });
// // // }
// // //
// // // module.exports = { registerUserHandlers, showMainMenu };
// // //
// // //
// // //
// // //
// // // // // /handlers/userHandler.js
// // // // const { Markup } = require('telegraf');
// // // // const bot = require('../bot');
// // // // const ShopCategory = require('../models/ShopCategory');
// // // // const Cart = require('../models/Cart'); // <-- 1. Импортируем модель Корзины
// // // //
// // // // // Ваша функция для главного меню. Оставляем ее без изменений.
// // // // async function showMainMenu(ctx) {
// // // //     const logoUrl = './assets/full_logo.png';
// // // //     const message = 'Добро пожаловать в наш магазин!';
// // // //     const keyboard = Markup.inlineKeyboard([
// // // //         [Markup.button.callback('🗂 Каталог', 'show_catalog')],
// // // //         [Markup.button.callback('🛒 Корзина', 'view_cart')],
// // // //         [Markup.button.callback('ℹ️ Информация', 'show_info')]
// // // //     ]);
// // // //
// // // //     try {
// // // //         if (ctx.callbackQuery) {
// // // //             // Если это колбэк, редактируем сообщение, чтобы не было дублей
// // // //             await ctx.editMessageMedia({ type: 'photo', media: logoUrl, caption: message }, keyboard);
// // // //         } else {
// // // //             // Если это /start, отправляем новое сообщение
// // // //             await ctx.replyWithPhoto(logoUrl, { caption: message, reply_markup: keyboard.reply_markup });
// // // //         }
// // // //     } catch (e) {
// // // //         if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {
// // // //             // Игнорируем ошибку, если сообщение не изменилось
// // // //         } else {
// // // //             console.error('Ошибка при показе главного меню:', e);
// // // //             // В случае другой ошибки, просто отправляем новое сообщение
// // // //             await ctx.replyWithPhoto(logoUrl, { caption: message, reply_markup: keyboard.reply_markup });
// // // //         }
// // // //     }
// // // // }
// // // //
// // // //
// // // // function registerUserHandlers() {
// // // //     bot.start(showMainMenu);
// // // //
// // // //     bot.action('back_to_main_menu', async (ctx) => {
// // // //         await ctx.answerCbQuery();
// // // //         if (ctx.scene && ctx.scene.current) {
// // // //             await ctx.scene.leave();
// // // //         }
// // // //         await showMainMenu(ctx);
// // // //     });
// // // //
// // // //     bot.action('show_catalog', async (ctx) => {
// // // //         await ctx.answerCbQuery();
// // // //         const categories = await ShopCategory.find({});
// // // //         const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
// // // //         buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
// // // //         const keyboard = Markup.inlineKeyboard(buttons);
// // // //         // Редактируем сообщение, но уже без картинки
// // // //         await ctx.editMessageCaption('Выберите категорию:', keyboard);
// // // //     });
// // // //
// // // //     bot.action(/^select_category:(.+)$/, async (ctx) => {
// // // //         await ctx.answerCbQuery();
// // // //         // Удаляем предыдущее сообщение, чтобы сцена началась с чистого листа
// // // //         await ctx.deleteMessage();
// // // //         const categoryCode = ctx.match[1];
// // // //         ctx.scene.state.categoryCode = categoryCode;
// // // //         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
// // // //     });
// // // //
// // // //     // --- 2. ДОБАВЛЯЕМ НЕДОСТАЮЩИЙ ОБРАБОТЧИК ДЛЯ КНОПКИ "ДОБАВИТЬ В КОРЗИНУ" ---
// // // //     bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
// // // //         const nmID = parseInt(ctx.match[1], 10);
// // // //         const telegramId = ctx.from.id;
// // // //
// // // //         try {
// // // //             let cart = await Cart.findOne({ telegramId });
// // // //             if (!cart) {
// // // //                 cart = new Cart({ telegramId, items: [] });
// // // //             }
// // // //
// // // //             const itemIndex = cart.items.findIndex(item => item.nmID === nmID);
// // // //             if (itemIndex > -1) {
// // // //                 // Если товар уже есть, увеличиваем количество
// // // //                 cart.items[itemIndex].quantity += 1;
// // // //             } else {
// // // //                 // Если товара нет, добавляем его
// // // //                 cart.items.push({ nmID, quantity: 1 });
// // // //             }
// // // //             await cart.save();
// // // //
// // // //             // Отправляем пользователю короткое всплывающее уведомление
// // // //             await ctx.answerCbQuery('✅ Добавлено в корзину!');
// // // //
// // // //         } catch (error) {
// // // //             console.error('Ошибка добавления в корзину:', error);
// // // //             await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
// // // //         }
// // // //     });
// // // //
// // // //     // Этот обработчик нужен для кнопки "Корзина" в главном меню
// // // //     bot.action('view_cart', async (ctx) => {
// // // //         await ctx.answerCbQuery();
// // // //         await ctx.deleteMessage(); // Удаляем главное меню
// // // //         await ctx.scene.enter('CART_SCENE'); // Входим в сцену корзины
// // // //     });
// // // // }
// // // //
// // // // module.exports = { registerUserHandlers, showMainMenu };
// // // //
// // // //
// // // //
// // // // // // handlers/userHandler.js
// // // // // const bot = require('../bot');
// // // // // const { Markup } = require('telegraf');
// // // // // const ShopCategory = require('../models/ShopCategory');
// // // // //
// // // // // async function sendMainMenu(ctx) {
// // // // //     try {
// // // // //         const categories = await ShopCategory.find({ 'product_nmIDs.0': { $exists: true } });
// // // // //         const categoryButtons = categories.map(cat => Markup.button.callback(cat.name, `category:${cat.code}`));
// // // // //
// // // // //         const staticButtons = [
// // // // //             Markup.button.callback('👥 Клиентам', 'client_info'),
// // // // //             Markup.button.callback('📝 Опрос', 'start_survey')
// // // // //         ];
// // // // //
// // // // //         const allButtons = [...categoryButtons, ...staticButtons];
// // // // //         const mainMenu = Markup.inlineKeyboard(allButtons, { columns: 2 });
// // // // //
// // // // //         const welcomeMessage = `Здравствуйте, ${ctx.from.first_name}!\nЧто желаете?`;
// // // // //
// // // // //         await ctx.replyWithPhoto(
// // // // //             { source: './assets/full_logo.png' },
// // // // //             {
// // // // //                 caption: welcomeMessage,
// // // // //                 ...mainMenu
// // // // //             }
// // // // //         );
// // // // //     } catch (error) {
// // // // //         console.error(`Ошибка при отправке главного меню для ${ctx.from.username}:`, error);
// // // // //         await ctx.reply('Возникла ошибка. Попробуйте еще раз, отправив команду /start.');
// // // // //     }
// // // // // }
// // // // //
// // // // // function registerUserHandlers() {
// // // // //     const menuHandler = async (ctx) => {
// // // // //         if (ctx.scene) {
// // // // //             await ctx.scene.leave();
// // // // //         }
// // // // //         // Убрали deleteMessage отсюда, чтобы не удалять команду /start или /menu
// // // // //         await sendMainMenu(ctx);
// // // // //     };
// // // // //
// // // // //     bot.start(menuHandler);
// // // // //     bot.command('menu', menuHandler);
// // // // //
// // // // //     bot.action(/^category:(.+)$/, async (ctx) => {
// // // // //         const categoryCode = ctx.match[1];
// // // // //         await ctx.answerCbQuery();
// // // // //         // --- ИЗМЕНЕНИЕ: УДАЛЕНО ---
// // // // //         // await ctx.deleteMessage().catch(()=>{}); // Больше не удаляем главное меню
// // // // //
// // // // //         await ctx.reply('Продолжаем');
// // // // //         ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
// // // // //     });
// // // // //
// // // // //     bot.action('back_to_main_menu', async (ctx) => {
// // // // //         await ctx.answerCbQuery();
// // // // //         if (ctx.scene) {
// // // // //             await ctx.scene.leave();
// // // // //         }
// // // // //         // --- ИЗМЕНЕНИЕ: УДАЛЕНО ---
// // // // //         // await ctx.deleteMessage().catch(()=>{}); // Больше не удаляем сообщения
// // // // //         // if (ctx.scene && ctx.scene.state.mediaGridMessageId) { ... } // И медиа-группу тоже
// // // // //
// // // // //         // Вместо этого просто отправляем новое меню
// // // // //         await sendMainMenu(ctx);
// // // // //     });
// // // // //
// // // // //     bot.action('client_info', async (ctx) => {
// // // // //         await ctx.answerCbQuery('Скоро здесь будет информация!');
// // // // //     });
// // // // //
// // // // //     bot.action('start_survey', async (ctx) => {
// // // // //         await ctx.answerCbQuery('Скоро здесь появится опрос!');
// // // // //     });
// // // // //
// // // // //     console.log('Обработчики для пользователя зарегистрированы.');
// // // // // }
// // // // //
// // // // // module.exports = { registerUserHandlers };
// // // // //
// // // // //
// // // // // // // handlers/userHandler.js
// // // // // // const bot = require('../bot');
// // // // // // const { Markup } = require('telegraf');
// // // // // // const ShopCategory = require('../models/ShopCategory');
// // // // // //
// // // // // // async function sendMainMenu(ctx) {
// // // // // //     try {
// // // // // //         const categories = await ShopCategory.find({ 'product_nmIDs.0': { $exists: true } });
// // // // // //         const categoryButtons = categories.map(cat => Markup.button.callback(cat.name, `category:${cat.code}`));
// // // // // //
// // // // // //         const staticButtons = [
// // // // // //             Markup.button.callback('👥 Клиентам', 'client_info'),
// // // // // //             Markup.button.callback('📝 Опрос', 'start_survey')
// // // // // //         ];
// // // // // //
// // // // // //         const allButtons = [...categoryButtons, ...staticButtons];
// // // // // //         const mainMenu = Markup.inlineKeyboard(allButtons, { columns: 2 });
// // // // // //
// // // // // //         const welcomeMessage = `Здравствуйте, ${ctx.from.first_name}!\nДобро пожаловать в наш магазин.`;
// // // // // //
// // // // // //         await ctx.replyWithPhoto(
// // // // // //             { source: './assets/full_logo.png' },
// // // // // //             {
// // // // // //                 caption: welcomeMessage,
// // // // // //                 ...mainMenu
// // // // // //             }
// // // // // //         );
// // // // // //     } catch (error) {
// // // // // //         console.error(`Ошибка при отправке главного меню для ${ctx.from.username}:`, error);
// // // // // //         await ctx.reply('Возникла ошибка. Попробуйте еще раз, отправив команду /start.');
// // // // // //     }
// // // // // // }
// // // // // //
// // // // // // function registerUserHandlers() {
// // // // // //     const menuHandler = async (ctx) => {
// // // // // //         if (ctx.scene) {
// // // // // //             await ctx.scene.leave();
// // // // // //         }
// // // // // //         await ctx.deleteMessage().catch(()=>{});
// // // // // //         await sendMainMenu(ctx);
// // // // // //     };
// // // // // //
// // // // // //     bot.start(menuHandler);
// // // // // //     bot.command('menu', menuHandler);
// // // // // //
// // // // // //     // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
// // // // // //     bot.action(/^category:(.+)$/, async (ctx) => {
// // // // // //         const categoryCode = ctx.match[1];
// // // // // //         await ctx.answerCbQuery();
// // // // // //         await ctx.deleteMessage().catch(()=>{});
// // // // // //
// // // // // //         // Сначала отправляем постоянное сообщение "Продолжаем"
// // // // // //         await ctx.reply('Продолжаем');
// // // // // //
// // // // // //         // А уже потом входим в сцену, которая покажет товары
// // // // // //         ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
// // // // // //     });
// // // // // //
// // // // // //     bot.action('back_to_main_menu', async (ctx) => {
// // // // // //         await ctx.answerCbQuery();
// // // // // //         if (ctx.scene) {
// // // // // //             await ctx.scene.leave();
// // // // // //         }
// // // // // //         // Удаляем сообщение с кнопками (под сеткой товаров)
// // // // // //         await ctx.deleteMessage().catch(()=>{});
// // // // // //         // Удаляем медиа-группу (саму сетку товаров)
// // // // // //         if (ctx.scene && ctx.scene.state.mediaGridMessageId) {
// // // // // //             await ctx.telegram.deleteMessage(ctx.chat.id, ctx.scene.state.mediaGridMessageId).catch(()=>{});
// // // // // //         }
// // // // // //         await sendMainMenu(ctx);
// // // // // //     });
// // // // // //
// // // // // //     bot.action('client_info', async (ctx) => {
// // // // // //         await ctx.answerCbQuery('Скоро здесь будет информация!');
// // // // // //     });
// // // // // //
// // // // // //     bot.action('start_survey', async (ctx) => {
// // // // // //         await ctx.answerCbQuery('Скоро здесь появится опрос!');
// // // // // //     });
// // // // // //
// // // // // //     console.log('Обработчики для пользователя зарегистрированы.');
// // // // // // }
// // // // // //
// // // // // // module.exports = { registerUserHandlers };
