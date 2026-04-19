// ============================================
// Activity Logger — logs all user actions
// ============================================

const db = require("../db");

/**
 * Log a user activity
 * @param {number} userId
 * @param {string} action - e.g. 'upload', 'delete', 'rename', 'login', 'register'
 * @param {string} entityType - 'file', 'folder', 'user', 'session'
 * @param {number|null} entityId
 * @param {string|null} entityName
 * @param {object|null} details - any extra JSON data
 * @param {string|null} ipAddress
 */
async function logActivity(userId, action, entityType, entityId = null, entityName = null, details = null, ipAddress = null) {
  try {
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, entity_name, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, entityName, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    console.error("Failed to log activity:", err.message);
    // Don't throw — logging should never break the main flow
  }
}

module.exports = logActivity;
