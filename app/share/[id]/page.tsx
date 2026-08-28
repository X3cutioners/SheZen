"use client";

import { useEffect, useState, use } from "react";
import { importShareKey, decryptSharePayload } from "@/lib/crypto/sharing";
import { ShieldCheck, Heart, Calendar, Activity, Printer, Lock, AlertCircle, Clock, Droplet, Moon, Sparkles } from "lucide-react";

interface SharedData {
  title?: string;
  senderPseudonym?: string;
  generatedAt: string;
  shareType: "partner" | "doctor";
  cycleData?: {
    currentCycleDay?: number;
    currentPhase?: string;
    phaseDescription?: string;
    partnerTip?: string;
    avgCycleLength?: number;
    avgPeriodLength?: number;
    nextPeriodEstimated?: string;
    fertileWindow?: { start: string; end: string };
    history?: Array<{
      startDate: string;
      length: number;
      periodLength: number;
      symptoms: string[];
    }>;
  };
  healthData?: {
    symptomSummary?: Record<string, number>;
    recentNotes?: Array<{ date: string; note: string; energy?: string; sleep?: string }>;
  };
}

export default function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requiresPin, setRequiresPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState("");
  const [shareKey, setShareKey] = useState<string | null>(null);

  useEffect(() => {
    // Extract key from URL hash (#key=...)
    const hash = window.location.hash;
    const match = hash.match(/key=([^&]+)/);
    if (!match || !match[1]) {
      setError("Decryption key missing from link. Please request the full link with the security key fragment.");
      setLoading(false);
      return;
    }
    const key = decodeURIComponent(match[1]);
    setShareKey(key);
    fetchReport(id, key);
  }, [id]);

  async function fetchReport(reportId: string, rawKey: string, enteredPin?: string) {
    setError("");
    setPinError("");
    try {
      const pinParam = enteredPin ? `?pin=${encodeURIComponent(enteredPin)}` : "";
      const res = await fetch(`/api/share/${reportId}${pinParam}`);

      if (res.status === 401) {
        setRequiresPin(true);
        setLoading(false);
        setPinSubmitting(false);
        return;
      }

      if (res.status === 403) {
        setPinError("Incorrect PIN. Please check with the sender.");
        setPinSubmitting(false);
        return;
      }

      if (res.status === 410) {
        setError("This shared report has expired.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("This shared report does not exist or has been revoked by the owner.");
        setLoading(false);
        return;
      }

      const { ciphertext, nonce } = await res.json();

      // Decrypt client-side using the key from URL hash
      const cryptoKey = await importShareKey(rawKey);
      const decrypted = await decryptSharePayload<SharedData>(ciphertext, nonce, cryptoKey);

      setData(decrypted);
      setRequiresPin(false);
    } catch (err: any) {
      console.error("[Decrypt error]", err);
      setError("Failed to decrypt the report. The link key may be invalid or tampered with.");
    } finally {
      setLoading(false);
      setPinSubmitting(false);
    }
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || !shareKey) return;
    setPinSubmitting(true);
    fetchReport(id, shareKey, pin.trim());
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--color-border)", borderTopColor: "var(--color-brand)", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontFamily: "var(--font-voice)", fontSize: 18, color: "var(--color-text-primary)" }}>
            Decrypting private report…
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            End-to-end decryption happening in your browser
          </p>
        </div>
      </div>
    );
  }

  if (requiresPin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", padding: 20 }}>
        <div className="card" style={{ maxWidth: 400, width: "100%", padding: 28, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Lock size={22} color="var(--color-brand)" />
          </div>
          <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
            PIN Protected Report
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
            The sender set a security PIN for this report. Enter the PIN to view and decrypt.
          </p>

          <form onSubmit={handlePinSubmit}>
            <input
              className="input"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ width: "100%", textAlign: "center", fontSize: 18, letterSpacing: "0.2em", marginBottom: 12 }}
              maxLength={8}
              autoFocus
            />

            {pinError && <p style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 12 }}>{pinError}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", fontSize: 14 }}
              disabled={pinSubmitting || !pin.trim()}
            >
              {pinSubmitting ? "Unlocking…" : "Unlock & Decrypt"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", padding: 20 }}>
        <div className="card" style={{ maxWidth: 440, width: "100%", padding: 28, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertCircle size={24} color="var(--color-danger)" />
          </div>
          <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--color-text-primary)", marginBottom: 8 }}>
            Unable to View Report
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
            {error}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Zero-Knowledge Verification: Reports are strictly protected by client-side cryptography.
          </p>
        </div>
      </div>
    );
  }

  const isPartner = data.shareType === "partner";

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottom: "0.5px solid var(--color-border)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {isPartner ? <Heart size={18} color="var(--color-brand)" /> : <Activity size={18} color="var(--color-brand)" />}
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-brand)" }}>
                {isPartner ? "Partner View" : "Clinical Health Summary"}
              </span>
            </div>
            <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 26, color: "var(--color-text-primary)", margin: 0 }}>
              {data.title || (isPartner ? "Cycle & Wellness Summary" : "Medical Cycle & Symptoms Log")}
            </h1>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              Generated for you by <strong>{data.senderPseudonym || "SheZen User"}</strong> • {new Date(data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "6px 12px", gap: 6 }}
            title="Print or save as PDF"
          >
            <Printer size={14} /> Print
          </button>
        </div>

        {/* ── PARTNER VIEW ── */}
        {isPartner && data.cycleData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Current Phase Highlight */}
            <div className="card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-brand-light)", padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>CURRENT PHASE</span>
                {data.cycleData.currentCycleDay && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", background: "var(--color-surface-raised)", padding: "3px 8px", borderRadius: 6 }}>
                    Day {data.cycleData.currentCycleDay} of Cycle
                  </span>
                )}
              </div>
              <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 28, color: "var(--color-text-primary)", marginBottom: 8 }}>
                {data.cycleData.currentPhase || "Current Cycle"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {data.cycleData.phaseDescription || "Cycle details shared by your partner."}
              </p>

              {data.cycleData.partnerTip && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--color-surface-raised)", borderRadius: 10, border: "0.5px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Sparkles size={14} color="var(--color-brand)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>How to Support</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                    {data.cycleData.partnerTip}
                  </p>
                </div>
              )}
            </div>

            {/* Estimates row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Droplet size={16} color="var(--color-brand)" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>NEXT PERIOD EST.</span>
                </div>
                <p style={{ fontFamily: "var(--font-voice)", fontSize: 18, color: "var(--color-text-primary)", margin: 0 }}>
                  {data.cycleData.nextPeriodEstimated || "Logged in app"}
                </p>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Clock size={16} color="var(--color-brand)" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>AVG CYCLE LENGTH</span>
                </div>
                <p style={{ fontFamily: "var(--font-voice)", fontSize: 18, color: "var(--color-text-primary)", margin: 0 }}>
                  {data.cycleData.avgCycleLength ? `${data.cycleData.avgCycleLength} Days` : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCTOR / CLINICAL SUMMARY VIEW ── */}
        {!isPartner && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Clinical Overview Card */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 14 }}>
                Cycle Statistics & Averages
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--color-surface-raised)", padding: 12, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>Avg Cycle Length</span>
                  <strong style={{ fontSize: 16, color: "var(--color-text-primary)" }}>
                    {data.cycleData?.avgCycleLength ? `${data.cycleData.avgCycleLength} days` : "—"}
                  </strong>
                </div>
                <div style={{ background: "var(--color-surface-raised)", padding: 12, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>Avg Period Duration</span>
                  <strong style={{ fontSize: 16, color: "var(--color-text-primary)" }}>
                    {data.cycleData?.avgPeriodLength ? `${data.cycleData.avgPeriodLength} days` : "—"}
                  </strong>
                </div>
                <div style={{ background: "var(--color-surface-raised)", padding: 12, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>Recorded Cycles</span>
                  <strong style={{ fontSize: 16, color: "var(--color-text-primary)" }}>
                    {data.cycleData?.history?.length ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* Cycle History Table */}
            {data.cycleData?.history && data.cycleData.history.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>
                  Recent Cycle History
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-text-muted)" }}>
                        <th style={{ padding: "8px 6px" }}>Start Date</th>
                        <th style={{ padding: "8px 6px" }}>Cycle Length</th>
                        <th style={{ padding: "8px 6px" }}>Period Duration</th>
                        <th style={{ padding: "8px 6px" }}>Reported Symptoms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cycleData.history.map((h, i) => (
                        <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border)" }}>
                          <td style={{ padding: "10px 6px", fontWeight: 500, color: "var(--color-text-primary)" }}>{h.startDate}</td>
                          <td style={{ padding: "10px 6px", color: "var(--color-text-secondary)" }}>{h.length > 0 ? `${h.length} days` : "Current"}</td>
                          <td style={{ padding: "10px 6px", color: "var(--color-text-secondary)" }}>{h.periodLength} days</td>
                          <td style={{ padding: "10px 6px", color: "var(--color-text-secondary)" }}>
                            {h.symptoms.length > 0 ? h.symptoms.join(", ") : "None reported"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Symptom Frequency */}
            {data.healthData?.symptomSummary && Object.keys(data.healthData.symptomSummary).length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>
                  Symptom Frequency Breakdown
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(data.healthData.symptomSummary).map(([symptom, count]) => (
                    <div
                      key={symptom}
                      style={{
                        background: "var(--color-surface-raised)",
                        border: "0.5px solid var(--color-border)",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <span>{symptom}:</span> <strong>{count}x</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Notes & Health Logs */}
            {data.healthData?.recentNotes && data.healthData.recentNotes.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12 }}>
                  Clinical Health Notes & Observations
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.healthData.recentNotes.map((n, idx) => (
                    <div key={idx} style={{ background: "var(--color-surface-raised)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--color-text-muted)" }}>
                        <span>{n.date}</span>
                        {n.sleep && <span>Sleep: {n.sleep}</span>}
                      </div>
                      <p style={{ fontFamily: "var(--font-voice)", fontSize: 14, color: "var(--color-text-primary)", margin: 0 }}>
                        {n.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECURITY BADGE ── */}
        <div style={{ marginTop: 32, padding: "14px 18px", borderRadius: 12, background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", display: "flex", alignItems: "center", gap: 12 }}>
          <ShieldCheck size={20} color="var(--color-brand)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.4 }}>
            <strong>Zero-Knowledge Encryption Verified:</strong> This report was decrypted strictly inside your browser using the secret key in the link URL hash fragment. The server cannot view or store this health report.
          </p>
        </div>

      </div>
    </div>
  );
}
