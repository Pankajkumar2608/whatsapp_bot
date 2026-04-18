/**
 * Makeup Artist conversation flow.
 */

const FLOW_CONFIG = {
  serviceType: 'makeup',

  extractionFields: ['event_type', 'event_date', 'location', 'budget_range'],

  getNextQuestionHint(extractedFields = {}) {
    if (!extractedFields.event_type) {
      return 'Ask what the occasion is — wedding, engagement, party, photoshoot, etc.';
    }
    if (!extractedFields.event_date) {
      return 'Ask when the event is — the exact date or approximate timeline.';
    }
    if (!extractedFields.location) {
      return 'Ask for the event location or city so we can check availability.';
    }
    if (!extractedFields.budget_range) {
      return 'Gently ask about their budget range to suggest the right package.';
    }
    return 'All information collected. Thank the user and let them know the artist team will reach out with packages soon.';
  },

  systemPromptContext: `You are a friendly beauty and makeup booking assistant.
You help clients book professional makeup artists for events.
You know about bridal makeup, party makeup, engagement looks, pre-wedding shoots, saree draping, and hair styling.
Be warm, excited about their event, and encouraging.`,

  qualificationQuestions: [
    'What event is the makeup for?',
    'When is the event?',
    'Where will it be held?',
    'Do you have a budget range in mind?',
  ],
};

module.exports = FLOW_CONFIG;
