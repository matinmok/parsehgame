const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        ...options
      };
      
      return await this.bot.sendMessage(chatId, text, payload);
    } catch (error) {
      console.error('Send message error:', error);
      return { ok: false, description: error.message };
    }
  }

  async editMessage(chatId, messageId, text, options = {}) {
    try {
      const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        ...options
      };
      
      return await this.bot.editMessageText(text, payload);
    } catch (error) {
      console.error('Edit message error:', error);
      return { ok: false, description: error.message };
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      return await this.bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Delete message error:', error);
      return { ok: false, description: error.message };
    }
  }

  async sendPhoto(chatId, photoUrl, caption = '', options = {}) {
    try {
      const payload = {
        caption: caption,
        parse_mode: 'HTML',
        ...options
      };
      
      return await this.bot.sendPhoto(chatId, photoUrl, payload);
    } catch (error) {
      console.error('Send photo error:', error);
      return { ok: false, description: error.message };
    }
  }

  async answerCallbackQuery(queryId, text = '', showAlert = false) {
    try {
      return await this.bot.answerCallbackQuery(queryId, {
        text: text,
        show_alert: showAlert
      });
    } catch (error) {
      console.error('Answer callback query error:', error);
      return { ok: false, description: error.message };
    }
  }

  async setWebhook(url) {
    try {
      return await this.bot.setWebHook(url);
    } catch (error) {
      console.error('Set webhook error:', error);
      return { ok: false, description: error.message };
    }
  }

  async deleteWebhook() {
    try {
      return await this.bot.deleteWebHook();
    } catch (error) {
      console.error('Delete webhook error:', error);
      return { ok: false, description: error.message };
    }
  }
}

module.exports = TelegramService;
