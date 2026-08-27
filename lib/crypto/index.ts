/**
 * lib/crypto/index.ts
 * Zero-knowledge crypto module for SheZen.
 *
 * DESIGN:
 *  - One random 256-bit master key generated on first setup (or import).
 *  - Master key lives in memory only for the session (never written to
 *    IndexedDB/localStorage in plaintext).
 *  - Master key is wrapped (encrypted) by a key derived from the user's
 *    passcode via Argon2id, and the wrapped blob is stored in IndexedDB.
 *  - Every individual record (journal entry, cycle log, note) is encrypted
 *    with AES-256-GCM using the master key + a per-record random nonce.
 *
 * DEPENDENCIES:
 *  - WebCrypto API (window.crypto.subtle) — no extra bundle.
 *  - hash-wasm (Argon2id WASM) — imported dynamically so it only loads
 *    when key derivation is actually needed (setup / unlock).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WrappedKey {
  /** Base64-encoded ciphertext of the wrapped master key */
  ciphertext: string;
  /** Base64-encoded IV used for the AES-GCM wrapping */
  iv: string;
  /** Base64-encoded Argon2id salt */
  salt: string;
}

export interface EncryptedRecord {
  /** Base64-encoded AES-256-GCM ciphertext */
  ciphertext: string;
  /** Base64-encoded 12-byte IV/nonce */
  iv: string;
}

// ─── Session key store (in-memory only) ─────────────────────────────────────

let _sessionMasterKey: CryptoKey | null = null;

/** Store the master key in memory for this session. */
export function setSessionMasterKey(key: CryptoKey): void {
  _sessionMasterKey = key;
}

/** Retrieve the in-memory master key, or null if locked. */
export function getSessionMasterKey(): CryptoKey | null {
  return _sessionMasterKey;
}

/** Clear the in-memory master key (lock the session). */
export function lockSession(): void {
  _sessionMasterKey = null;
}

/** True if the app is unlocked (master key is in memory). */
export function isUnlocked(): boolean {
  return _sessionMasterKey !== null;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

// ─── Master key generation ───────────────────────────────────────────────────

/**
 * Generate a new random 256-bit master key.
 * Called once on first setup; never called again for the same account.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can wrap it
    ["encrypt", "decrypt"]
  );
}

/**
 * Export the raw bytes of the master key.
 * Used only for wrapping — never stored in plaintext.
 */
export async function exportRawKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

/**
 * Import raw bytes as a master key.
 * Used when unwrapping after login/unlock.
 */
export async function importRawKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ─── Key derivation (Argon2id via hash-wasm) ─────────────────────────────────

const ARGON2_MEMORY_KIB = 65536; // 64 MiB
const ARGON2_ITERATIONS = 3;
const ARGON2_PARALLELISM = 1;
const DERIVED_KEY_BYTES = 32; // 256 bits

/**
 * Derive a 256-bit wrapping key from a passcode + salt using Argon2id.
 * The derived key is used to wrap/unwrap the master key, never to encrypt
 * data directly.
 *
 * @param passcode  The user's PIN or passphrase (plain string)
 * @param salt      Random 16-byte salt (stored alongside the wrapped key)
 * @returns A CryptoKey suitable for AES-GCM wrapping operations
 */
export async function deriveWrappingKey(
  passcode: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Dynamic import keeps hash-wasm out of the initial bundle.
  const { argon2id } = await import("hash-wasm");

  const hashHex = await argon2id({
    password: passcode,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: DERIVED_KEY_BYTES,
    outputType: "hex",
  });

  const rawBytes = new Uint8Array(
    hashHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );

  return crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM", length: 256 },
    false, // NOT extractable — wrapping key never leaves crypto.subtle
    ["wrapKey", "unwrapKey"]
  );
}

/** Generate a new random Argon2id salt (16 bytes). */
export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

// ─── Key wrapping / unwrapping ───────────────────────────────────────────────

/**
 * Wrap (encrypt) the master key with a wrapping key derived from the passcode.
 * The result is safe to store in IndexedDB or on the server.
 *
 * @param masterKey     The master CryptoKey to wrap
 * @param wrappingKey   Derived from passcode via deriveWrappingKey()
 * @returns A serialisable WrappedKey object
 */
export async function wrapMasterKey(
  masterKey: CryptoKey,
  wrappingKey: CryptoKey,
  salt: Uint8Array
): Promise<WrappedKey> {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey("raw", masterKey, wrappingKey, {
    name: "AES-GCM",
    iv,
  });
  return {
    ciphertext: toBase64(wrapped),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/**
 * Unwrap (decrypt) a wrapped master key using the wrapping key.
 * Throws if the passcode is wrong (AES-GCM authentication tag fails).
 *
 * @param wrapped       The WrappedKey from storage
 * @param wrappingKey   Derived from passcode via deriveWrappingKey()
 * @returns The master CryptoKey, ready to be set in session
 */
export async function unwrapMasterKey(
  wrapped: WrappedKey,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const ciphertext = fromBase64(wrapped.ciphertext);
  const iv = fromBase64(wrapped.iv);

  return crypto.subtle.unwrapKey(
    "raw",
    ciphertext,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ─── Record encryption / decryption ──────────────────────────────────────────

/**
 * Encrypt a plaintext string (JSON record, note body, etc.) with the master
 * key. Each call generates a fresh random 12-byte IV — never reuse IVs.
 *
 * @param plaintext   UTF-8 string to encrypt
 * @param masterKey   The in-session master CryptoKey
 * @returns An EncryptedRecord with base64-encoded ciphertext + IV
 */
export async function encryptRecord(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedRecord> {
  const iv = randomBytes(12);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encoded
  );
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
  };
}

/**
 * Decrypt an EncryptedRecord back to plaintext.
 * Throws on tamper or wrong key (AES-GCM authentication failure).
 *
 * @param record      An EncryptedRecord from storage
 * @param masterKey   The in-session master CryptoKey
 * @returns Decrypted UTF-8 string
 */
export async function decryptRecord(
  record: EncryptedRecord,
  masterKey: CryptoKey
): Promise<string> {
  const ciphertext = fromBase64(record.ciphertext);
  const iv = fromBase64(record.iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Full setup helper (first run) ───────────────────────────────────────────

/**
 * First-run setup: generate a master key and wrap it with the user's passcode.
 * Returns the master key (to be set in session) and the wrapped key blob
 * (to be stored in IndexedDB via local-db).
 *
 * @param passcode  The user's chosen PIN / passphrase
 */
export async function setupNewVault(passcode: string): Promise<{
  masterKey: CryptoKey;
  wrappedKey: WrappedKey;
}> {
  const masterKey = await generateMasterKey();
  const salt = generateSalt();
  const wrappingKey = await deriveWrappingKey(passcode, salt);
  const wrappedKey = await wrapMasterKey(masterKey, wrappingKey, salt);
  return { masterKey, wrappedKey };
}

/**
 * Unlock: re-derive the wrapping key from the passcode, unwrap the master key.
 * Throws if the passcode is wrong.
 *
 * @param passcode   The user's PIN / passphrase
 * @param wrapped    The WrappedKey from local storage
 * @returns The master CryptoKey, ready for setSessionMasterKey()
 */
export async function unlockVault(
  passcode: string,
  wrapped: WrappedKey
): Promise<CryptoKey> {
  const salt = fromBase64(wrapped.salt);
  const wrappingKey = await deriveWrappingKey(passcode, salt);
  return unwrapMasterKey(wrapped, wrappingKey);
}
