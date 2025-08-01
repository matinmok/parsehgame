require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER UNIQUE,
    wallet_balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    chat_id INTEGER,
    username TEXT,
    plan_name TEXT,
    plan_price INTEGER,
    expire_timestamp INTEGER,
    config_url TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    chat_id INTEGER,
    plan_name TEXT,
    plan_price INTEGER,
    status TEXT DEFAULT 'pending',
    receipt_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    chat_id INTEGER,
    subject TEXT,
    message TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Constants
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const PLANS = {
  '1m_50gb': { name: '1 ماهه 50 گیگ', price: 25000, duration: 30, data: 50 },
  '1m_100gb': { name: '1 ماهه 100 گیگ', price: 45000, duration: 30, data: 100 },
  '1m_unlimited': { name: '1 ماهه نامحدود', price: 75000, duration: 30, data: 0 },
  '3m_unlimited': { name: '3 ماهه نامحدود', price: 200000, duration: 90, data: 0 }
};

// Helper functions
const formatPrice = (price) => new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('fa-IR');
const generateId = () => Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);

const sendMessage = async (chatId, text, keyboard = null) => {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Send message error:', error.response?.data || error.message);
  }
};

const editMessage = async (chatId, messageId, text, keyboard = null) => {
  try {
    await axios.post(`${TELEGRAM_API}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Edit message error:', error.response?.data || error.message);
  }
};

// Bot handlers
const showMainMenu = async (chatId, messageId = null) => {
  const text = `🛜 <b>ARDISK VPN</b>
⬅️ به ربات آردیسک وی پی ان خوش آمدید!

💎 ارائه فیلترشکن پرسرعت
🔒 امنیت بالا و رمزنگاری  
🌍 دسترسی آزاد به اینترنت

🎯 گزینه مورد نظر را انتخاب کنید:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🛒 خرید سرویس', callback_data: 'buy_service' },
        { text: '📱 سرویس‌های من', callback_data: 'my_services' }
      ],
      [
        { text: '💰 کیف پول', callback_data: 'wallet' },
        { text: '🎫 پشتیبانی', callback_data: 'support' }
      ],
      ...(chatId === ADMIN_ID ? [[{ text: '⚙️ پنل مدیریت', callback_data: 'admin_panel' }]] : [])
    ]
  };

  if (messageId) {
    await editMessage(chatId, messageId, text, keyboard);
  } else {
    await sendMessage(chatId, text, keyboard);
  }
};

const showBuyService = async (chatId, messageId) => {
  const text = `🛒 <b>پلن‌های موجود</b>

✨ سرویس‌های پایدار و پرسرعت
🌐 بدون محدودیت دستگاه
🔒 امنیت بالا

💎 پلن مورد نظر را انتخاب کنید:`;

  const keyboard = {
    inline_keyboard: [
      ...Object.entries(PLANS).map(([id, plan]) => ([{
        text: `${plan.name} - ${formatPrice(plan.price)}`,
        callback_data: `plan_${id}`
      }])),
      [{ text: '🔙 منوی اصلی', callback_data: 'start' }]
    ]
  };

  await editMessage(chatId, messageId, text, keyboard);
};

const showMyServices = async (chatId, messageId) => {
  db.all('SELECT * FROM services WHERE chat_id = ? ORDER BY created_at DESC', [chatId], async (err, services) => {
    if (err) {
      await editMessage(chatId, messageId, '❌ خطا در بارگیری سرویس‌ها');
      return;
    }

    let text = `📱 <b>سرویس‌های من</b>\n\n`;

    if (services.length === 0) {
      text += '❌ هیچ سرویس فعالی ندارید!';
    } else {
      services.forEach((service, index) => {
        const isExpired = service.expire_timestamp < Date.now();
        text += `${index + 1}. <b>${service.plan_name}</b>
👤 کاربری: <code>${service.username}</code>
📅 انقضا: ${formatDate(service.expire_timestamp)}
📊 وضعیت: ${isExpired ? 'منقضی ❌' : 'فعال ✅'}

`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 خرید سرویس جدید', callback_data: 'buy_service' }],
        [{ text: '🔙 منوی اصلی', callback_data: 'start' }]
      ]
    };

    await editMessage(chatId, messageId, text, keyboard);
  });
};

const showPlanDetails = async (chatId, messageId, planId) => {
  const plan = PLANS[planId];
  if (!plan) return;

  const text = `📦 <b>${plan.name}</b>

💰 قیمت: ${formatPrice(plan.price)}
📊 حجم: ${plan.data ? plan.data + ' گیگ' : 'نامحدود'}
⏰ مدت: ${plan.duration} روز

💡 سرویس پرسرعت و پایدار`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💳 پرداخت', callback_data: `pay_${planId}` }],
      [{ text: '🔙 پلن‌های دیگر', callback_data: 'buy_service' }]
    ]
  };

  await editMessage(chatId, messageId, text, keyboard);
};

