/**
 * app/(app)/privacy/components/CloudBackupPanel.tsx
 * 
 * Cloud Backup opt-in flow for SheZen.
 * Uses your existing vault passcode — no separate cloud password needed.
 * Steps: Confirm Passcode -> Show 24-Word Recovery Key -> Confirm 3 Words -> Active & Synced
 */
"use client";

import { useState, useEffect } from "react";
import { unlockVault, wrapMasterKey, getSessionMasterKey, setSessionMasterKey } from "@/lib/crypto";
import { generateRecoveryKey, recoveryKeyToPassphrase, deriveRecoveryWrappingKey } from "@/lib/crypto/recovery";
import { loadWrappedKey, saveWrappedKey } from "@/lib/local-db";
import { syncAll } from "@/lib/sync";
import { Cloud, CloudOff, Check, Eye, EyeOff, RefreshCw, LogOut, ArrowRight, ShieldCheck, Download, Copy, FileText } from "lucide-react";

type BackupStep = "idle" | "passcode" | "recovery" | "confirm" | "syncing" | "login" | "active";

interface CloudAccount {
  identifier: string;
  userId: string;
}

export function CloudBackupPanel() {
  const [step, setStep] = useState<BackupStep>("idle");
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [recoveryWords, setRecoveryWords] = useState<string[]>([]);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [confirmWords, setConfirmWords] = useState<Record<number, string>>({});
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");

  useEffect(() => {
    const stored = localStorage.getItem("sz_cloud_account");
    if (stored) {
      try {
        setAccount(JSON.parse(stored));
        setStep("active");
      } catch {}
    }
  }, []);

  function pickConfirmIndices(words: string[]): number[] {
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  async function hashPassword(pass: string): Promise<string> {
    const encoded = new TextEncoder().encode(pass);
    const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
  }

  function handleDownloadRecoveryTxt() {
    if (recoveryWords.length === 0) return;
    const content = [
      "==================================================",
      "             SHEZEN RECOVERY KEY                  ",
      "==================================================",
      "",
      "IMPORTANT & CONFIDENTIAL:",
      "This 24-word recovery key is the ONLY way to restore",
      "your encrypted SheZen cloud vault if you forget your passcode.",
      "Keep this file secure, offline, and private.",
      "",
      "Generated: " + new Date().toLocaleString(),
      "",
      "--------------------------------------------------",
      recoveryWords.map((w, idx) => `${String(idx + 1).padStart(2, " ")}. ${w}`).join("\n"),
      "--------------------------------------------------",
      "",
      "One-line phrase:",
      recoveryWords.join(" "),
      "",
      "==================================================",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `shezen-recovery-key-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCopyRecoveryWords() {
    if (recoveryWords.length === 0) return;
    navigator.clipboard.writeText(recoveryWords.join(" "));
    setCopiedRecovery(true);
    setTimeout(() => setCopiedRecovery(false), 2500);
  }

  async function handlePasscodeNext() {
    setError("");
    if (!passcode) {
      setError("Please enter your vault passcode.");
      return;
    }
    setLoading(true);
    try {
      const localWrapped = await loadWrappedKey();
      if (!localWrapped) throw new Error("Vault not found.");
      
      // Verify passcode against local vault
      const masterKey = await unlockVault(passcode, localWrapped);
      setSessionMasterKey(masterKey);

      // Check if recovery key was already verified during setup
      const storedRecovery = localStorage.getItem("sz_recovery_words");
      let words: string[];
      if (storedRecovery) {
        try {
          words = JSON.parse(storedRecovery);
        } catch {
          words = generateRecoveryKey();
        }
      } else {
        words = generateRecoveryKey();
      }

      if (storedRecovery && words.length === 24) {
        // Recovery key already saved and verified during setup! Activate cloud sync directly.
        setStep("syncing");
        const pwHash = await hashPassword(passcode);
        const recoveryPhrase = recoveryKeyToPassphrase(words);
        const { wrappingKey: recoveryWrappingKey, salt: recoverySalt } = await deriveRecoveryWrappingKey(recoveryPhrase);
        const wrappedByRecovery = await wrapMasterKey(masterKey, recoveryWrappingKey, recoverySalt);
        const localName = (typeof window !== "undefined" ? localStorage.getItem("sz_name") : null) || undefined;

        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: localName,
            password_hash: pwHash,
            wrapped_key_by_password: JSON.stringify(localWrapped),
            password_salt: localWrapped.salt,
            wrapped_key_by_recovery: JSON.stringify(wrappedByRecovery),
            recovery_salt: wrappedByRecovery.salt,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Cloud signup failed.");
        }

        const data = await res.json();
        const newAccount = { identifier: data.identifier, userId: data.user_id };
        localStorage.setItem("sz_cloud_account", JSON.stringify(newAccount));
        setAccount(newAccount);

        await syncAll();

        setStep("active");
        setPasscode("");
      } else {
        // Fallback for legacy accounts without stored recovery words
        setRecoveryWords(words);
        setConfirmIndices(pickConfirmIndices(words));
        setStep("recovery");
      }
    } catch (e: any) {
      setError(e.message || "Incorrect vault passcode. Please enter the passcode you use to unlock SheZen.");
      setStep("passcode");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAndActivate() {
    setError("");
    for (const idx of confirmIndices) {
      if ((confirmWords[idx] ?? "").trim().toLowerCase() !== recoveryWords[idx].toLowerCase()) {
        setError(`Word #${idx + 1} is incorrect. Please check your recovery key.`);
        return;
      }
    }
    setLoading(true);
    setStep("syncing");
    try {
      const masterKey = getSessionMasterKey();
      if (!masterKey) throw new Error("Session locked. Please re-enter your passcode.");

      const localWrapped = await loadWrappedKey();
      if (!localWrapped) throw new Error("Vault not found.");

      const pwHash = await hashPassword(passcode);

      // Derive wrapping key from the 24-word recovery phrase
      const recoveryPhrase = recoveryKeyToPassphrase(recoveryWords);
      const { wrappingKey: recoveryWrappingKey, salt: recoverySalt } = await deriveRecoveryWrappingKey(recoveryPhrase);
      const wrappedByRecovery = await wrapMasterKey(masterKey, recoveryWrappingKey, recoverySalt);

      const localName = (typeof window !== "undefined" ? localStorage.getItem("sz_name") : null) || undefined;

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: localName,
          password_hash: pwHash,
          wrapped_key_by_password: JSON.stringify(localWrapped),
          password_salt: localWrapped.salt,
          wrapped_key_by_recovery: JSON.stringify(wrappedByRecovery),
          recovery_salt: wrappedByRecovery.salt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Signup failed.");
      }

      const data = await res.json();
      const newAccount = { identifier: data.identifier, userId: data.user_id };
      localStorage.setItem("sz_cloud_account", JSON.stringify(newAccount));
      setAccount(newAccount);

      // Push local data to cloud
      await syncAll();

      setStep("active");
      setPasscode("");
      setRecoveryWords([]);
      setConfirmWords({});
    } catch (e: any) {
      setError(e.message ?? "Failed to activate cloud backup.");
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginExisting() {
    setError("");
    if (!loginIdentifier.trim() || !passcode.trim()) {
      setError("Please enter both your SheZen name and passcode.");
      return;
    }
    setLoading(true);
    try {
      const pwHash = await hashPassword(passcode);
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: pwHash,
        }),
      });

      if (!res.ok) {
        throw new Error("Invalid SheZen name or passcode.");
      }

      const data = await res.json();
      const wrappedKeyObj = JSON.parse(data.wrapped_key_by_password);

      // Unwrap master key using passcode
      const masterKey = await unlockVault(passcode, wrappedKeyObj);
      setSessionMasterKey(masterKey);
      await saveWrappedKey(wrappedKeyObj);

      const newAccount = { identifier: loginIdentifier.trim(), userId: data.user_id };
      localStorage.setItem("sz_cloud_account", JSON.stringify(newAccount));
      setAccount(newAccount);

      // Pull cloud records
      await syncAll();

      setStep("active");
      setPasscode("");
      setLoginIdentifier("");
    } catch (e: any) {
      setError(e.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncStatus("syncing");
    try {
      await syncAll();
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("sz_cloud_account");
    setAccount(null);
    setStep("idle");
  }

  if (step === "idle") {
    return (
      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CloudOff size={18} color="var(--color-text-secondary)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Cloud Backup & Sync
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
              Optional zero-knowledge backup encrypted with your existing vault passcode.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, fontSize: 13, padding: "8px 14px" }}
            onClick={() => setStep("passcode")}
          >
            Enable Backup
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "8px 12px" }}
            onClick={() => setStep("login")}
          >
            Link Existing Backup
          </button>
        </div>
      </div>
    );
  }

  if (step === "passcode") {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <ShieldCheck size={20} color="var(--color-brand)" />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Confirm Your Vault Passcode
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
          Your cloud backup will be encrypted with your <strong>existing vault passcode</strong>. Enter it once below to verify your vault and generate your 24-word recovery key.
        </p>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            className="input"
            type={showPasscode ? "text" : "password"}
            placeholder="Enter your vault passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: "100%", paddingRight: 44 }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPasscode(!showPasscode)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={() => { setStep("idle"); setPasscode(""); setError(""); }}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={handlePasscodeNext} disabled={loading}>
            {loading ? "Verifying…" : "Next: Recovery Key →"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Cloud size={20} color="var(--color-brand)" />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Link Existing Backup
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
          Enter your <strong>SheZen Name</strong> and vault passcode to restore and sync your records.
        </p>

        <input
          className="input"
          type="text"
          placeholder="Your SheZen Name (e.g. GoldenBloom)"
          value={loginIdentifier}
          onChange={(e) => setLoginIdentifier(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
          autoFocus
        />

        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            className="input"
            type={showPasscode ? "text" : "password"}
            placeholder="Vault Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: "100%", paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPasscode(!showPasscode)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={() => { setStep("idle"); setPasscode(""); setLoginIdentifier(""); setError(""); }}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={handleLoginExisting} disabled={loading}>
            {loading ? "Restoring…" : "Link & Restore"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "recovery") {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <i className="fi fi-rr-key" style={{ fontSize: 18, color: "var(--color-brand)", lineHeight: 1 }}></i>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Your 24-Word Recovery Key
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
          If you ever forget your vault passcode, this 24-word phrase is the <strong>only way</strong> to restore your encrypted cloud vault.
        </p>

        <div style={{ background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 12px" }}>
            {recoveryWords.map((word, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", minWidth: 18, textAlign: "right" }}>{i + 1}.</span>
                <span style={{ fontFamily: "var(--font-voice)", fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{word}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "color-mix(in srgb, var(--color-danger) 8%, transparent)", border: "0.5px solid var(--color-danger)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.5 }}>
            <strong>Write this down or download the file.</strong> SheZen has zero knowledge of your encryption keys and cannot reset your vault without this phrase.
          </p>
        </div>

        {/* Action buttons: Download, Copy, and Continue */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, gap: 6 }}
            onClick={handleDownloadRecoveryTxt}
          >
            <Download size={14} color="var(--color-brand)" /> Download .txt
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, gap: 6 }}
            onClick={handleCopyRecoveryWords}
          >
            {copiedRecovery ? <Check size={14} color="var(--color-brand)" /> : <Copy size={14} />}
            {copiedRecovery ? "Copied!" : "Copy Words"}
          </button>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", fontSize: 13 }}
          onClick={() => setStep("confirm")}
        >
          I&apos;ve saved my recovery key →
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Check size={18} color="var(--color-brand)" />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Confirm Your Recovery Key
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
          Enter the words at positions {confirmIndices.map(i => `#${i + 1}`).join(", ")} from your 24-word recovery key:
        </p>

        {confirmIndices.map((wordIndex) => (
          <div key={wordIndex} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
              Word #{wordIndex + 1}
            </label>
            <input
              className="input"
              type="text"
              placeholder={`Type word #${wordIndex + 1}`}
              value={confirmWords[wordIndex] ?? ""}
              onChange={(e) => setConfirmWords(prev => ({ ...prev, [wordIndex]: e.target.value }))}
              style={{ width: "100%" }}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        ))}

        {error && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={() => setStep("recovery")} disabled={loading}>
            ← Back
          </button>
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={handleConfirmAndActivate} disabled={loading}>
            {loading ? "Activating…" : "Activate Cloud Backup"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "syncing") {
    return (
      <div className="card" style={{ marginBottom: 12, textAlign: "center", padding: 28 }}>
        <i className="fi fi-rr-cloud-upload" style={{ fontSize: 32, color: "var(--color-brand)", display: "block", marginBottom: 12 }}></i>
        <p style={{ fontFamily: "var(--font-voice)", fontSize: 16, color: "var(--color-text-primary)", marginBottom: 6 }}>
          Activating cloud backup…
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Encrypting and syncing your vault records.
        </p>
      </div>
    );
  }

  // step === "active"
  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Cloud size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Cloud Backup Active
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 1 }}>
            SheZen Account: <strong style={{ color: "var(--color-brand)" }}>{account?.identifier ?? "…"}</strong>
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncStatus === "syncing"}
          style={{ background: "none", border: "none", cursor: "pointer", color: syncStatus === "success" ? "var(--color-brand)" : syncStatus === "error" ? "var(--color-danger)" : "var(--color-text-secondary)", padding: 8 }}
          title="Sync now"
        >
          {syncStatus === "syncing" ? (
            <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
          ) : syncStatus === "success" ? (
            <Check size={18} />
          ) : (
            <RefreshCw size={18} />
          )}
        </button>
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-border)", padding: "10px 16px", display: "flex", gap: 8 }}>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: 12, gap: 6 }}
          onClick={handleLogout}
        >
          <LogOut size={14} /> Unlink Backup
        </button>
      </div>
      {syncStatus === "error" && (
        <div style={{ padding: "8px 16px", background: "color-mix(in srgb, var(--color-danger) 8%, transparent)" }}>
          <p style={{ fontSize: 11, color: "var(--color-danger)" }}>Sync failed. Check your connection and try again.</p>
        </div>
      )}
    </div>
  );
}
