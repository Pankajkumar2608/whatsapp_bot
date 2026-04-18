/**
 * PostgreSQL connection pool using pg.
 * Uses Neon's serverless-compatible pooler endpoint.
 */
const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error', err);
});

/**
 * Run a single query.
 * @param {string} text  SQL
 * @param {any[]}  params
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`SQL (${duration}ms): ${text.substring(0, 80)}…`);
    return res;
  } catch (err) {
    logger.error(`SQL error: ${err.message}`, { text, params });
    throw err;
  }
};

/**
 * Grab a client from the pool for transactions.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
