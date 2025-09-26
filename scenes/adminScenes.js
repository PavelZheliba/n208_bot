// scenes/adminScenes.js

const { Scenes, Markup } = require('telegraf');
const Cards = require('../models/Cards');
const ShopCategory = require('../models/ShopCategory');
const ShopProduct = require('../models/ShopProduct');

const deleteProductWizard = new Scenes.WizardScene(
    'DELETE_PRODUCT_WIZARD', // Уникальный ID

    // --- Шаг 1: Запрос артикула ---
    async (ctx) => {
        await ctx.reply('Введите артикул (nmID) товара, который хотите удалить. Для отмены введите /cancel');
        return ctx.wizard.next();
    },

    // --- Шаг 2: Поиск товара и показ вариантов удаления ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text || ctx.message.text.toLowerCase() === '/cancel') {
            await ctx.reply('Действие отменено.');
            return ctx.scene.leave();
        }

        const nmID = parseInt(ctx.message.text, 10);
        if (isNaN(nmID)) {
            await ctx.reply('Это не артикул. Попробуйте еще раз или введите /cancel');
            return;
        }

        // 1. Ищем товар в Cards для получения его названия и фото
        const product = await Cards.findOne({ nmID });
        if (!product) {
            await ctx.reply(`Товар с артикулом ${nmID} не найден в основной базе. Проверьте правильность ввода.`);
            return ctx.scene.reenter();
        }

        // Сохраняем nmID в состоянии сцены для следующего шага
        ctx.wizard.state.nmID = nmID;
        ctx.wizard.state.productTitle = product.title;

        // 2. Ищем все категории, в которых находится этот товар
        const categories = await ShopCategory.find({ product_nmIDs: nmID });
        if (categories.length === 0) {
            await ctx.reply(`Товар "${product.title}" не найден ни в одной из витринных категорий. Возможно, он уже удален.`);
            return ctx.scene.leave();
        }

        // 3. Показываем информацию о товаре и варианты удаления
        await ctx.reply(`Найден товар: "${product.title}".\n\nВыберите действие:`);

        // Создаем кнопки для удаления из каждой конкретной категории
        const buttons = categories.map(cat =>
            Markup.button.callback(`❌ Из категории "${cat.name}"`, `delete_from_cat:${cat.code}`)
        );

        // Добавляем "опасную" кнопку для полного удаления
        buttons.push(Markup.button.callback('🗑️ Удалить из магазина ПОЛНОСТЬЮ', 'delete_from_store'));

        const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 }); // Кнопки в один столбец для наглядности
        await ctx.reply('Куда вы хотите внести изменения?', keyboard);

        return ctx.wizard.next();
    },

    // --- Шаг 3: Обработка выбора и удаление ---
    async (ctx) => {
        if (!ctx.callbackQuery || !ctx.callbackQuery.data) {
            await ctx.reply('Пожалуйста, используйте кнопки для выбора действия.');
            return;
        }

        const data = ctx.callbackQuery.data;
        const nmID = ctx.wizard.state.nmID;
        const productTitle = ctx.wizard.state.productTitle;

        try {
            if (data.startsWith('delete_from_cat:')) {
                const categoryCode = data.split(':')[1];
                // Используем оператор $pull для удаления элемента из массива
                await ShopCategory.updateOne(
                    { code: categoryCode },
                    { $pull: { product_nmIDs: nmID } }
                );
                await ctx.editMessageText(`✅ Товар "${productTitle}" успешно удален из категории!`);

            } else if (data === 'delete_from_store') {
                // Полное удаление
                // 1. Удаляем из всех категорий, где он есть
                await ShopCategory.updateMany(
                    { product_nmIDs: nmID },
                    { $pull: { product_nmIDs: nmID } }
                );
                // 2. Удаляем из коллекции с ценами и остатками
                await ShopProduct.deleteOne({ nmID: nmID });

                await ctx.editMessageText(`🗑️ Товар "${productTitle}" полностью удален из магазина (из всех категорий и прайс-листа).`);
            }
        } catch (e) {
            console.error('Ошибка при удалении товара:', e);
            await ctx.reply('Произошла ошибка при удалении. Попробуйте позже.');
        }

        return ctx.scene.leave();
    }
);

