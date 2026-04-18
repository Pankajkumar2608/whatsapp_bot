/**
 * Memory service — manages the sliding context window.
 *
 * Only feeds last 5 messages + structured memory to the LLM.
 * Never sends full chat history.
 */
const MessageModel = require('../models/messageModel');
const logger = require('../utils/logger');

const CONTEXT_WINDOW_SIZE = 5;

const MemoryService = {
  /**
   * Save a message to the database.
   */
  async saveMessage(userId, direction, content, metadata = null) {
    return MessageModel.create({ userId, direction, content, metadata });
  },

  /**
   * Get the last N messages for context window.
   */
  async getRecentMessages(userId) {
    return MessageModel.getLastN(userId, CONTEXT_WINDOW_SIZE);
  },

  /**
   * Build the structured memory object sent alongside the context window.
   * This is what gets injected into the prompt — NOT the full DB row.
   */
  buildStructuredMemory(user) {
    return {
      message_count: user.message_count,
      intent_score: user.intent_score,
      lead_tag: user.lead_tag,
      extracted_fields: user.extracted_fields || {},
      detected_language: user.detected_language,
    };
  },

  /**
   * Merge newly extracted fields into existing ones.
   * Only overwrites a field if the new value is truthy.
   */
  mergeExtractedFields(existing = {}, incoming = {}) {
    const merged = { ...existing };

    if (incoming.need) merged.need = incoming.need;
    if (incoming.timeline) merged.timeline = incoming.timeline;

    // Merge custom_fields
    if (incoming.custom_fields && typeof incoming.custom_fields === 'object') {
      merged.custom_fields = merged.custom_fields || {};
      for (const [key, val] of Object.entries(incoming.custom_fields)) {
        if (val !== null && val !== undefined && val !== '') {
          merged.custom_fields[key] = val;
        }
      }
    }

    if (incoming.intent) merged.last_intent = incoming.intent;

    return merged;
  },
};

module.exports = MemoryService;
