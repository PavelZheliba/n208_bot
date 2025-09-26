// handlers/adminHandler.js
const bot = require('../bot');
const { Markup } = require('telegraf');

const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim(), 10));

// Миддлвер для проверки, является ли пользователь админом
const adminMiddleware = (ctx, next) => {
    if (ADMIN_IDS.includes(ctx.from.id)) {
        return next();
    }
    ctx.reply('У вас нет доступа к этой команде.').catch(e => console.error(e));
};

function registerAdminHandlers() {

    const adminMenu = Markup.inlineKeyboard([
        [Markup.button.callback('⚙️ Управление товаром (цена/наличие)', 'admin:manage_product')],
        [Markup.button.callback('👁️ Посмотреть категорию', 'admin:view_category')], // <-- НОВАЯ КНОПКА
        [Markup.button.callback('➕ Добавить товар в категорию', 'admin:add_product')],
        [Markup.button.callback('📁 Создать категорию', 'admin:create_cat')],
        [Markup.button.callback('❌ Удалить товар', 'admin:delete_product')],
    ], { columns: 2 }); // Можно вернуть 2 колонки, если помещается



    bot.command('admin', adminMiddleware, async (ctx) => {
        await ctx.reply('Добро пожаловать в панель администратора!', adminMenu);
    });

    bot.action('admin:view_category', adminMiddleware, async (ctx) => {
        await ctx.answerCbQuery();
        ctx.scene.enter('VIEW_CATEGORY_WIZARD');
    });

    bot.action('admin:add_product', adminMiddleware, async (ctx) => {
        await ctx.answerCbQuery();
        ctx.scene.enter('ADD_PRODUCT_WIZARD');
    });

    bot.action('admin:manage_product', adminMiddleware, async (ctx) => {
        await ctx.answerCbQuery();
        ctx.scene.enter('MANAGE_PRODUCT_WIZARD');
    });

    bot.action('admin:create_cat', adminMiddleware, async (ctx) => {
        await ctx.answerCbQuery(); // Убираем "часики" на кнопке
        ctx.scene.enter('CREATE_CATEGORY_WIZARD'); // Входим в нашу новую сцену
    });

    bot.action('admin:delete_product', adminMiddleware, async (ctx) => {
        await ctx.answerCbQuery();
        ctx.scene.enter('DELETE_PRODUCT_WIZARD'); // Входим в сцену удаления
    });
    console.log('Обработчики для администратора зарегистрированы.');
}
module.exports = { registerAdminHandlers };
