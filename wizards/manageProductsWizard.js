// /wizards/manageProductsWizard.js
const { Scenes, Markup } = require('telegraf');
const ShopProduct = require('../models/ShopProduct');
const Cards = require('../models/Cards');
const ShopCategory = require('../models/ShopCategory');

// ========================================================================
// ===                   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ                      ===
// ========================================================================

/**
 * Показывает главное меню управления товаром (с кнопками остатков, размеров, цены).
 */
async function showProductManagementMenu(ctx, nmID) {
    const card = await Cards.findOne({ nmID });
    const shopProduct = await ShopProduct.findOne({ nmID });

    if (!card || !shopProduct) {
        await ctx.reply('Не удалось найти информацию о товаре.');
        return ctx.scene.leave();
    }

    ctx.wizard.state.cardData = card;
    ctx.wizard.state.shopProduct = shopProduct;
    ctx.wizard.state.nmID = nmID;

    const stockItems = shopProduct.sizes
        .filter(s => s.amount > 0)
        .map(s => `${s.name} - ${s.amount} шт.`);
    const stockInfo = stockItems.length > 0 ? stockItems.join('\n') : 'Нет на складе';

    const message = `<b>Управление товаром:</b>\n` +
        `<em>${card.title}</em>\n\n` +
        `<b>Артикул:</b> ${nmID}\n` +
        `<b>Текущая цена:</b> ${shopProduct.price} руб.\n\n` +
        `<b>Остатки на складе:</b>\n` +
        `${stockInfo}`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📦 Изменить остатки', 'edit_stock')],
        [Markup.button.callback('📏 Изменить размеры', 'edit_sizes')],
        [Markup.button.callback('💰 Изменить цену', 'edit_price')],
        [Markup.button.callback('⬅️ Назад к списку товаров', 'back_to_list')]
    ]);

    if (ctx.callbackQuery) {
        try {
            await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: keyboard.reply_markup });
        } catch (e) {
            // Игнорируем ошибку, если сообщение не изменилось
        }
    } else {
        await ctx.replyWithHTML(message, keyboard);
    }
}

/**
 * Показывает меню для включения/выключения размеров для продажи.
 */
async function showSizeManagementMenu(ctx) {
    const { nmID } = ctx.wizard.state;
    const card = await Cards.findOne({ nmID });
    const shopProduct = await ShopProduct.findOne({ nmID });

    if (!card || !card.sizes || card.sizes.length === 0) {
        await ctx.reply('В справочнике для этого товара не найдено размеров.');
        return showProductManagementMenu(ctx, nmID);
    }

    const activeSkus = new Set(shopProduct.sizes.map(s => s.sku));

    const sizeToggleButtons = card.sizes
        .filter(size => size.skus && size.skus.length > 0) // Убедимся, что SKU существует
        .map(size => {
            const sku = size.skus[0]; // Берем первый SKU как идентификатор
            const isActive = activeSkus.has(sku);
            const buttonText = `${isActive ? '✅' : '❌'} ${size.techSize}`;
            const callbackData = `toggle_size:${sku}:${encodeURIComponent(size.techSize)}:${isActive ? '1' : '0'}`;
            return [Markup.button.callback(buttonText, callbackData)];
        });

    sizeToggleButtons.push([Markup.button.callback('⬅️ Назад', 'back_to_product_menu')]);

    await ctx.editMessageText(
        'Выберите размеры, которые будут доступны для продажи.\n\n' +
        '✅ - размер активен\n❌ - размер скрыт',
        Markup.inlineKeyboard(sizeToggleButtons)
    );
}


// ========================================================================
// ===                      ОСНОВНОЙ КОД ВИЗАРДА                      ===
// ========================================================================

