// /scenes/cartScene.js

const {Scenes, Markup} = require('telegraf');
const Cart = require('../models/Cart');
// const ShopProduct = require('../models/ShopProduct');

async function showCart(ctx, forceReply = false) {
    const userId = ctx.from.id;
    const cart = await Cart.findOne({userId}).populate('items.productId');

    if (!cart || cart.items.length === 0) {
        const emptyCartText = '🛒 Ваша корзина пуста';
        const keyboard = Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);

        if (ctx.callbackQuery && !forceReply) {
            try {
                await ctx.answerCbQuery();
                // --- ЗАЩИТА ---
                await ctx.editMessageText(emptyCartText, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: keyboard.reply_markup
                });
            } catch (e) {
                // Если сообщение не найдено или "query is too old", просто логируем, но не падаем
                console.error("Не удалось отредактировать сообщение (пустая корзина):", e.message);
                // Как запасной вариант, отправляем новое сообщение
                await ctx.replyWithMarkdownV2(emptyCartText, keyboard);
            }
        } else {
            if (ctx.callbackQuery) await ctx.answerCbQuery();
            await ctx.replyWithMarkdownV2(emptyCartText, keyboard);
        }
        return;
    }

    let totalAmount = 0;
    let cartMessage = '🛒 *Ваша корзина:*\n\n';
    const buttons = [];
    for (const item of cart.items) {
        const product = item.productId;
        if (!product) continue; // Защита, если товар был удален, но остался в корзине
        const price = product.price;
        const itemTotal = price * item.quantity;
        totalAmount += itemTotal;
        cartMessage += `*${product.title || `Товар ${product.nmID}`}*\n`;
        cartMessage += `Размер: ${item.size}, ${item.quantity} шт\\. x ${price} руб\\. = *${itemTotal} руб\\.*\n\n`;
        buttons.push([
            Markup.button.callback(`-`, `cart_decrease_${product.nmID}_${item.size}`),
            Markup.button.callback(`${item.quantity} шт.`, `cart_info`),
            Markup.button.callback(`+`, `cart_increase_${product.nmID}_${item.size}`),
        ]);
        buttons.push([Markup.button.callback(`❌ Удалить`, `cart_remove_${product.nmID}_${item.size}`)]);
    }
    cartMessage += `\n*Итого:* ${totalAmount} руб\\.`;
    buttons.push([Markup.button.callback('✅ Оформить заказ', 'checkout')]);
    buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery && !forceReply) {
        try {
            await ctx.answerCbQuery();
            // --- ЗАЩИТА ---
            await ctx.editMessageText(cartMessage, {parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup});
        } catch (e) {
            console.error("Не удалось отредактировать сообщение (полная корзина):", e.message);
            await ctx.replyWithMarkdownV2(cartMessage, keyboard);
        }
    } else {
        if (ctx.callbackQuery) await ctx.answerCbQuery();
        await ctx.replyWithMarkdownV2(cartMessage, keyboard);
    }
}

const cartScene = new Scenes.BaseScene('CART_SCENE');
cartScene.enter(async (ctx) => {
    await showCart(ctx, true);
});

cartScene.action('refresh_cart', async (ctx) => {
    await ctx.answerCbQuery('Обновляю...');
    await showCart(ctx, true);
});

cartScene.action('clear_cart', async (ctx) => {
    const telegramId = ctx.from.id;
    await Cart.updateOne({telegramId}, {$set: {items: []}});
    await ctx.answerCbQuery('✅ Корзина очищена');
    await showCart(ctx, true);
});

cartScene.action('back_to_main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    try {
        await ctx.deleteMessage();
    } catch (e) {
    }
    await showMainMenu(ctx, true);
});

module.exports = {showCart, cartScene};