const addProductWizard = new Scenes.WizardScene(
    'ADD_PRODUCT_WIZARD', // Уникальный идентификатор этой сцены

    // --- Шаг 1: Запрос артикула у администратора ---
    async (ctx) => {
        try {
            await ctx.reply('Введите артикул (nmID) товара для добавления. Для отмены введите /cancel');
            // Переходим к следующему шагу (обработчику) в этой сцене
            return ctx.wizard.next();
        } catch (e) {
            console.error("Ошибка на шаге 1 сцены ADD_PRODUCT_WIZARD:", e);
            await ctx.reply("Произошла ошибка, попробуйте снова.");
            return ctx.scene.leave(); // Выходим из сцены в случае ошибки
        }
    },

    // --- Шаг 2: Проверка артикула и выбор категории ---
    async (ctx) => {
        try {
            // Проверяем, что пользователь отправил текстовое сообщение
            if (!ctx.message || !ctx.message.text) {
                // Если нажата кнопка или отправлен стикер, просим ввести текст
                await ctx.reply('Пожалуйста, отправьте артикул текстовым сообщением.');
                return; // Остаемся на этом же шаге, не выходя из сцены
            }

            // Обработка команды отмены
            if (ctx.message.text.toLowerCase() === '/cancel') {
                await ctx.reply('Действие отменено.');
                return ctx.scene.leave();
            }

            const nmID = parseInt(ctx.message.text, 10);
            if (isNaN(nmID)) {
                await ctx.reply('Введенное значение не похоже на артикул. Пожалуйста, введите число или /cancel');
                return; // Остаемся на этом же шаге
            }

            // Ищем товар в "сырой" базе данных Cards
            const product = await Cards.findOne({ nmID: nmID });
            if (!product) {
                await ctx.reply(`Товар с артикулом ${nmID} не найден в основной базе. Проверьте правильность ввода или введите /cancel.`);
                // ctx.scene.reenter() - хороший способ начать сцену заново, не выходя из нее
                return ctx.scene.reenter();
            }

            // Сохраняем найденный товар в состоянии "волшебника" (wizard state).
            // Эти данные будут доступны на следующих шагах этой же сцены для этого же пользователя.
            ctx.wizard.state.product = product;

            await ctx.reply('Отлично, товар найден:');

            // Формируем информацию о товаре для админа
            const photoUrl = (product.photos && product.photos.length > 0)
                ? product.photos[0].big
                : 'https://via.placeholder.com/150'; // URL-заглушка, если фото нет

            const caption = `${product.title}\n\nБренд: ${product.brand}\nАртикул: ${product.nmID}`;

            // Показываем админу, какой товар он добавляет
            await ctx.replyWithPhoto(photoUrl, { caption });

            // Получаем список всех витринных категорий для отображения в кнопках
            const categories = await ShopCategory.find({});
            if (categories.length === 0) {
                await ctx.reply('В магазине еще не создано ни одной категории. Сначала создайте их в меню администратора, а затем попробуйте снова.');
                return ctx.scene.leave();
            }

            // Создаем массив кнопок на основе найденных категорий
            const buttons = categories.map(cat =>
                Markup.button.callback(cat.name, `add_to_cat:${cat.code}`)
            );

            // Формируем клавиатуру с кнопками, по 2 в ряд
            const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

            await ctx.reply('В какую витринную категорию добавить этот товар?', keyboard);

            // Переходим к финальному шагу сцены
            return ctx.wizard.next();

        } catch (e) {
            console.error("Ошибка на шаге 2 сцены ADD_PRODUCT_WIZARD:", e);
            await ctx.reply("Произошла ошибка при поиске товара, попробуйте снова.");
            return ctx.scene.leave();
        }
    },

    // --- Шаг 3: Обработка выбора категории и добавление товара ---
    async (ctx) => {
        try {
            // Проверяем, что это действительно нажатие на кнопку (callback_query)
            if (!ctx.callbackQuery || !ctx.callbackQuery.data || !ctx.callbackQuery.data.startsWith('add_to_cat:')) {
                await ctx.reply('Пожалуйста, используйте кнопки для выбора категории.');
                return; // Остаемся на этом же шаге, ожидая нажатия кнопки
            }

            // Извлекаем код категории из данных кнопки (например, 'dresses' из 'add_to_cat:dresses')
            const categoryCode = ctx.callbackQuery.data.split(':')[1];
            // Достаем артикул товара, сохраненный на предыдущем шаге
            const product_nmID = ctx.wizard.state.product.nmID;

            // Используем оператор $addToSet в MongoDB.
            // Он добавляет элемент в массив, только если такого элемента там еще нет.
            // Это защищает нас от дублирования товаров в категориях.
            const result = await ShopCategory.updateOne(
                { code: categoryCode },
                { $addToSet: { product_nmIDs: product_nmID } }
            );

            // Анализируем результат операции
            if (result.modifiedCount > 0) {
                await ctx.editMessageText(`✅ Товар "${ctx.wizard.state.product.title}" успешно добавлен в категорию!`);
            } else {
                // modifiedCount будет 0, если документ был найден, но не изменен (т.е. товар уже был в категории)
                await ctx.editMessageText(`ℹ️ Товар "${ctx.wizard.state.product.title}" уже был в этой категории.`);
            }

        } catch (e) {
            console.error("Ошибка на шаге 3 сцены ADD_PRODUCT_WIZARD:", e);
            await ctx.reply("Произошла ошибка при добавлении товара в категорию.");
        } finally {
            // Вне зависимости от успеха или ошибки, выходим из сцены
            return ctx.scene.leave();
        }
    }
);

