// /handlers/userHandler.js
const { Markup, Input } = require('telegraf');
const bot = require('../bot');
const ShopCategory = require('../models/ShopCategory');
const { showCart } = require('../scenes/cartScene'); // <-- ВАЖНО: Импортируем нашу функцию

async function showMainMenu(ctx, forceReply = false) {
    const logoPath = './assets/full_logo.png';
    const message = 'Добро пожаловать в наш магазин!';
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🗂 Каталог', 'show_catalog')],
        [Markup.button.callback('🛒 Корзина', 'view_cart')],
        [Markup.button.callback('ℹ️ Информация', 'show_info')]
    ]);
    try {
        // Убедимся, что выходим из любой сцены при возврате в главное меню
        if (ctx.scene?.current) {
            await ctx.scene.leave();
        }

        const photo = Input.fromLocalFile(logoPath);
        if (ctx.callbackQuery && !forceReply) {
            // Редактируем сообщение, если это возможно
            await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
        } else {
            // Или отправляем новое, если это команда /start или принудительный вызов
            if (ctx.callbackQuery) { // Если это был колбэк, удаляем старое сообщение
                await ctx.deleteMessage().catch(() => {});
            }
            await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
        }
    } catch (e) {
        if (e.response && e.response.error_code === 400 && (e.response.description.includes('message is not modified') || e.response.description.includes('message to edit not found'))) {
            // Игнорируем ошибку, если сообщение не изменилось или уже удалено
        } else {
            console.error('Ошибка при показе главного меню:', e);
        }
    }
}

function registerUserHandlers() {
    // bot.start уже не нужен здесь, т.к. он обрабатывается в index.js
    // bot.start(showMainMenu); // <--- ЭТУ СТРОКУ МОЖНО УДАЛИТЬ ИЛИ ЗАКОММЕНТИРОВАТЬ

    bot.action('back_to_main_menu', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            await showMainMenu(ctx, true); // Принудительно отправляем новое меню
        } catch (e) {
            console.error("Ошибка в back_to_main_menu:", e);
        }
    });

    bot.action('show_catalog', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            // Ищем только корневые категории для начального отображения
            const categories = await ShopCategory.find({ parent: null });
            if (categories.length === 0) {
                await ctx.editMessageCaption('К сожалению, в данный момент нет доступных категорий.', Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]
                ]));
                return;
            }
            const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);

            buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);

            const keyboard = Markup.inlineKeyboard(buttons);
            // Меняем подпись под фото и кнопки
            await ctx.editMessageCaption('Выберите категорию:', keyboard);
        } catch(e) {
            console.error("Ошибка в show_catalog:", e);
            await ctx.reply('Произошла ошибка при загрузке каталога. Попробуйте позже.');
        }
    });

    bot.action(/^select_category:(.+)$/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            await ctx.deleteMessage(); // Удаляем старое сообщение с лого
            const categoryCode = ctx.match[1];
            // Входим в сцену и передаем ей код выбранной категории
            await ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
        } catch (e) {
            console.error("Ошибка в select_category:", e);
        }
    });

    bot.action('view_cart', async (ctx) => {
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.warn("Не удалось удалить сообщение при переходе в корзину.", e.message);
        }
        await showCart(ctx, true);
    });

    bot.action('show_info', async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const infoMessage = `<b>О магазине</b>\n\n
Все вопросы по призам, акциям, обмену, гарантии, возврату, браку и доставке товаров присылайте на почту: shop@n208.ru, мы отвечаем на все письма!\n\n
Задавайте вопросы в чате с покупателями, а так же пишите любые пожелания на почту: shop@n208.ru.\n
Подписывайтесь на наш Телеграмм канал: n208shop`;
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]
            ]);
            await ctx.editMessageCaption(infoMessage, { parse_mode: 'HTML', reply_markup: keyboard.reply_markup });
        } catch (e) {
            console.error("Ошибка в show_info:", e);
        }
    });
}

module.exports = { registerUserHandlers, showMainMenu };



// // /handlers/userHandler.js
// const { Markup, Input } = require('telegraf');
// const bot = require('../bot');
// const ShopCategory = require('../models/ShopCategory');
//
// async function showMainMenu(ctx, forceReply = false) {
//     const logoPath = './assets/full_logo.png';
//     const message = 'Добро пожаловать в наш магазин!';
//     const keyboard = Markup.inlineKeyboard([
//         [Markup.button.callback('🗂 Каталог', 'show_catalog')],
//         [Markup.button.callback('🛒 Корзина', 'view_cart')],
//         [Markup.button.callback('ℹ️ Информация', 'show_info')]
//     ]);
//     try {
//         const photo = Input.fromLocalFile(logoPath);
//         if (ctx.callbackQuery && !forceReply) {
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
// function registerUserHandlers() {
//     bot.start(showMainMenu);
//
//     bot.action('back_to_main_menu', async (ctx) => {
//         await ctx.answerCbQuery();
//         if (ctx.scene && ctx.scene.current) {
//             await ctx.scene.leave();
//         }
//         try {
//             await ctx.deleteMessage();
//         } catch (e) {
//             console.warn("Не удалось удалить сообщение при возврате в меню.", e.message);
//         }
//         await showMainMenu(ctx, true);
//     });
//
//     bot.action('show_catalog', async (ctx) => {
//         await ctx.answerCbQuery();
//         const categories = await ShopCategory.find({});
//         const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);
//
//         buttons.push([
//             Markup.button.callback('🛒 Корзина', 'view_cart'),
//             Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
//         ]);
//
//         const keyboard = Markup.inlineKeyboard(buttons);
//         await ctx.editMessageCaption('Выберите категорию:', keyboard);
//     });
//
//     bot.action(/^select_category:(.+)$/, async (ctx) => {
//         await ctx.answerCbQuery();
//         await ctx.deleteMessage();
//         const categoryCode = ctx.match[1];
//         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
//     });
//
//     bot.action('view_cart', async (ctx) => {
//         await ctx.answerCbQuery();
//         if (ctx.scene?.current?.id !== 'CART_SCENE') {
//             if (ctx.scene?.current) {
//                 await ctx.scene.leave();
//             }
//             await ctx.deleteMessage().catch(()=>{});
//             await ctx.scene.enter('CART_SCENE');
//         }
//     });
// }
//
// module.exports = { registerUserHandlers, showMainMenu };
