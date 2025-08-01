const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');
const path = require('path');

const config = require('./config');
const Database = require('./database/models');
const initDatabase = require('./database/init');
const TelegramService = require('./services/telegramService');
const MessageHandler = require('./handlers/messageHandler');
const CallbackHandler = require('./handlers/callbackHandler');
const AdminHandler = require('./handlers/adminHandler');
const NotificationService = require('./services/notificationService');

class ArdiskVPNBot {
  constructor() {
    this.app = express();
    this.db = new Database();
    this.telegram = new TelegramService();
    this.messageHandler = new MessageHandler(this.db, this.telegram);
    this.callbackHandler = new CallbackHandler(this.db, this.telegram);
    this.adminHandler = new AdminHandler(this.db, this.telegram);
    this.notificationService = new NotificationService(this.db, this.telegram);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupCronJobs();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        status: 'online',
        bot: 'ARDISK VPN Sales Bot',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: [
          '🛒 Sales System',
          '💳 Payment Processing', 
          '💰 Wallet System',
          '🖥️ Multi-Server Support',
          '⚙️ Admin Panel',
          '🎫 Support Tickets'
        ]
      });
    });

    // Telegram webhook
    this.app.post('/webhook', async (req, res) => {
      try {
        const update = req.body;
        console.log('Received update:', JSON.stringify(update, null, 2));
        
        if (update.message) {
          await this.messageHandler.handle(update.message);
        } else if (update.callback_query) {
          await this.callbackHandler.handle(update.callback_query);
        }
        
        res.status(200).send('OK');
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).send('Error processed');
      }
    });

    // Admin panel
    this.app.get('/admin', this.adminHandler.getAdminPanel.bind(this.adminHandler));
    this.app.post('/admin/login', this.adminHandler.handleLogin.bind(this.adminHandler));
    
    // API routes
    this.app.use('/api/admin', this.adminHandler.getApiRouter());

    // Cron endpoint
    this.app.get('/cron/check-expiry', async (req, res) => {
      try {
        await this.notificationService.checkExpiringServices();
        res.json({ success: true, message: 'Expiry check completed' });
      } catch (error) {
        console.error('Cron error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Set webhook endpoint
    this.app.post('/set-webhook', async (req, res) => {
      try {
        const { url } = req.body;
        const result = await this.telegram.setWebhook(url);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupCronJobs() {
    // Check expiring services every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('Starting scheduled expiry check...');
        await this.notificationService.checkExpiringServices();
        console.log('Scheduled expiry check completed');
      } catch (error) {
        console.error('Cron job error:', error);
      }
    });

    console.log('✅ Cron jobs scheduled');
  }

  async start() {
    try {
      // Initialize database
      await initDatabase();
      console.log('✅ Database initialized');

      // Start server
      const port = config.server.port;
      this.app.listen(port, () => {
        console.log(`🚀 ARDISK VPN Bot server running on port ${port}`);
        console.log(`📡 Webhook URL: http://your-domain.com/webhook`);
        console.log(`⚙️ Admin Panel: http://localhost:${port}/admin`);
        console.log(`📊 Health Check: http://localhost:${port}/`);
      });

    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      this.db.close();
      console.log('✅ Bot stopped gracefully');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  if (global.botInstance) {
    await global.botInstance.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  if (global.botInstance) {
    await global.botInstance.stop();
  }
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  const bot = new ArdiskVPNBot();
  global.botInstance = bot;
  bot.start();
}

module.exports = ArdiskVPNBot;
