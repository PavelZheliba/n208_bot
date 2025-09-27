// /wizards/addCategoryWizard.js
const { Scenes } = require('telegraf');
const ShopCategory = require('../models/ShopCategory');

// Шаг 1: Запрос названия категории
const askForName = async (ctx) => {
    // Инициализируем хранилище данных для этого визарда
    ctx.wizard.state.categoryData = {};
    await ctx.reply('Введите название новой категории (например, "Пиджаки"). Для отмены введите /cancel');
    // Переходим к следующему шагу
    return ctx.wizard.next();
};

// Шаг 2: Обработка названия и запрос кода категории
const processNameAndAskForCode = async (ctx) => {
    if (ctx.message.text === '/cancel') {
        await ctx.reply('Создание категории отменено.');
        return ctx.scene.leave();
    }
    const categoryName = ctx.message.text;
    if (!categoryName || categoryName.length < 2) {
        await ctx.reply('Название слишком короткое. Попробуйте еще раз или введите /cancel.');
        return; // Остаемся на этом же шаге
    }
    // Сохраняем название в состоянии визарда
    ctx.wizard.state.categoryData.name = categoryName;

    await ctx.reply('Отлично! Теперь введите уникальный код для категории (например, "jackets").\n\nИспользуйте только латинские буквы в нижнем регистре, цифры и нижнее подчеркивание. Этот код нельзя будет изменить.');
    return ctx.wizard.next();
};

// Шаг 3: Обработка кода и сохранение категории в базу данных
const processCodeAndSave = async (ctx) => {
    if (ctx.message.text === '/cancel') {
        await ctx.reply('Создание категории отменено.');
        return ctx.scene.leave();
    }
    const categoryCode = ctx.message.text;

    // Проверка кода на корректность (только a-z, 0-9, _)
    if (!/^[a-z0-9_]+$/.test(categoryCode)) {
        await ctx.reply('Неверный формат кода. Используйте только латинские буквы в нижнем регистре, цифры и _. Попробуйте снова или введите /cancel.');
        return; // Остаемся на этом же шаге
    }

    try {
        // Проверка на уникальность кода
        const existingCategory = await ShopCategory.findOne({ code: categoryCode });
        if (existingCategory) {
            await ctx.reply('Категория с таким кодом уже существует. Пожалуйста, придумайте другой код.');
            return; // Остаемся на этом же шаге
        }

        // Сохраняем код и создаем новую категорию
        ctx.wizard.state.categoryData.code = categoryCode;
        const newCategory = new ShopCategory(ctx.wizard.state.categoryData);
        await newCategory.save();

        await ctx.replyWithHTML(`✅ Категория "<b>${newCategory.name}</b>" с кодом <code>${newCategory.code}</code> успешно создана!`);
    } catch (error) {
        console.error("Ошибка при сохранении категории:", error);
        await ctx.reply('Произошла ошибка при сохранении. Попробуйте позже.');
    }

    // Завершаем сцену (визард)
    return ctx.scene.leave();
};


// Создаем сам визард, передавая ему ID и последовательность шагов
const addCategoryWizard = new Scenes.WizardScene(
    'ADD_CATEGORY_WIZARD', // Уникальный ID этого визарда
    askForName,
    processNameAndAskForCode,
    processCodeAndSave
);

module.exports = addCategoryWizard;

