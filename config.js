require('dotenv').config();

module.exports = {
  telegram: {
    botToken: process.env.BOT_TOKEN,
    adminId: parseInt(process.env.ADMIN_ID),
    adminPassword: process.env.ADMIN_PASSWORD
  },
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  payment: {
    cardNumber: process.env.CARD_NUMBER,
    cardHolder: process.env.CARD_HOLDER,
    supportUsername: process.env.SUPPORT_USERNAME
  },
  database: {
    path: process.env.DB_PATH || './database/ardisk.db'
  },
  defaultServer: {
    name: process.env.DEFAULT_SERVER_NAME,
    baseUrl: process.env.DEFAULT_SERVER_URL,
    username: process.env.DEFAULT_SERVER_USERNAME,
    password: process.env.DEFAULT_SERVER_PASSWORD,
    location: process.env.DEFAULT_SERVER_LOCATION
  }
};