const createCategoryWizard = new Scenes.WizardScene(
    'CREATE_CATEGORY_WIZARD',

    // --- Шаг 1: Запрос названия категории ---
    async (ctx) => {
        await ctx.reply('Введите название для новой категории (например, "Летние платья"). Для отмены введите /cancel');
        return ctx.wizard.next();
    },

    // --- Шаг 2: Получение названия, запрос кода категории ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text || ctx.message.text.toLowerCase() === '/cancel') {
            await ctx.reply('Действие отменено.');
            return ctx.scene.leave();
        }

        // Сохраняем название в состоянии сцены
        ctx.wizard.state.categoryName = ctx.message.text;

        await ctx.reply(`Отлично! Теперь введите "код" для категории.\n\nКод должен быть уникальным, состоять из латинских букв, цифр и дефиса (например, "letnie-platya" или "sale-2024").\n\nЭтот код используется для кнопок и не виден пользователям.`);
        return ctx.wizard.next();
    },

    // --- Шаг 3: Получение кода, валидация и сохранение ---
    async (ctx) => {
        if (!ctx.message || !ctx.message.text || ctx.message.text.toLowerCase() === '/cancel') {
            await ctx.reply('Действие отменено.');
            return ctx.scene.leave();
        }

        const categoryCode = ctx.message.text.toLowerCase();

        // Валидация формата кода
        const formatRegex = /^[a-z0-9-]+$/;
        if (!formatRegex.test(categoryCode)) {
            await ctx.reply('Неверный формат кода. Используйте только латинские буквы, цифры и дефис. Попробуйте еще раз.');
            return; // Остаемся на этом же шаге
        }

        // Валидация на уникальность
        const existingCategory = await ShopCategory.findOne({ code: categoryCode });
        if (existingCategory) {
            await ctx.reply('Категория с таким кодом уже существует. Пожалуйста, придумайте другой код.');
            return; // Остаемся на этом же шаге
        }

        try {
            // Все проверки пройдены, создаем категорию
            const newCategory = new ShopCategory({
                name: ctx.wizard.state.categoryName,
                code: categoryCode,
                product_nmIDs: [] // Изначально пустая
            });
            await newCategory.save();

            await ctx.reply(`✅ Категория "${newCategory.name}" успешно создана!`);
        } catch (e) {
            console.error('Ошибка при создании категории:', e);
            await ctx.reply('Произошла ошибка при сохранении. Попробуйте позже.');
        }

        return ctx.scene.leave();
    }
);

