/**
 * app/(app)/notes/page.tsx
 * Health notes — sleep, symptoms, medications/supplements, general private log.
 * Phase 1: local-only, fully encrypted.
 *
 * Data-minimized inputs: ranges not exact values, nicknames not drug names.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { saveRecord, loadAllRecords, deleteRecord } from "@/lib/local-db";

interface HealthNote {
  date: string;
  /** Sleep: range in hours (e.g. "6–7") not exact */
  sleepRange?: string;
  /** Energy level 1–5 */
  energy?: number;
  /** Symptoms as free-text nicknames */
  symptoms?: string;
  /** Medications/supplements as a comma-separated list of user-chosen nicknames */
  medications?: string;
  /** General private note */
  note?: string;
}

interface LoadedEntry {
  id: string;
  date: string;
  updatedAt: number;
  data: HealthNote;
}

const SLEEP_RANGES = ["< 5h", "5–6h", "6–7h", "7–8h", "8–9h", "> 9h"];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

import { X } from "lucide-react";

export default function NotesPage() {
  const [entries, setEntries] = useState<LoadedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<HealthNote>>({ date: todayISO() });
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await loadAllRecords<HealthNote>("notes");
      setEntries(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSave() {
    const hasContent =
      form.sleepRange || form.energy || form.symptoms || form.medications || form.note;
    if (!hasContent) return;
    setSaving(true);
    try {
      await saveRecord<HealthNote>("notes", form as HealthNote, form.date!, editingId ?? undefined);
      setForm({ date: todayISO() });
      setEditingId(null);
      setShowForm(false);
      await fetchEntries();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(e: LoadedEntry) {
    setForm(e.data);
    setEditingId(e.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this health note?")) return;
    await deleteRecord(id);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
      setForm({ date: todayISO() });
    }
    await fetchEntries();
  }

  return (
    <div className="page-container">
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <h1 className="text-screen-title">Health Notes</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          style={{ flexShrink: 0 }}
        >
          + Add
        </button>
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--color-bg)", zIndex: 99999, overflowY: "auto", padding: "20px 16px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {editingId ? "Edit Health Note" : "New Health Note"}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: todayISO() }); }} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              <X size={24} />
            </button>
          </div>
          <div className="card stack" style={{ marginBottom: 20 }}>
            <div>
              <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
                Date
              </label>
            <input
              type="date"
              className="input"
              value={form.date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onFocus={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
            />
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 6 }}>
              Sleep
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SLEEP_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      sleepRange: f.sleepRange === r ? undefined : r,
                    }))
                  }
                  className={`option-button ${form.sleepRange === r ? "selected" : ""}`}
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 6 }}>
              Energy <span className="text-meta">(1 = exhausted, 5 = great)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setForm((f) => ({ ...f, energy: n }))}
                  className={`option-button ${form.energy === n ? "selected" : ""}`}
                  style={{ flex: 1, padding: "8px 0", textAlign: "center" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
              Symptoms <span className="text-meta">(use your own terms)</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="e.g. back tension, foggy head"
              value={form.symptoms ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, symptoms: e.target.value || undefined }))
              }
            />
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
              Medications / supplements{" "}
              <span className="text-meta">(use nicknames)</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="e.g. iron tab, magnesium"
              value={form.medications ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, medications: e.target.value || undefined }))
              }
            />
            <p className="text-meta" style={{ marginTop: 4 }}>
              Use your own nicknames — no clinical identifiers needed.
            </p>
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
              Note
            </label>
            <textarea
              className="input"
              style={{
                fontFamily: "var(--font-voice)",
                fontSize: "var(--text-body-voice)",
                lineHeight: "var(--leading-voice)",
                minHeight: 80,
                resize: "vertical",
              }}
              placeholder="Anything else worth noting…"
              value={form.note ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, note: e.target.value || undefined }))
              }
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={
              saving ||
              !(form.sleepRange || form.energy || form.symptoms || form.medications || form.note)
            }
          >
            {saving ? "Saving…" : "Save note"}
          </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-meta" style={{ textAlign: "center", paddingTop: 40 }}>
          Loading…
        </p>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <i className="fi fi-rr-stethoscope" style={{ fontSize: 64, color: "var(--color-brand)", display: "block", marginBottom: 16 }}></i>
          <p className="text-screen-title" style={{ fontSize: 20, marginBottom: 8 }}>
            No health notes yet
          </p>
          <p className="text-voice-body" style={{ color: "var(--color-text-secondary)" }}>
            Track sleep, energy, symptoms, and supplements — privately.
          </p>
        </div>
      ) : (
        <div className="stack">
          {entries.map((e) => (
            <div key={e.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <p className="text-voice-italic">{formatDate(e.date)}</p>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleEdit(e);
                    }}
                    className="btn"
                    style={{
                      padding: "4px 8px",
                      color: "var(--color-brand)",
                      border: "none",
                      background: "transparent",
                      fontSize: 12,
                    }}
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="btn"
                    style={{
                      padding: "4px 8px",
                      color: "var(--color-text-muted)",
                      border: "none",
                      background: "transparent",
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="stack" style={{ gap: 6 }}>
                {e.data.sleepRange && (
                  <p className="text-meta">
                    Sleep: <span style={{ color: "var(--color-text-primary)" }}>{e.data.sleepRange}</span>
                  </p>
                )}
                {e.data.energy && (
                  <p className="text-meta">
                    Energy:{" "}
                    <span style={{ color: "var(--color-text-primary)" }}>
                      {e.data.energy}/5
                    </span>
                  </p>
                )}
                {e.data.symptoms && (
                  <p className="text-meta">
                    Symptoms:{" "}
                    <span style={{ color: "var(--color-text-primary)" }}>
                      {e.data.symptoms}
                    </span>
                  </p>
                )}
                {e.data.medications && (
                  <p className="text-meta">
                    Supplements:{" "}
                    <span style={{ color: "var(--color-text-primary)" }}>
                      {e.data.medications}
                    </span>
                  </p>
                )}
                {e.data.note && (
                  <p className="text-voice-body" style={{ marginTop: 4 }}>
                    {e.data.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
