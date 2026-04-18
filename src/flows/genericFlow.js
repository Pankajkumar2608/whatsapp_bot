/**
 * Generic / fallback conversation flow.
 * Used when no service-specific flow matches.
 */

const FLOW_CONFIG = {
  serviceType: 'generic',

  extractionFields: ['requirement', 'timeline', 'location'],

  getNextQuestionHint(extractedFields = {}) {
    if (!extractedFields.requirement) {
      return 'Ask what service or help the user is looking for.';
    }
    if (!extractedFields.timeline) {
      return 'Ask about their timeline — when do they need this done.';
    }
    if (!extractedFields.location) {
      return 'Ask for their city or area.';
    }
    return 'All information collected. Thank the user and let them know someone will get in touch.';
  },

  systemPromptContext: `You are a helpful service booking assistant.
Understand the user's requirement, timeline, and location to connect them with the right provider.`,

  qualificationQuestions: [
    'What service are you looking for?',
    'By when do you need it?',
    'Which city/area are you in?',
  ],
};

module.exports = FLOW_CONFIG;
