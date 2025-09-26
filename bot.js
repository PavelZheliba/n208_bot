require('dotenv').config();
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN не найден! Проверьте ваш .env файл.');
}

const bot = new Telegraf(BOT_TOKEN);

module.exports = bot;
