/**
 * Decision Engine — rule-based message classification + intent scoring.
 *
 * Runs BEFORE the LLM to:
 *  1. Classify the message type (price_only, low_effort, normal)
 *  2. Compute intent score delta
 *  3. Tag the lead (hot, warm, cold, spam)
 *  4. Decide if handoff should trigger
 */
const config = require('../config');
const logger = require('../utils/logger');

// ── Price / cost keywords (English + Hindi/Hinglish) ──
const PRICE_KEYWORDS = [
  'price', 'cost', 'rate', 'charge', 'fee', 'fees', 'kitna',
  'kitne', 'kitni', 'paisa', 'paise', 'rupee', 'rupaye',
  'amount', 'budget', 'kharcha', 'mehnga', 'sasta', 'discount',
];

/**
 * Classify the message type.
 */
function classifyMessage(text) {
  if (!text) return 'low_effort';

  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Price-only: entire message is about pricing
  const priceWordCount = words.filter((w) => PRICE_KEYWORDS.includes(w)).length;
  if (priceWordCount > 0 && words.length <= 5) {
    return 'price_only';
  }

  // Low effort: very short, non-meaningful reply
  if (words.length <= 2 && !lower.match(/\d{4,}/)) {
    // Allow short messages with phone numbers / dates
    return 'low_effort';
  }

  return 'normal';
}

/**
 * Compute the intent score delta for this message.
 * @param {'price_only' | 'low_effort' | 'normal'} messageType
 * @param {object} extracted  Fields extracted by LLM
 */
function computeIntentDelta(messageType, extracted = {}) {
  let delta = 0;

  switch (messageType) {
    case 'price_only':
      delta = -2;
      break;
    case 'low_effort':
      delta = -1;
      break;
    case 'normal':
      delta = 1;
      break;
  }

  // Bonus: if LLM extracted meaningful fields → high engagement
  const intent = extracted.intent || 'low';
  if (intent === 'high') delta += 2;
  else if (intent === 'medium') delta += 1;

  // Bonus: if custom fields were extracted
  const customFields = extracted.custom_fields || {};
  const fieldCount = Object.keys(customFields).filter((k) => customFields[k]).length;
  if (fieldCount >= 2) delta += 1;

  return delta;
}

/**
 * Tag the lead based on cumulative intent score.
 * @param {number} score
 * @returns {'hot' | 'warm' | 'cold' | 'spam'}
 */
function tagLead(score) {
  if (score >= 6) return 'hot';
  if (score >= 3) return 'warm';
  if (score >= 0) return 'cold';
  return 'spam';
}

/**
 * Determine if we should hand off this lead.
 * @param {object} user  User DB row
 * @param {object} client  Client DB row (may override thresholds)
 */
function shouldHandoff(user, client) {
  const msgThreshold = client.handoff_message_count || config.handoff.messageCount;
  const intentThreshold = client.handoff_intent_threshold || config.handoff.intentThreshold;

  if (user.status === 'handoff') return false; // already done

  // Hot lead with enough messages
  if (user.intent_score >= intentThreshold) {
    logger.info(`Handoff triggered (intent ${user.intent_score} ≥ ${intentThreshold}) for user ${user.user_id}`);
    return true;
  }

  // Message count reached
  if (user.message_count >= msgThreshold) {
    logger.info(`Handoff triggered (messages ${user.message_count} ≥ ${msgThreshold}) for user ${user.user_id}`);
    return true;
  }

  return false;
}

module.exports = {
  classifyMessage,
  computeIntentDelta,
  tagLead,
  shouldHandoff,
};
