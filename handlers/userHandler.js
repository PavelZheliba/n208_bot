// handlers/userHandler.js
const bot = require('../bot');
const { Markup } = require('telegraf');
const ShopCategory = require('../models/ShopCategory');

async function sendMainMenu(ctx) {
    try {
        const categories = await ShopCategory.find({ 'product_nmIDs.0': { $exists: true } });
        const categoryButtons = categories.map(cat => Markup.button.callback(cat.name, `category:${cat.code}`));

        const staticButtons = [
            Markup.button.callback('👥 Клиентам', 'client_info'),
            Markup.button.callback('📝 Опрос', 'start_survey')
        ];

        const allButtons = [...categoryButtons, ...staticButtons];
        const mainMenu = Markup.inlineKeyboard(allButtons, { columns: 2 });

        const welcomeMessage = `Здравствуйте, ${ctx.from.first_name}!\nЧто желаете?`;

        await ctx.replyWithPhoto(
            { source: './assets/full_logo.png' },
            {
                caption: welcomeMessage,
                ...mainMenu
            }
        );
    } catch (error) {
        console.error(`Ошибка при отправке главного меню для ${ctx.from.username}:`, error);
        await ctx.reply('Возникла ошибка. Попробуйте еще раз, отправив команду /start.');
    }
}

function registerUserHandlers() {
    const menuHandler = async (ctx) => {
        if (ctx.scene) {
            await ctx.scene.leave();
        }
        // Убрали deleteMessage отсюда, чтобы не удалять команду /start или /menu
        await sendMainMenu(ctx);
    };

    bot.start(menuHandler);
    bot.command('menu', menuHandler);

    bot.action(/^category:(.+)$/, async (ctx) => {
        const categoryCode = ctx.match[1];
        await ctx.answerCbQuery();
        // --- ИЗМЕНЕНИЕ: УДАЛЕНО ---
        // await ctx.deleteMessage().catch(()=>{}); // Больше не удаляем главное меню

        await ctx.reply('Продолжаем');
        ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
    });

    bot.action('back_to_main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        if (ctx.scene) {
            await ctx.scene.leave();
        }
        // --- ИЗМЕНЕНИЕ: УДАЛЕНО ---
        // await ctx.deleteMessage().catch(()=>{}); // Больше не удаляем сообщения
        // if (ctx.scene && ctx.scene.state.mediaGridMessageId) { ... } // И медиа-группу тоже

        // Вместо этого просто отправляем новое меню
        await sendMainMenu(ctx);
    });

    bot.action('client_info', async (ctx) => {
        await ctx.answerCbQuery('Скоро здесь будет информация!');
    });

    bot.action('start_survey', async (ctx) => {
        await ctx.answerCbQuery('Скоро здесь появится опрос!');
    });

    console.log('Обработчики для пользователя зарегистрированы.');
}

module.exports = { registerUserHandlers };


// // handlers/userHandler.js
// const bot = require('../bot');
// const { Markup } = require('telegraf');
// const ShopCategory = require('../models/ShopCategory');
//
// async function sendMainMenu(ctx) {
//     try {
//         const categories = await ShopCategory.find({ 'product_nmIDs.0': { $exists: true } });
//         const categoryButtons = categories.map(cat => Markup.button.callback(cat.name, `category:${cat.code}`));
//
//         const staticButtons = [
//             Markup.button.callback('👥 Клиентам', 'client_info'),
//             Markup.button.callback('📝 Опрос', 'start_survey')
//         ];
//
//         const allButtons = [...categoryButtons, ...staticButtons];
//         const mainMenu = Markup.inlineKeyboard(allButtons, { columns: 2 });
//
//         const welcomeMessage = `Здравствуйте, ${ctx.from.first_name}!\nДобро пожаловать в наш магазин.`;
//
//         await ctx.replyWithPhoto(
//             { source: './assets/full_logo.png' },
//             {
//                 caption: welcomeMessage,
//                 ...mainMenu
//             }
//         );
//     } catch (error) {
//         console.error(`Ошибка при отправке главного меню для ${ctx.from.username}:`, error);
//         await ctx.reply('Возникла ошибка. Попробуйте еще раз, отправив команду /start.');
//     }
// }
//
// function registerUserHandlers() {
//     const menuHandler = async (ctx) => {
//         if (ctx.scene) {
//             await ctx.scene.leave();
//         }
//         await ctx.deleteMessage().catch(()=>{});
//         await sendMainMenu(ctx);
//     };
//
//     bot.start(menuHandler);
//     bot.command('menu', menuHandler);
//
//     // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
//     bot.action(/^category:(.+)$/, async (ctx) => {
//         const categoryCode = ctx.match[1];
//         await ctx.answerCbQuery();
//         await ctx.deleteMessage().catch(()=>{});
//
//         // Сначала отправляем постоянное сообщение "Продолжаем"
//         await ctx.reply('Продолжаем');
//
//         // А уже потом входим в сцену, которая покажет товары
//         ctx.scene.enter('BROWSE_PRODUCTS_SCENE', { categoryCode: categoryCode });
//     });
//
//     bot.action('back_to_main_menu', async (ctx) => {
//         await ctx.answerCbQuery();
//         if (ctx.scene) {
//             await ctx.scene.leave();
//         }
//         // Удаляем сообщение с кнопками (под сеткой товаров)
//         await ctx.deleteMessage().catch(()=>{});
//         // Удаляем медиа-группу (саму сетку товаров)
//         if (ctx.scene && ctx.scene.state.mediaGridMessageId) {
//             await ctx.telegram.deleteMessage(ctx.chat.id, ctx.scene.state.mediaGridMessageId).catch(()=>{});
//         }
//         await sendMainMenu(ctx);
//     });
//
//     bot.action('client_info', async (ctx) => {
//         await ctx.answerCbQuery('Скоро здесь будет информация!');
//     });
//
//     bot.action('start_survey', async (ctx) => {
//         await ctx.answerCbQuery('Скоро здесь появится опрос!');
//     });
//
//     console.log('Обработчики для пользователя зарегистрированы.');
// }
//
// module.exports = { registerUserHandlers };
