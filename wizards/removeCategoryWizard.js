// /wizards/removeCategoryWizard.js
const { Scenes, Markup } = require('telegraf');
const ShopCategory = require('../models/ShopCategory');

// Создаем сцену. Она не будет многошаговой в плане текста,
// но будет использовать кнопки для навигации по шагам.
const removeCategoryWizard = new Scenes.BaseScene('REMOVE_CATEGORY_WIZARD');

// ШАГ 1: При входе в сцену показываем список категорий для удаления
removeCategoryWizard.enter(async (ctx) => {
    const categories = await ShopCategory.find({});

    if (categories.length === 0) {
        await ctx.reply('Нет категорий для удаления.');
        return ctx.scene.leave();
    }

    // Создаем по одной кнопке для каждой категории
    const buttons = categories.map(cat =>
        [Markup.button.callback(
            `❌ ${cat.name}`, // Текст на кнопке
            `confirm_delete:${cat._id}` // callback_data с ID категории
        )]
    );

    // Добавляем кнопку отмены
    buttons.push([Markup.button.callback('⬅️ Отмена', 'cancel_delete')]);

    await ctx.reply('Выберите категорию, которую хотите удалить:', Markup.inlineKeyboard(buttons));
});


// ШАГ 2: Пользователь нажал на категорию. Показываем подтверждение.
removeCategoryWizard.action(/^confirm_delete:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = ctx.match[1];

    try {
        const category = await ShopCategory.findById(categoryId);
        if (!category) {
            await ctx.editMessageText('Категория не найдена. Возможно, она уже была удалена.');
            return ctx.scene.leave();
        }

        // Сохраняем ID в состоянии сцены, чтобы следующий шаг знал, что удалять
        ctx.scene.state.categoryIdToDelete = categoryId;
        ctx.scene.state.categoryNameToDelete = category.name;

        const confirmationKeyboard = Markup.inlineKeyboard([
            Markup.button.callback('‼️ ДА, УДАЛИТЬ ‼️', 'perform_delete'),
            Markup.button.callback('⬅️ Нет, отмена', 'cancel_delete')
        ]);

        await ctx.editMessageText(
            `Вы уверены, что хотите удалить категорию "${category.name}"?\n\n` +
            `⚠️ ВНИМАНИЕ: Это действие необратимо!`,
            confirmationKeyboard
        );

    } catch (error) {
        console.error("Ошибка при поиске категории для удаления:", error);
        await ctx.reply('Произошла ошибка.');
        return ctx.scene.leave();
    }
});


// ШАГ 3: Пользователь подтвердил удаление. Выполняем.
removeCategoryWizard.action('perform_delete', async (ctx) => {
    await ctx.answerCbQuery();

    const categoryId = ctx.scene.state.categoryIdToDelete;
    const categoryName = ctx.scene.state.categoryNameToDelete || 'удаленную категорию';

    if (!categoryId) {
        await ctx.editMessageText('Произошла ошибка. Не удалось определить категорию для удаления.');
        return ctx.scene.leave();
    }

    try {
        await ShopCategory.findByIdAndDelete(categoryId);
        await ctx.editMessageText(`✅ Категория "${categoryName}" успешно удалена.`);
    } catch (error) {
        console.error("Ошибка при удалении категории:", error);
        await ctx.editMessageText('Произошла ошибка при удалении.');
    }

    return ctx.scene.leave();
});


// Обработчик для кнопки отмены на любом шаге
removeCategoryWizard.action('cancel_delete', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Удаление отменено.');
    return ctx.scene.leave();
});

module.exports = removeCategoryWizard;
