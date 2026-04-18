/**
 * WhatsApp Cloud API service.
 * Handles sending text messages + group messages via Meta's Graph API.
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const WA_BASE_URL = `https://graph.facebook.com/${config.wa.apiVersion}`;

/**
 * Send a text message to a user.
 * @param {string} to  Recipient phone number (with country code, no +)
 * @param {string} body  Message text
 */
async function sendMessage(to, body) {
  try {
    const url = `${WA_BASE_URL}/${config.wa.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    };

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.wa.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info(`WA message sent to ${to}: "${body.substring(0, 50)}…"`);
    return res.data;
  } catch (err) {
    logger.error(`WA send failed to ${to}`, {
      status: err.response?.status,
      data: err.response?.data,
    });
    throw err;
  }
}

/**
 * Send a lead summary to a WhatsApp group.
 * Note: WhatsApp Cloud API does not natively support sending to groups.
 * This sends to the group admin's phone number (handoff_group_id stores that).
 * For true group messaging, use WhatsApp Business API (on-premise) or a workaround.
 *
 * @param {string} groupIdOrPhone  The group admin phone or group JID
 * @param {string} summary  Formatted lead summary
 */
async function sendGroupMessage(groupIdOrPhone, summary) {
  // Cloud API sends to individual numbers; the "group" is the admin/team lead
  return sendMessage(groupIdOrPhone, summary);
}

/**
 * Mark a message as read (blue ticks).
 */
async function markAsRead(messageId) {
  try {
    const url = `${WA_BASE_URL}/${config.wa.phoneNumberId}/messages`;
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.wa.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    // Non-critical — don't throw
    logger.warn(`Failed to mark message ${messageId} as read`, err.message);
  }
}

module.exports = { sendMessage, sendGroupMessage, markAsRead };
