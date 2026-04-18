/**
 * Seed script — inserts sample client configs (dentist + makeup).
 *
 * Usage:  node src/scripts/seed.js
 */
require('dotenv').config();
const { pool } = require('../config/database');

const SAMPLE_CLIENTS = [
  {
    service_type: 'dentist',
    business_name: 'SmileCare Dental Clinic',
    qualification_questions: JSON.stringify([
      'What dental treatment are you looking for?',
      'How urgent is this?',
      'Which city/area are you in?',
      'When would you like to visit?',
    ]),
    handoff_group_id: null, // ← set to real group admin phone
    tone: 'casual',
    language_preference: 'hinglish',
    entry_keywords: '{dental,dentist,teeth,dant,daant}',
    is_default: true,
    system_prompt_override: null,
    handoff_message_count: 10,
    handoff_intent_threshold: 6,
  },
  {
    service_type: 'makeup',
    business_name: 'GlamSquad Makeup Studio',
    qualification_questions: JSON.stringify([
      'What is the occasion — wedding, engagement, party?',
      'When is the event?',
      'Which city will the event be in?',
      'Do you have a budget range in mind?',
    ]),
    handoff_group_id: null, // ← set to real group admin phone
    tone: 'casual',
    language_preference: 'hinglish',
    entry_keywords: '{makeup,bridal,makeover,shaadi}',
    is_default: false,
    system_prompt_override: null,
    handoff_message_count: 10,
    handoff_intent_threshold: 6,
  },
];

async function seed() {
  console.log('🌱 Seeding sample clients…');

  for (const client of SAMPLE_CLIENTS) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO clients (
          service_type, business_name, qualification_questions,
          handoff_group_id, tone, language_preference,
          entry_keywords, is_default, system_prompt_override,
          handoff_message_count, handoff_intent_threshold
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT DO NOTHING
        RETURNING client_id, business_name`,
        [
          client.service_type,
          client.business_name,
          client.qualification_questions,
          client.handoff_group_id,
          client.tone,
          client.language_preference,
          client.entry_keywords,
          client.is_default,
          client.system_prompt_override,
          client.handoff_message_count,
          client.handoff_intent_threshold,
        ]
      );

      if (rows[0]) {
        console.log(`  ✅ ${rows[0].business_name} (${rows[0].client_id})`);
      } else {
        console.log(`  ⏭️  ${client.business_name} — already exists`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to seed ${client.business_name}:`, err.message);
    }
  }

  await pool.end();
  console.log('🌱 Seeding complete.');
}

seed();
