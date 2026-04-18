/**
 * Central configuration — all env vars & defaults in one place.
 */
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // ── PostgreSQL ──
  databaseUrl: process.env.DATABASE_URL,

  // ── WhatsApp Cloud API ──
  wa: {
    accessToken: process.env.WA_ACCESS_TOKEN,
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
    businessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID,
    verifyToken: process.env.WA_VERIFY_TOKEN || 'verify_token',
    apiVersion: 'v21.0',
  },

  // ── OpenAI ──
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  // ── Handoff thresholds ──
  handoff: {
    messageCount: parseInt(process.env.HANDOFF_MESSAGE_COUNT, 10) || 10,
    intentThreshold: parseInt(process.env.HANDOFF_INTENT_THRESHOLD, 10) || 6,
  },

  // ── Logging ──
  logLevel: process.env.LOG_LEVEL || 'info',
};
