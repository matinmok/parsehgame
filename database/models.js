const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

class Database {
  constructor() {
    this.db = new sqlite3.Database(config.database.path);
  }

  // Helper methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // User methods
  async getUser(chatId) {
    return await this.get('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  }

  async createUser(chatId) {
    return await this.run(
      'INSERT OR IGNORE INTO users (chat_id) VALUES (?)',
      [chatId]
    );
  }

  async updateUserActivity(chatId) {
    return await this.run(
      'UPDATE users SET last_activity = ? WHERE chat_id = ?',
      [Date.now(), chatId]
    );
  }

  // Wallet methods
  async getWalletBalance(chatId) {
    const user = await this.getUser(chatId);
    return user ? user.wallet_balance : 0;
  }

  async updateWalletBalance(chatId, amount) {
    await this.createUser(chatId);
    const result = await this.run(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE chat_id = ?',
      [amount, chatId]
    );
    
    const user = await this.getUser(chatId);
    return user.wallet_balance;
  }

  async recordTransaction(id, chatId, amount, type, description) {
    return await this.run(
      'INSERT INTO wallet_transactions (id, chat_id, amount, type, description) VALUES (?, ?, ?, ?, ?)',
      [id, chatId, amount, type, description]
    );
  }

  async getTransactions(chatId, limit = 10) {
    return await this.all(
      'SELECT * FROM wallet_transactions WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?',
      [chatId, limit]
    );
  }

  // Service methods
  async createService(serviceData) {
    return await this.run(`
      INSERT INTO services 
      (id, chat_id, username, plan_name, plan_id, data_limit, duration, expire_timestamp, 
       config_url, order_id, server_id, server_name) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      serviceData.serviceId,
      serviceData.chatId,
      serviceData.username,
      serviceData.planName,
      serviceData.planId,
      serviceData.dataLimit,
      serviceData.duration,
      serviceData.expireTimestamp,
      serviceData.configUrl,
      serviceData.orderId,
      serviceData.serverId,
      serviceData.serverName
    ]);
  }

  async getService(chatId, serviceId) {
    return await this.get(
      'SELECT * FROM services WHERE chat_id = ? AND id = ?',
      [chatId, serviceId]
    );
  }

  async getServiceByUsername(chatId, username) {
    return await this.get(
      'SELECT * FROM services WHERE chat_id = ? AND username = ?',
      [chatId, username]
    );
  }

  async getUserServices(chatId, limit = 100, offset = 0) {
    return await this.all(
      'SELECT * FROM services WHERE chat_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [chatId, limit, offset]
    );
  }

  async updateService(serviceId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    return await this.run(
      `UPDATE services SET ${setClause} WHERE id = ?`,
      [...values, serviceId]
    );
  }

  async getExpiringServices() {
    const now = Date.now();
    const oneDayFromNow = now + (24 * 60 * 60 * 1000);
    
    return await this.all(
      'SELECT * FROM services WHERE expire_timestamp BETWEEN ? AND ? AND status = "active"',
      [now, oneDayFromNow]
    );
  }

  // Order methods
  async createOrder(orderData) {
    return await this.run(`
      INSERT INTO orders 
      (id, chat_id, plan_id, plan_data, server_id, server_name, payment_method, type, service_id, expires_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderData.id,
      orderData.chatId,
      orderData.planId,
      JSON.stringify(orderData.plan),
      orderData.serverId,
      orderData.serverName,
      orderData.paymentMethod || null,
      orderData.type || 'new',
      orderData.serviceId || null,
      orderData.expiresAt || null
    ]);
  }

  async getOrder(orderId) {
    const order = await this.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (order && order.plan_data) {
      order.plan = JSON.parse(order.plan_data);
    }
    return order;
  }

  async updateOrder(orderId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    return await this.run(
      `UPDATE orders SET ${setClause} WHERE id = ?`,
      [...values, orderId]
    );
  }

  async getPendingPayments() {
    const orders = await this.all(
      'SELECT * FROM orders WHERE status = "payment_submitted" ORDER BY created_at DESC'
    );
    
    return orders.map(order => {
      if (order.plan_data) {
        order.plan = JSON.parse(order.plan_data);
      }
      return order;
    });
  }

  // Ticket methods
  async createTicket(ticketData) {
    return await this.run(`
      INSERT INTO tickets 
      (id, chat_id, type, type_name, subject, message, messages) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      ticketData.id,
      ticketData.chatId,
      ticketData.type,
      ticketData.typeName,
      ticketData.subject,
      ticketData.message,
      JSON.stringify(ticketData.messages)
    ]);
  }

  async getTicket(ticketId) {
    const ticket = await this.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (ticket && ticket.messages) {
      ticket.messages = JSON.parse(ticket.messages);
    }
    return ticket;
  }

  async getUserTickets(chatId) {
    const tickets = await this.all(
      'SELECT * FROM tickets WHERE chat_id = ? ORDER BY created_at DESC',
      [chatId]
    );
    
    return tickets.map(ticket => {
      if (ticket.messages) {
        ticket.messages = JSON.parse(ticket.messages);
      }
      return ticket;
    });
  }

  async updateTicket(ticketId, updates) {
    if (updates.messages) {
      updates.messages = JSON.stringify(updates.messages);
    }
    
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    return await this.run(
      `UPDATE tickets SET ${setClause} WHERE id = ?`,
      [...values, ticketId]
    );
  }

  async getOpenTickets() {
    const tickets = await this.all(
      'SELECT * FROM tickets WHERE status = "open" ORDER BY created_at DESC'
    );
    
    return tickets.map(ticket => {
      if (ticket.messages) {
        ticket.messages = JSON.parse(ticket.messages);
      }
      return ticket;
    });
  }

  // Plan methods
  async getPlans() {
    return await this.all('SELECT * FROM plans WHERE active = 1 ORDER BY plan_order');
  }

  async getPlan(planId) {
    return await this.get('SELECT * FROM plans WHERE id = ?', [planId]);
  }

  async createPlan(planData) {
    return await this.run(`
      INSERT INTO plans (id, name, price, duration, data_limit, description, plan_order) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      planData.id,
      planData.name,
      planData.price,
      planData.duration,
      planData.dataLimit,
      planData.description,
      planData.order || 999
    ]);
  }

  async updatePlan(planId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    return await this.run(
      `UPDATE plans SET ${setClause} WHERE id = ?`,
      [...values, planId]
    );
  }

  // Server methods
  async getServers() {
    return await this.all('SELECT * FROM servers WHERE status = "active"');
  }

  async getServer(serverId) {
    return await this.get('SELECT * FROM servers WHERE id = ?', [serverId]);
  }

  async getDefaultServer() {
    return await this.get('SELECT * FROM servers WHERE is_default = 1 AND status = "active"');
  }

  async createServer(serverData) {
    return await this.run(`
      INSERT INTO servers (id, name, base_url, username, password, location, description, is_default) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      serverData.id,
      serverData.name,
      serverData.baseUrl,
      serverData.username,
      serverData.password,
      serverData.location,
      serverData.description,
      serverData.isDefault ? 1 : 0
    ]);
  }

  // Settings methods
  async getSetting(key) {
    const result = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  }

  async setSetting(key, value) {
    return await this.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  // Wallet charge methods
  async createCharge(chargeData) {
    return await this.run(`
      INSERT INTO wallet_charges (id, chat_id, amount, expires_at) 
      VALUES (?, ?, ?, ?)
    `, [
      chargeData.id,
      chargeData.chatId,
      chargeData.amount,
      chargeData.expiresAt
    ]);
  }

  async getCharge(chargeId) {
    return await this.get('SELECT * FROM wallet_charges WHERE id = ?', [chargeId]);
  }

  async updateCharge(chargeId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    return await this.run(
      `UPDATE wallet_charges SET ${setClause} WHERE id = ?`,
      [...values, chargeId]
    );
  }

  async getPendingCharges() {
    return await this.all(
      'SELECT * FROM wallet_charges WHERE status = "payment_submitted" ORDER BY created_at DESC'
    );
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
