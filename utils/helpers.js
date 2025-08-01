const config = require('../config');

function isAdmin(chatId) {
  return chatId === config.telegram.adminId;
}

function formatPrice(price) {
  return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'نامحدود';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(1) + ' گیگابایت';
}

function formatDate(timestamp) {
  if (!timestamp) return 'نامشخص';
  const date = new Date(timestamp);
  return date.toLocaleDateString('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return 'نامشخص';
  const date = new Date(timestamp);
  return date.toLocaleString('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function generateUsername(chatId, planId) {
  const randomNumber = Math.random().toString().slice(2, 8);
  return `ARDISK-${randomNumber}`;
}

function generateId(prefix = '') {
  return prefix + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateOrderId() {
  return generateId('ORD_');
}

function generateServiceId() {
  return generateId('SRV_');
}

function generateTicketId() {
  return generateId('TKT_');
}

function generateChargeId() {
  return generateId('CHG_');
}

function generateTransactionId() {
  return generateId('TXN_');
}

function generateServerId() {
  return generateId('server_');
}

function generatePlanId() {
  return generateId('plan_');
}

module.exports = {
  isAdmin,
  formatPrice,
  formatBytes,
  formatDate,
  formatDateTime,
  generateUsername,
  generateId,
  generateOrderId,
  generateServiceId,
  generateTicketId,
  generateChargeId,
  generateTransactionId,
  generateServerId,
  generatePlanId
};
