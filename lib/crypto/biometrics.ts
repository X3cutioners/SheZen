/**
 * lib/crypto/biometrics.ts
 * WebAuthn platform authenticator (Touch ID, Face ID, Windows Hello) integration for SheZen.
 * Unlocks the vault locally in 1 tap without transmitting credentials.
 */

import { unlockVault, setSessionMasterKey } from "@/lib/crypto";
import { loadWrappedKey } from "@/lib/local-db";

const STORAGE_KEY = "sz_biometrics_data";

interface BiometricVaultData {
  credentialId: string;
  encryptedPass: string;
  iv: string;
  salt: string;
}

export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricsEnrolled(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

export async function enrollBiometrics(passcode: string): Promise<boolean> {
  if (!window.PublicKeyCredential) throw new Error("Biometrics not supported on this device.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "SheZen Private Vault", id: window.location.hostname },
      user: {
        id: userId,
        name: "shezen_user",
        displayName: "SheZen Vault Owner",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },  // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  if (!credential) throw new Error("Biometric enrollment canceled.");

  // Encrypt passcode locally with device-bound AES key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Derive key from credential rawId
  const rawId = new Uint8Array(credential.rawId);
  const keyMaterial = await crypto.subtle.importKey("raw", rawId.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt"]);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    new TextEncoder().encode(passcode)
  );

  const data: BiometricVaultData = {
    credentialId: btoa(String.fromCharCode(...rawId)),
    encryptedPass: btoa(String.fromCharCode(...new Uint8Array(encryptedBuf))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return true;
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) throw new Error("Biometrics not enrolled.");

  const data: BiometricVaultData = JSON.parse(stored);
  const rawIdBytes = Uint8Array.from(atob(data.credentialId), (c) => c.charCodeAt(0));
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: rawIdBytes }],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  if (!assertion) throw new Error("Biometric verification failed.");

  // Decrypt stored passcode using credential rawId
  const keyMaterial = await crypto.subtle.importKey("raw", rawIdBytes.slice(0, 32), { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = Uint8Array.from(atob(data.iv), (c) => c.charCodeAt(0));
  const encryptedBytes = Uint8Array.from(atob(data.encryptedPass), (c) => c.charCodeAt(0));

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encryptedBytes
  );

  const passcode = new TextDecoder().decode(decryptedBuf);
  const localWrapped = await loadWrappedKey();
  if (!localWrapped) throw new Error("Vault not found.");

  const masterKey = await unlockVault(passcode, localWrapped);
  setSessionMasterKey(masterKey);
  return true;
}

export function disableBiometrics(): void {
  localStorage.removeItem(STORAGE_KEY);
}
