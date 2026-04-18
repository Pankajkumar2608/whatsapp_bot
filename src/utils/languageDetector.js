/**
 * Lightweight Hindi / Hinglish detector.
 * Uses common keyword heuristics — no heavy NLP library needed.
 */

const HINDI_KEYWORDS = [
  'kya', 'hai', 'kaise', 'kab', 'kaha', 'kitna', 'kitne', 'kitni',
  'mujhe', 'chahiye', 'haan', 'nahi', 'theek', 'accha', 'bhai',
  'didi', 'ji', 'namaste', 'dhanyawad', 'shukriya', 'batao',
  'bolo', 'bol', 'karwana', 'karwani', 'lagega', 'lagegi',
  'mil', 'milega', 'de', 'dena', 'do', 'lena', 'aur', 'par',
  'lekin', 'abhi', 'kal', 'aaj', 'subah', 'shaam', 'raat',
  'paisa', 'paise', 'rupee', 'rupaye', 'wala', 'wali',
];

// Unicode range for Devanagari script
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/**
 * Detect language from a user message.
 * @param {string} text
 * @returns {'hindi' | 'hinglish' | 'english'}
 */
function detectLanguage(text) {
  if (!text) return 'english';

  // Pure Hindi (Devanagari script)
  if (DEVANAGARI_REGEX.test(text)) return 'hindi';

  // Hinglish detection (romanised Hindi words mixed with English)
  const words = text.toLowerCase().split(/\s+/);
  const hindiWordCount = words.filter((w) => HINDI_KEYWORDS.includes(w)).length;
  const ratio = hindiWordCount / words.length;

  if (ratio >= 0.4) return 'hinglish';
  if (hindiWordCount >= 2) return 'hinglish';

  return 'english';
}

module.exports = { detectLanguage };
