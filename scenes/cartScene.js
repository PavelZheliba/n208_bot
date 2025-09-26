// /scenes/cartScene.js
const { Scenes, Markup } = require('telegraf');
const Cart = require('../models/Cart');
const Cards = require('../models/Cards');
const ShopProduct = require('../models/ShopProduct');

const cartScene = new Scenes.BaseScene('CART_SCENE');

// Функция для отрисовки корзины
async function showCart(ctx) {
    const telegramId = ctx.from.id;
    const cart = await Cart.findOne({ telegramId });

    if (!cart || cart.items.length === 0) {
        await ctx.reply('Ваша корзина пуста.', Markup.inlineKeyboard([
            [Markup.button.callback('🗂 В каталог', 'continue_shopping')]
        ]));
        return;
    }

    // Собираем все nmID из корзины для запроса к БД
    const nmIDs = cart.items.map(item => item.nmID);
    const productsInfo = await Cards.find({ nmID: { $in: nmIDs } });
    const shopProductsInfo = await ShopProduct.find({ nmID: { $in: nmIDs } });

    let message = '🛒 *Ваша корзина:*\n\n';
    let totalPrice = 0;
    const buttons = [];

    // Формируем сообщение и кнопки
    cart.items.forEach((item, index) => {
        const product = productsInfo.find(p => p.nmID === item.nmID);
        const shopProduct = shopProductsInfo.find(p => p.nmID === item.nmID);

        if (product && shopProduct) {
            const itemPrice = item.quantity * shopProduct.price;
            totalPrice += itemPrice;
            message += `${index + 1}\\. *${product.title}*\n`;
            message += `_Артикул: ${item.nmID}_\n`;
            message += `${item.quantity} шт\\. x ${shopProduct.price} руб\\. = *${itemPrice} руб\\.*\n\n`;

            // Добавляем кнопку для удаления товара
            buttons.push([Markup.button.callback(`❌ Удалить ${product.title.slice(0, 20)}...`, `remove_from_cart:${item.nmID}`)]);
        }
    });

    message += `*Итого: ${totalPrice} руб\\.*`;

    // Добавляем главные кнопки управления
    buttons.push([Markup.button.callback('🧹 Очистить корзину', 'clear_cart')]);
    buttons.push([Markup.button.callback('🗂 Продолжить покупки', 'continue_shopping')]);
    buttons.push([Markup.button.callback('✅ Оформить заказ', 'checkout')]);

    await ctx.replyWithMarkdownV2(message, Markup.inlineKeyboard(buttons));
}

// Вход в сцену
cartScene.enter(async (ctx) => {
    await showCart(ctx);
});

// Обработка удаления одного товара
cartScene.action(/^remove_from_cart:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const nmIDToRemove = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    await Cart.updateOne({ telegramId }, { $pull: { items: { nmID: nmIDToRemove } } });
    await ctx.deleteMessage(); // Удаляем старое сообщение корзины
    return ctx.scene.reenter(); // Перезаходим в сцену, чтобы показать обновленную корзину
});

// Обработка полной очистки корзины
cartScene.action('clear_cart', async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id;
    await Cart.updateOne({ telegramId }, { $set: { items: [] } });
    await ctx.deleteMessage();
    return ctx.scene.reenter();
});

// Выход из корзины (продолжить покупки)
cartScene.action('continue_shopping', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.leave(); // Выходим из сцены, сработает обработчик 'back_to_main_menu'
});

// Переход к оформлению заказа (пока заглушка)
cartScene.action('checkout', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Функционал оформления заказа в разработке...');
    return ctx.scene.leave();
});

// При выходе из сцены показываем главное меню
cartScene.leave(async (ctx) => {
    // Импортируем здесь, чтобы избежать циклических зависимостей
    const { showMainMenu } = require('../handlers/userHandler');
    await showMainMenu(ctx);
});

module.exports = { cartScene };
