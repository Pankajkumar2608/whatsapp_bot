/**
 * Winston logger — structured JSON in production, colorized in dev.
 */
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    config.nodeEnv === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  defaultMeta: { service: 'wa-lead-bot' },
  transports: [
    new transports.Console(),
  ],
});

module.exports = logger;
