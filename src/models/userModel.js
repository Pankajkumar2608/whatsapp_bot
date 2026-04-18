/**
 * User (Lead) model — tracks each WhatsApp user's conversation state.
 */
const db = require('../config/database');
const logger = require('../utils/logger');

const UserModel = {
  /**
   * Find or create a user session for this phone + client pair.
   */
  async findOrCreate(phoneNumber, clientId) {
    // Try existing
    let { rows } = await db.query(
      `SELECT * FROM users WHERE phone_number = $1 AND client_id = $2`,
      [phoneNumber, clientId]
    );

    if (rows[0]) return rows[0];

    // Create new
    const result = await db.query(
      `INSERT INTO users (phone_number, client_id)
       VALUES ($1, $2)
       RETURNING *`,
      [phoneNumber, clientId]
    );
    logger.info(`New user created: ${phoneNumber} → client ${clientId}`);
    return result.rows[0];
  },

  /**
   * Get user by ID.
   */
  async findById(userId) {
    const { rows } = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return rows[0] || null;
  },

  /**
   * Get user by phone + client.
   */
  async findByPhoneAndClient(phoneNumber, clientId) {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE phone_number = $1 AND client_id = $2',
      [phoneNumber, clientId]
    );
    return rows[0] || null;
  },

  /**
   * Increment message count and update intent score.
   */
  async updateAfterMessage(userId, { intentDelta = 0, extractedFields = null } = {}) {
    let sql = `
      UPDATE users SET
        message_count = message_count + 1,
        intent_score  = intent_score + $2,
        updated_at    = NOW()
    `;
    const params = [userId, intentDelta];

    if (extractedFields) {
      sql += `, extracted_fields = extracted_fields || $3::jsonb`;
      params.push(JSON.stringify(extractedFields));
    }

    sql += ` WHERE user_id = $1 RETURNING *`;
    const { rows } = await db.query(sql, params);
    return rows[0];
  },

  /**
   * Mark user as handed off — bot will never reply again.
   */
  async markHandoff(userId) {
    const { rows } = await db.query(
      `UPDATE users SET status = 'handoff', updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [userId]
    );
    logger.info(`User ${userId} marked as HANDOFF`);
    return rows[0];
  },

  /**
   * Update lead tag (hot / warm / cold / spam).
   */
  async updateLeadTag(userId, tag) {
    const { rows } = await db.query(
      `UPDATE users SET lead_tag = $2, updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [userId, tag]
    );
    return rows[0];
  },

  /**
   * Update detected language.
   */
  async updateLanguage(userId, language) {
    await db.query(
      `UPDATE users SET detected_language = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, language]
    );
  },
};

module.exports = UserModel;
