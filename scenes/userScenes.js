// /scenes/userScenes.js
const { Scenes, Markup } = require('telegraf');
const sharp = require('sharp');
const axios = require('axios');
const Cards = require('../models/Cards');
const ShopProduct = require('../models/ShopProduct');
const ShopCategory = require('../models/ShopCategory');

const PAGE_SIZE = 6;
const GRID_IMAGE_SIZE = 500;

// ========================================================================
// ===                   ИЗМЕНЕНИЕ №1: Функция-уборщик                  ===
// ========================================================================
// Эта функция будет удалять все сообщения, ID которых сохранены в state
async function cleanupGridMessages(ctx) {
    if (ctx.scene.state.messagesToDelete && ctx.scene.state.messagesToDelete.length > 0) {
        // Promise.all для параллельного и быстрого удаления
        // .catch() чтобы избежать ошибки, если сообщение уже удалено
        await Promise.all(
            ctx.scene.state.messagesToDelete.map(msgId => ctx.deleteMessage(msgId).catch(() => {}))
        );
    }
    // Очищаем массив для следующего использования
    ctx.scene.state.messagesToDelete = [];
}


async function generateNumberedImage(imageUrl, number) {
    try {
        const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const svg = `<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="rgba(0,0,0,0.6)" /><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial, sans-serif" fill="white">${number}</text></svg>`;
        return sharp(imageBuffer).resize(GRID_IMAGE_SIZE, GRID_IMAGE_SIZE, { fit: sharp.fit.cover, position: 'attention' }).composite([{ input: Buffer.from(svg), gravity: 'northwest' }]).jpeg({ quality: 90 }).toBuffer();
    } catch (error) {
        console.error(`Ошибка генерации изображения для ${imageUrl}:`, error);
        const fallbackSvg = `<svg width="${GRID_IMAGE_SIZE}" height="${GRID_IMAGE_SIZE}"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">Error</text></svg>`;
        return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }
}

async function showProductGrid(ctx, categoryCode, page = 1) {
    // === ИЗМЕНЕНИЕ №2: Вызываем уборщика в самом начале ===
    await cleanupGridMessages(ctx);

    const loadingMessage = await ctx.reply('⏳ Загружаю товары...');
    const category = await ShopCategory.findOne({ code: categoryCode });
    if (!category) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, '❌ Произошла ошибка. Категория не найдена.');
        return;
    }

    const availableProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
    const availableNmIDs = availableProducts.map(p => p.nmID);
    const totalProducts = availableNmIDs.length;
    const productsOnPage = await Cards.find({ nmID: { $in: availableNmIDs } }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);

    if (productsOnPage.length === 0) {
        const keyboard = Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 'В этой категории пока нет товаров.', { reply_markup: keyboard.reply_markup });
        // === ИЗМЕНЕНИЕ №3: Сохраняем ID этого сообщения, чтобы его можно было удалить потом ===
        ctx.scene.state.messagesToDelete = [loadingMessage.message_id];
        return;
    }

    const mediaGroupPromises = productsOnPage.map((product, index) => {
        const imageUrl = (product.photos && product.photos.length > 0) ? product.photos[0].big : 'https://via.placeholder.com/500';
        const number = (page - 1) * PAGE_SIZE + (index + 1);
        return generateNumberedImage(imageUrl, number).then(buffer => ({ type: 'photo', media: { source: buffer } }));
    });
    const mediaGroup = await Promise.all(mediaGroupPromises);
    ctx.scene.state.currentPageMap = new Map(productsOnPage.map((p, i) => [String((page - 1) * PAGE_SIZE + (i + 1)), p.nmID]));
    const numberButtons = productsOnPage.map((_, index) => Markup.button.callback(String((page - 1) * PAGE_SIZE + (index + 1)), `select_product:${(page - 1) * PAGE_SIZE + (index + 1)}`));

    const hasMore = totalProducts > page * PAGE_SIZE;
    const hasPrevious = page > 1;
    const controlButtons = [];
    if (hasPrevious) controlButtons.push(Markup.button.callback('⬅️ Назад', `show_prev:${categoryCode}:${page - 1}`));
    controlButtons.push(Markup.button.callback('🛒 Корзина', 'view_cart'));
    controlButtons.push(Markup.button.callback('🏠 Главное меню', 'back_to_main_menu'));
    if (hasMore) controlButtons.push(Markup.button.callback('Далее ➡️', `show_more:${categoryCode}:${page + 1}`));

    const keyboard = Markup.inlineKeyboard([numberButtons, controlButtons]);

    // Удаляем сообщение "Загружаю..."
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

    // Отправляем новый контент
    const mediaGroupMessages = await ctx.replyWithMediaGroup(mediaGroup);
    const choiceMessage = await ctx.reply('Выберите товар по его номеру:', keyboard);

    // === ИЗМЕНЕНИЕ №4: Сохраняем ID всех новых сообщений в state ===
    ctx.scene.state.messagesToDelete = [
        ...mediaGroupMessages.map(m => m.message_id), // Все ID из медиагруппы
        choiceMessage.message_id                     // ID сообщения с кнопками
    ];
}

