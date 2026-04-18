/**
 * OpenAI service — generates human-like replies + extracts structured data.
 *
 * ⚡ Token-optimised: only sends last 5 messages + structured memory.
 */
const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Build the system prompt dynamically based on client + flow config.
 */
function buildSystemPrompt({ client, flow, extractedFields, detectedLanguage }) {
  const tone = client.tone === 'formal'
    ? 'professional and polite'
    : 'friendly, casual, and warm';

  const langInstruction = {
    hindi: 'Reply in Hindi (Devanagari script).',
    hinglish: 'Reply in Hinglish (Hindi words written in English). Example: "Aapka event kab hai?"',
    english: 'Reply in English.',
  }[detectedLanguage] || 'Reply in the same language the user is using.';

  const nextHint = flow.getNextQuestionHint(extractedFields);

  return `You are a lead qualification assistant for "${client.business_name}".
Your tone is ${tone}.

${flow.systemPromptContext}

RULES:
- Ask ONLY 1 question at a time.
- Keep replies under 2 lines (max 40 words).
- Sound like a real human, not a bot.
- NEVER say you are an AI or bot.
- ${langInstruction}
${client.system_prompt_override ? `\nADDITIONAL INSTRUCTIONS: ${client.system_prompt_override}` : ''}

CURRENT GOAL: ${nextHint}

Fields extracted so far: ${JSON.stringify(extractedFields || {})}

You MUST respond with ONLY valid JSON in this exact format:
{
  "reply": "your message to the user",
  "extracted": {
    "need": "what they need (or null)",
    "timeline": "when they need it (or null)",
    "custom_fields": { extracted field key-values },
    "intent": "high" | "medium" | "low"
  }
}`;
}

/**
 * Build the messages array (token-optimised: only last 5 + memory).
 */
function buildMessages({ systemPrompt, recentMessages }) {
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const msg of recentMessages) {
    messages.push({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  return messages;
}

/**
 * Generate a reply + extract structured data.
 *
 * @param {object} params
 * @param {object} params.client       Client DB row
 * @param {object} params.flow         Flow config
 * @param {object} params.extractedFields  Already-extracted fields
 * @param {string} params.detectedLanguage
 * @param {object[]} params.recentMessages  Last 5 messages [{direction, content}]
 * @param {string} params.userMessage  The current inbound message
 *
 * @returns {{ reply: string, extracted: object }}
 */
async function generateReply({ client, flow, extractedFields, detectedLanguage, recentMessages, userMessage }) {
  const systemPrompt = buildSystemPrompt({ client, flow, extractedFields, detectedLanguage });

  // Append the current message
  const allMessages = [
    ...recentMessages,
    { direction: 'inbound', content: userMessage },
  ];

  const messages = buildMessages({ systemPrompt, recentMessages: allMessages });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0].message.content;
    logger.debug('OpenAI raw response', { raw });

    const parsed = JSON.parse(raw);

    // Validate structure
    if (!parsed.reply) {
      throw new Error('Missing "reply" in OpenAI response');
    }

    return {
      reply: parsed.reply,
      extracted: parsed.extracted || {},
    };
  } catch (err) {
    logger.error('OpenAI generation failed', err);

    // Fallback — generic reply so user is never left hanging
    return {
      reply: detectedLanguage === 'hindi'
        ? 'Ek second, main check karta hoon.'
        : detectedLanguage === 'hinglish'
          ? 'Ek sec, check kar raha hoon.'
          : 'One moment, let me check on that.',
      extracted: {},
    };
  }
}

module.exports = { generateReply };
