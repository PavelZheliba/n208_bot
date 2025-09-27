// /handlers/userHandler.js
const { Markup, Input } = require('telegraf');
const bot = require('../bot');
const ShopCategory = require('../models/ShopCategory');
const Cart = require('../models/Cart');

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
        if (ctx.callbackQuery && !forceReply) {
            await ctx.editMessageMedia({ type: 'photo', media: photo, caption: message }, keyboard);
        } else {
            await ctx.replyWithPhoto(photo, { caption: message, reply_markup: keyboard.reply_markup });
        }
    } catch (e) {
        if (e.response && e.response.error_code === 400 && e.response.description.includes('message is not modified')) {} else {
            console.error('Ошибка при показе главного меню:', e);
        }
    }
}

function registerUserHandlers() {
    bot.start(showMainMenu);

    bot.action('back_to_main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        if (ctx.scene && ctx.scene.current) {
            await ctx.scene.leave();
        }
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.warn("Не удалось удалить сообщение при возврате в меню.", e.message);
        }
        await showMainMenu(ctx, true);
    });

    bot.action('show_catalog', async (ctx) => {
        await ctx.answerCbQuery();
        const categories = await ShopCategory.find({});
        const buttons = categories.map(cat => [Markup.button.callback(cat.name, `select_category:${cat.code}`)]);

        // ========================================================================
        // ===              ИЗМЕНЕНИЕ №1: Добавляем кнопку Корзины сюда         ===
        // ========================================================================
        // Теперь в последней строке две кнопки: Корзина и Главное меню
        buttons.push([
            Markup.button.callback('🛒 Корзина', 'view_cart'),
            Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
        ]);
        // ========================================================================

        const keyboard = Markup.inlineKeyboard(buttons);
        await ctx.editMessageCaption('Выберите категорию:', keyboard);
    });

    bot.action(/^select_category:(.+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
        const categoryCode = ctx.match[1];
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
        // Проверяем, не находимся ли мы уже в сцене корзины, чтобы избежать лишних действий
        if (ctx.scene?.current?.id !== 'CART_SCENE') {
            await ctx.deleteMessage();
            await ctx.scene.enter('CART_SCENE');
        }
    });
}

module.exports = { registerUserHandlers, showMainMenu };
