// /wizards/addProductWizard.js
const { Scenes } = require('telegraf');
const ShopProduct = require('../models/ShopProduct');
const Cards = require('../models/Cards');

const askForNmID = async (ctx) => { /* ... без изменений ... */
    ctx.wizard.state.productData = {};
    await ctx.reply('Введите артикул товара (nmID) для добавления:');
    return ctx.wizard.next();
};

const processNmIDAndAskPrice = async (ctx) => { /* ... без изменений ... */
    const nmID = parseInt(ctx.message.text, 10);
    if (isNaN(nmID)) { await ctx.reply('Неверный формат...'); return; }
    const existingProduct = await ShopProduct.findOne({ nmID });
    if (existingProduct) { await ctx.reply('Товар с таким артикулом уже существует...'); return ctx.scene.leave(); }
    const card = await Cards.findOne({ nmID }).lean();
    if (!card) { await ctx.reply(`Артикул ${nmID} не найден...`); return ctx.scene.leave(); }
    ctx.wizard.state.productData.nmID = nmID;
    ctx.wizard.state.cardData = card;
    await ctx.reply(`Товар "${card.title}" найден. Теперь введите цену для него:`);
    return ctx.wizard.next();
};

const processPriceAndSave = async (ctx) => {
    const price = parseInt(ctx.message.text, 10);
    if (isNaN(price) || price <= 0) {
        await ctx.reply('Неверный формат цены. Введите положительное число.');
        return;
    }
    ctx.wizard.state.productData.price = price;
    ctx.wizard.state.productData.active = true;

    const card = ctx.wizard.state.cardData;
    let sizesForShopProduct = [];

    if (card && Array.isArray(card.sizes) && card.sizes.length > 0) {
        sizesForShopProduct = card.sizes
            // <--- ИЗМЕНЕНИЕ: Проверяем наличие size.techSize
            .filter(size => size && size.optionId && size.techSize)
            .map(size => ({
                optionId: size.optionId,
                // <--- ИЗМЕНЕНИЕ: Читаем из size.techSize и записываем в поле `name` нашей модели
                name: size.techSize,
                amount: 0
            }));
    }

    ctx.wizard.state.productData.sizes = sizesForShopProduct;

    try {
        const newProduct = new ShopProduct(ctx.wizard.state.productData);
        await newProduct.save();
        let sizesReport = 'данные о размерах не найдены в справочнике.';
        if (sizesForShopProduct.length > 0) {
            sizesReport = `добавлены размеры: <b>${sizesForShopProduct.map(s => s.name).join(', ')}</b>`;
        }
        await ctx.replyWithHTML(
            `✅ <b>Товар успешно добавлен!</b>\n` +
            `<b>Артикул:</b> ${newProduct.nmID}\n` +
            `<b>Название:</b> ${card.title}\n` +
            `<b>Цена:</b> ${newProduct.price} руб.\n` +
            `Статус: ${sizesReport}\n\n` +
            `❗️<b>ВАЖНО:</b> Количество всех размеров установлено в 0. Обновите его в базе данных.`
        );
    } catch (error) {
        console.error('Ошибка при сохранении товара:', error);
        await ctx.reply(`Ошибка валидации при сохранении: ${error.message}`);
    }
    return ctx.scene.leave();
};

const addProductWizard = new Scenes.WizardScene(
    'ADD_PRODUCT_WIZARD',
    askForNmID,
    processNmIDAndAskPrice,
    processPriceAndSave
);

module.exports = addProductWizard;
