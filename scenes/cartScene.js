// /scenes/cartScene.js
const { Scenes, Markup } = require('telegraf');
const Cart = require('../models/Cart');
const Cards = require('../models/Cards');
const ShopProduct = require('../models/ShopProduct');

// ========================================================================
// ===                   ИЗМЕНЕНИЕ №1: Импортируем функцию              ===
// ========================================================================
// Подключаем функцию showMainMenu из соседнего файла
const { showMainMenu } = require('../handlers/userHandler');


function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function showCart(ctx, isUpdate = false) {
    const telegramId = ctx.from.id;
    const cart = await Cart.findOne({ telegramId }).lean();

    if (!cart || cart.items.length === 0) {
        const emptyCartText = '🛒 Ваша корзина пуста';
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
        ]);
        if (isUpdate) {
            await ctx.editMessageText(emptyCartText, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
        } else {
            await ctx.replyWithMarkdownV2(emptyCartText, keyboard);
        }
        return;
    }

    const nmIDs = cart.items.map(item => item.nmID);
    const populatedItems = await Cards.find({ nmID: { $in: nmIDs } }).lean();
    const populatedShopProducts = await ShopProduct.find({ nmID: { $in: nmIDs } }).lean();

    let cartMessage = '🛒 *Ваша корзина:*\n\n';
    let totalPrice = 0;
    let itemNumber = 1;

    for (const item of cart.items) {
        const card = populatedItems.find(p => p.nmID === item.nmID);
        const shopProduct = populatedShopProducts.find(p => p.nmID === item.nmID);

        if (card && shopProduct) {
            const title = escapeMarkdownV2(card.title);
            const itemPrice = shopProduct.price;
            const totalItemPrice = item.quantity * itemPrice;
            totalPrice += totalItemPrice;

            cartMessage += `${itemNumber}\\. *${title}*\n`;
            cartMessage += `_Артикул: ${item.nmID}_\n`;
            cartMessage += `${item.quantity} шт\\. x ${itemPrice} руб\\. \\= *${totalItemPrice} руб\\.*\n\n`;

            itemNumber++;
        }
    }

    cartMessage += `*Итого: ${totalPrice} руб\\.*`;

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🗑️ Очистить корзину', 'clear_cart'),
            Markup.button.callback('🔄 Обновить', 'refresh_cart')
        ],
        [Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]
    ]);

    try {
        if (isUpdate && ctx.callbackQuery) {
            await ctx.editMessageText(cartMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
        } else {
            await ctx.reply(cartMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
        }
    } catch(e) {
        console.error("Ошибка при отправке сообщения корзины:", e.message);
        if (!isUpdate) {
            await ctx.reply("Не удалось отобразить корзину. Попробуйте обновить.");
        }
    }
}

const cartScene = new Scenes.BaseScene('CART_SCENE');

cartScene.enter((ctx) => showCart(ctx, false));

cartScene.action('refresh_cart', async (ctx) => {
    await ctx.answerCbQuery('Обновляю...');
    await showCart(ctx, true);
});

cartScene.action('clear_cart', async (ctx) => {
    const telegramId = ctx.from.id;
    await Cart.updateOne({ telegramId }, { $set: { items: [] } });
    await ctx.answerCbQuery('✅ Корзина очищена');
    await showCart(ctx, true);
});

// ========================================================================
// ===           ИЗМЕНЕНИЕ №2: Вызываем импортированную функцию         ===
// ========================================================================
cartScene.action('back_to_main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    try {
        // Удаляем сообщение с корзиной
        await ctx.deleteMessage();
    } catch(e) { /* Игнорируем ошибку, если сообщение уже удалено */ }

    // Вызываем функцию, чтобы отправить НОВОЕ сообщение с главным меню
    await showMainMenu(ctx, true);
});

module.exports = { cartScene };
