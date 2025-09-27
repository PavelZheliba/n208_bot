// /handlers/adminHandler.js
const { Markup } = require('telegraf');
const bot = require('../bot');
const Admin = require('../models/Admin');
const ShopCategory = require('../models/ShopCategory');

// ========================================================================
// ===                     ОБНОВЛЯЕМ ФУНКЦИЮ ПРОВЕРКИ                   ===
// ========================================================================
async function isAdmin(telegramId) {
    // 1. Получаем список ID "супер-админов" из файла .env
    const superAdminIdsEnv = process.env.ADMIN_IDS || '';
    const superAdminIds = superAdminIdsEnv.split(',').map(Number);

    // 2. Проверяем, есть ли ID пользователя в этом списке.
    // Если есть - сразу возвращаем true, не обращаясь к базе. Это быстро.
    if (superAdminIds.includes(telegramId)) {
        return true;
    }

    // 3. Если пользователь не "супер-админ", проверяем его в базе данных.
    const adminFromDb = await Admin.findOne({ telegramId });
    return !!adminFromDb; // вернет true, если найден в базе, иначе false
}
// ========================================================================


function registerAdminHandlers() {
    bot.command('admin', async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.scene.enter('ADMIN_SCENE');
    });

    bot.action('manage_categories', async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.answerCbQuery();

        const categories = await ShopCategory.find({});
        const buttons = categories.map(cat => [Markup.button.callback(cat.name, `manage_category:${cat.code}`)]);
        buttons.push(
            [Markup.button.callback('➕ Добавить категорию', 'add_category')],
            [Markup.button.callback('➖ Удалить категорию', 'remove_category')],
            [Markup.button.callback('⬅️ Назад в админку', 'back_to_admin_menu')]
        );

        await ctx.editMessageText('Управление категориями:', Markup.inlineKeyboard(buttons));
    });

    bot.action(/^manage_category:(.+)$/, async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.answerCbQuery();

        const categoryCode = ctx.match[1];
        await ctx.scene.enter('MANAGE_PRODUCTS_WIZARD', { categoryCode: categoryCode });
    });

    bot.action('add_category', async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.answerCbQuery();
        await ctx.scene.enter('ADD_CATEGORY_WIZARD');
    });

    bot.action('remove_category', async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.answerCbQuery();
        await ctx.scene.enter('REMOVE_CATEGORY_WIZARD');
    });

    bot.action('back_to_admin_menu', async (ctx) => {
        if (!await isAdmin(ctx.from.id)) return;
        await ctx.answerCbQuery();
        await ctx.scene.reenter();
    });

    bot.on('text', async (ctx, next) => {
        // Проверяем, является ли пользователь админом, прежде чем что-то делать
        // const isUserAdmin = await isAdmin(ctx.from.id);

        // Этот блок теперь не нужен, так как проверка есть в каждой команде
        // if (isUserAdmin && (!ctx.scene || !ctx.scene.current)) {
        //     return ctx.reply('Пожалуйста, используйте кнопки или команду /admin.');
        // }

        // Передаем управление дальше другим обработчикам
        return next();
    });
}

module.exports = { registerAdminHandlers };
