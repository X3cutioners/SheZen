/**
 * app/(app)/privacy/components/SharingPanel.tsx
 * 
 * Granular, opt-in partner and doctor sharing.
 * Compiles specific encrypted reports with client-side ephemeral keys.
 */
"use client";

import { useState, useEffect } from "react";
import { loadAllRecords } from "@/lib/local-db";
import { generateShareKey, exportShareKey, encryptSharePayload } from "@/lib/crypto/sharing";
import { Heart, Stethoscope, Copy, Check, Trash2, Link as LinkIcon, Shield, Lock, Clock, AlertTriangle, ExternalLink } from "lucide-react";

interface SharedReportMeta {
  id: string;
  share_type: string;
  data_type: string;
  created_at: string;
  expires_at: string;
  has_pin: boolean;
  is_expired: boolean;
}

export function SharingPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [shareType, setShareType] = useState<"partner" | "doctor">("partner");
  const [expiresHours, setExpiresHours] = useState<number>(48);
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeShares, setActiveShares] = useState<SharedReportMeta[]>([]);
  const [refreshingShares, setRefreshingShares] = useState(false);

  useEffect(() => {
    loadActiveShares();
  }, []);

  async function loadActiveShares() {
    setRefreshingShares(true);
    try {
      const res = await fetch("/api/share/list");
      if (res.ok) {
        const data = await res.json();
        setActiveShares(data.reports || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingShares(false);
    }
  }

  async function handleCreateShare() {
    setError("");
    setLoading(true);
    try {
      const cycleEntries = await loadAllRecords<any>("cycle");
      const noteEntries = await loadAllRecords<any>("notes");

      // Compute statistics client-side
      const cycleStarts = cycleEntries.filter((e) => e.data.isPeriodStart).sort((a, b) => a.data.date.localeCompare(b.data.date));
      const cycles: Array<{ startDate: string; length: number; periodLength: number; symptoms: string[] }> = [];

      for (let i = 0; i < cycleStarts.length; i++) {
        const curr = cycleStarts[i];
        const next = cycleStarts[i + 1];
        let length = 0;
        if (next) {
          length = Math.round((new Date(next.data.date).getTime() - new Date(curr.data.date).getTime()) / 86400000);
        }
        
        // Find symptoms logged around this cycle
        const periodEntries = cycleEntries.filter(
          (e) => e.data.date >= curr.data.date && (!next || e.data.date < next.data.date)
        );
        const periodLength = periodEntries.filter((e) => e.data.flow && e.data.flow !== "none").length || 4;
        const symptoms = Array.from(new Set(periodEntries.flatMap((e) => e.data.symptoms || [])));

        cycles.push({
          startDate: curr.data.date,
          length,
          periodLength,
          symptoms,
        });
      }

      const completedCycles = cycles.filter((c) => c.length > 0);
      const avgCycleLength = completedCycles.length > 0
        ? Math.round(completedCycles.reduce((a, b) => a + b.length, 0) / completedCycles.length)
        : 28;
      const avgPeriodLength = cycles.length > 0
        ? Math.round(cycles.reduce((a, b) => a + b.periodLength, 0) / cycles.length)
        : 5;

      const latestCycle = cycleStarts[cycleStarts.length - 1];
      let currentCycleDay = 1;
      let nextPeriodEstimated = "Unknown";
      let currentPhase = "Follicular Phase";
      let phaseDescription = "Energy and mood are naturally rising. A great time for activity and projects.";
      let partnerTip = "Encourage plans, support her focus, and enjoy higher energy days together.";

      if (latestCycle) {
        currentCycleDay = Math.max(1, Math.round((Date.now() - new Date(latestCycle.data.date).getTime()) / 86400000) + 1);
        const nextDate = new Date(latestCycle.data.date);
        nextDate.setDate(nextDate.getDate() + avgCycleLength);
        nextPeriodEstimated = nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        if (currentCycleDay <= avgPeriodLength) {
          currentPhase = "Menstrual Phase";
          phaseDescription = "Body is resting and renewing. Comfort and restorative rest are highest priority.";
          partnerTip = "Offer a heating pad, warm tea, handle extra chores, and give gentle reassurance.";
        } else if (currentCycleDay <= 13) {
          currentPhase = "Follicular Phase";
          phaseDescription = "Estrogen is building. Focus, creativity, and physical energy increase.";
          partnerTip = "Plan dates, brainstorm ideas, and support her productive energy.";
        } else if (currentCycleDay <= 16) {
          currentPhase = "Ovulatory Phase";
          phaseDescription = "Peak energy and communication. Social confidence is highest.";
          partnerTip = "Connect, engage in active outings, and enjoy quality social time together.";
        } else {
          currentPhase = "Luteal Phase";
          phaseDescription = "Progesterone rises. Slower pace, nesting, and potential PMS sensitivity.";
          partnerTip = "Be patient, offer comfort snacks, minimize stressful demands, and listen empathetically.";
        }
      }

      // Symptom summary counts
      const symptomSummary: Record<string, number> = {};
      cycleEntries.forEach((e) => {
        (e.data.symptoms || []).forEach((s: string) => {
          symptomSummary[s] = (symptomSummary[s] || 0) + 1;
        });
      });

      // Assemble payload
      const payload = {
        title: shareType === "partner" ? "Partner Cycle & Wellness View" : "Clinical Cycle & Symptom Summary",
        senderPseudonym: localStorage.getItem("sz_pseudonym") || "SheZen User",
        generatedAt: new Date().toISOString(),
        shareType,
        cycleData: {
          currentCycleDay,
          currentPhase,
          phaseDescription,
          partnerTip,
          avgCycleLength,
          avgPeriodLength,
          nextPeriodEstimated,
          history: cycles.slice(-6).reverse(),
        },
        healthData: {
          symptomSummary,
          recentNotes: noteEntries.slice(0, 6).map((n) => ({
            date: n.date,
            note: n.data.note || "Check-in logged",
            energy: n.data.energy,
            sleep: n.data.sleepHours ? `${n.data.sleepHours} hrs` : undefined,
          })),
        },
      };

      // 1. Generate ephemeral AES-256-GCM key
      const cryptoKey = await generateShareKey();
      const b64Key = await exportShareKey(cryptoKey);

      // 2. Encrypt report bundle
      const { ciphertext, nonce } = await encryptSharePayload(payload, cryptoKey);

      // 3. Upload ciphertext to server (server NEVER gets b64Key)
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_type: shareType,
          data_type: shareType === "partner" ? "cycle" : "clinical",
          ciphertext,
          nonce,
          expires_hours: expiresHours,
          pin: usePin && pin.trim() ? pin.trim() : null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create shared report.");
      }

      const result = await res.json();

      // 4. Construct URL with key in the URL hash fragment (#key=...)
      const fullUrl = `${window.location.origin}/share/${result.id}#key=${encodeURIComponent(b64Key)}`;
      setGeneratedLink(fullUrl);
      loadActiveShares();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate share link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await fetch(`/api/share/${id}`, { method: "DELETE" });
      setActiveShares((prev) => prev.filter((s) => s.id !== id));
      if (generatedLink?.includes(id)) {
        setGeneratedLink(null);
      }
    } catch (e) {
      console.error("Revoke error", e);
    }
  }

  function handleCopy() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="card" style={{ marginBottom: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Heart size={18} color="var(--color-brand)" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Partner & Doctor Sharing
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            Zero-knowledge, revocable sharing with link encryption. Server never sees plaintext.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: "6px 12px" }}
          onClick={() => { setIsOpen(!isOpen); setGeneratedLink(null); }}
        >
          {isOpen ? "Close" : "Share…"}
        </button>
      </div>

      {/* Creator Modal / Drawer */}
      {isOpen && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "0.5px solid var(--color-border)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: 10 }}>
            Select Sharing Mode
          </p>

          {/* Mode Selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => { setShareType("partner"); setGeneratedLink(null); }}
              style={{
                background: shareType === "partner" ? "var(--color-surface-raised)" : "transparent",
                border: shareType === "partner" ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border)",
                borderRadius: 10,
                padding: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Heart size={16} color="var(--color-brand)" />
                <strong style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Partner View</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                Cycle phase, estimates & support suggestions.
              </p>
            </button>

            <button
              onClick={() => { setShareType("doctor"); setGeneratedLink(null); }}
              style={{
                background: shareType === "doctor" ? "var(--color-surface-raised)" : "transparent",
                border: shareType === "doctor" ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border)",
                borderRadius: 10,
                padding: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Stethoscope size={16} color="var(--color-brand)" />
                <strong style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Doctor Summary</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                Cycle stats, symptom counts & printable table.
              </p>
            </button>
          </div>

          {/* Expiration & Security Settings */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                Link Expiration
              </label>
              <select
                className="input"
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
                style={{ width: "100%", fontSize: 12 }}
              >
                <option value={24}>24 Hours</option>
                <option value={48}>48 Hours</option>
                <option value={168}>7 Days</option>
                <option value={720}>30 Days</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                Optional Access PIN
              </label>
              <input
                className="input"
                type="text"
                placeholder="None (open link)"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setUsePin(e.target.value.length > 0);
                }}
                maxLength={6}
                style={{ width: "100%", fontSize: 12 }}
              />
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 10 }}>{error}</p>}

          {/* Action button */}
          {!generatedLink ? (
            <button
              className="btn btn-primary"
              style={{ width: "100%", fontSize: 13 }}
              onClick={handleCreateShare}
              disabled={loading}
            >
              {loading ? "Encrypting & Generating…" : "Generate Zero-Knowledge Link"}
            </button>
          ) : (
            <div style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-brand-light)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Check size={16} color="var(--color-brand)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>Encrypted Link Ready</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 10, lineHeight: 1.4 }}>
                The encryption key is embedded in the link fragment (<code>#key=...</code>). The server cannot read this link.
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: 12, gap: 6 }}
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Link Copied!" : "Copy Share Link"}
                </button>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "8px 12px", textDecoration: "none" }}
                  title="Preview Link"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* Active Shared Links */}
          {activeShares.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: 8 }}>
                Active Shared Links ({activeShares.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activeShares.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "var(--color-surface-raised)",
                      border: "0.5px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", textTransform: "capitalize" }}>
                          {s.share_type} View
                        </span>
                        {s.has_pin && <Lock size={12} color="var(--color-brand)" />}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                        Expires: {new Date(s.expires_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRevoke(s.id)}
                      className="btn btn-danger"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      title="Revoke immediately"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
