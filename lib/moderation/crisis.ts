/**
 * lib/moderation/crisis.ts
 * Automated crisis & self-harm detection classifier and supportive resources.
 */

export interface CrisisResource {
  name: string;
  contact: string;
  description: string;
  actionUrl?: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    description: "Free, confidential support available 24/7 in the US and Canada.",
    actionUrl: "tel:988",
  },
  {
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    description: "Connect with a volunteer crisis counselor 24/7 via text message.",
    actionUrl: "sms:741741?body=HOME",
  },
  {
    name: "International Helpline Directory",
    contact: "findahelpline.com",
    description: "Free, confidential crisis support services worldwide.",
    actionUrl: "https://findahelpline.com",
  },
];

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "self-harm",
  "self harm",
  "cutting myself",
  "hurt myself",
  "hopeless",
  "no reason to live",
  "better off dead",
  "don't want to live",
  "overdose",
];

export function detectCrisisSignals(text: string): {
  isCrisis: boolean;
  matchedKeywords: string[];
} {
  const lower = text.toLowerCase();
  const matched = CRISIS_KEYWORDS.filter((kw) => lower.includes(kw));

  return {
    isCrisis: matched.length > 0,
    matchedKeywords: matched,
  };
}