const manageProductsWizard = new Scenes.WizardScene(
    'MANAGE_PRODUCTS_WIZARD',

    // --- ШАГ 0: Показ списка товаров, ожидание nmID ---
    async (ctx) => {
        const categoryCode = ctx.wizard.state.categoryCode;
        const category = await ShopCategory.findOne({ code: categoryCode });
        if (!category) {
            await ctx.reply('Ошибка: категория не найдена.');
            return ctx.scene.leave();
        }

        const cards = await Cards.find({ nmID: { $in: category.product_nmIDs } });
        const shopProducts = await ShopProduct.find({ nmID: { $in: category.product_nmIDs } });
        const shopProductMap = new Map(shopProducts.map(p => [p.nmID, p]));

        let message = `Товары в категории "<b>${category.name}</b>":\n\n`;

        if (cards.length === 0) {
            message += 'В этой категории нет товаров.';
        } else {
            cards.forEach(card => {
                const shopProduct = shopProductMap.get(card.nmID);
                message += `▪️ ${card.title}\n(${card.nmID}) - `;
                if (shopProduct) {
                    const stockItems = shopProduct.sizes.filter(s => s.amount > 0).map(s => `${s.name}-${s.amount}`);
                    const stockInfo = stockItems.length > 0 ? stockItems.join(', ') : 'нет на складе';
                    message += `✅ Цена: ${shopProduct.price} руб. Остатки: ${stockInfo}\n\n`;
                } else {
                    message += `⚠️ <b>ЦЕНА НЕ УСТАНОВЛЕНА</b>\n\n`;
                }
            });
        }

        await ctx.replyWithHTML(message);
        await ctx.reply('Введите артикул (nmID) товара для управления или /cancel для выхода.');
        return ctx.wizard.next();
    },

    // --- ШАГ 1: Обработка nmID, определение дальнейшего шага ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) { return; }
        if (ctx.message.text === '/cancel') { await ctx.reply('Отменено.'); return ctx.scene.leave(); }

        const nmID = parseInt(ctx.message.text, 10);
        if (isNaN(nmID)) { await ctx.reply('Неверный формат. Введите числовой артикул.'); return; }

        const card = await Cards.findOne({ nmID }).lean();
        if (!card) {
            await ctx.reply(`Товар с артикулом ${nmID} не найден в общем справочнике. Проверьте правильность ввода.`);
            return ctx.scene.leave();
        }

        const shopProduct = await ShopProduct.findOne({ nmID });

        if (shopProduct) {
            await showProductManagementMenu(ctx, nmID);
            return ctx.wizard.next(); // Переходим на ШАГ 2 (главный цикл)
        } else {
            ctx.wizard.state.cardData = card;
            ctx.wizard.state.nmID = nmID;
            await ctx.reply(`Товар "${card.title}" еще не добавлен в магазин.\n\nВведите цену для него (например, 4990), чтобы добавить. Для отмены /cancel.`);
            return ctx.wizard.selectStep(3); // Переходим на ШАГ 3 (создание)
        }
    },

    // --- ШАГ 2: Главный цикл, обрабатывает ТОЛЬКО текст ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            return;
        }

        const input = ctx.message.text;
        const { action, sku, nmID } = ctx.wizard.state;

        if (action === 'editing_stock') {
            const product = await ShopProduct.findOne({ nmID });
            const sizeToUpdate = product.sizes.find(s => s.sku === sku);
            const currentAmount = sizeToUpdate.amount;
            let newAmount;

            if (input.startsWith('+')) { newAmount = currentAmount + parseInt(input.substring(1), 10); }
            else if (input.startsWith('-')) { newAmount = currentAmount - parseInt(input.substring(1), 10); }
            else { newAmount = parseInt(input, 10); }

            if (!isNaN(newAmount) && newAmount >= 0) {
                await ShopProduct.updateOne({ nmID, "sizes.sku": sku }, { $set: { "sizes.$.amount": newAmount } });
                await ShopCategory.updateOne({ code: ctx.wizard.state.categoryCode }, { $addToSet: { product_nmIDs: nmID } });
                await ctx.reply(`✅ Остаток для размера ${sizeToUpdate.name} обновлен на ${newAmount} шт.`);
            } else { await ctx.reply('Некорректное значение. Количество должно быть положительным числом.'); }
        }

        if (action === 'editing_price') {
            const newPrice = parseInt(input, 10);
            if (!isNaN(newPrice) && newPrice > 0) {
                await ShopProduct.updateOne({ nmID }, { $set: { price: newPrice } });
                await ctx.reply(`✅ Цена обновлена на ${newPrice} руб.`);
            } else { await ctx.reply('Некорректная цена. Введите положительное число.'); }
        }

        await showProductManagementMenu(ctx, nmID);
        return ctx.wizard.selectStep(2); // Остаемся в главном цикле
    },

    // --- ШАГ 3: Создание нового товара ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) { return; }
        if (ctx.message.text === '/cancel') { await ctx.reply('Создание отменено.'); return ctx.scene.leave(); }

        const price = parseInt(ctx.message.text, 10);
        if (isNaN(price) || price <= 0) {
            await ctx.reply('Неверный формат цены. Введите положительное число или /cancel.');
            return;
        }

        const { nmID, cardData } = ctx.wizard.state;
        const sizesForShopProduct = (cardData.sizes || [])
            .filter(size => size && size.techSize && size.skus && size.skus.length > 0)
            .map(size => ({
                sku: size.skus[0],
                name: size.techSize,
                amount: 0
            }));

        try {
            const newProduct = new ShopProduct({ nmID, price, active: true, sizes: sizesForShopProduct });
            await newProduct.save();
            await ShopCategory.updateOne({ code: ctx.wizard.state.categoryCode }, { $addToSet: { product_nmIDs: newProduct.nmID } });
            await ctx.replyWithHTML(`✅ Товар "<b>${cardData.title}</b>" успешно добавлен с ценой <b>${price}</b> руб.`);
        } catch (error) {
            console.error("Ошибка при создании товара:", error);
            await ctx.reply(`Произошла ошибка при сохранении товара: ${error.message}`);
        }

        return ctx.scene.leave();
    }
);


