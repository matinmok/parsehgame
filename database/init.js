const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config');

const dbPath = path.resolve(config.database.path);

function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
    });

    // Create tables
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          chat_id INTEGER PRIMARY KEY,
          wallet_balance REAL DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          last_activity INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);

      // Services table
      db.run(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          username TEXT UNIQUE,
          plan_name TEXT,
          plan_id TEXT,
          data_limit INTEGER,
          duration INTEGER,
          expire_timestamp INTEGER,
          config_url TEXT,
          status TEXT DEFAULT 'active',
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          order_id TEXT,
          server_id TEXT,
          server_name TEXT,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          plan_id TEXT,
          plan_data TEXT,
          server_id TEXT,
          server_name TEXT,
          status TEXT DEFAULT 'waiting_payment',
          payment_method TEXT,
          type TEXT DEFAULT 'new',
          service_id TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          completed_at INTEGER,
          expires_at INTEGER,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Tickets table
      db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          type TEXT,
          type_name TEXT,
          subject TEXT,
          message TEXT,
          status TEXT DEFAULT 'open',
          messages TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          closed_at INTEGER,
          closed_by TEXT,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Wallet transactions table
      db.run(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          amount REAL,
          type TEXT,
          description TEXT,
          timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Wallet charges table
      db.run(`
        CREATE TABLE IF NOT EXISTS wallet_charges (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          amount REAL,
          status TEXT DEFAULT 'waiting_payment',
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          expires_at INTEGER,
          completed_at INTEGER,
          receipt_data TEXT,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Plans table
      db.run(`
        CREATE TABLE IF NOT EXISTS plans (
          id TEXT PRIMARY KEY,
          name TEXT,
          price REAL,
          duration INTEGER,
          data_limit INTEGER,
          description TEXT,
          plan_order INTEGER DEFAULT 999,
          active BOOLEAN DEFAULT 1
        )
      `);

      // Servers table
      db.run(`
        CREATE TABLE IF NOT EXISTS servers (
          id TEXT PRIMARY KEY,
          name TEXT,
          base_url TEXT,
          username TEXT,
          password TEXT,
          location TEXT,
          description TEXT,
          is_default BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'active'
        )
      `);

      // Settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // Notifications table
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          chat_id INTEGER,
          service_id TEXT,
          type TEXT,
          sent_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Insert default data
      insertDefaultData(db);
    });

    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✅ Database initialized successfully');
      resolve();
    });
  });
}

function insertDefaultData(db) {
  // Insert default plans
  const defaultPlans = [
    ['plan_1m_50gb', '1 ماهه 50 گیگ', 25000, 30, 50, 'مناسب برای استفاده عمومی', 1],
    ['plan_1m_100gb', '1 ماهه 100 گیگ', 45000, 30, 100, 'مناسب برای استفاده متوسط', 2],
    ['plan_1m_unlimited', '1 ماهه نامحدود', 75000, 30, 0, 'حجم نامحدود', 3],
    ['plan_3m_unlimited', '3 ماهه نامحدود', 200000, 90, 0, 'بهترین قیمت برای 3 ماه', 4]
  ];

  defaultPlans.forEach(plan => {
    db.run(`
      INSERT OR IGNORE INTO plans 
      (id, name, price, duration, data_limit, description, plan_order) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, plan);
  });

  // Insert default server
  db.run(`
    INSERT OR IGNORE INTO servers 
    (id, name, base_url, username, password, location, description, is_default, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'server_main',
    config.defaultServer.name,
    config.defaultServer.baseUrl,
    config.defaultServer.username,
    config.defaultServer.password,
    config.defaultServer.location,
    'سرور اصلی با پرسرعت بالا',
    1,
    'active'
  ]);
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Database setup failed:', err);
      process.exit(1);
    });
}

module.exports = initDatabase;
