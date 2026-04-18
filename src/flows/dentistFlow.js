/**
 * Dentist-specific conversation flow.
 *
 * Defines:
 *  - extraction fields the LLM should pull
 *  - next-question logic based on what's missing
 *  - system prompt flavour
 */

const FLOW_CONFIG = {
  serviceType: 'dentist',

  /** Fields the LLM should extract from the conversation. */
  extractionFields: ['treatment_type', 'urgency', 'location', 'preferred_date'],

  /**
   * Determine the next question to guide the conversation.
   * Returns a hint that gets injected into the system prompt.
   */
  getNextQuestionHint(extractedFields = {}) {
    if (!extractedFields.treatment_type) {
      return 'Ask what dental treatment they are looking for (cleaning, braces, RCT, implant, etc).';
    }
    if (!extractedFields.urgency) {
      return 'Ask how urgently they need the treatment — today, this week, or no rush.';
    }
    if (!extractedFields.location) {
      return 'Ask which area or city they are located in.';
    }
    if (!extractedFields.preferred_date) {
      return 'Ask when they would like to schedule the appointment.';
    }
    // All info gathered
    return 'All information collected. Thank the user and let them know someone from the clinic will contact them shortly.';
  },

  /**
   * Extra context injected into the system prompt for this service.
   */
  systemPromptContext: `You are a friendly dental clinic assistant helping patients book appointments.
You know about common dental treatments: teeth cleaning, root canals (RCT), braces, dental implants, teeth whitening, cavity filling, wisdom tooth extraction.
Be empathetic about dental anxiety. Keep it warm and reassuring.`,

  /**
   * Qualification questions (also stored in DB per client — this is the default).
   */
  qualificationQuestions: [
    'What treatment are you looking for?',
    'How urgent is this — do you need it soon?',
    'Which area are you located in?',
    'When would you like to come in?',
  ],
};

module.exports = FLOW_CONFIG;
