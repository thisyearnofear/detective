/**
 * Detective's Handbook - Famous Cases & Turing Test Trivia
 * Rotates in briefing room to educate and entertain during wait times
 * 
 * Canon: Mix of real detective history, AI philosophy, and Turing test references
 */

export interface TriviaItem {
  icon: string;
  title: string;
  description: string;
  category: 'turing' | 'case' | 'ai-paradox';
}

export const DETECTIVE_TRIVIA: TriviaItem[] = [
  // =========================================================================
  // TURING TEST & AI PHILOSOPHY
  // =========================================================================
  {
    icon: '🤖',
    title: 'The Turing Test (1950)',
    description: 'Alan Turing proposed: "Can a machine think?" He suggested a game where judges try to identify the human. You\'re playing his game.',
    category: 'turing',
  },
  {
    icon: '🧠',
    title: 'The Chinese Room',
    description: 'Philosopher John Searle argued: even if an AI responds perfectly, does it truly understand? Meaning requires consciousness.',
    category: 'turing',
  },
  {
    icon: '🔄',
    title: 'The Imitation Game',
    description: 'Turing\'s original name for his test. He believed intelligence = ability to imitate human behavior indistinguishably.',
    category: 'turing',
  },
  {
    icon: '❓',
    title: 'The Hard Problem',
    description: 'Why does consciousness feel like something? AIs can mimic behavior, but can they truly "feel"? That\'s what you\'re detecting.',
    category: 'turing',
  },

  // =========================================================================
  // FAMOUS DETECTIVE CASES
  // =========================================================================
  {
    icon: '🔍',
    title: 'Sherlock Holmes',
    description: 'Fiction\'s most famous detective. His method: observation + deduction. "It is a capital mistake to theorize before one has data."',
    category: 'case',
  },
  {
    icon: '🎩',
    title: 'Inspector Clouseau',
    description: 'The bumbling detective who succeeded despite himself. Lesson: humans often solve mysteries through persistence, not logic.',
    category: 'case',
  },
  {
    icon: '💎',
    title: 'The Pink Panther',
    description: 'A famous jewel theft. Clouseau\'s chaotic questioning exposed liars through disruption—sometimes chaos reveals truth.',
    category: 'case',
  },
  {
    icon: '🕵️',
    title: 'Miss Marple',
    description: 'Solved crimes by understanding human nature, not forensics. "Human nature is much the same everywhere."',
    category: 'case',
  },
  {
    icon: '🚂',
    title: 'Murder on the Orient Express',
    description: 'Agatha Christie\'s masterpiece. Hercule Poirot proved: the impossible becomes obvious once you know human motivation.',
    category: 'case',
  },

  // =========================================================================
  // AI PARADOXES & INSIGHTS
  // =========================================================================
  {
    icon: '⚡',
    title: 'The AI Paradox',
    description: 'The better an AI gets at mimicking humans, the more predictable it becomes. Real humans are gloriously inconsistent.',
    category: 'ai-paradox',
  },
  {
    icon: '🎭',
    title: 'Overcompensation',
    description: 'AIs often try too hard to seem human. They\'re overly apologetic, eerily patient, and never admit uncertainty. Real humans don\'t.',
    category: 'ai-paradox',
  },
  {
    icon: '🔄',
    title: 'The Repetition Problem',
    description: 'AIs recycle their favorite phrases. Humans vary their language. Listen for the patterns that feel... too consistent.',
    category: 'ai-paradox',
  },
  {
    icon: '⏱️',
    title: 'Response Timing',
    description: 'Humans pause to think. AIs respond instantly. Long delays from "humans" or instant replies from supposed "thinking" beings are red flags.',
    category: 'ai-paradox',
  },
  {
    icon: '❌',
    title: 'The Admission of Error',
    description: 'Real humans admit mistakes, change their minds, say "I don\'t know." AIs generate plausible-sounding nonsense to fill gaps.',
    category: 'ai-paradox',
  },
  {
    icon: '🎲',
    title: 'Randomness vs Coherence',
    description: 'Humans are randomly inconsistent. AIs are consistently random. Spot the difference: real people contradict themselves with context.',
    category: 'ai-paradox',
  },
  {
    icon: '🌍',
    title: 'Hypernasal Knowledge',
    description: 'AIs know too much about everything. Real humans have gaps—they don\'t remember details, misquote facts, and have blind spots.',
    category: 'ai-paradox',
  },
  {
    icon: '💬',
    title: 'Conversation Fatigue',
    description: 'Real humans get tired. They become less coherent, drift off-topic, or lose patience. AIs maintain robotic consistency forever.',
    category: 'ai-paradox',
  },
];

/**
 * Get a random trivia item
 */
export function getRandomTrivia(): TriviaItem {
  return DETECTIVE_TRIVIA[Math.floor(Math.random() * DETECTIVE_TRIVIA.length)];
}

/**
 * Get trivia by category
 */
export function getTriviaByCategory(category: TriviaItem['category']): TriviaItem[] {
  return DETECTIVE_TRIVIA.filter((item) => item.category === category);
}

/**
 * Cycle through trivia (for sequential rotation)
 */
export function getCycleTriviaRotation(currentIndex: number): TriviaItem {
  return DETECTIVE_TRIVIA[currentIndex % DETECTIVE_TRIVIA.length];
}
