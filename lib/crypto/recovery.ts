/**
 * lib/crypto/recovery.ts
 * Recovery key generation (24-word BIP39-style phrase) and
 * Argon2id-based wrapping key derivation from that phrase.
 */
import { BIP39_WORDS } from "@/lib/db/wordlist";
import { deriveWrappingKey, generateSalt } from "@/lib/crypto";

/** Generate a cryptographically random 24-word recovery phrase. */
export function generateRecoveryKey(): string[] {
  const words: string[] = [];
  const arr = new Uint32Array(24);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 24; i++) {
    words.push(BIP39_WORDS[arr[i] % BIP39_WORDS.length]);
  }
  return words;
}

/** Serialize the recovery key array to a passphrase string for key derivation. */
export function recoveryKeyToPassphrase(words: string[]): string {
  return words.join(" ");
}

/**
 * Derive an Argon2id wrapping key from a recovery key phrase.
 * Returns the wrapping key and the salt used (store the salt alongside the wrapped key).
 */
export async function deriveRecoveryWrappingKey(
  recoveryPhrase: string,
  existingSalt?: Uint8Array<ArrayBuffer>
): Promise<{ wrappingKey: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const salt = existingSalt ?? generateSalt();
  const wrappingKey = await deriveWrappingKey(recoveryPhrase, salt);
  return { wrappingKey, salt };
}
