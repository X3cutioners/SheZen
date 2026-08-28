"use client";

/**
 * app/unlock/page.tsx
 * Secure, elegant passcode unlock screen with complete Vault Recovery support:
 * - 24-Word Recovery Phrase / Key (.txt upload or paste)
 * - .shezen local backup file restore
 * - Zero-knowledge security transparency
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Fingerprint,
  KeyRound,
  FileText,
  Upload,
  RefreshCw,
  X,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { AVATARS } from "@/lib/avatars";
import { isBiometricsEnrolled, unlockWithBiometrics } from "@/lib/crypto/biometrics";
import {
  unlockVault,
  setSessionMasterKey,
  unwrapMasterKey,
  wrapMasterKey,
  deriveWrappingKey,
  generateSalt,
  toBase64,
  fromBase64,
} from "@/lib/crypto";
import { deriveRecoveryWrappingKey } from "@/lib/crypto/recovery";
import {
  loadWrappedKey,
  loadDecoyWrappedKey,
  saveWrappedKey,
  deleteEverything,
  importLocalVaultFile,
  type SheZenBackupFile,
} from "@/lib/local-db";

type RecoveryMethod = "phrase" | "backup_file" | "reset";
type RecoveryStep = "input" | "new_passcode" | "success";

export default function UnlockPage() {
  const router = useRouter();

  // Unlock State
  const [passcode, setPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Recovery Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>("phrase");
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("input");

  // Recovery - 24 Words
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("");
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState("");
  const [recoveredMasterKey, setRecoveredMasterKey] = useState<CryptoKey | null>(null);
  const [recoveredUserId, setRecoveredUserId] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  // Recovery - New Passcode Setting
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmNewPasscode, setConfirmNewPasscode] = useState("");
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [savingNewPass, setSavingNewPass] = useState(false);

  // Recovery - File Restore
  const [backupFile, setPendingBackup] = useState<SheZenBackupFile | null>(null);
  const [backupFileName, setBackupFileName] = useState("");
  const [backupFilePasscode, setBackupFilePasscode] = useState("");
  const [showBackupPasscode, setShowBackupPasscode] = useState(false);
  const [fileRestoreLoading, setFileRestoreLoading] = useState(false);
  const [fileRestoreError, setFileRestoreError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("sz_name");
      const storedAvatar = localStorage.getItem("sz_avatar");
      if (storedName) {
        setUserName(storedName);
        setRecoveryIdentifier(storedName);
      }
      if (storedAvatar) setUserAvatar(storedAvatar);
      setHasBiometrics(isBiometricsEnrolled());
    }
  }, []);

  // ─── Regular Passcode Unlock ────────────────────────────────────────────────

  async function handleUnlock() {
    if (!passcode || loading) return;
    setError("");
    setLoading(true);

    try {
      const wrapped = await loadWrappedKey();
      if (!wrapped) {
        router.replace("/setup");
        return;
      }

      let masterKey: CryptoKey | null = null;

      try {
        masterKey = await unlockVault(passcode, wrapped);
      } catch (err) {
        const decoyWrapped = await loadDecoyWrappedKey();
        if (decoyWrapped) {
          try {
            masterKey = await unlockVault(passcode, decoyWrapped);
          } catch (decoyErr) {
            throw new Error("Wrong passcode");
          }
        } else {
          throw err;
        }
      }

      if (masterKey) {
        setSessionMasterKey(masterKey);
        router.replace("/cycle");
      }
    } catch {
      setError("Incorrect passcode. Please try again.");
      setPasscode("");
      setLoading(false);
    }
  }

  // ─── Biometric Fast Unlock ─────────────────────────────────────────────────

  async function handleBiometricUnlock() {
    setBioLoading(true);
    setError("");
    try {
      const success = await unlockWithBiometrics();
      if (success) {
        router.replace("/cycle");
      }
    } catch (e: any) {
      console.error(e);
      setError("Biometric verification canceled or failed.");
    } finally {
      setBioLoading(false);
    }
  }

  // ─── Recovery via 24-Word Phrase ───────────────────────────────────────────

  async function handleVerifyRecoveryKey() {
    const trimmedPhrase = recoveryPhraseInput.trim().toLowerCase().replace(/\s+/g, " ");
    const words = trimmedPhrase.split(" ");

    if (words.length !== 24) {
      setRecoveryError("Please enter all 24 words in order.");
      return;
    }

    if (!recoveryIdentifier.trim()) {
      setRecoveryError("Please enter your SheZen account name.");
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError("");

    try {
      // 1. Fetch recovery key wrapping from server
      const res = await fetch("/api/recovery/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: recoveryIdentifier.trim() }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("No cloud backup record found for this SheZen account name.");
        }
        throw new Error("Failed to communicate with recovery server.");
      }

      const data = await res.json();
      const recoverySalt = fromBase64(data.salt);
      const wrappedRecovery = {
        ciphertext: data.wrapped_key_by_recovery,
        iv: data.wrapped_key_by_recovery.split(":")[1] || data.wrapped_key_by_recovery, // handles format
        salt: data.salt,
      };

      // 2. Derive wrapping key from the 24 words
      const { wrappingKey } = await deriveRecoveryWrappingKey(trimmedPhrase, recoverySalt);

      // 3. Unwrap master key
      let unwrappedMaster: CryptoKey;
      try {
        // Attempt unwrap with raw payload structure
        const rawCiphertext = fromBase64(data.wrapped_key_by_recovery);
        // Note: recovery wrapping format uses standard unwrap
        unwrappedMaster = await crypto.subtle.unwrapKey(
          "raw",
          rawCiphertext,
          wrappingKey,
          { name: "AES-GCM", iv: new Uint8Array(12) }, // recovery wrap IV
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
      } catch (unwrapErr) {
        // Fallback standard unwrap
        unwrappedMaster = await unwrapMasterKey(
          { ciphertext: data.wrapped_key_by_recovery, iv: toBase64(new Uint8Array(12)), salt: data.salt },
          wrappingKey
        );
      }

      setRecoveredMasterKey(unwrappedMaster);
      setRecoveryStep("new_passcode");
    } catch (e: any) {
      console.error(e);
      setRecoveryError(e.message || "Invalid recovery phrase or account name.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleUploadRecoveryTxt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecoveryError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract one-line phrase or 24 lines
      const phraseMatch = text.match(/One-line phrase:\s*\n([a-z\s]+)/i);
      if (phraseMatch && phraseMatch[1]) {
        setRecoveryPhraseInput(phraseMatch[1].trim());
        return;
      }

      // Or parse numbered lines "1. word"
      const lines = text.split("\n");
      const parsedWords: string[] = [];
      for (const line of lines) {
        const m = line.trim().match(/^\d+\.\s*([a-z]+)$/i);
        if (m && m[1]) {
          parsedWords.push(m[1].toLowerCase());
        }
      }

      if (parsedWords.length === 24) {
        setRecoveryPhraseInput(parsedWords.join(" "));
      } else {
        // If raw words
        const rawWords = text.trim().split(/\s+/);
        if (rawWords.length === 24) {
          setRecoveryPhraseInput(rawWords.join(" ").toLowerCase());
        } else {
          setRecoveryError("Could not detect 24 words in the uploaded .txt file.");
        }
      }
    };
    reader.readAsText(file);
  }

  // ─── Set New Passcode after Recovery ────────────────────────────────────────

  async function handleSaveNewPasscode() {
    if (!recoveredMasterKey) return;

    if (newPasscode.length < 4) {
      setRecoveryError("Passcode must be at least 4 characters.");
      return;
    }

    if (newPasscode !== confirmNewPasscode) {
      setRecoveryError("Passcodes do not match.");
      return;
    }

    setSavingNewPass(true);
    setRecoveryError("");

    try {
      // 1. Re-wrap master key with new passcode
      const newSalt = generateSalt();
      const newWrappingKey = await deriveWrappingKey(newPasscode, newSalt);
      const newWrappedKey = await wrapMasterKey(recoveredMasterKey, newWrappingKey, newSalt);

      // 2. Save locally to IndexedDB
      await saveWrappedKey(newWrappedKey);

      // 3. Update server password & wrapping if cloud account is linked
      const storedCloud = localStorage.getItem("sz_cloud_account");
      if (storedCloud) {
        try {
          const cloudData = JSON.parse(storedCloud);
          const encoded = new TextEncoder().encode(newPasscode);
          const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
          const passwordHash = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));

          await fetch("/api/recovery/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: cloudData.userId,
              new_password_hash: passwordHash,
              new_wrapped_key_by_password: newWrappedKey.ciphertext,
              new_salt: newWrappedKey.salt,
            }),
          });
        } catch (serverErr) {
          console.warn("Cloud sync update skipped:", serverErr);
        }
      }

      // 4. Set master key in session memory and unlock!
      setSessionMasterKey(recoveredMasterKey);
      setShowRecoveryModal(false);
      router.replace("/cycle");
    } catch (e: any) {
      console.error(e);
      setRecoveryError(e.message || "Failed to save new passcode.");
    } finally {
      setSavingNewPass(false);
    }
  }

  // ─── Restore from .shezen Backup File ──────────────────────────────────────

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileRestoreError("");
    setBackupFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.format !== "shezen-encrypted-vault" || !parsed.wrappedKey) {
          setFileRestoreError("Invalid .shezen backup file format.");
          return;
        }
        setPendingBackup(parsed);
      } catch {
        setFileRestoreError("Failed to parse backup file. Please select a valid .shezen file.");
      }
    };
    reader.readAsText(file);
  }

  async function handleRestoreFromFile() {
    if (!backupFile || !backupFilePasscode.trim()) return;

    setFileRestoreLoading(true);
    setFileRestoreError("");

    try {
      const { recordCount } = await importLocalVaultFile(backupFile, backupFilePasscode);
      setShowRecoveryModal(false);
      alert(`Successfully restored ${recordCount} vault records!`);
      router.replace("/cycle");
    } catch (e: any) {
      console.error(e);
      setFileRestoreError(e.message || "Incorrect passcode for this backup file.");
    } finally {
      setFileRestoreLoading(false);
    }
  }

  // ─── Full Reset / Fresh Start ─────────────────────────────────────────────

  async function handleWipeAndReset() {
    if (confirm("Reset everything? All local vault records on this device will be erased permanently. This cannot be undone.")) {
      await deleteEverything();
      localStorage.clear();
      sessionStorage.clear();
      router.replace("/setup");
    }
  }

  const avatarSvg = AVATARS.find((a) => a.id === userAvatar)?.svg;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "var(--color-bg)",
        padding: "32px 20px 24px",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 400, width: "100%", margin: "0 auto" }}>
        
        {/* Brand Icon or Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          {avatarSvg ? (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(var(--color-brand-rgb, 168 64 96) / 0.15)",
                border: "3px solid var(--color-surface)",
                marginBottom: 16,
              }}
            >
              {avatarSvg}
            </div>
          ) : (
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-hover) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 28px rgba(var(--color-brand-rgb, 168 64 96) / 0.25)",
                marginBottom: 16,
              }}
            >
              <Lock size={32} color="#ffffff" strokeWidth={2.2} />
            </div>
          )}

          <h1
            style={{
              fontFamily: "var(--font-voice)",
              fontSize: 32,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            {userName ? `Welcome back, ${userName}` : "SheZen"}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "var(--color-text-secondary)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Enter your passcode to unlock SheZen
          </p>
        </div>

        {/* Unlock Form Card */}
        <div
          className="card"
          style={{
            padding: "24px 20px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
            border: "0.5px solid var(--color-border)",
            borderRadius: 16,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="passcode"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Passcode
            </label>

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Lock size={18} />
              </div>

              <input
                id="passcode"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleUnlock()}
                autoFocus
                autoComplete="current-password"
                disabled={loading}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  color: "var(--color-text-primary)",
                  background: "var(--color-surface)",
                  border: error ? "1.5px solid var(--color-danger)" : "1px solid var(--color-border-strong)",
                  borderRadius: 10,
                  padding: "12px 42px 12px 38px",
                  width: "100%",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
                aria-label={showPassword ? "Hide passcode" : "Show passcode"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                background: "rgba(var(--color-danger-rgb, 220 38 38) / 0.08)",
                borderRadius: 8,
                border: "1px solid var(--color-danger)",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--color-danger)", fontWeight: 500 }}>
                {error}
              </span>
            </div>
          )}

          {/* Unlock Action Button */}
          <button
            className="btn btn-primary"
            onClick={handleUnlock}
            disabled={loading || passcode.length === 0}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Unlocking SheZen…</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>Unlock SheZen</span>
              </>
            )}
          </button>

          {/* Optional Biometric Fast Unlock Button */}
          {hasBiometrics && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBiometricUnlock}
              disabled={bioLoading || loading}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "12px",
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {bioLoading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Verifying Biometrics…</span>
                </>
              ) : (
                <>
                  <Fingerprint size={18} color="var(--color-brand)" />
                  <span>Fast Unlock with Biometrics</span>
                </>
              )}
            </button>
          )}

          {/* Forgot Passcode Button */}
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                setShowRecoveryModal(true);
                setRecoveryStep("input");
                setRecoveryError("");
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "var(--color-brand)",
                cursor: "pointer",
                padding: "4px 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontWeight: 500,
              }}
            >
              <KeyRound size={14} /> Forgot Passcode?
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Security Guarantee Footer */}
      <div style={{ textAlign: "center", paddingTop: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "var(--color-surface)",
            borderRadius: 20,
            border: "0.5px solid var(--color-border)",
          }}
        >
          <ShieldCheck size={14} color="var(--color-brand)" />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500 }}>
            Zero-Knowledge AES-256-GCM • Stays in memory only
          </span>
        </div>
      </div>

      {/* ─── Vault Recovery Modal ─── */}
      {showRecoveryModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 460,
              width: "100%",
              maxHeight: "90dvh",
              overflowY: "auto",
              borderRadius: 20,
              padding: 24,
              background: "var(--color-surface)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <KeyRound size={20} color="var(--color-brand)" />
                </div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                    SheZen Recovery
                  </h3>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                    Restore access to your encrypted SheZen data
                  </p>
                </div>
              </div>
              <button onClick={() => setShowRecoveryModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Recovery Method Tabs */}
            {recoveryStep === "input" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--color-surface-raised)", padding: 4, borderRadius: 12 }}>
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod("phrase"); setRecoveryError(""); }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: recoveryMethod === "phrase" ? 600 : 400,
                    background: recoveryMethod === "phrase" ? "var(--color-surface)" : "transparent",
                    color: recoveryMethod === "phrase" ? "var(--color-brand)" : "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: recoveryMethod === "phrase" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Recovery Phrase
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod("backup_file"); setRecoveryError(""); }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: recoveryMethod === "backup_file" ? 600 : 400,
                    background: recoveryMethod === "backup_file" ? "var(--color-surface)" : "transparent",
                    color: recoveryMethod === "backup_file" ? "var(--color-brand)" : "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: recoveryMethod === "backup_file" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  .shezen Backup
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod("reset"); setRecoveryError(""); }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: recoveryMethod === "reset" ? 600 : 400,
                    background: recoveryMethod === "reset" ? "var(--color-surface)" : "transparent",
                    color: recoveryMethod === "reset" ? "var(--color-danger)" : "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: recoveryMethod === "reset" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Reset SheZen
                </button>
              </div>
            )}

            {/* Error Message */}
            {recoveryError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(var(--color-danger-rgb, 220 38 38) / 0.08)", borderRadius: 8, border: "1px solid var(--color-danger)", marginBottom: 14 }}>
                <AlertCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--color-danger)", fontWeight: 500 }}>{recoveryError}</span>
              </div>
            )}

            {/* ─── TAB 1: 24-Word Recovery Phrase ─── */}
            {recoveryMethod === "phrase" && recoveryStep === "input" && (
              <div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.4 }}>
                  Enter your 24-word recovery phrase or upload your downloaded <code>.txt</code> key file to restore access.
                </p>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                    SheZen Account Name
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. GoldenBloom or quiet-harbor-42"
                    value={recoveryIdentifier}
                    onChange={(e) => setRecoveryIdentifier(e.target.value)}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                      24-Word Recovery Key
                    </label>
                    <label style={{ fontSize: 11, color: "var(--color-brand)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                      <Upload size={12} /> Upload .txt Key
                      <input type="file" accept=".txt" onChange={handleUploadRecoveryTxt} style={{ display: "none" }} />
                    </label>
                  </div>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Paste your 24 words separated by spaces…"
                    value={recoveryPhraseInput}
                    onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                    style={{ width: "100%", fontSize: 12, fontFamily: "monospace", resize: "none" }}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", fontSize: 13, padding: "10px" }}
                  onClick={handleVerifyRecoveryKey}
                  disabled={recoveryLoading || !recoveryPhraseInput.trim()}
                >
                  {recoveryLoading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Loader2 size={16} className="spinner" /> Verifying Keys…
                    </span>
                  ) : (
                    "Verify & Reset Passcode"
                  )}
                </button>
              </div>
            )}

            {/* ─── TAB 1 (Step 2): Setting New Passcode ─── */}
            {recoveryStep === "new_passcode" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <CheckCircle2 size={36} color="var(--color-brand)" style={{ margin: "0 auto 6px" }} />
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                    Recovery Key Verified!
                  </h4>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    Please choose a new passcode for SheZen.
                  </p>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                    New Passcode
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      className="input"
                      type={showNewPasscode ? "text" : "password"}
                      placeholder="Enter new passcode"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      style={{ width: "100%", fontSize: 14, paddingRight: 38 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasscode(!showNewPasscode)}
                      style={{ position: "absolute", right: 10, background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer" }}
                    >
                      {showNewPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                    Confirm New Passcode
                  </label>
                  <input
                    className="input"
                    type={showNewPasscode ? "text" : "password"}
                    placeholder="Repeat new passcode"
                    value={confirmNewPasscode}
                    onChange={(e) => setConfirmNewPasscode(e.target.value)}
                    style={{ width: "100%", fontSize: 14 }}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", fontSize: 13, padding: "10px" }}
                  onClick={handleSaveNewPasscode}
                  disabled={savingNewPass || !newPasscode}
                >
                  {savingNewPass ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Loader2 size={16} className="spinner" /> Saving New Passcode…
                    </span>
                  ) : (
                    "Save & Open SheZen"
                  )}
                </button>
              </div>
            )}

            {/* ─── TAB 2: .shezen Backup File Restore ─── */}
            {recoveryMethod === "backup_file" && recoveryStep === "input" && (
              <div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.4 }}>
                  If you exported a <code>.shezen</code> encrypted backup file from this or another device, you can restore it here.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "1.5px dashed var(--color-border)",
                    borderRadius: 12,
                    padding: "20px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--color-surface-raised)",
                    marginBottom: 14,
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".shezen"
                    onChange={handleFileSelected}
                    style={{ display: "none" }}
                  />
                  <Upload size={24} color="var(--color-brand)" style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                    {backupFileName ? backupFileName : "Select .shezen backup file"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                    Tap to browse local files
                  </p>
                </div>

                {backupFile && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                      Backup File Passcode
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        className="input"
                        type={showBackupPasscode ? "text" : "password"}
                        placeholder="Passcode used when exporting"
                        value={backupFilePasscode}
                        onChange={(e) => setBackupFilePasscode(e.target.value)}
                        style={{ width: "100%", fontSize: 14, paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBackupPasscode(!showBackupPasscode)}
                        style={{ position: "absolute", right: 10, background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer" }}
                      >
                        {showBackupPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", fontSize: 13, padding: "10px" }}
                  onClick={handleRestoreFromFile}
                  disabled={fileRestoreLoading || !backupFile || !backupFilePasscode}
                >
                  {fileRestoreLoading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Loader2 size={16} className="spinner" /> Restoring Records…
                    </span>
                  ) : (
                    "Restore & Open SheZen"
                  )}
                </button>
              </div>
            )}

            {/* ─── TAB 3: Zero-Knowledge Notice & Reset ─── */}
            {recoveryMethod === "reset" && recoveryStep === "input" && (
              <div>
                <div style={{ background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", border: "1px solid var(--color-danger)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <ShieldAlert size={18} color="var(--color-danger)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-danger)" }}>
                      Zero-Knowledge Architecture Notice
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
                    SheZen uses true zero-knowledge client-side encryption. No master passwords, reset links, or backdoors exist anywhere on our servers.
                  </p>
                </div>

                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 18, lineHeight: 1.5 }}>
                  If you lost your passcode and do not have your 24-word recovery key or a <code>.shezen</code> backup file, the encrypted data cannot be decrypted by anyone. You can wipe this device and start fresh with a new setup.
                </p>

                <button
                  className="btn btn-danger"
                  style={{ width: "100%", fontSize: 13, padding: "10px" }}
                  onClick={handleWipeAndReset}
                >
                  Wipe Data & Reset App
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
