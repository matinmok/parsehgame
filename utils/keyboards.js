const config = require('../config');

const KEYBOARDS = {
  main: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 خرید سرویس', callback_data: 'buy_service' },
          { text: '📱 سرویس‌های من', callback_data: 'my_services' }
        ],
        [
          { text: '💰 کیف پول', callback_data: 'wallet_menu' },
          { text: '🎫 پشتیبانی', callback_data: 'support_menu' }
        ],
        [
          { text: '📖 نحوه اتصال', callback_data: 'connection_guide' },
          { text: '👤 حساب کاربری', callback_data: 'user_account' }
        ]
      ]
    }
  },

  adminMain: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 خرید سرویس', callback_data: 'buy_service' },
          { text: '📱 سرویس‌های من', callback_data: 'my_services' }
        ],
        [
          { text: '💰 کیف پول', callback_data: 'wallet_menu' },
          { text: '🎫 پشتیبانی', callback_data: 'support_menu' }
        ],
        [
          { text: '📖 نحوه اتصال', callback_data: 'connection_guide' },
          { text: '👤 حساب کاربری', callback_data: 'user_account' }
        ],
        [
          { text: '⚙️ پنل مدیریت', callback_data: 'admin_panel' }
        ]
      ]
    }
  },

  supportMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎫 ثبت تیکت جدید', callback_data: 'create_ticket' },
          { text: '📂 تیکت‌های من', callback_data: 'my_tickets' }
        ],
        [
          { text: '❓ سوالات متداول', callback_data: 'faq' }
        ],
        [
          { text: '🔙 منوی اصلی', callback_data: 'start' }
        ]
      ]
    }
  },

  walletMenu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💳 شارژ کیف پول', callback_data: 'wallet_charge' },
          { text: '📊 موجودی و تاریخچه', callback_data: 'wallet_balance' }
        ],
        [
          { text: '🔙 منوی اصلی', callback_data: 'start' }
        ]
      ]
    }
  },

  backToMain: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 منوی اصلی', callback_data: 'start' }]
      ]
    }
  },

  backToSupport: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 منوی پشتیبانی', callback_data: 'support_menu' }]
      ]
    }
  },

  backToWallet: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 کیف پول', callback_data: 'wallet_menu' }]
      ]
    }
  }
};

module.exports = { KEYBOARDS };
