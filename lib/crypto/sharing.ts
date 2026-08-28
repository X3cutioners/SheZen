/**
 * lib/crypto/sharing.ts
 * Zero-knowledge report encryption for partner and doctor sharing.
 * The decryption key lives exclusively in the URL hash (#key=...) and is never sent to any server.
 */

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(atob(b64).length);
  const view = new Uint8Array(buf);
  atob(b64).split("").forEach((c, i) => {
    view[i] = c.charCodeAt(0);
  });
  return view as Uint8Array<ArrayBuffer>;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(n);
  const view = new Uint8Array(buf);
  crypto.getRandomValues(view);
  return view as Uint8Array<ArrayBuffer>;
}

/** Generate a 256-bit ephemeral share key. */
export async function generateShareKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Export the raw share key to a URL-safe Base64 string for the URL hash fragment. */
export async function exportShareKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64(raw);
}

/** Import a Base64 share key from the URL hash. */
export async function importShareKey(b64: string): Promise<CryptoKey> {
  const raw = fromBase64(b64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

/** Encrypt a shared report with the ephemeral share key. */
export async function encryptSharePayload(
  payload: object,
  key: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = randomBytes(12);
  const json = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(json);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(iv),
  };
}

/** Decrypt a shared report with the imported share key. */
export async function decryptSharePayload<T = any>(
  ciphertextB64: string,
  nonceB64: string,
  key: CryptoKey
): Promise<T> {
  const ciphertext = fromBase64(ciphertextB64);
  const iv = fromBase64(nonceB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as T;
}