async function showFullProductCard(ctx, nmID) {
    // При входе в карточку товара тоже чистим старую сетку
    await cleanupGridMessages(ctx);
    try {
        const card = await Cards.findOne({ nmID });
        const shopProduct = await ShopProduct.findOne({ nmID });
        if (!card || !shopProduct) {
            await ctx.reply('К сожалению, информация об этом товаре не найдена.');
            return;
        }

        let sentMessages = [];
        if (card.photos && card.photos.length > 0) {
            const mediaGroup = card.photos.slice(0, 10).map(photo => ({ type: 'photo', media: photo.big }));
            const mediaMessages = await ctx.replyWithMediaGroup(mediaGroup);
            sentMessages.push(...mediaMessages.map(m => m.message_id));
        }
        const caption = `<b>арт. ${card.nmID}</b>,\n<b>${card.title}</b>\n\n${card.description || ''}\n\n<b>Цена: ${shopProduct.price} руб.</b>`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('⬅️ Назад к товарам', 'back_to_grid'),
                Markup.button.callback('🛒 Корзина', 'view_cart'),
                Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
            ],
            [Markup.button.callback('➕ Добавить в корзину', `add_to_cart:${nmID}`)],
        ]);
        const captionMessage = await ctx.replyWithHTML(caption, keyboard);
        sentMessages.push(captionMessage.message_id);

        // Сохраняем ID и этих сообщений тоже
        ctx.scene.state.messagesToDelete = sentMessages;

    } catch (e) {
        console.error(`Ошибка при показе товара ${nmID}:`, e);
    }
}

const browseProductsScene = new Scenes.BaseScene('BROWSE_PRODUCTS_SCENE');

browseProductsScene.enter(async (ctx) => {
    await showProductGrid(ctx, ctx.scene.state.categoryCode, 1);
});

// === ИЗМЕНЕНИЕ №5: Добавляем обработчик выхода из сцены ===
// Он будет вызывать нашего уборщика каждый раз, когда мы покидаем сцену
browseProductsScene.leave(cleanupGridMessages);


browseProductsScene.action(/^show_prev:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showProductGrid(ctx, ctx.match[1], parseInt(ctx.match[2], 10));
});

browseProductsScene.action(/^show_more:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showProductGrid(ctx, ctx.match[1], parseInt(ctx.match[2], 10));
});

browseProductsScene.action(/^select_product:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const selectedNumber = ctx.match[1];
    const nmID = ctx.scene.state.currentPageMap.get(selectedNumber);
    if (selectedNumber) {
        ctx.scene.state.returnPage = Math.ceil(parseInt(selectedNumber, 10) / PAGE_SIZE);
    }
    if (nmID) {
        ctx.scene.state.selectedNmID = nmID;
        await showFullProductCard(ctx, nmID);
    }
});

