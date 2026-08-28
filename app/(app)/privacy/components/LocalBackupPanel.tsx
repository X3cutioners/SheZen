/**
 * app/(app)/privacy/components/LocalBackupPanel.tsx
 * 
 * Local encrypted .shezen file export/import,
 * Biometric Fast Unlock (WebAuthn), and PWA Installation controls.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { exportLocalVaultFile, importLocalVaultFile, type SheZenBackupFile } from "@/lib/local-db";
import { isBiometricsSupported, isBiometricsEnrolled, enrollBiometrics, disableBiometrics } from "@/lib/crypto/biometrics";
import { Download, Upload, Fingerprint, Smartphone, Check, AlertCircle, Loader2, Eye, EyeOff, HardDrive } from "lucide-react";
import { usePWAInstall, IOSInstallModal } from "@/components/PWAInstallPrompt";

export function LocalBackupPanel() {
  // Local File Backup
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPasscode, setImportPasscode] = useState("");
  const [showImportPass, setShowImportPass] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<SheZenBackupFile | null>(null);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Biometrics
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [enrollingBio, setEnrollingBio] = useState(false);
  const [bioPasscode, setBioPasscode] = useState("");
  const [showBioPass, setShowBioPass] = useState(false);
  const [bioError, setBioError] = useState("");
  const [bioLoading, setBioLoading] = useState(false);

  // PWA Install
  const { isStandalone, triggerPrompt, showIOSModal, setShowIOSModal } = usePWAInstall();

  useEffect(() => {
    isBiometricsSupported().then(setBioSupported);
    setBioEnrolled(isBiometricsEnrolled());
  }, []);

  // ─── Local Export ─────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await exportLocalVaultFile();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `shezen-vault-${dateStr}.shezen`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert("Failed to export backup: " + (e.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  }

  // ─── Local Import ─────────────────────────────────────────────────────────

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportSuccess("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.format !== "shezen-encrypted-vault" || !parsed.wrappedKey) {
          setImportError("Invalid .shezen backup file format.");
          return;
        }
        setPendingBackup(parsed);
        setImporting(true);
      } catch {
        setImportError("Could not read backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleConfirmImport() {
    if (!pendingBackup || !importPasscode) return;
    setImportError("");
    try {
      const result = await importLocalVaultFile(pendingBackup, importPasscode);
      setImportSuccess(`Successfully restored vault with ${result.recordCount} records!`);
      setImporting(false);
      setPendingBackup(null);
      setImportPasscode("");
      setTimeout(() => setImportSuccess(""), 4000);
    } catch {
      setImportError("Incorrect passcode for this backup file.");
    }
  }

  // ─── Biometrics ───────────────────────────────────────────────────────────

  async function handleEnrollBiometrics() {
    setBioError("");
    if (!bioPasscode) {
      setBioError("Enter your passcode to authorize biometrics.");
      return;
    }
    setBioLoading(true);
    try {
      await enrollBiometrics(bioPasscode);
      setBioEnrolled(true);
      setEnrollingBio(false);
      setBioPasscode("");
    } catch (e: any) {
      console.error(e);
      setBioError(e.message || "Failed to enroll biometrics.");
    } finally {
      setBioLoading(false);
    }
  }

  function handleDisableBio() {
    disableBiometrics();
    setBioEnrolled(false);
    setEnrollingBio(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ─── Local File Backup (.shezen) ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <HardDrive size={18} color="var(--color-brand)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Offline File Backup (.shezen)
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
              Download or restore a standalone encrypted backup file directly on your device.
            </p>
          </div>
        </div>

        {importSuccess && (
          <div style={{ padding: "10px 12px", background: "var(--color-surface-raised)", border: "1px solid var(--color-brand-light)", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} color="var(--color-brand)" />
            <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>{importSuccess}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, gap: 6 }}
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={14} />
            {exporting ? "Exporting…" : "Export .shezen File"}
          </button>

          <button
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, gap: 6 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            Restore from File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".shezen,.json"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>

        {/* Import Passcode Dialog */}
        {importing && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--color-border)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
              Enter Passcode for Backup File
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 10 }}>
              Enter the passcode that was used when this backup file was created.
            </p>

            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                className="input"
                type={showImportPass ? "text" : "password"}
                placeholder="Backup passcode"
                value={importPasscode}
                onChange={(e) => setImportPasscode(e.target.value)}
                style={{ width: "100%", paddingRight: 40 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowImportPass(!showImportPass)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
              >
                {showImportPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {importError && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{importError}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: 12 }}
                onClick={() => { setImporting(false); setPendingBackup(null); setImportPasscode(""); setImportError(""); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 12 }}
                onClick={handleConfirmImport}
                disabled={!importPasscode}
              >
                Restore Backup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Biometrics / WebAuthn Unlock ─── */}
      {bioSupported && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: bioEnrolled ? "var(--color-brand)" : "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Fingerprint size={20} color={bioEnrolled ? "#fff" : "var(--color-text-secondary)"} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
                Biometric Fast Unlock
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                {bioEnrolled ? "Enabled — unlock with Touch ID, Face ID, or Windows Hello." : "Unlock SheZen instantly using your device biometrics."}
              </p>
            </div>

            {!enrollingBio && (
              bioEnrolled ? (
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={handleDisableBio}
                >
                  Disable
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => setEnrollingBio(true)}
                >
                  Enable
                </button>
              )
            )}
          </div>

          {/* Enrollment Input Drawer */}
          {enrollingBio && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--color-border)" }}>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
                Enter your passcode once to link your device fingerprint / face scan.
              </p>

              <div style={{ position: "relative", marginBottom: 10 }}>
                <input
                  className="input"
                  type={showBioPass ? "text" : "password"}
                  placeholder="Enter passcode"
                  value={bioPasscode}
                  onChange={(e) => setBioPasscode(e.target.value)}
                  style={{ width: "100%", paddingRight: 40 }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowBioPass(!showBioPass)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                >
                  {showBioPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {bioError && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{bioError}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => { setEnrollingBio(false); setBioPasscode(""); setBioError(""); }}
                  disabled={bioLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={handleEnrollBiometrics}
                  disabled={bioLoading || !bioPasscode}
                >
                  {bioLoading ? "Registering…" : "Register Biometrics"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PWA Install Banner ─── */}
      {!isStandalone && (
        <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Smartphone size={18} color="var(--color-brand)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Install SheZen App
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
              Add to your Home Screen for instant offline access and standalone privacy.
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: "8px 14px", whiteSpace: "nowrap" }}
            onClick={triggerPrompt}
          >
            Install App
          </button>
        </div>
      )}

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </div>
  );
}
