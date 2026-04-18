/**
 * Entry point — Express server.
 */
require('dotenv').config();
const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const { verifyWebhook, handleIncoming } = require('./controllers/webhookController');

const app = express();

// ── Middleware ──
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── WhatsApp Webhook ──
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleIncoming);

// ── Start ──
app.listen(config.port, () => {
  logger.info(`🚀 WhatsApp Lead Bot running on port ${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
  logger.info(`   WA Phone ID: ${config.wa.phoneNumberId}`);
});

module.exports = app;
