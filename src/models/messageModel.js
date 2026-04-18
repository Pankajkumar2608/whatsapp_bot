/**
 * Message model — stores every message for audit + memory window.
 */
const db = require('../config/database');

const MessageModel = {
  /**
   * Save a message (inbound or outbound).
   */
  async create({ userId, direction, content, metadata = null }) {
    const { rows } = await db.query(
      `INSERT INTO messages (user_id, direction, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, direction, content, metadata ? JSON.stringify(metadata) : null]
    );
    return rows[0];
  },

  /**
   * Get the last N messages for a user (for context window).
   */
  async getLastN(userId, n = 5) {
    const { rows } = await db.query(
      `SELECT direction, content, created_at
       FROM messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, n]
    );
    // Return in chronological order
    return rows.reverse();
  },

  /**
   * Count total messages for a user.
   */
  async countByUser(userId) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM messages WHERE user_id = $1',
      [userId]
    );
    return rows[0].count;
  },
};

module.exports = MessageModel;
