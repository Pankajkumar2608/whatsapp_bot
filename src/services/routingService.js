/**
 * Routing service — resolves which client a message belongs to.
 *
 * Resolution order:
 *  1. Existing user session (phone already mapped to a client)
 *  2. Entry keyword match (e.g. user texts "DENTAL")
 *  3. Phone number mapping (dedicated number per client)
 *  4. Default client fallback
 */
const ClientModel = require('../models/clientModel');
const UserModel = require('../models/userModel');
const logger = require('../utils/logger');

const RoutingService = {
  /**
   * Resolve the client for an incoming message.
   *
   * @param {string} phoneNumber  Sender's phone number
   * @param {string} messageText  Raw message text
   * @returns {{ client: object, user: object }}
   */
  async resolve(phoneNumber, messageText) {
    // ── 1. Check if user already has an active session ──
    // (Query all users with this phone — pick the most recent active one)
    const existingUsers = await this._findExistingUsers(phoneNumber);
    if (existingUsers.length > 0) {
      const activeUser = existingUsers.find((u) => u.status === 'active') || existingUsers[0];
      const client = await ClientModel.findById(activeUser.client_id);
      if (client) {
        return { client, user: activeUser };
      }
    }

    // ── 2. Try keyword match ──
    if (messageText) {
      const keyword = messageText.trim().split(/\s+/)[0]; // first word
      const clientByKeyword = await ClientModel.findByKeyword(keyword);
      if (clientByKeyword) {
        logger.info(`Routed via keyword "${keyword}" → ${clientByKeyword.business_name}`);
        const user = await UserModel.findOrCreate(phoneNumber, clientByKeyword.client_id);
        return { client: clientByKeyword, user };
      }
    }

    // ── 3. Try phone mapping ──
    const clientByPhone = await ClientModel.findByPhoneMapping(phoneNumber);
    if (clientByPhone) {
      logger.info(`Routed via phone mapping → ${clientByPhone.business_name}`);
      const user = await UserModel.findOrCreate(phoneNumber, clientByPhone.client_id);
      return { client: clientByPhone, user };
    }

    // ── 4. Default client ──
    const defaultClient = await ClientModel.findDefault();
    if (defaultClient) {
      logger.info(`Routed to default client → ${defaultClient.business_name}`);
      const user = await UserModel.findOrCreate(phoneNumber, defaultClient.client_id);
      return { client: defaultClient, user };
    }

    // No client configured at all
    logger.warn(`No client found for phone ${phoneNumber} — dropping message`);
    return { client: null, user: null };
  },

  /**
   * Internal: find all user rows for a phone number.
   */
  async _findExistingUsers(phoneNumber) {
    const db = require('../config/database');
    const { rows } = await db.query(
      `SELECT * FROM users WHERE phone_number = $1 ORDER BY updated_at DESC`,
      [phoneNumber]
    );
    return rows;
  },
};

module.exports = RoutingService;