const processPayment = async (chatId, messageId, planId) => {
  const plan = PLANS[planId];
  const orderId = generateId();

  // Save order
  db.run('INSERT INTO orders (id, chat_id, plan_name, plan_price) VALUES (?, ?, ?, ?)',
    [orderId, chatId, plan.name, plan.price]);

  const text = `💳 <b>پرداخت سفارش</b>

📦 پلن: ${plan.name}
💰 مبلغ: ${formatPrice(plan.price)}
🆔 کد سفارش: <code>${orderId}</code>

💳 <b>اطلاعات واریز:</b>
🏦 کارت: <code>${process.env.CARD_NUMBER}</code>
👤 نام: ${process.env.CARD_HOLDER}

📋 مراحل:
1️⃣ مبلغ را واریز کنید
2️⃣ "پرداخت کردم" بزنید
3️⃣ عکس رسید ارسال کنید
4️⃣ منتظر تأیید باشید`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ پرداخت کردم', callback_data: `receipt_${orderId}` }],
      [{ text: '❌ انصراف', callback_data: 'buy_service' }]
    ]
  };

  await editMessage(chatId, messageId, text, keyboard);
};

const showAdminPanel = async (chatId, messageId) => {
  if (chatId !== ADMIN_ID) return;

  db.get('SELECT COUNT(*) as count FROM orders WHERE status = "pending"', [], async (err, result) => {
    const pendingCount = result ? result.count : 0;

    const text = `⚙️ <b>پنل مدیریت ARDISK VPN</b>

📊 سفارش‌های در انتظار: ${pendingCount}
👥 مدیریت سیستم

انتخاب کنید:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 سفارش‌های در انتظار', callback_data: 'pending_orders' }],
        [{ text: '📊 آمار سیستم', callback_data: 'system_stats' }],
        [{ text: '👥 لیست کاربران', callback_data: 'users_list' }],
        [{ text: '🔙 منوی اصلی', callback_data: 'start' }]
      ]
    };

    await editMessage(chatId, messageId, text, keyboard);
  });
};

const showPendingOrders = async (chatId, messageId) => {
  if (chatId !== ADMIN_ID) return;

  db.all('SELECT * FROM orders WHERE status = "pending" ORDER BY created_at DESC LIMIT 10', [], async (err, orders) => {
    let text = `📋 <b>سفارش‌های در انتظار</b>\n\n`;

    if (orders.length === 0) {
      text += '✅ هیچ سفارش در انتظاری وجود ندارد!';
    } else {
      orders.forEach((order, index) => {
        text += `${index + 1}. <b>${order.plan_name}</b>
🆔 سفارش: <code>${order.id}</code>
👤 کاربر: <code>${order.chat_id}</code>
💰 مبلغ: ${formatPrice(order.plan_price)}
📅 تاریخ: ${formatDate(new Date(order.created_at).getTime())}

`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        ...orders.map(order => ([{
          text: `✅ تأیید ${order.plan_name}`,
          callback_data: `approve_${order.id}`
        }, {
          text: `❌ رد`,
          callback_data: `reject_${order.id}`
        }])),
        [{ text: '🔄 بروزرسانی', callback_data: 'pending_orders' }],
        [{ text: '🔙 پنل مدیریت', callback_data: 'admin_panel' }]
      ]
    };

    await editMessage(chatId, messageId, text, keyboard);
  });
};

const approveOrder = async (orderId) => {
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], async (err, order) => {
    if (!order) return;

    const serviceId = generateId();
    const username = `ARDISK_${Math.random().toString().slice(2, 8)}`;
    const expireTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
    const configUrl = `vless://example@server.com:443?security=tls&type=ws&path=/ws#${username}`;

    // Create service
    db.run('INSERT INTO services (id, chat_id, username, plan_name, plan_price, expire_timestamp, config_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [serviceId, order.chat_id, username, order.plan_name, order.plan_price, expireTime, configUrl]);

    // Update order status
    db.run('UPDATE orders SET status = "completed" WHERE id = ?', [orderId]);

    // Send service to user
    const userText = `✅ <b>سرویس شما آماده است!</b>

📦 پلن: ${order.plan_name}
👤 نام کاربری: <code>${username}</code>
📅 انقضا: ${formatDate(expireTime)}

🔗 <b>لینک اتصال:</b>
<code>${configUrl}</code>

💡 لینک را در اپلیکیشن V2rayNG کپی کنید`;

    await sendMessage(order.chat_id, userText);
  });
};

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🛜 ARDISK VPN Sales Bot',
    version: '1.0.0',
    admin_panel: '/admin'
  });
});

