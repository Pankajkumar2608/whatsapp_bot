/**
 * Webhook controller — handles all incoming WhatsApp Cloud API webhooks.
 *
 * GET  /webhook  → verification challenge
 * POST /webhook  → incoming messages
 */
const config = require('../config');
const logger = require('../utils/logger');
const RoutingService = require('../services/routingService');
const MemoryService = require('../services/memoryService');
const DecisionEngine = require('../services/decisionEngine');
const OpenAIService = require('../services/openaiService');
const HandoffService = require('../services/handoffService');
const WhatsAppService = require('../services/whatsappService');
const UserModel = require('../models/userModel');
const { getFlow } = require('../flows');
const { detectLanguage } = require('../utils/languageDetector');

/**
 * GET /webhook — Meta verification challenge.
 */
function verifyWebhook(req, res) {
  // Express 5 can break dot-notation query params — parse manually as fallback
  const url = new URL(req.originalUrl, `http://${req.headers.host}`);
  const mode = req.query['hub.mode'] || req.query?.hub?.mode || url.searchParams.get('hub.mode');
  const token = req.query['hub.verify_token'] || req.query?.hub?.verify_token || url.searchParams.get('hub.verify_token');
  const challenge = req.query['hub.challenge'] || req.query?.hub?.challenge || url.searchParams.get('hub.challenge');

  logger.info('Webhook verify attempt', {
    mode,
    receivedToken: token,
    expectedToken: config.wa.verifyToken,
    match: token === config.wa.verifyToken,
    rawUrl: req.originalUrl,
  });

  if (mode === 'subscribe' && token === config.wa.verifyToken) {
    logger.info('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification FAILED', {
    mode,
    receivedToken: token,
    expectedToken: config.wa.verifyToken,
  });
  return res.sendStatus(403);
}

/**
 * POST /webhook — process incoming messages.
 */
async function handleIncoming(req, res) {
  // Always respond 200 immediately to avoid Meta retries
  res.sendStatus(200);

  try {
    const body = req.body;

    // Validate structure
    if (body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value.messages) continue;

        for (const message of value.messages) {
          // We only handle text messages for now
          if (message.type !== 'text') {
            logger.debug(`Skipping non-text message type: ${message.type}`);
            continue;
          }

          await processMessage({
            from: message.from,
            text: message.text?.body || '',
            messageId: message.id,
            timestamp: message.timestamp,
            metadata: value.metadata,
          });
        }
      }
    }
  } catch (err) {
    logger.error('Webhook processing error', err);
  }
}

/**
 * Core message processing pipeline.
 */
async function processMessage({ from, text, messageId, timestamp, metadata }) {
  const startTime = Date.now();
  logger.info(`── Incoming from ${from}: "${text.substring(0, 80)}"`);

  // ── 1. Mark as read ──
  WhatsAppService.markAsRead(messageId).catch(() => {});

  // ── 2. Route to client ──
  const { client, user } = await RoutingService.resolve(from, text);
  if (!client || !user) {
    logger.warn(`No client resolved for ${from} — ignoring`);
    return;
  }

  // ── 3. Check if already handed off ──
  if (user.status === 'handoff') {
    logger.info(`User ${from} already handed off — NOT replying`);
    return;
  }

  // ── 4. Detect language ──
  const detectedLanguage = detectLanguage(text);
  if (detectedLanguage !== user.detected_language) {
    await UserModel.updateLanguage(user.user_id, detectedLanguage);
  }

  // ── 5. Get flow config ──
  const flow = getFlow(client.service_type);

  // ── 6. Decision Engine — classify message ──
  const messageType = DecisionEngine.classifyMessage(text);
  logger.debug(`Message classified as: ${messageType}`);

  // ── 7. Get recent messages (context window) ──
  const recentMessages = await MemoryService.getRecentMessages(user.user_id);

  // ── 8. Save inbound message ──
  await MemoryService.saveMessage(user.user_id, 'inbound', text, {
    messageId,
    messageType,
    timestamp,
  });

  // ── 9. Generate LLM reply ──
  const { reply, extracted } = await OpenAIService.generateReply({
    client,
    flow,
    extractedFields: user.extracted_fields || {},
    detectedLanguage: detectedLanguage || user.detected_language || 'english',
    recentMessages,
    userMessage: text,
  });

  // ── 10. Compute intent delta + merge fields ──
  const intentDelta = DecisionEngine.computeIntentDelta(messageType, extracted);
  const mergedFields = MemoryService.mergeExtractedFields(
    user.extracted_fields || {},
    extracted
  );

  // ── 11. Update user in DB ──
  const updatedUser = await UserModel.updateAfterMessage(user.user_id, {
    intentDelta,
    extractedFields: mergedFields,
  });

  // ── 12. Update lead tag ──
  const tag = DecisionEngine.tagLead(updatedUser.intent_score);
  await UserModel.updateLeadTag(user.user_id, tag);

  // ── 13. Check for handoff ──
  if (DecisionEngine.shouldHandoff(updatedUser, client)) {
    logger.info(`🔔 Handoff triggered for ${from}`);
    await HandoffService.execute(updatedUser, client);
    return; // ← bot stops here permanently
  }

  // ── 14. Send reply ──   (added delay to make it more human like ig it will human like it)
  setTimeout(() => {
    await WhatsAppService.sendMessage(from, reply);
  },3000)

  // ── 15. Save outbound message ──
  await MemoryService.saveMessage(user.user_id, 'outbound', reply);

  const elapsed = Date.now() - startTime;
  logger.info(`── Pipeline done for ${from} in ${elapsed}ms | Score: ${updatedUser.intent_score} | Tag: ${tag}`);
}

module.exports = { verifyWebhook, handleIncoming };
