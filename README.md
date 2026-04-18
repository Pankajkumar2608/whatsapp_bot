# Multi-Tenant WhatsApp Lead Qualification Bot

A production-ready, multi-tenant WhatsApp bot that qualifies leads for multiple service providers (dentists, makeup artists, and more) using the WhatsApp Cloud API and OpenAI.

## Architecture

```
src/
├── config/
│   ├── index.js            # Centralized env config
│   └── database.js         # PostgreSQL pool (Neon)
├── controllers/
│   └── webhookController.js  # Webhook handler + message pipeline
├── services/
│   ├── whatsappService.js    # WhatsApp Cloud API wrapper
│   ├── openaiService.js      # LLM reply generation + extraction
│   ├── decisionEngine.js     # Rule-based scoring + classification
│   ├── memoryService.js      # Context window + field merging
│   ├── routingService.js     # Multi-tenant client resolution
│   └── handoffService.js     # Lead handoff to client groups
├── models/
│   ├── clientModel.js        # Client/tenant CRUD
│   ├── userModel.js          # User/lead state management
│   └── messageModel.js       # Message audit trail
├── flows/
│   ├── index.js              # Flow registry
│   ├── dentistFlow.js        # Dentist qualification flow
│   ├── makeupFlow.js         # Makeup artist flow
│   └── genericFlow.js        # Fallback flow
├── utils/
│   ├── logger.js             # Winston structured logging
│   └── languageDetector.js   # Hindi/Hinglish detection
├── scripts/
│   ├── migrate.js            # DB schema setup
│   └── seed.js               # Sample client data
└── server.js                 # Express entry point
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Set Up Database
```bash
npm run migrate   # Create tables
npm run seed      # Insert sample clients (dentist + makeup)
```

### 4. Run
```bash
npm start         # Production
npm run dev       # Development (auto-restart on changes)
```

## How It Works

### Message Pipeline (15 steps)

1. **Receive** — WhatsApp webhook delivers message
2. **Mark Read** — Blue ticks on user's phone
3. **Route** — Identify which client this user belongs to
4. **Handoff Check** — If already handed off, ignore completely
5. **Language Detect** — Hindi / Hinglish / English
6. **Load Flow** — Get service-specific flow config
7. **Classify** — Rule-based: `price_only`, `low_effort`, `normal`
8. **Load Context** — Last 5 messages only (token optimization)
9. **Save Inbound** — Persist to audit trail
10. **LLM Generate** — OpenAI reply + structured extraction
11. **Score** — Compute intent delta + merge extracted fields
12. **Update DB** — Persist user state
13. **Tag** — Classify lead: hot / warm / cold / spam
14. **Handoff Check** — If threshold met → send summary to client group
15. **Reply** — Send bot message to user

### Multi-Tenant Routing

Incoming messages are routed to clients in this order:

1. **Existing session** — User already has an active conversation with a client
2. **Entry keyword** — First word matches a client's keywords (e.g., "dental", "makeup")
3. **Phone mapping** — Sender's number is pre-mapped to a client
4. **Default client** — Fallback when nothing matches

### Decision Engine (Rule-Based)

| Message Type | Condition | Score Delta |
|-------------|-----------|-------------|
| `price_only` | Contains price keywords, ≤5 words | -2 |
| `low_effort` | ≤2 words | -1 |
| `normal` | Everything else | +1 |

LLM intent bonuses: `high` → +2, `medium` → +1

| Lead Tag | Score Range |
|----------|-------------|
| 🔥 HOT | ≥ 6 |
| 🟡 WARM | 3–5 |
| 🔵 COLD | 0–2 |
| ⚫ SPAM | < 0 |

### Handoff Triggers

Handoff fires when **either** condition is met:
- `message_count ≥ 10` (configurable per client)
- `intent_score ≥ 6` (configurable per client)

On handoff:
1. Bot **permanently stops** replying
2. Structured lead summary is sent to the client's WhatsApp group
3. User receives a goodbye message

## Adding a New Service Type

1. Create `src/flows/yogaFlow.js`:
```javascript
module.exports = {
  serviceType: 'yoga',
  extractionFields: ['class_type', 'schedule', 'location', 'experience_level'],
  getNextQuestionHint(fields) {
    if (!fields.class_type) return 'Ask what type of yoga they are interested in.';
    if (!fields.schedule) return 'Ask about preferred schedule — morning, evening, weekends.';
    // ...
    return 'All info collected. Thank the user.';
  },
  systemPromptContext: 'You are a friendly yoga studio assistant...',
  qualificationQuestions: ['What type of yoga interests you?', ...],
};
```

2. Register it in `src/flows/index.js`:
```javascript
const yogaFlow = require('./yogaFlow');
const flowRegistry = { dentist, makeup, generic, yoga: yogaFlow };
```

3. Add a client in the DB:
```sql
INSERT INTO clients (service_type, business_name, entry_keywords, is_default)
VALUES ('yoga', 'ZenFlow Yoga Studio', '{yoga,yogaa,class}', false);
```

## Database Schema

### `clients`
| Column | Type | Description |
|--------|------|-------------|
| client_id | UUID (PK) | Auto-generated |
| service_type | VARCHAR | dentist, makeup, generic, etc. |
| business_name | VARCHAR | Display name |
| qualification_questions | JSONB | Ordered question list |
| handoff_group_id | VARCHAR | WA phone for lead delivery |
| tone | VARCHAR | casual / formal |
| language_preference | VARCHAR | english / hindi / hinglish |
| entry_keywords | TEXT[] | Routing keywords |
| is_default | BOOLEAN | Fallback client |
| handoff_message_count | INT | Override threshold |
| handoff_intent_threshold | INT | Override threshold |

### `users`
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (PK) | Auto-generated |
| phone_number | VARCHAR | WhatsApp number |
| client_id | UUID (FK) | Mapped client |
| message_count | INT | Total messages |
| intent_score | INT | Cumulative score |
| extracted_fields | JSONB | need, timeline, custom_fields |
| lead_tag | VARCHAR | hot / warm / cold / spam |
| status | VARCHAR | active / handoff |
| detected_language | VARCHAR | english / hindi / hinglish |

### `messages`
| Column | Type | Description |
|--------|------|-------------|
| message_id | UUID (PK) | Auto-generated |
| user_id | UUID (FK) | Parent user |
| direction | VARCHAR | inbound / outbound |
| content | TEXT | Message text |
| metadata | JSONB | WA message ID, etc. |

## WhatsApp Cloud API Setup

### 1. Create Meta App
- Go to [developers.facebook.com](https://developers.facebook.com)
- Create a Business app → Add WhatsApp product

### 2. Configure Webhook
- **Callback URL**: `https://your-domain.com/webhook`
- **Verify Token**: Same as `WA_VERIFY_TOKEN` in `.env`
- **Subscribe to**: `messages`