// ========================================================================
// ===                  ОБРАБОТЧИКИ КНОПОК (ACTIONS)                    ===
// ========================================================================

manageProductsWizard.action('edit_sizes', async (ctx) => {
    await ctx.answerCbQuery();
    await showSizeManagementMenu(ctx);
});

manageProductsWizard.action(/^toggle_size:(.+):(.+):([01])$/, async (ctx) => {
    await ctx.answerCbQuery();
    const sku = ctx.match[1];
    const sizeName = decodeURIComponent(ctx.match[2]);
    const wasActive = ctx.match[3] === '1';
    const { nmID } = ctx.wizard.state;

    if (wasActive) {
        await ShopProduct.updateOne({ nmID }, { $pull: { sizes: { sku: sku } } });
    } else {
        const newSize = { sku: sku, name: sizeName, amount: 0 };
        await ShopProduct.updateOne({ nmID }, { $push: { sizes: newSize } });
    }
    await showSizeManagementMenu(ctx);
});

manageProductsWizard.action('edit_stock', async (ctx) => {
    await ctx.answerCbQuery();
    const { shopProduct } = ctx.wizard.state;
    if (!shopProduct || shopProduct.sizes.length === 0) {
        await ctx.editMessageText('У этого товара нет активных размеров для редактирования. Сначала добавьте их в меню "Изменить размеры".', Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Назад', 'back_to_product_menu')]
        ]));
        return;
    }
    const sizeButtons = shopProduct.sizes.map(size => [Markup.button.callback(`${size.name} (${size.amount} шт.)`, `select_size_stock:${size.sku}`)]);
    sizeButtons.push([Markup.button.callback('⬅️ Назад', 'back_to_product_menu')]);
    await ctx.editMessageText('Выберите размер для изменения остатка:', Markup.inlineKeyboard(sizeButtons));
});

manageProductsWizard.action(/^select_size_stock:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const sku = ctx.match[1];
    const { shopProduct } = ctx.wizard.state;
    const size = shopProduct.sizes.find(s => s.sku === sku);

    ctx.wizard.state.action = 'editing_stock';
    ctx.wizard.state.sku = sku;

    await ctx.editMessageText(`Введите новое количество для размера <b>${size.name}</b> (сейчас ${size.amount} шт.).\n\nИспользуйте <code>+N</code>, <code>-N</code>, или просто <code>N</code>.`, {parse_mode: 'HTML'});
});

manageProductsWizard.action('edit_price', async (ctx) => {
    await ctx.answerCbQuery();
    const { shopProduct } = ctx.wizard.state;
    ctx.wizard.state.action = 'editing_price';
    await ctx.editMessageText(`Введите новую цену (текущая: ${shopProduct.price} руб.):`);
});

manageProductsWizard.action('back_to_product_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await showProductManagementMenu(ctx, ctx.wizard.state.nmID);
});

manageProductsWizard.action('back_to_list', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.reenter();
});

module.exports = manageProductsWizard;