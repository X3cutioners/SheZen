/**
 * app/(app)/journal/page.tsx
 * Journal — daily entries, mood tracking, gratitude prompts.
 * Phase 1: local-only, fully encrypted.
 *
 * Journal body text rendered in EB Garamond (--font-voice) per design spec.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { saveRecord, loadAllRecords, deleteRecord } from "@/lib/local-db";
import { X } from "lucide-react";
import {
  Frown,
  Meh,
  Smile,
  Heart,
  Sun,
  Star,
  CloudRain
} from "lucide-react";

interface JournalEntry {
  /** Date of the entry (ISO date string) */
  date: string;
  /** Mood: 1–5 */
  mood?: number;
  /** Main journal body — the user's own words */
  body: string;
  /** Optional gratitude note (prompted) */
  gratitude?: string;
}

interface LoadedEntry {
  id: string;
  date: string;
  updatedAt: number;
  data: JournalEntry;
}

// Map 1-5 to a Lucide icon component + color
const MOODS: Record<number, { Icon: React.ElementType; color: string; label: string }> = {
  1: { Icon: CloudRain, color: "var(--color-text-muted)", label: "Struggling" },
  2: { Icon: Frown, color: "var(--color-warning)", label: "Down" },
  3: { Icon: Meh, color: "var(--color-text-secondary)", label: "Okay" },
  4: { Icon: Smile, color: "var(--color-brand-light)", label: "Good" },
  5: { Icon: Sun, color: "var(--color-brand)", label: "Great" },
};

const GRATITUDE_PROMPTS = [
  "What made you smile today?",
  "Something small that went well today…",
  "One thing you're grateful for right now.",
  "A moment of peace today.",
  "Something you're proud of today.",
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function JournalPage() {
  const [entries, setEntries] = useState<LoadedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<JournalEntry>>({
    date: todayISO(),
    body: "",
  });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const gratitudePrompt =
    GRATITUDE_PROMPTS[new Date().getDate() % GRATITUDE_PROMPTS.length];

  const fetchEntries = useCallback(async () => {
    try {
      const data = await loadAllRecords<JournalEntry>("journal");
      setEntries(data);
    } catch (err) {
      console.error("Failed to load journal:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSave() {
    if (!form.body?.trim()) return;
    setSaving(true);
    try {
      await saveRecord<JournalEntry>(
        "journal",
        { date: form.date!, body: form.body!, mood: form.mood, gratitude: form.gratitude },
        form.date!,
        editingId ?? undefined
      );
      setForm({ date: todayISO(), body: "" });
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
    setExpandedId(e.id);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this journal entry?")) return;
    await deleteRecord(id);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
      setForm({ date: todayISO(), body: "" });
    }
    await fetchEntries();
  }

  return (
    <div className="page-container">
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 className="text-screen-title">Journal</h1>
          <p className="text-voice-italic" style={{ marginTop: 4 }}>
            {formatDate(todayISO())}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          style={{ flexShrink: 0 }}
        >
          + Write
        </button>
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--color-bg)", zIndex: 99999, overflowY: "auto", padding: "20px 16px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {editingId ? "Edit Journal Entry" : "New Journal Entry"}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: todayISO(), body: "" }); }} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              <X size={24} />
            </button>
          </div>
          <div className="card stack" style={{ marginBottom: 20 }}>
            <div>
              <label
                className="text-label"
                style={{ display: "block", marginBottom: 4 }}
              >
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
            <label
              style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}
            >
              How are you feeling? <span className="text-meta">(1–5)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const { Icon, color } = MOODS[n];
                const isSelected = form.mood === n;
                return (
                  <button
                    key={n}
                    onClick={() => setForm((f) => ({ ...f, mood: n }))}
                    className={`option-button ${isSelected ? "selected" : ""}`}
                    style={{
                      display: "flex",
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 0",
                    }}
                    title={`Mood ${n}`}
                  >
                    <Icon size={20} color={isSelected ? "var(--color-on-brand)" : color} strokeWidth={isSelected ? 2.5 : 2} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              className="text-label"
              style={{ display: "block", marginBottom: 4 }}
            >
              Your entry
            </label>
            <textarea
              className="input"
              style={{
                fontFamily: "var(--font-voice)",
                fontSize: "var(--text-body-voice)",
                lineHeight: "var(--leading-voice)",
                minHeight: 160,
                resize: "vertical",
              }}
              placeholder="What's on your mind today?"
              value={form.body ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label
              className="text-label"
              style={{ display: "block", marginBottom: 4 }}
            >
              Gratitude{" "}
              <span className="text-meta">(optional)</span>
            </label>
            <textarea
              className="input"
              style={{
                fontFamily: "var(--font-voice)",
                fontSize: "var(--text-body-voice)",
                lineHeight: "var(--leading-voice)",
                minHeight: 60,
                resize: "vertical",
              }}
              placeholder={gratitudePrompt}
              value={form.gratitude ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  gratitude: e.target.value || undefined,
                }))
              }
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.body?.trim()}
          >
            {saving ? "Saving…" : "Save entry"}
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
          <i className="fi fi-rr-book-alt" style={{ fontSize: 64, color: "var(--color-brand)", display: "block", marginBottom: 16 }}></i>
          <p className="text-screen-title" style={{ fontSize: 20, marginBottom: 8 }}>
            Your journal is empty
          </p>
          <p
            className="text-voice-body"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Tap + Write to start your first entry. Everything stays private, on
            your device.
          </p>
        </div>
      ) : (
        <div className="stack">
          {entries.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <div
                key={e.id}
                className="card"
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedId(expanded ? null : e.id)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <p className="text-voice-italic">{formatDate(e.date)}</p>
                    {e.data.mood && (() => {
                      const { Icon, color } = MOODS[e.data.mood!];
                      return (
                        <div style={{ marginTop: 4 }}>
                          <Icon size={18} color={color} strokeWidth={2} />
                        </div>
                      );
                    })()}
                  </div>
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
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleDelete(e.id);
                      }}
                      className="btn"
                      style={{
                        fontSize: 12,
                      }}
                      title="Delete"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <p
                  className="text-voice-body"
                  style={{
                    overflow: expanded ? "visible" : "hidden",
                    display: expanded ? "block" : "-webkit-box",
                    WebkitLineClamp: expanded ? undefined : 3,
                    WebkitBoxOrient: "vertical",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {e.data.body}
                </p>

                {expanded && e.data.gratitude && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "0.5px solid var(--color-border)",
                    }}
                  >
                    <p className="text-label" style={{ marginBottom: 4 }}>
                      Gratitude
                    </p>
                    <p
                      className="text-voice-body"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {e.data.gratitude}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
