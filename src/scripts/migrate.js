/**
 * Database schema — run this once to set up all tables.
 *
 * Usage:  node src/scripts/migrate.js
 */
require('dotenv').config();
const { pool } = require('../config/database');

const SCHEMA = `
-- ──────────────────────────────────────────────
-- Enable UUID generation
-- ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────
-- CLIENTS — one row per tenant / service provider
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  client_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type        VARCHAR(50) NOT NULL,            -- dentist, makeup, generic, etc.
  business_name       VARCHAR(255) NOT NULL,
  qualification_questions JSONB DEFAULT '[]'::jsonb,   -- ordered list of questions
  handoff_group_id    VARCHAR(50),                     -- WA phone/group to receive leads
  tone                VARCHAR(20) DEFAULT 'casual',    -- casual | formal
  language_preference VARCHAR(20) DEFAULT 'english',   -- english | hindi | hinglish
  entry_keywords      TEXT[] DEFAULT '{}',             -- keywords that route to this client
  is_default          BOOLEAN DEFAULT false,           -- fallback client
  system_prompt_override TEXT,                         -- custom system prompt additions
  handoff_message_count  INT DEFAULT 10,               -- override global threshold
  handoff_intent_threshold INT DEFAULT 6,              -- override global threshold
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- CLIENT PHONE MAPPINGS — optional dedicated numbers
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_phone_mappings (
  mapping_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID REFERENCES clients(client_id) ON DELETE CASCADE,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- USERS (LEADS) — one row per phone+client pair
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number      VARCHAR(20) NOT NULL,
  client_id         UUID REFERENCES clients(client_id) ON DELETE SET NULL,
  message_count     INT DEFAULT 0,
  intent_score      INT DEFAULT 0,
  extracted_fields  JSONB DEFAULT '{}'::jsonb,
  lead_tag          VARCHAR(20) DEFAULT 'cold',         -- hot | warm | cold | spam
  status            VARCHAR(20) DEFAULT 'active',       -- active | handoff
  detected_language VARCHAR(20) DEFAULT 'english',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- One active session per phone+client
  UNIQUE(phone_number, client_id)
);

-- ──────────────────────────────────────────────
-- MESSAGES — full audit trail
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  message_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(user_id) ON DELETE CASCADE,
  direction   VARCHAR(10) NOT NULL,    -- inbound | outbound
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- INDEXES for query performance
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_keywords ON clients USING GIN(entry_keywords);
`;

async function migrate() {
  console.log('🔄 Running database migration…');
  try {
    await pool.query(SCHEMA);
    console.log('✅ Database schema created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