// Telegram webhook
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === '/start' || text === '/menu') {
        await showMainMenu(chatId);
      }

      // Handle receipt upload
      if (update.message.photo && update.message.caption && update.message.caption.includes('ORDER_')) {
        const orderId = update.message.caption.match(/ORDER_\w+/)[0];
        
        // Save receipt info
        db.run('UPDATE orders SET receipt_message = ?, status = "submitted" WHERE id = ?', 
          [JSON.stringify(update.message), orderId]);

        // Notify admin
        await sendMessage(ADMIN_ID, `📄 رسید جدید برای سفارش: ${orderId}\nکاربر: ${chatId}`);
        await sendMessage(chatId, '✅ رسید دریافت شد! منتظر تأیید باشید.');
      }
    }

    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const data = update.callback_query.data;

      // Answer callback query
      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: update.callback_query.id
      });

      // Handle callbacks
      if (data === 'start') {
        await showMainMenu(chatId, messageId);
      } else if (data === 'buy_service') {
        await showBuyService(chatId, messageId);
      } else if (data === 'my_services') {
        await showMyServices(chatId, messageId);
      } else if (data.startsWith('plan_')) {
        const planId = data.replace('plan_', '');
        await showPlanDetails(chatId, messageId, planId);
      } else if (data.startsWith('pay_')) {
        const planId = data.replace('pay_', '');
        await processPayment(chatId, messageId, planId);
      } else if (data.startsWith('receipt_')) {
        const orderId = data.replace('receipt_', '');
        await editMessage(chatId, messageId, 
          `📤 عکس رسید پرداخت را با کپشن ${orderId} ارسال کنید`);
      } else if (data === 'admin_panel' && chatId === ADMIN_ID) {
        await showAdminPanel(chatId, messageId);
      } else if (data === 'pending_orders' && chatId === ADMIN_ID) {
        await showPendingOrders(chatId, messageId);
      } else if (data.startsWith('approve_') && chatId === ADMIN_ID) {
        const orderId = data.replace('approve_', '');
        await approveOrder(orderId);
        await showPendingOrders(chatId, messageId);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('Error');
  }
});

// Admin panel web interface
app.get('/admin', (req, res) => {
  const password = req.query.password;
  
  if (password !== process.env.ADMIN_PASSWORD) {
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>🔐 ARDISK VPN Admin Panel</h2>
          <form>
            <input type="password" name="password" placeholder="Admin Password" style="padding: 10px; font-size: 16px;">
            <br><br>
            <button type="submit" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px;">Login</button>
          </form>
        </body>
      </html>
    `);
    return;
  }

  db.all('SELECT * FROM orders WHERE status IN ("pending", "submitted") ORDER BY created_at DESC', [], (err, orders) => {
    const ordersHtml = orders.map(order => `
      <tr>
        <td>${order.id}</td>
        <td>${order.chat_id}</td>
        <td>${order.plan_name}</td>
        <td>${formatPrice(order.plan_price)}</td>
        <td>${order.status}</td>
        <td>
          <button onclick="approveOrder('${order.id}')" style="background: green; color: white; border: none; padding: 5px 10px;">✅ تأیید</button>
          <button onclick="rejectOrder('${order.id}')" style="background: red; color: white; border: none; padding: 5px 10px;">❌ رد</button>
        </td>
      </tr>
    `).join('');

    res.send(`
      <html>
        <head>
          <meta charset="utf-8">
          <title>ARDISK VPN Admin Panel</title>
          <style>
            body { font-family: Arial; padding: 20px; direction: rtl; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>🛜 ARDISK VPN Admin Panel</h1>
          <h2>📋 سفارش‌های در انتظار</h2>
          <table>
            <tr>
              <th>شناسه سفارش</th>
              <th>کاربر</th>
              <th>پلن</th>
              <th>مبلغ</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
            ${ordersHtml}
          </table>
          
          <script>
            function approveOrder(orderId) {
              fetch('/api/approve/' + orderId, {method: 'POST'})
                .then(() => location.reload());
            }
            
            function rejectOrder(orderId) {
              fetch('/api/reject/' + orderId, {method: 'POST'})
                .then(() => location.reload());
            }
          </script>
        </body>
      </html>
    `);
  });
});

// API endpoints
app.post('/api/approve/:orderId', async (req, res) => {
  await approveOrder(req.params.orderId);
  res.json({success: true});
});

app.post('/api/reject/:orderId', (req, res) => {
  db.run('UPDATE orders SET status = "rejected" WHERE id = ?', [req.params.orderId]);
  res.json({success: true});
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ARDISK VPN Bot running on port ${PORT}`);
  console.log(`📱 Telegram Bot: Active`);
  console.log(`🌐 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`💾 Database: SQLite initialized`);
});

// Cron job - every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('🔄 Checking expired services...');
  
  db.all('SELECT * FROM services WHERE expire_timestamp < ? AND status = "active"', 
    [Date.now()], (err, expiredServices) => {
      expiredServices.forEach(service => {
        // Update service status
        db.run('UPDATE services SET status = "expired" WHERE id = ?', [service.id]);
        
        // Notify user
        sendMessage(service.chat_id, `⚠️ سرویس ${service.plan_name} شما منقضی شده است.`);
      });
  });
});