browseProductsScene.action('back_to_grid', async (ctx) => {
    await ctx.answerCbQuery();
    const pageToGoBack = ctx.scene.state.returnPage || 1;
    await showProductGrid(ctx, ctx.scene.state.categoryCode, pageToGoBack);
});

module.exports = { browseProductsScene };



// // /scenes/userScenes.js
// const { Scenes, Markup } = require('telegraf');
// const sharp = require('sharp');
// const axios = require('axios');
// const Cards = require('../models/Cards');
// const ShopProduct = require('../models/ShopProduct');
// const ShopCategory = require('../models/ShopCategory');
//
// const PAGE_SIZE = 6;
// const GRID_IMAGE_SIZE = 500;
//
// async function generateNumberedImage(imageUrl, number) {
//     try {
//         const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
//         const imageBuffer = Buffer.from(response.data, 'binary');
//         const svg = `<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="rgba(0,0,0,0.6)" /><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial, sans-serif" fill="white">${number}</text></svg>`;
//         return sharp(imageBuffer).resize(GRID_IMAGE_SIZE, GRID_IMAGE_SIZE, { fit: sharp.fit.cover, position: 'attention' }).composite([{ input: Buffer.from(svg), gravity: 'northwest' }]).jpeg({ quality: 90 }).toBuffer();
//     } catch (error) {
//         console.error(`Ошибка генерации изображения для ${imageUrl}:`, error);
//         const fallbackSvg = `<svg width="${GRID_IMAGE_SIZE}" height="${GRID_IMAGE_SIZE}"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">Error</text></svg>`;
//         return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
//     }
// }
//
// async function showProductGrid(ctx, categoryCode, page = 1) {
//     const loadingMessage = await ctx.reply('⏳ Загружаю товары...');
//     const category = await ShopCategory.findOne({ code: categoryCode });
//     if (!category) {
//         await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, '❌ Произошла ошибка. Категория не найдена.');
//         return;
//     }
//
//     const availableProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
//     const availableNmIDs = availableProducts.map(p => p.nmID);
//     const totalProducts = availableNmIDs.length;
//     const productsOnPage = await Cards.find({ nmID: { $in: availableNmIDs } }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);
//
//     // ========================================================================
//     // ===                 ВОТ ЗДЕСЬ ВНОСИМ ИЗМЕНЕНИЕ                      ===
//     // ========================================================================
//     if (productsOnPage.length === 0) {
//         // Создаем клавиатуру с одной кнопкой
//         const keyboard = Markup.inlineKeyboard([
//             Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
//         ]);
//         // Редактируем сообщение "Загружаю...", меняя текст И добавляя к нему кнопку
//         await ctx.telegram.editMessageText(
//             ctx.chat.id,
//             loadingMessage.message_id,
//             undefined,
//             'В этой категории пока нет товаров.',
//             { reply_markup: keyboard.reply_markup }
//         );
//         return; // Завершаем выполнение функции
//     }
//     // ========================================================================
//
//     const mediaGroupPromises = productsOnPage.map((product, index) => {
//         const imageUrl = (product.photos && product.photos.length > 0) ? product.photos[0].big : 'https://via.placeholder.com/500';
//         const number = (page - 1) * PAGE_SIZE + (index + 1);
//         return generateNumberedImage(imageUrl, number).then(buffer => ({ type: 'photo', media: { source: buffer } }));
//     });
//     const mediaGroup = await Promise.all(mediaGroupPromises);
//     ctx.scene.state.currentPageMap = new Map(productsOnPage.map((p, i) => [String((page - 1) * PAGE_SIZE + (i + 1)), p.nmID]));
//     const numberButtons = productsOnPage.map((_, index) => Markup.button.callback(String((page - 1) * PAGE_SIZE + (index + 1)), `select_product:${(page - 1) * PAGE_SIZE + (index + 1)}`));
//
//     const hasMore = totalProducts > page * PAGE_SIZE;
//     const hasPrevious = page > 1;
//     const controlButtons = [];
//     if (hasPrevious) controlButtons.push(Markup.button.callback('⬅️ Назад', `show_prev:${categoryCode}:${page - 1}`));
//
//     controlButtons.push(Markup.button.callback('🛒 Корзина', 'view_cart'));
//     controlButtons.push(Markup.button.callback('🏠 Главное меню', 'back_to_main_menu'));
//
//     if (hasMore) controlButtons.push(Markup.button.callback('Далее ➡️', `show_more:${categoryCode}:${page + 1}`));
//
//     const keyboard = Markup.inlineKeyboard([numberButtons, controlButtons]);
//
//     await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
//     await ctx.replyWithMediaGroup(mediaGroup);
//     await ctx.reply('Выберите товар по его номеру:', keyboard);
// }
//
// async function showFullProductCard(ctx, nmID) {
//     try {
//         const card = await Cards.findOne({ nmID });
//         const shopProduct = await ShopProduct.findOne({ nmID });
//         if (!card || !shopProduct) {
//             await ctx.reply('К сожалению, информация об этом товаре не найдена.');
//             return;
//         }
//         if (card.photos && card.photos.length > 0) {
//             const mediaGroup = card.photos.slice(0, 10).map(photo => ({ type: 'photo', media: photo.big }));
//             await ctx.replyWithMediaGroup(mediaGroup);
//         }
//         const caption = `<b>арт. ${card.nmID}</b>,\n<b>${card.title}</b>\n\n${card.description || ''}\n\n<b>Цена: ${shopProduct.price} руб.</b>`;
//
//         const keyboard = Markup.inlineKeyboard([
//             [
//                 Markup.button.callback('⬅️ Назад к товарам', 'back_to_grid'),
//                 Markup.button.callback('🛒 Корзина', 'view_cart'),
//                 Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
//             ],
//             [Markup.button.callback('➕ Добавить в корзину', `add_to_cart:${nmID}`)],
//         ]);
//
//         await ctx.replyWithHTML(caption, keyboard);
//     } catch (e) {
//         console.error(`Ошибка при показе товара ${nmID}:`, e);
//     }
// }
//
// const browseProductsScene = new Scenes.BaseScene('BROWSE_PRODUCTS_SCENE');
//
// browseProductsScene.enter(async (ctx) => {
//     await showProductGrid(ctx, ctx.scene.state.categoryCode, 1);
// });
//
// browseProductsScene.action(/^show_prev:(.+):(\d+)$/, async (ctx) => {
//     await ctx.answerCbQuery();
//     const categoryCode = ctx.match[1];
//     const page = parseInt(ctx.match[2], 10);
//     await showProductGrid(ctx, categoryCode, page);
// });
//
// browseProductsScene.action(/^show_more:(.+):(\d+)$/, async (ctx) => {
//     await ctx.answerCbQuery();
//     const categoryCode = ctx.match[1];
//     const page = parseInt(ctx.match[2], 10);
//     await showProductGrid(ctx, categoryCode, page);
// });
//
// browseProductsScene.action(/^select_product:(\d+)$/, async (ctx) => {
//     await ctx.answerCbQuery();
//     const selectedNumber = ctx.match[1];
//     const nmID = ctx.scene.state.currentPageMap.get(selectedNumber);
//     if (selectedNumber) {
//         ctx.scene.state.returnPage = Math.ceil(parseInt(selectedNumber, 10) / PAGE_SIZE);
//     }
//     if (nmID) {
//         ctx.scene.state.selectedNmID = nmID;
//         await showFullProductCard(ctx, nmID);
//     }
// });
//
// browseProductsScene.action('back_to_grid', async (ctx) => {
//     await ctx.answerCbQuery();
//     const pageToGoBack = ctx.scene.state.returnPage || 1;
//     await showProductGrid(ctx, ctx.scene.state.categoryCode, pageToGoBack);
// });
//
// browseProductsScene.command('menu', async (ctx) => {
//     await ctx.reply('Возвращаю в главное меню...');
//     return ctx.scene.leave();
// });
//
// module.exports = { browseProductsScene };
//
//
// // // /scenes/userScenes.js
// // const { Scenes, Markup } = require('telegraf');
// // const sharp = require('sharp');
// // const axios = require('axios');
// // const Cards = require('../models/Cards');
// // const ShopProduct = require('../models/ShopProduct');
// // const ShopCategory = require('../models/ShopCategory');
// //
// // const PAGE_SIZE = 6;
// // const GRID_IMAGE_SIZE = 500;
// //
// // async function generateNumberedImage(imageUrl, number) {
// //     try {
// //         const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
// //         const imageBuffer = Buffer.from(response.data, 'binary');
// //         const svg = `<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="rgba(0,0,0,0.6)" /><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial, sans-serif" fill="white">${number}</text></svg>`;
// //         return sharp(imageBuffer).resize(GRID_IMAGE_SIZE, GRID_IMAGE_SIZE, { fit: sharp.fit.cover, position: 'attention' }).composite([{ input: Buffer.from(svg), gravity: 'northwest' }]).jpeg({ quality: 90 }).toBuffer();
// //     } catch (error) {
// //         console.error(`Ошибка генерации изображения для ${imageUrl}:`, error);
// //         const fallbackSvg = `<svg width="${GRID_IMAGE_SIZE}" height="${GRID_IMAGE_SIZE}"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">Error</text></svg>`;
// //         return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
// //     }
// // }
// //
// // async function showProductGrid(ctx, categoryCode, page = 1) {
// //     const loadingMessage = await ctx.reply('⏳ Загружаю товары...');
// //     const category = await ShopCategory.findOne({ code: categoryCode });
// //     if (!category) {
// //         await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, '❌ Произошла ошибка. Категория не найдена.');
// //         return;
// //     }
// //
// //     const availableProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
// //     const availableNmIDs = availableProducts.map(p => p.nmID);
// //     const totalProducts = availableNmIDs.length;
// //     const productsOnPage = await Cards.find({ nmID: { $in: availableNmIDs } }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);
// //
// //     if (productsOnPage.length === 0) {
// //         await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 'В этой категории пока нет товаров.');
// //         return;
// //     }
// //
// //     const mediaGroupPromises = productsOnPage.map((product, index) => {
// //         const imageUrl = (product.photos && product.photos.length > 0) ? product.photos[0].big : 'https://via.placeholder.com/500';
// //         const number = (page - 1) * PAGE_SIZE + (index + 1);
// //         return generateNumberedImage(imageUrl, number).then(buffer => ({ type: 'photo', media: { source: buffer } }));
// //     });
// //     const mediaGroup = await Promise.all(mediaGroupPromises);
// //     ctx.scene.state.currentPageMap = new Map(productsOnPage.map((p, i) => [String((page - 1) * PAGE_SIZE + (i + 1)), p.nmID]));
// //     const numberButtons = productsOnPage.map((_, index) => Markup.button.callback(String((page - 1) * PAGE_SIZE + (index + 1)), `select_product:${(page - 1) * PAGE_SIZE + (index + 1)}`));
// //
// //     const hasMore = totalProducts > page * PAGE_SIZE;
// //     const hasPrevious = page > 1;
// //     const controlButtons = [];
// //     if (hasPrevious) controlButtons.push(Markup.button.callback('⬅️ Назад', `show_prev:${categoryCode}:${page - 1}`));
// //
// //     // ========================================================================
// //     // ===              ИЗМЕНЕНИЕ №2: Добавляем кнопку Корзины сюда         ===
// //     // ========================================================================
// //     controlButtons.push(Markup.button.callback('🛒 Корзина', 'view_cart'));
// //     controlButtons.push(Markup.button.callback('🏠 Главное меню', 'back_to_main_menu'));
// //     // ========================================================================
// //
// //     if (hasMore) controlButtons.push(Markup.button.callback('Далее ➡️', `show_more:${categoryCode}:${page + 1}`));
// //
// //     const keyboard = Markup.inlineKeyboard([numberButtons, controlButtons]);
// //
// //     await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
// //     await ctx.replyWithMediaGroup(mediaGroup);
// //     await ctx.reply('Выберите товар по его номеру:', keyboard);
// // }
// //
// // async function showFullProductCard(ctx, nmID) {
// //     try {
// //         const card = await Cards.findOne({ nmID });
// //         const shopProduct = await ShopProduct.findOne({ nmID });
// //         if (!card || !shopProduct) {
// //             await ctx.reply('К сожалению, информация об этом товаре не найдена.');
// //             return;
// //         }
// //         if (card.photos && card.photos.length > 0) {
// //             const mediaGroup = card.photos.slice(0, 10).map(photo => ({ type: 'photo', media: photo.big }));
// //             await ctx.replyWithMediaGroup(mediaGroup);
// //         }
// //         const caption = `<b>арт. ${card.nmID}</b>,\n<b>${card.title}</b>\n\n${card.description || ''}\n\n<b>Цена: ${shopProduct.price} руб.</b>`;
// //
// //         // ========================================================================
// //         // ===              ИЗМЕНЕНИЕ №3: Добавляем кнопку Корзины сюда         ===
// //         // ========================================================================
// //         const keyboard = Markup.inlineKeyboard([
// //             [
// //                 Markup.button.callback('⬅️ Назад к товарам', 'back_to_grid'),
// //                 Markup.button.callback('🛒 Корзина', 'view_cart'),
// //                 Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
// //             ],
// //             [Markup.button.callback('➕ Добавить в корзину', `add_to_cart:${nmID}`)],
// //         ]);
// //         // ========================================================================
// //
// //         await ctx.replyWithHTML(caption, keyboard);
// //     } catch (e) {
// //         console.error(`Ошибка при показе товара ${nmID}:`, e);
// //     }
// // }
// //
// // const browseProductsScene = new Scenes.BaseScene('BROWSE_PRODUCTS_SCENE');
// //
// // browseProductsScene.enter(async (ctx) => {
// //     await showProductGrid(ctx, ctx.scene.state.categoryCode, 1);
// // });
// //
// // browseProductsScene.action(/^show_prev:(.+):(\d+)$/, async (ctx) => {
// //     await ctx.answerCbQuery();
// //     const categoryCode = ctx.match[1];
// //     const page = parseInt(ctx.match[2], 10);
// //     await showProductGrid(ctx, categoryCode, page);
// // });
// //
// // browseProductsScene.action(/^show_more:(.+):(\d+)$/, async (ctx) => {
// //     await ctx.answerCbQuery();
// //     const categoryCode = ctx.match[1];
// //     const page = parseInt(ctx.match[2], 10);
// //     await showProductGrid(ctx, categoryCode, page);
// // });
// //
// // browseProductsScene.action(/^select_product:(\d+)$/, async (ctx) => {
// //     await ctx.answerCbQuery();
// //     const selectedNumber = ctx.match[1];
// //     const nmID = ctx.scene.state.currentPageMap.get(selectedNumber);
// //     if (selectedNumber) {
// //         ctx.scene.state.returnPage = Math.ceil(parseInt(selectedNumber, 10) / PAGE_SIZE);
// //     }
// //     if (nmID) {
// //         ctx.scene.state.selectedNmID = nmID;
// //         await showFullProductCard(ctx, nmID);
// //     }
// // });
// //
// // browseProductsScene.action('back_to_grid', async (ctx) => {
// //     await ctx.answerCbQuery();
// //     const pageToGoBack = ctx.scene.state.returnPage || 1;
// //     await showProductGrid(ctx, ctx.scene.state.categoryCode, pageToGoBack);
// // });
// //
// // browseProductsScene.command('menu', async (ctx) => {
// //     await ctx.reply('Возвращаю в главное меню...');
// //     return ctx.scene.leave();
// // });
// //
// // module.exports = { browseProductsScene };
