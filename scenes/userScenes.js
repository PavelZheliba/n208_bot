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
    const availableProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
    const availableNmIDs = availableProducts.map(p => p.nmID);
    const totalProducts = availableNmIDs.length;
    const productsOnPage = await Cards.find({ nmID: { $in: availableNmIDs } }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);
    if (productsOnPage.length === 0) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 'В этой категории больше нет товаров.');
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

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Меняем порядок строк в клавиатуре ---
    // Первый ряд - номера (numberButtons), второй ряд - навигация (controlButtons)
    const keyboard = Markup.inlineKeyboard([
        numberButtons,
        controlButtons
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
    await ctx.replyWithMediaGroup(mediaGroup);
    await ctx.reply('Выберите товар по его номеру:', keyboard);
}

async function showFullProductCard(ctx, nmID) {
    // ... (эта функция без изменений)
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
    ctx.scene.state.categoryCode = ctx.scene.state.categoryCode;
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
