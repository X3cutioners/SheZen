/**
 * app/(app)/haven/page.tsx
 * Encrypted haven — general-purpose private notes for anything sensitive.
 * Phase 1: local-only, fully encrypted.
 *
 * The haven is the most security-sensitive view. Note body uses EB Garamond.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Lock, Search, Trash2, Edit2, X } from "lucide-react";
import { saveRecord, loadAllRecords, deleteRecord } from "@/lib/local-db";

interface HavenNote {
  /** Short title (plaintext in terms of feel, but encrypted in storage) */
  title: string;
  /** Note body — the private content */
  body: string;
  /** Optional category tag — user-defined */
  tag?: string;
}

interface LoadedEntry {
  id: string;
  date: string;
  updatedAt: number;
  data: HavenNote;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HavenPage() {
  const [entries, setEntries] = useState<LoadedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<HavenNote>>({ title: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const data = await loadAllRecords<HavenNote>("vault");
      setEntries(data);
    } catch (err) {
      console.error("Failed to load haven:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSave() {
    if (!form.title?.trim() || !form.body?.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString().split("T")[0];
      await saveRecord<HavenNote>("vault", form as HavenNote, now, editingId ?? undefined);
      setForm({ title: "", body: "" });
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
    if (!window.confirm("Are you sure you want to delete this haven note?")) return;
    await deleteRecord(id);
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
      setForm({ title: "", body: "" });
    }
    await fetchEntries();
  }

  // Client-side search over decrypted titles and tags.
  const filtered = searchQuery
    ? entries.filter(
        (e) =>
          e.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.data.tag?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  return (
    <div className="page-container">
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <h1 className="text-screen-title">Haven</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          style={{ flexShrink: 0 }}
        >
          + Add Note
        </button>
      </div>

      {!showForm && (
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            className="input"
            placeholder="Search haven notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: "8px 12px" }}
          />
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--color-bg)", zIndex: 99999, overflowY: "auto", padding: "20px 16px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {editingId ? "Edit Haven Note" : "New Haven Note"}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ title: "", body: "" }); }} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              <X size={24} />
            </button>
          </div>
          <div className="card stack" style={{ marginBottom: 20 }}>
            <div>
            <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
              Title
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. My deepest secret..."
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="text-label" style={{ display: "block", marginBottom: 4 }}>
              Tag <span className="text-meta">(optional)</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Personal, Work, Health..."
              value={form.tag ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
            />
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
                minHeight: 160,
                resize: "vertical",
              }}
              placeholder="Write anything here. It's fully encrypted."
              value={form.body ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.title?.trim() || !form.body?.trim()}
          >
            {saving ? "Saving…" : "Save to Haven"}
          </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-meta">Loading your haven...</p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            border: "0.5px dashed var(--color-border-strong)",
          }}
        >
          <i className="fi fi-rr-safe-box" style={{ fontSize: 64, color: "var(--color-brand)", display: "block", marginBottom: 16 }}></i>
          <p className="text-meta" style={{ marginBottom: 12 }}>
            {searchQuery
              ? "No notes found matching your search."
              : "Your haven is empty."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <div
                key={e.id}
                className="card"
                onClick={() => setExpandedId(expanded ? null : e.id)}
                style={{ cursor: "pointer", transition: "all 0.2s" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <h3
                      className="text-voice-body"
                      style={{
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {e.data.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p className="text-meta" style={{ color: "var(--color-text-muted)" }}>
                        {formatDate(e.date)}
                      </p>
                      {e.data.tag && (
                        <span
                          style={{
                            fontSize: 11,
                            background: "var(--color-brand-light)",
                            color: "var(--color-text-primary)",
                            padding: "2px 6px",
                            borderRadius: 12,
                          }}
                        >
                          {e.data.tag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleEdit(e as any);
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
                        padding: "4px 8px",
                        color: "var(--color-text-muted)",
                        border: "none",
                        background: "transparent",
                        fontSize: 12,
                      }}
                      title="Delete"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "0.5px solid var(--color-border)",
                    }}
                  >
                    <p
                      className="text-voice-body"
                      style={{
                        color: "var(--color-text-primary)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {e.data.body}
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
