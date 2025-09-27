// /scenes/userScenes.js
const { Scenes, Markup } = require('telegraf');
const sharp = require('sharp');
const axios = require('axios');
const Cards = require('../models/Cards');
const ShopProduct = require('../models/ShopProduct');
const ShopCategory = require('../models/ShopCategory');

const PAGE_SIZE = 6;
const GRID_IMAGE_SIZE = 500;

async function generateNumberedImage(imageUrl, number) {
    try {
        const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const svg = `
            <svg width="100" height="100">
                <circle cx="50" cy="50" r="40" fill="rgba(0,0,0,0.6)" />
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial, sans-serif" fill="white">${number}</text>
            </svg>
        `;
        return sharp(imageBuffer)
            .resize(GRID_IMAGE_SIZE, GRID_IMAGE_SIZE, { fit: sharp.fit.cover, position: 'attention' })
            .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (error) {
        console.error(`Ошибка генерации изображения для ${imageUrl}:`, error);
        const fallbackSvg = `<svg width="${GRID_IMAGE_SIZE}" height="${GRID_IMAGE_SIZE}"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">Error</text></svg>`;
        return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }
}

async function showProductGrid(ctx, categoryCode, page = 1) {
    const loadingMessage = await ctx.reply('⏳ Загружаю товары...');
    const category = await ShopCategory.findOne({ code: categoryCode });

    if (!category) {
        console.error(`!!! КРИТИЧЕСКАЯ ОШИБКА: Категория с кодом "${categoryCode}" не найдена в базе данных.`);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, '❌ Произошла ошибка. Категория не найдена. Попробуйте вернуться в главное меню.');
        await ctx.reply('Нажмите, чтобы вернуться:', Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]));
        return;
    }

    const availableProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
    const availableNmIDs = availableProducts.map(p => p.nmID);
    const totalProducts = availableNmIDs.length;
    const productsOnPage = await Cards.find({ nmID: { $in: availableNmIDs } }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);

    if (productsOnPage.length === 0) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 'В этой категории пока нет товаров.');
        await ctx.reply('Нажмите, чтобы вернуться:', Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]));
        return;
    }

    const mediaGroupPromises = productsOnPage.map((product, index) => {
        const imageUrl = (product.photos && product.photos.length > 0) ? product.photos[0].big : 'https://via.placeholder.com/500';
        const number = (page - 1) * PAGE_SIZE + (index + 1);
        return generateNumberedImage(imageUrl, number).then(buffer => ({
            type: 'photo',
            media: { source: buffer }
        }));
    });
    const mediaGroup = await Promise.all(mediaGroupPromises);
    ctx.scene.state.currentPageMap = new Map(productsOnPage.map((p, i) => {
        const number = (page - 1) * PAGE_SIZE + (i + 1);
        return [String(number), p.nmID];
    }));
    const numberButtons = productsOnPage.map((_, index) => {
        const number = (page - 1) * PAGE_SIZE + (index + 1);
        const numberStr = String(number);
        return Markup.button.callback(numberStr, `select_product:${numberStr}`);
    });
    const hasMore = totalProducts > page * PAGE_SIZE;
    const hasPrevious = page > 1;
    const controlButtons = [];
    if (hasPrevious) {
        controlButtons.push(Markup.button.callback('⬅️ Вернуться', `show_prev:${categoryCode}:${page - 1}`));
    }
    controlButtons.push(Markup.button.callback('🏠 Главное меню', 'back_to_main_menu'));
    if (hasMore) {
        controlButtons.push(Markup.button.callback('Посмотреть еще ➡️', `show_more:${categoryCode}:${page + 1}`));
    }

    const keyboard = Markup.inlineKeyboard([
        numberButtons,
        controlButtons
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
    await ctx.replyWithMediaGroup(mediaGroup);
    await ctx.reply('Выберите товар по его номеру:', keyboard);
}

async function showFullProductCard(ctx, nmID) {
    try {
        const card = await Cards.findOne({ nmID });
        const shopProduct = await ShopProduct.findOne({ nmID });
        if (!card || !shopProduct) {
            await ctx.reply('К сожалению, информация об этом товаре не найдена.');
            return;
        }
        if (card.photos && card.photos.length > 0) {
            const mediaGroup = card.photos.slice(0, 10).map(photo => ({ type: 'photo', media: photo.big }));
            await ctx.replyWithMediaGroup(mediaGroup);
        }
        const caption = `<b>арт. ${card.nmID}</b>,\n<b>${card.title}</b>\n\n${card.description || ''}\n\n<b>Цена: ${shopProduct.price} руб.</b>`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('⬅️ Назад', 'back_to_grid'),
                Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
            ],
            [Markup.button.callback('🛒 Добавить в корзину', `add_to_cart:${nmID}`)],
        ]);

        await ctx.replyWithHTML(caption, keyboard);
    } catch (e) {
        console.error(`Ошибка при показе товара ${nmID}:`, e);
    }
}


const browseProductsScene = new Scenes.BaseScene('BROWSE_PRODUCTS_SCENE');

browseProductsScene.enter(async (ctx) => {
    // --- ОТЛАДКА ---
    console.log(`[userScenes.js] Получили из state categoryCode: >>>${ctx.scene.state.categoryCode}<<<`);

    await showProductGrid(ctx, ctx.scene.state.categoryCode, 1);
});

browseProductsScene.action(/^show_prev:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryCode = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    await showProductGrid(ctx, categoryCode, page);
});

browseProductsScene.action(/^show_more:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryCode = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    await showProductGrid(ctx, categoryCode, page);
});

browseProductsScene.action(/^select_product:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const selectedNumber = ctx.match[1];
    const nmID = ctx.scene.state.currentPageMap.get(selectedNumber);
    if (selectedNumber) {
        const returnPage = Math.ceil(parseInt(selectedNumber, 10) / PAGE_SIZE);
        ctx.scene.state.returnPage = returnPage;
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

browseProductsScene.command('menu', async (ctx) => {
    await ctx.reply('Возвращаю в главное меню...');
    return ctx.scene.leave();
});

module.exports = { browseProductsScene };



// // /handlers/userHandler.js
// const { Markup, Input } = require('telegraf');
// const bot = require('../bot');
// const ShopCategory = require('../models/ShopCategory');
// const Cart = require('../models/Cart');
//
// async function showMainMenu(ctx) {
//     // ... (эта функция без изменений)
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
//
//     // ========================================================================
//     // ===                 ГЛАВНЫЙ ОТЛАДОЧНЫЙ БЛОК                         ===
//     // ========================================================================
//     // Этот код перехватит ЛЮБОЕ нажатие инлайн-кнопки
//     bot.on('callback_query', (ctx, next) => {
//         console.log(`[userHandler.js | ПРОСЛУШКА] Получено нажатие кнопки. DATA: >>>${ctx.callbackQuery.data}<<<`);
//         // next() передает управление дальше, другим обработчикам
//         return next();
//     });
//     // ========================================================================
//
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
//         console.log('[userHandler.js | ACTION] Обработчик select_category сработал!'); // Добавили лог сюда
//         await ctx.answerCbQuery();
//         await ctx.deleteMessage();
//         const categoryCode = ctx.match[1];
//
//         console.log(`[userHandler.js] Передаем в сцену categoryCode: >>>${categoryCode}<<<`);
//
//         ctx.scene.state.categoryCode = categoryCode;
//         await ctx.scene.enter('BROWSE_PRODUCTS_SCENE');
//     });
//
//     bot.action(/^add_to_cart:(\d+)$/, async (ctx) => {
//         // ... (без изменений)
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