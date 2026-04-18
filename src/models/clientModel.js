/**
 * Client model — CRUD for multi-tenant client configurations.
 * Each row represents one business (dentist, makeup artist, etc.).
 */
const db = require('../config/database');
const logger = require('../utils/logger');

const ClientModel = {
  /**
   * Find client by its UUID.
   */
  async findById(clientId) {
    const { rows } = await db.query(
      'SELECT * FROM clients WHERE client_id = $1',
      [clientId]
    );
    return rows[0] || null;
  },

  /**
   * Find client mapped to a specific WhatsApp phone number.
   * Used when a single WA number is dedicated to one client.
   */
  async findByPhoneMapping(phoneNumber) {
    const { rows } = await db.query(
      `SELECT c.* FROM clients c
       JOIN client_phone_mappings cpm ON c.client_id = cpm.client_id
       WHERE cpm.phone_number = $1`,
      [phoneNumber]
    );
    return rows[0] || null;
  },

  /**
   * Find client by entry keyword (e.g. user texts "DENTAL" to start).
   */
  async findByKeyword(keyword) {
    const { rows } = await db.query(
      `SELECT * FROM clients
       WHERE $1 = ANY(entry_keywords)`,
      [keyword.toLowerCase()]
    );
    return rows[0] || null;
  },

  /**
   * Return the default / fallback client when no mapping is found.
   */
  async findDefault() {
    const { rows } = await db.query(
      `SELECT * FROM clients WHERE is_default = true LIMIT 1`
    );
    return rows[0] || null;
  },

  /**
   * Create a new client config.
   */
  async create(data) {
    const { rows } = await db.query(
      `INSERT INTO clients (
        service_type, business_name, qualification_questions,
        handoff_group_id, tone, language_preference,
        entry_keywords, is_default, system_prompt_override
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        data.service_type,
        data.business_name,
        JSON.stringify(data.qualification_questions),
        data.handoff_group_id,
        data.tone || 'casual',
        data.language_preference || 'english',
        data.entry_keywords || [],
        data.is_default || false,
        data.system_prompt_override || null,
      ]
    );
    logger.info(`Client created: ${rows[0].client_id} – ${data.business_name}`);
    return rows[0];
  },

  /**
   * List all clients.
   */
  async listAll() {
    const { rows } = await db.query('SELECT * FROM clients ORDER BY created_at DESC');
    return rows;
  },

  /**
   * Update a client.
   */
  async update(clientId, data) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'qualification_questions' ? JSON.stringify(value) : value);
      idx++;
    }
    values.push(clientId);

    const { rows } = await db.query(
      `UPDATE clients SET ${fields.join(', ')}, updated_at = NOW()
       WHERE client_id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  },
};

module.exports = ClientModel;
