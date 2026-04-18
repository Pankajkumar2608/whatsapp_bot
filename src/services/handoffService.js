/**
 * Handoff service — generates lead summary and sends to client's group.
 */
const UserModel = require('../models/userModel');
const whatsappService = require('./whatsappService');
const { tagLead } = require('./decisionEngine');
const logger = require('../utils/logger');

const HandoffService = {
  /**
   * Execute a full handoff for a user.
   *
   * 1. Generate structured summary
   * 2. Send to client's group/admin
   * 3. Mark user as handed off
   * 4. Send goodbye message to user
   */
  async execute(user, client) {
    try {
      const tag = tagLead(user.intent_score);
      const summary = this.buildSummary(user, client, tag);

      // ── Send to client's WhatsApp group ──
      if (client.handoff_group_id) {
        await whatsappService.sendGroupMessage(
          client.handoff_group_id,
          summary.formatted
        );
        logger.info(`Handoff summary sent to group ${client.handoff_group_id}`);
      } else {
        logger.warn(`No handoff_group_id for client ${client.client_id} — skipping group message`);
      }

      // ── Mark user as handed off ──
      await UserModel.markHandoff(user.user_id);
      await UserModel.updateLeadTag(user.user_id, tag);

      // ── Send human-takeover message to user ──
      const goodbyeMsg = user.detected_language === 'hindi'
        ? 'Dhanyavaad! Hamaari team aapse jaldi baat karegi. 🙏'
        : user.detected_language === 'hinglish'
          ? 'Thank you! Humari team aapse jaldi connect karegi. 🙏'
          : 'Thank you! Our team will reach out to you shortly. 🙏';

      await whatsappService.sendMessage(user.phone_number, goodbyeMsg);

      logger.info(`Handoff complete for user ${user.user_id} (${user.phone_number})`);
      return summary;
    } catch (err) {
      logger.error(`Handoff failed for user ${user.user_id}`, err);
      throw err;
    }
  },

  /**
   * Build a structured & formatted lead summary.
   */
  buildSummary(user, client, tag) {
    const fields = user.extracted_fields || {};
    const customFields = fields.custom_fields || {};

    const structured = {
      phone: user.phone_number,
      client_id: client.client_id,
      business_name: client.business_name,
      service_type: client.service_type,
      need: fields.need || 'Not specified',
      timeline: fields.timeline || 'Not specified',
      extracted_fields: customFields,
      intent: fields.last_intent || 'unknown',
      intent_score: user.intent_score,
      lead_tag: tag,
      message_count: user.message_count,
      language: user.detected_language || 'english',
    };

    // Build formatted WhatsApp message
    const formatted = `🔔 *NEW LEAD — ${client.business_name}*

📱 Phone: ${user.phone_number}
🏷️ Tag: *${tag.toUpperCase()}*
📊 Score: ${user.intent_score} | Messages: ${user.message_count}

📋 *Details:*
• Need: ${structured.need}
• Timeline: ${structured.timeline}
${Object.entries(customFields)
  .filter(([, v]) => v)
  .map(([k, v]) => `• ${k}: ${v}`)
  .join('\n')}

🌐 Language: ${structured.language}
🔗 Service: ${client.service_type}

_Lead qualified by bot at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

    return { structured, formatted };
  },
};

module.exports = HandoffService;
