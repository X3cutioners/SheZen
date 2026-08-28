/**
 * app/(app)/privacy/page.tsx
 * Data Transparency Dashboard — settings first, privacy info below.
 */

"use client";

import { useState, useEffect } from "react";
import { totalRecordCount, deleteEverything } from "@/lib/local-db";
import { lockSession } from "@/lib/crypto";
import { useRouter } from "next/navigation";
import { CloudBackupPanel } from "./components/CloudBackupPanel";
import { SharingPanel } from "./components/SharingPanel";
import { LocalBackupPanel } from "./components/LocalBackupPanel";

export default function PrivacyPage() {
  const router = useRouter();
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [hasDecoy, setHasDecoy] = useState(false);
  const [settingDecoy, setSettingDecoy] = useState(false);
  const [decoyPass, setDecoyPass] = useState("");
  const [decoyPassConfirm, setDecoyPassConfirm] = useState("");
  const [savingDecoy, setSavingDecoy] = useState(false);
  const [decoyError, setDecoyError] = useState("");

  useEffect(() => {
    totalRecordCount().then(setRecordCount);
    import("@/lib/local-db").then((db) => {
      db.loadDecoyWrappedKey().then((key) => setHasDecoy(!!key));
    });
  }, []);

  async function handleDisableDecoy() {
    try {
      const { deleteDecoyWrappedKey } = await import("@/lib/local-db");
      await deleteDecoyWrappedKey();
      setHasDecoy(false);
      setSettingDecoy(false);
      setDecoyPass("");
      setDecoyPassConfirm("");
      setDecoyError("");
    } catch (err) {
      console.error("Failed to disable decoy mode", err);
    }
  }

  async function handleSetupDecoy() {
    if (decoyPass.length < 4) {
      setDecoyError("Passcode must be at least 4 characters.");
      return;
    }
    if (decoyPass !== decoyPassConfirm) {
      setDecoyError("Passcodes do not match.");
      return;
    }
    setSavingDecoy(true);
    setDecoyError("");
    try {
      const { setupNewVault } = await import("@/lib/crypto");
      const { saveDecoyWrappedKey } = await import("@/lib/local-db");
      const { wrappedKey } = await setupNewVault(decoyPass);
      await saveDecoyWrappedKey(wrappedKey);
      setHasDecoy(true);
      setSettingDecoy(false);
      setDecoyPass("");
      setDecoyPassConfirm("");
    } catch (err) {
      setDecoyError("Failed to save decoy passcode.");
      console.error(err);
    } finally {
      setSavingDecoy(false);
    }
  }

  async function handleDeleteAll() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteEverything();
      lockSession();
      router.replace("/setup");
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="page-container" style={{ paddingBottom: 80 }}>

      {/* ── PAGE TITLE ── */}
      <div style={{ paddingTop: 20, paddingBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 28, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>
          Privacy & Security
        </h1>
        <p className="text-meta">Manage your privacy, security, and data settings.</p>
      </div>

      {/* ── SECTION: SECURITY & DATA SETTINGS ── */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 12 }}>
        Security & Data Settings
      </p>

      {/* Cloud Backup & Sync card */}
      <CloudBackupPanel />

      {/* Partner & Doctor Zero-Knowledge Sharing */}
      <SharingPanel />

      {/* Local Encrypted Backup, Biometrics & PWA Install */}
      <LocalBackupPanel />

      {/* Decoy Mode card */}
      <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", borderBottom: settingDecoy ? "0.5px solid var(--color-border)" : "none" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: hasDecoy ? "var(--color-brand)" : "var(--color-surface-raised)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            transition: "background 0.2s"
          }}>
            <i className="fi fi-rr-user-ninja" style={{ fontSize: 18, color: hasDecoy ? "#fff" : "var(--color-text-secondary)", lineHeight: 1 }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 2 }}>Decoy Mode</p>
            <p className="text-meta" style={{ fontSize: 12 }}>
              {hasDecoy
                ? "Decoy mode is active. Entering the decoy passcode opens an empty SheZen profile."
                : "Enter a secondary passcode to open an empty profile under duress."}
            </p>
          </div>
          {/* Action button */}
          {!settingDecoy && (
            hasDecoy ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}
                  onClick={() => setSettingDecoy(true)}
                >
                  Change PIN
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}
                  onClick={handleDisableDecoy}
                >
                  Disable
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}
                onClick={() => setSettingDecoy(true)}
              >
                Enable
              </button>
            )
          )}
        </div>

        {/* Inline passcode form */}
        {settingDecoy && (
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>
              {hasDecoy ? "Change Decoy Passcode" : "Set a Decoy Passcode"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <input
                type="password"
                placeholder="Decoy passcode"
                className="input"
                value={decoyPass}
                onChange={(e) => { setDecoyPass(e.target.value); setDecoyError(""); }}
                style={{ fontSize: 14 }}
              />
              <input
                type="password"
                placeholder="Confirm passcode"
                className="input"
                value={decoyPassConfirm}
                onChange={(e) => { setDecoyPassConfirm(e.target.value); setDecoyError(""); }}
                style={{ fontSize: 14 }}
              />
            </div>
            {decoyError && (
              <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{decoyError}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setSettingDecoy(false); setDecoyPass(""); setDecoyPassConfirm(""); setDecoyError(""); }}
                disabled={savingDecoy}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSetupDecoy}
                disabled={savingDecoy || decoyPass.length < 4}
              >
                {savingDecoy ? "Saving…" : hasDecoy ? "Update PIN" : "Save & Enable"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION: DANGER ZONE ── */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 12, marginTop: 32 }}>
        Danger Zone
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(var(--color-danger-rgb, 220 38 38) / 0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <i className="fi fi-rr-trash" style={{ fontSize: 18, color: "var(--color-danger)", lineHeight: 1 }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 2 }}>Delete Everything</p>
            <p className="text-meta" style={{ fontSize: 12 }}>
              Permanently wipes all entries, your encryption key, and passcode setup. Cannot be undone.
            </p>
          </div>
        </div>

        {confirming && (
          <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: "rgba(var(--color-danger-rgb, 220 38 38) / 0.08)", borderRadius: 10, border: "1px solid var(--color-danger)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-danger)", marginBottom: 4 }}>This cannot be undone.</p>
            <p className="text-meta" style={{ fontSize: 12 }}>All your journal entries, cycle logs, health notes, haven items, encryption key, and passcode setup will be permanently deleted from this device.</p>
          </div>
        )}

        <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
          {confirming && (
            <button
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          )}
          <button
            className="btn btn-danger"
            onClick={handleDeleteAll}
            disabled={deleting}
            style={{ flex: confirming ? 1 : undefined, width: confirming ? undefined : "100%" }}
          >
            {deleting ? "Deleting…" : confirming ? "Yes, delete everything" : "Delete Everything"}
          </button>
        </div>
      </div>

      {/* ── SECTION: PRIVACY INFO ── */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 12 }}>
        About Your Privacy
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 32 }}>
        <TrustRow icon="fi-rr-ban" label="No trackers or analytics" desc="No third-party SDKs, no ads, no telemetry." />
        <TrustRow icon="fi-rr-cloud-disabled" label="Nothing sent to servers" desc="Everything lives locally, encrypted with your passcode." />
        <TrustRow icon="fi-rr-lock" label="AES-256-GCM encryption" desc="Your key is derived from your passcode and never leaves memory." />
        <TrustRow icon="fi-rr-smartphone" label="Local-first by design" desc="No account needed. Your data belongs only to you." />
        <TrustRow
          icon="fi-rr-database"
          label={recordCount === null ? "Counting records…" : recordCount === 0 ? "No entries yet" : `${recordCount} encrypted record${recordCount === 1 ? "" : "s"} on device`}
          desc="All data is ciphertext — unreadable without your passcode."
        />
      </div>

    </div>
  );
}

function TrustRow({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--color-surface)", borderRadius: 14, border: "0.5px solid var(--color-border)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`fi ${icon}`} style={{ fontSize: 16, color: "var(--color-brand)", lineHeight: 1 }}></i>
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{desc}</p>
      </div>
    </div>
  );
}