// // /scenes/cartScene.js
// const { Scenes, Markup } = require('telegraf');
// const Cart = require('../models/Cart');
// const Cards = require('../models/Cards');
// const ShopProduct = require('../models/ShopProduct');
// const { showMainMenu } = require('../handlers/userHandler');
//
// function escapeMarkdownV2(text) {
//     if (typeof text !== 'string') return '';
//     return text.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
// }
//
//
//
//
//
// async function showCart(ctx) {
//     const userId = ctx.from.id;
//     const cart = await Cart.findOne({ userId }).populate('items.productId');
//
//     // === БЛОК ДЛЯ ПУСТОЙ КОРЗИНЫ ===
//     if (!cart || cart.items.length === 0) {
//         const emptyCartText = '🛒 Ваша корзина пуста';
//         const keyboard = Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
//
//         // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
//         // Проверяем, был ли вызов через нажатие инлайн-кнопки
//         if (ctx.callbackQuery) {
//             // Если да, то это обновление существующего сообщения. Редактируем.
//             await ctx.answerCbQuery(); // Убираем "часики" на кнопке
//             await ctx.editMessageText(emptyCartText, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
//         } else {
//             // Если нет (это была команда /cart), то отправляем новое сообщение
//             await ctx.replyWithMarkdownV2(emptyCartText, keyboard);
//         }
//         return;
//     }
//
//     // === БЛОК ДЛЯ КОРЗИНЫ С ТОВАРАМИ ===
//     // (Логика построения сообщения остается прежней)
//     let totalAmount = 0;
//     let cartMessage = '🛒 *Ваша корзина:*\n\n';
//     const buttons = [];
//
//     for (const item of cart.items) {
//         const product = item.productId;
//         const price = product.price;
//         const itemTotal = price * item.quantity;
//         totalAmount += itemTotal;
//
//         cartMessage += `*${product.title}*\n`;
//         cartMessage += `Размер: ${item.size}, ${item.quantity} шт\\. x ${price} руб\\. = *${itemTotal} руб\\.*\n\n`;
//
//         buttons.push([
//             Markup.button.callback(`-`, `cart_decrease_${product.nmID}_${item.size}`),
//             Markup.button.callback(`${item.quantity} шт.`, `cart_info`),
//             Markup.button.callback(`+`, `cart_increase_${product.nmID}_${item.size}`),
//         ]);
//         buttons.push([Markup.button.callback(`❌ Удалить`, `cart_remove_${product.nmID}_${item.size}`)]);
//     }
//
//     cartMessage += `\n*Итого:* ${totalAmount} руб\\.`;
//     buttons.push([Markup.button.callback('✅ Оформить заказ', 'checkout')]);
//     buttons.push([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
//
//     const keyboard = Markup.inlineKeyboard(buttons);
//
//     // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
//     // Та же самая логика проверки
//     if (ctx.callbackQuery) {
//         await ctx.answerCbQuery();
//         await ctx.editMessageText(cartMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
//     } else {
//         await ctx.replyWithMarkdownV2(cartMessage, keyboard);
//     }
// }
//
//
//
//
// // async function showCart(ctx, isUpdate = false) {
// //     const telegramId = ctx.from.id;
// //     const cart = await Cart.findOne({ telegramId }).lean();
// //
// //     if (!cart || cart.items.length === 0) {
// //         const emptyCartText = '🛒 Ваша корзина пуста';
// //         const keyboard = Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
// //         if (isUpdate) {
// //             await ctx.editMessageText(emptyCartText, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
// //         } else {
// //             await ctx.replyWithMarkdownV2(emptyCartText, keyboard);
// //         }
// //         return;
// //     }
// //
// //     const nmIDs = cart.items.map(item => item.nmID);
// //     const populatedItems = await Cards.find({ nmID: { $in: nmIDs } }).lean();
// //     const populatedShopProducts = await ShopProduct.find({ nmID: { $in: nmIDs } }).lean();
// //
// //     let cartMessage = '🛒 *Ваша корзина:*\n\n';
// //     let totalPrice = 0;
// //     let itemNumber = 1;
// //
// //     for (const item of cart.items) {
// //         const card = populatedItems.find(p => p.nmID === item.nmID);
// //         const shopProduct = populatedShopProducts.find(p => p.nmID === item.nmID);
// //
// //         if (card && shopProduct) {
// //             const title = escapeMarkdownV2(card.title);
// //             const itemPrice = shopProduct.price;
// //             const totalItemPrice = item.quantity * itemPrice;
// //             totalPrice += totalItemPrice;
// //
// //             // ========================================================================
// //             // ===             ИЗМЕНЕНИЕ: Добавляем отображение размера           ===
// //             // ========================================================================
// //             cartMessage += `${itemNumber}\\. *${title}*\n`;
// //             cartMessage += `_Артикул: ${item.nmID} \\| Размер: ${escapeMarkdownV2(item.sizeName)}_\n`;
// //             // ========================================================================
// //
// //             cartMessage += `${item.quantity} шт\\. x ${itemPrice} руб\\. \\= *${totalItemPrice} руб\\.*\n\n`;
// //             itemNumber++;
// //         }
// //     }
// //
// //     cartMessage += `*Итого: ${totalPrice} руб\\.*`;
// //
// //     const keyboard = Markup.inlineKeyboard([
// //         [Markup.button.callback('🗑️ Очистить корзину', 'clear_cart'), Markup.button.callback('🔄 Обновить', 'refresh_cart')],
// //         [Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]
// //     ]);
// //
// //     try {
// //         if (isUpdate && ctx.callbackQuery) {
// //             await ctx.editMessageText(cartMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
// //         } else {
// //             await ctx.reply(cartMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup });
// //         }
// //     } catch(e) {
// //         console.error("Ошибка при отправке сообщения корзины:", e.message);
// //         if (!isUpdate) {
// //             await ctx.reply("Не удалось отобразить корзину. Попробуйте обновить.");
// //         }
// //     }
// // }
//
// const cartScene = new Scenes.BaseScene('CART_SCENE');
//
// cartScene.enter((ctx) => showCart(ctx, false));
//
// cartScene.action('refresh_cart', async (ctx) => {
//     await ctx.answerCbQuery('Обновляю...');
//     await showCart(ctx, true);
// });
//
// cartScene.action('clear_cart', async (ctx) => {
//     const telegramId = ctx.from.id;
//     await Cart.updateOne({ telegramId }, { $set: { items: [] } });
//     await ctx.answerCbQuery('✅ Корзина очищена');
//     await showCart(ctx, true);
// });
//
// cartScene.action('back_to_main_menu', async (ctx) => {
//     await ctx.answerCbQuery();
//     await ctx.scene.leave();
//     try {
//         await ctx.deleteMessage();
//     } catch(e) {}
//     await showMainMenu(ctx, true);
// });
//
// module.exports = { showCart, cartScene };