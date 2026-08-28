/**
 * lib/crypto/community.ts
 * Cryptographic helpers for Anonymous Community & 1:1 E2E Encrypted Chat.
 * Uses WebCrypto ECDH (P-256) for Diffie-Hellman key agreement + AES-256-GCM for message encryption.
 */

export interface AnonKeypair {
  publicKeyBase64: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface StoredAnonIdentity {
  anonId: string;
  anonHandle: string;
  publicKeyBase64: string;
  privateKeyJwk: JsonWebKey;
}

const STORAGE_KEY = "sz_anon_community_identity";

/** Generate a fresh ECDH keypair for 1:1 anon chat */
export async function generateChatKeypair(): Promise<AnonKeypair> {
  const keypair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );

  const exportedPub = await crypto.subtle.exportKey("raw", keypair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPub)));

  return {
    publicKeyBase64,
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
  };
}

/** Import a recipient's raw public key from base64 */
export async function importPeerPublicKey(b64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

/** Compute shared AES-256-GCM symmetric key via ECDH */
export async function deriveSharedChatKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a 1:1 chat message */
export async function encryptChatMessage(
  plaintext: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuf))),
    nonce: btoa(String.fromCharCode(...iv)),
  };
}

/** Decrypt a 1:1 chat message */
export async function decryptChatMessage(
  payload: { ciphertext: string; nonce: string },
  sharedKey: CryptoKey
): Promise<string> {
  const iv = Uint8Array.from(atob(payload.nonce), (c) => c.charCodeAt(0));
  const cipherBytes = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    cipherBytes
  );

  return new TextDecoder().decode(decryptedBuf);
}

/** Save anon identity locally (client-side only, completely isolated from vault ID) */
export async function saveLocalAnonIdentity(
  anonId: string,
  anonHandle: string,
  keypair: AnonKeypair
): Promise<void> {
  const privateJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);
  const data: StoredAnonIdentity = {
    anonId,
    anonHandle,
    publicKeyBase64: keypair.publicKeyBase64,
    privateKeyJwk: privateJwk,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Load local anon identity if joined */
export async function loadLocalAnonIdentity(): Promise<{
  anonId: string;
  anonHandle: string;
  publicKeyBase64: string;
  privateKey: CryptoKey;
} | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: StoredAnonIdentity = JSON.parse(raw);
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      parsed.privateKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"]
    );
    return {
      anonId: parsed.anonId,
      anonHandle: parsed.anonHandle,
      publicKeyBase64: parsed.publicKeyBase64,
      privateKey,
    };
  } catch (err) {
    console.error("Failed to load local anon identity", err);
    return null;
  }
}

/** Delete local anon identity */
export function removeLocalAnonIdentity(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
