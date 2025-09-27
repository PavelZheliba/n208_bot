// /scenes/userScenes.js
const {Scenes, Markup} = require('telegraf');
const sharp = require('sharp');
const axios = require('axios');
const Cards = require('../models/Cards');
const ShopProduct = require('../models/ShopProduct');
const ShopCategory = require('../models/ShopCategory');
const Cart = require('../models/Cart');

// ... (вспомогательные функции cleanupGridMessages, generateNumberedImage, showProductGrid остаются без изменений)
async function cleanupGridMessages(ctx) {
    if (ctx.scene.state.messagesToDelete && ctx.scene.state.messagesToDelete.length > 0) {
        await Promise.all(ctx.scene.state.messagesToDelete.map(msgId => ctx.deleteMessage(msgId).catch(() => {
        })));
    }
    ctx.scene.state.messagesToDelete = [];
}

async function generateNumberedImage(imageUrl, number) {
    try {
        const response = await axios({url: imageUrl, responseType: 'arraybuffer'});
        const imageBuffer = Buffer.from(response.data, 'binary');
        const svg = `<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="rgba(0,0,0,0.6)" /><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial, sans-serif" fill="white">${number}</text></svg>`;
        return sharp(imageBuffer).resize(500, 500, {
            fit: sharp.fit.cover,
            position: 'attention'
        }).composite([{input: Buffer.from(svg), gravity: 'northwest'}]).jpeg({quality: 90}).toBuffer();
    } catch (error) {
        const fallbackSvg = `<svg width="500" height="500"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">Error</text></svg>`;
        return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }
}

async function showProductGrid(ctx, categoryCode, page = 1) {
    await cleanupGridMessages(ctx);
    const loadingMessage = await ctx.reply('⏳ Загружаю товары...');
    const category = await ShopCategory.findOne({code: categoryCode});
    if (!category) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, '❌ Произошла ошибка. Категория не найдена.');
        return;
    }
    const availableProducts = await ShopProduct.find({nmID: {$in: category.product_nmIDs}});
    const availableNmIDs = availableProducts.map(p => p.nmID);
    const productsOnPage = await Cards.find({nmID: {$in: availableNmIDs}}).skip((page - 1) * 6).limit(6);
    if (productsOnPage.length === 0) {
        const keyboard = Markup.inlineKeyboard([Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')]);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 'В этой категории пока нет товаров.', {reply_markup: keyboard.reply_markup});
        ctx.scene.state.messagesToDelete = [loadingMessage.message_id];
        return;
    }
    const mediaGroupPromises = productsOnPage.map((product, index) => {
        const imageUrl = (product.photos && product.photos.length > 0) ? product.photos[0].big : 'https://via.placeholder.com/500';
        const number = (page - 1) * 6 + (index + 1);
        return generateNumberedImage(imageUrl, number).then(buffer => ({type: 'photo', media: {source: buffer}}));
    });
    const mediaGroup = await Promise.all(mediaGroupPromises);
    ctx.scene.state.currentPageMap = new Map(productsOnPage.map((p, i) => [String((page - 1) * 6 + (i + 1)), p.nmID]));
    const numberButtons = productsOnPage.map((_, index) => Markup.button.callback(String((page - 1) * 6 + (index + 1)), `select_product:${(page - 1) * 6 + (index + 1)}`));
    const hasMore = availableNmIDs.length > page * 6;
    const hasPrevious = page > 1;
    const controlButtons = [];
    if (hasPrevious) controlButtons.push(Markup.button.callback('⬅️ Назад', `show_prev:${categoryCode}:${page - 1}`));
    controlButtons.push(Markup.button.callback('🛒 Корзина', 'view_cart'));
    controlButtons.push(Markup.button.callback('🏠 Главное меню', 'back_to_main_menu'));
    if (hasMore) controlButtons.push(Markup.button.callback('Далее ➡️', `show_more:${categoryCode}:${page + 1}`));
    const keyboard = Markup.inlineKeyboard([numberButtons, controlButtons]);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
    const mediaGroupMessages = await ctx.replyWithMediaGroup(mediaGroup);
    const choiceMessage = await ctx.reply('Выберите товар по его номеру:', keyboard);
    ctx.scene.state.messagesToDelete = [...mediaGroupMessages.map(m => m.message_id), choiceMessage.message_id];
}


async function showFullProductCard(ctx, nmID) {
    await cleanupGridMessages(ctx);
    try {
        // Получаем данные из ОБЕИХ коллекций
        const card = await Cards.findOne({nmID}); // для фото и названия
        const shopProduct = await ShopProduct.findOne({nmID}); // для цены и НАЛИЧИЯ РАЗМЕРОВ

        if (!card || !shopProduct) {
            await ctx.reply('К сожалению, информация об этом товаре не найдена.');
            return;
        }

        // --- Отображение фото (без изменений) ---
        let sentMessages = [];
        if (card.photos && card.photos.length > 0) {
            const mediaGroup = card.photos.slice(0, 10).map(photo => ({type: 'photo', media: photo.big}));
            const mediaMessages = await ctx.replyWithMediaGroup(mediaGroup);
            sentMessages.push(...mediaMessages.map(m => m.message_id));
        }

        // --- Формирование нового текста карточки ---
        const availableSizes = shopProduct.sizes.filter(s => s.amount > 0);
        const availableSizesText = availableSizes.length > 0
            ? availableSizes.map(s => s.name).join(', ')
            : 'нет в наличии';

        const caption =
            `<b>${card.title}</b>\n\n` +
            `Артикул: ${card.nmID}\n` +
            `Цена: <b>${shopProduct.price} руб.</b>\n\n` +
            `Доступные размеры: ${availableSizesText}`;

        // --- Формирование кнопок ---
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('⬅️ Назад к товарам', 'back_to_grid'),
                Markup.button.callback('🛒 Корзина', 'view_cart'),
                Markup.button.callback('🏠 Главное меню', 'back_to_main_menu')
            ],
            // Кнопка "Добавить в корзину" показывается только если есть размеры в наличии
            ...(availableSizes.length > 0 ? [[Markup.button.callback('➕ Добавить в корзину', `select_sizes:${nmID}`)]] : [])
        ]);

        const captionMessage = await ctx.replyWithHTML(caption, keyboard);
        sentMessages.push(captionMessage.message_id);

        ctx.scene.state.messagesToDelete = sentMessages;
    } catch (e) {
        console.error(`Ошибка при показе товара ${nmID}:`, e);
    }
}