// --- НОВАЯ СЦЕНA: Просмотр товаров в категории ---
const viewCategoryWizard = new Scenes.WizardScene(
    'VIEW_CATEGORY_WIZARD', // Уникальный ID

    // --- Шаг 1: Выбор категории для просмотра ---
    async (ctx) => {
        const categories = await ShopCategory.find({});
        if (categories.length === 0) {
            await ctx.reply('В магазине еще не создано ни одной категории.');
            return ctx.scene.leave();
        }

        const buttons = categories.map(cat =>
            Markup.button.callback(cat.name, `view_cat_products:${cat.code}`)
        );
        const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

        await ctx.reply('Выберите категорию для просмотра ее содержимого:', keyboard);
        return ctx.wizard.next();
    },

    // --- Шаг 2: Отображение товаров ---
    async (ctx) => {
        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('view_cat_products:')) {
            await ctx.reply('Пожалуйста, используйте кнопки.');
            return;
        }

        const categoryCode = ctx.callbackQuery.data.split(':')[1];

        // Получаем информацию о категории
        const category = await ShopCategory.findOne({ code: categoryCode });
        if (!category || category.product_nmIDs.length === 0) {
            await ctx.editMessageText(`В категории "${category.name}" нет товаров.`);
            return ctx.scene.leave();
        }

        await ctx.editMessageText(`🔍 Загружаю товары для категории "${category.name}"...`);

        const nmIDs = category.product_nmIDs;

        // Получаем всю необходимую информацию одним махом
        const cards = await Cards.find({ nmID: { $in: nmIDs } });
        const shopProducts = await ShopProduct.find({ nmID: { $in: nmIDs } });

        // Преобразуем в Map для быстрого доступа
        const cardsMap = new Map(cards.map(c => [c.nmID, c]));
        const shopProductsMap = new Map(shopProducts.map(p => [p.nmID, p]));

        if (cardsMap.size === 0) {
            await ctx.reply('Не удалось найти информацию о товарах. Возможно, они были удалены из основной базы.');
            return ctx.scene.leave();
        }

        let response = `<b>Товары в категории "${category.name}":</b>\n\n`;

        // Формируем красивый список
        for (const nmID of nmIDs) {
            const card = cardsMap.get(nmID);
            const shopProduct = shopProductsMap.get(nmID);

            if (!card) continue; // Пропускаем, если по какой-то причине нет данных в Cards

            const title = card.title;
            const priceInfo = shopProduct
                ? `${shopProduct.price} руб.`
                : '<b>⚠️ ЦЕНА НЕ УСТАНОВЛЕНА</b>';

            response += `▪️ ${title}\n(<code>${nmID}</code>) - ${priceInfo}\n\n`;
        }

        // Отправляем результат одним сообщением.
        // Если список очень длинный, можно разбить на несколько.
        await ctx.replyWithHTML(response);

        return ctx.scene.leave();
    }
);


