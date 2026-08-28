/**
 * lib/name-generator.ts
 * Generates anonymous, poetic SheZen pseudonyms.
 */

export const ADJECTIVES = [
  "quiet", "gentle", "golden", "silver", "wild", "soft", "bright", "tender", "warm",
  "misty", "rosy", "calm", "serene", "lunar", "velvet", "starry", "dewy", "ivory",
  "sage", "mossy", "sunny", "amber", "pearl", "coral", "lilac", "crisp", "hazy",
];

export const NOUNS = [
  "bloom", "river", "dawn", "moon", "rose", "ember", "mist", "wave", "pine", "grove",
  "leaf", "shore", "glow", "petal", "willow", "fern", "brook", "tide", "meadow",
  "spark", "echo", "vale", "garden", "rain", "cloud", "cedar", "path", "song",
];

export const generateRandomName = (): string =>
  `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