### 3. Get Credentials
- Copy **Phone Number ID** → `WA_PHONE_NUMBER_ID`
- Copy **Access Token** → `WA_ACCESS_TOKEN`
- Copy **Business Account ID** → `WA_BUSINESS_ACCOUNT_ID`

## Deploy on Render

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "initial"
# Push to your GitHub repo
```

### 2. Create Render Web Service
- Go to [render.com](https://render.com) → New Web Service
- Connect your GitHub repo
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node

### 3. Add Environment Variables
Add all variables from `.env.example` in Render's Environment tab.

### 4. Set Webhook URL
Once deployed, your webhook URL will be:
```
https://your-app.onrender.com/webhook
```
Set this in your Meta App's WhatsApp webhook configuration.

### render.yaml (optional)
```yaml
services:
  - type: web
    name: wa-lead-bot
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: WA_ACCESS_TOKEN
        sync: false
      - key: WA_PHONE_NUMBER_ID
        sync: false
      - key: WA_BUSINESS_ACCOUNT_ID
        sync: false
      - key: WA_VERIFY_TOKEN
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: NODE_ENV
        value: production
```

## Example Handoff Message

```
🔔 *NEW LEAD — SmileCare Dental Clinic*

📱 Phone: 919876543210
🏷️ Tag: *HOT*
📊 Score: 8 | Messages: 7

📋 *Details:*
• Need: Root canal treatment
• Timeline: This week
• treatment_type: RCT
• urgency: high
• location: Mumbai, Andheri

🌐 Language: hinglish
🔗 Service: dentist

_Lead qualified by bot at 18/4/2026, 10:30:00 am_
```

## License

ISC