// --- НОВАЯ СЦЕНА: Управление товаром (цена и наличие) ---
const manageProductWizard = new Scenes.WizardScene(
    'MANAGE_PRODUCT_WIZARD', // Уникальный ID

    // --- Шаг 1: Запрос артикула ---
    async (ctx) => {
        await ctx.reply('Введите артикул (nmID) товара для управления. Для отмены введите /cancel');
        return ctx.wizard.next();
    },

    // --- Шаг 2: Основной хаб управления ---
    // Этот шаг самый сложный. Он будет действовать как "диспетчер".
    async (ctx) => {
        // Если это первый вход в шаг, ctx.wizard.state пуст. Мы берем nmID из сообщения.
        // Если мы возвращаемся на этот шаг из другого, nmID уже будет в состоянии.
        if (!ctx.wizard.state.nmID) {
            if (!ctx.message || !ctx.message.text || ctx.message.text.toLowerCase() === '/cancel') {
                await ctx.reply('Действие отменено.');
                return ctx.scene.leave();
            }
            const nmID = parseInt(ctx.message.text, 10);
            if (isNaN(nmID)) {
                await ctx.reply('Это не артикул. Попробуйте еще раз.');
                return ctx.scene.reenter();
            }
            ctx.wizard.state.nmID = nmID;
        }

        const nmID = ctx.wizard.state.nmID;

        // Ищем товар в обеих коллекциях
        const card = await Cards.findOne({ nmID });
        const shopProduct = await ShopProduct.findOne({ nmID });

        if (!card) {
            await ctx.reply(`Товар с артикулом ${nmID} не найден в основной базе. Проверьте правильность ввода.`);
            return ctx.scene.leave();
        }

        // --- СЦЕНАРИЙ 1: Товар новый (нет в shop_products) ---
        if (!shopProduct) {
            await ctx.reply(`Товар "${card.title}" еще не добавлен в магазин.\n\nВведите цену для него (например, 4990), чтобы добавить. Для отмены /cancel.`);
            // Переходим на следующий шаг, который будет ждать ввода цены
            return ctx.wizard.next();
        }

        // --- СЦЕНАРИЙ 2: Товар уже в магазине ---
        ctx.wizard.state.card = card;
        ctx.wizard.state.shopProduct = shopProduct;

        // Формируем и отправляем "панель управления" товаром
        const caption = `<b>${card.title}</b>\n\n<b>Цена:</b> ${shopProduct.price} руб.\n\n<b>Наличие размеров:</b>\n${shopProduct.sizes.map(s => `${s.isAvailable ? '✅' : '❌'} ${s.techSize}`).join('\n')}`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Изменить цену', 'edit_price')],
            [Markup.button.callback('🔄 Управление размерами', 'edit_sizes')],
            [Markup.button.callback('✅ Готово', 'done')]
        ]);

        await ctx.replyWithHTML(caption, keyboard);
        // Переходим на шаг, который будет обрабатывать нажатия этих кнопок
        return ctx.wizard.selectStep(3); // Явно переходим на 4й шаг (индекс 3)
    },

    // --- Шаг 3: Обработка нового товара (ждем цену) ---
    async (ctx) => {
        const price = parseInt(ctx.message.text, 10);
        if (isNaN(price) || price <= 0) {
            await ctx.reply('Неверная цена. Введите положительное число или /cancel');
            return; // Остаемся на этом шаге
        }

        const nmID = ctx.wizard.state.nmID;
        const card = await Cards.findOne({ nmID });

        // Создаем массив размеров на основе данных из Cards
        const sizesFromCard = card.sizes.map(s => ({
            techSize: s.techSize,
            isAvailable: true // По умолчанию все размеры в наличии
        }));

        // Создаем новую запись в shop_products
        await ShopProduct.create({
            nmID,
            price,
            sizes: sizesFromCard
        });

        await ctx.reply(`✅ Товар "${card.title}" добавлен в магазин по цене ${price} руб.`);
        // Возвращаемся ко второму шагу, чтобы показать панель управления
        return ctx.wizard.selectStep(1); // Индекс шага 2 - это 1
    },

    // --- Шаг 4: Обработка кнопок панели управления ---
    async (ctx) => {
        if (!ctx.callbackQuery) return;
        const action = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (action === 'edit_price') {
            await ctx.reply('Введите новую цену:');
            return ctx.wizard.next(); // Переходим на шаг 5 для ввода цены
        }
        if (action === 'edit_sizes') {
            const { shopProduct } = ctx.wizard.state;
            const sizeButtons = shopProduct.sizes.map(s =>
                Markup.button.callback(`${s.isAvailable ? '✅' : '❌'} ${s.techSize}`, `toggle_size:${s.techSize}`)
            );
            const keyboard = Markup.inlineKeyboard(sizeButtons, { columns: 3 });
            await ctx.editMessageText('Нажимайте на размеры, чтобы изменить их наличие. Когда закончите, вернитесь в /admin.', keyboard);
            // Остаемся на этом же шаге для обработки нажатий на размеры
            return ctx.wizard.selectStep(5); // Переходим на шаг 6 (управление размерами)
        }
        if (action === 'done') {
            await ctx.reply('Изменения сохранены.');
            return ctx.scene.leave();
        }
    },

    // --- Шаг 5: Обработка ввода новой цены ---
    async (ctx) => {
        const price = parseInt(ctx.message.text, 10);
        if (isNaN(price) || price <= 0) {
            await ctx.reply('Неверная цена. Введите положительное число.');
            return;
        }

        const nmID = ctx.wizard.state.nmID;
        await ShopProduct.updateOne({ nmID }, { $set: { price: price } });
        await ctx.reply(`Цена для товара обновлена на ${price} руб.`);

        // Возвращаемся к панели управления (шаг 2)
        return ctx.wizard.selectStep(1);
    },

    // --- Шаг 6: Интерактивное управление размерами ---
    async (ctx) => {
        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('toggle_size:')) {
            await ctx.reply('Пожалуйста, используйте кнопки.');
            return;
        }
        await ctx.answerCbQuery();
        const techSizeToToggle = ctx.callbackQuery.data.split(':')[1];
        const { nmID } = ctx.wizard.state;

        // Находим товар и инвертируем значение isAvailable для нужного размера
        // Это сложный запрос MongoDB, который обновляет элемент внутри массива
        const product = await ShopProduct.findOne({ nmID });
        const size = product.sizes.find(s => s.techSize === techSizeToToggle);
        await ShopProduct.updateOne(
            { nmID, "sizes.techSize": techSizeToToggle },
            { $set: { "sizes.$.isAvailable": !size.isAvailable } }
        );

        // Обновляем клавиатуру "на лету"
        const updatedProduct = await ShopProduct.findOne({ nmID }); // Получаем обновленные данные
        const sizeButtons = updatedProduct.sizes.map(s =>
            Markup.button.callback(`${s.isAvailable ? '✅' : '❌'} ${s.techSize}`, `toggle_size:${s.techSize}`)
        );
        // Добавляем кнопку "Готово" для выхода из этого режима
        sizeButtons.push(Markup.button.callback('✅ Готово с размерами', 'sizes_done'));
        const keyboard = Markup.inlineKeyboard(sizeButtons, { columns: 3 });
        await ctx.editMessageReplyMarkup(keyboard.reply_markup);

        // Если нажали "Готово с размерами", возвращаемся в главный хаб
        if (ctx.callbackQuery.data === 'sizes_done') {
            return ctx.wizard.selectStep(1);
        }
    }
);




module.exports = {
    addProductWizard,
    createCategoryWizard,
    deleteProductWizard,
    manageProductWizard,
    viewCategoryWizard,
};