const browseProductsScene = new Scenes.BaseScene('BROWSE_PRODUCTS_SCENE');

browseProductsScene.enter(async (ctx) => {
    await showProductGrid(ctx, ctx.scene.state.categoryCode, 1);
});
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
    if (selectedNumber) ctx.scene.state.returnPage = Math.ceil(parseInt(selectedNumber, 10) / 6);
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


browseProductsScene.action(/^select_sizes:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const nmID = parseInt(ctx.match[1], 10);
    const shopProduct = await ShopProduct.findOne({nmID});

    if (!shopProduct || !shopProduct.sizes) {
        return ctx.reply('Не удалось получить информацию о размерах.');
    }

    const availableSizes = shopProduct.sizes.filter(size => size.amount > 0);

    if (availableSizes.length === 0) {
        return ctx.editMessageText('К сожалению, этого товара больше нет в наличии.', Markup.inlineKeyboard([
            Markup.button.callback('⬅️ Назад к товару', `back_to_product:${nmID}`)
        ]));
    }

    const sizeButtons = availableSizes.map(size =>
        Markup.button.callback(
            `${size.name} (${size.amount} шт.)`, // Показываем остаток на кнопке
            `add_with_size:${nmID}:${size.optionId}:${encodeURIComponent(size.name)}`
        )
    );

    const keyboard = Markup.inlineKeyboard([
        ...sizeButtons.map(btn => [btn]),
        [Markup.button.callback('⬅️ Назад к товару', `back_to_product:${nmID}`)]
    ]);

    await ctx.editMessageText('<b>Выберите размер:</b>', {parse_mode: 'HTML', reply_markup: keyboard.reply_markup});
});

browseProductsScene.action(/^back_to_product:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showFullProductCard(ctx, parseInt(ctx.match[1], 10));
});


// ========================================================================
// ===       ИЗМЕНЕНИЕ №3: Самая важная часть. Уменьшаем количество     ===
// ========================================================================
browseProductsScene.action(/^add_with_size:(\d+):(\d+):(.+)$/, async (ctx) => {
    const nmID = parseInt(ctx.match[1], 10);
    const optionId = parseInt(ctx.match[2], 10);
    const sizeName = decodeURIComponent(ctx.match[3]);
    const telegramId = ctx.from.id;

    try {
        // --- ШАГ 1: Атомарно уменьшаем количество в базе ---
        const updatedProduct = await ShopProduct.findOneAndUpdate(
            // Найти документ...
            {
                nmID: nmID,
                "sizes.optionId": optionId,
                "sizes.amount": {$gt: 0} // ...где у нужного размера количество > 0
            },
            // ...и обновить его
            {
                $inc: {"sizes.$.amount": -1} // уменьшить количество найденного размера на 1
            },
            {new: true} // вернуть обновленный документ
        );

        // Если updatedProduct равен null, значит товар закончился, пока пользователь думал
        if (!updatedProduct) {
            await ctx.answerCbQuery('❗️Упс! Этот размер только что закончился.', {show_alert: true});
            // Обновляем карточку, чтобы пользователь увидел, что товара больше нет
            return showFullProductCard(ctx, nmID);
        }

        // --- ШАГ 2: Если количество успешно уменьшено, добавляем в корзину ---
        let cart = await Cart.findOne({telegramId});
        if (!cart) cart = new Cart({telegramId, items: []});
        const itemIndex = cart.items.findIndex(item => item.nmID === nmID && item.optionId === optionId);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += 1;
        } else {
            cart.items.push({nmID, optionId, sizeName, quantity: 1});
        }
        await cart.save();
        await ctx.answerCbQuery();

        // --- ШАГ 3: Показываем подтверждение ---
        const confirmationText = `✅ *Размер ${sizeName} добавлен в корзину\\.*\n\nЧто делаем дальше?`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Продолжить покупки', `continue_shopping:${nmID}`)],
            [Markup.button.callback('🛒 Перейти в корзину', 'go_to_cart')]
        ]);

        await ctx.editMessageText(confirmationText, {parse_mode: 'MarkdownV2', reply_markup: keyboard.reply_markup});

    } catch (error) {
        console.error('Ошибка добавления в корзину с размером:', error);
        await ctx.answerCbQuery('❗️ Ошибка. Попробуйте снова.');
    }
});


// ... (continue_shopping и go_to_cart остаются без изменений)
browseProductsScene.action(/^continue_shopping:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showFullProductCard(ctx, parseInt(ctx.match[1], 10));
});
browseProductsScene.action('go_to_cart', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.scene.enter('CART_SCENE');
});

module.exports = {browseProductsScene, showFullProductCard};
