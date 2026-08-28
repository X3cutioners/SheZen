"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { saveRecord, loadAllRecords, deleteRecord } from "@/lib/local-db";
import { CalendarHeart, Check, Loader2, Thermometer, Droplets, Droplet, Flame, Zap, Wind, BatteryLow, Activity, Shield, ShieldAlert, ShieldCheck, HelpCircle, CloudRain, Smile, Frown, Angry, Brain, Heart, ChevronLeft, ChevronRight, Sparkles, X, Meh, Battery, BatteryFull, BatteryMedium, BatteryWarning, AlertCircle, AlertTriangle, Moon, Sunrise, Sun, Coffee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ProgressRing, CycleCalendarInteractive, DayLogDetail, PredictionChart, CycleHistoryBars } from "./components/CycleWidgets";

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface CycleDayEntry {
  date: string; // ISO date (YYYY-MM-DD)
  isPeriodStart?: boolean;
  isPeriodEnd?: boolean;
  flow?: "spotting" | "light" | "medium" | "heavy";
  pain?: 0 | 1 | 2 | 3 | 4 | 5;
  mood?: 1 | 2 | 3 | 4 | 5;
  sleep?: 0 | 1 | 2 | 3 | 4;
  energy?: 0 | 1 | 2 | 3 | 4;
  symptoms?: string[];
  sexualActivity?: "none" | "protected" | "unprotected";
  discharge?: string;
  bbt?: number;
  note?: string;
  updatedAt: string;
}

export interface LoadedEntry {
  id: string;
  date: string;
  updatedAt: number;
  data: CycleDayEntry;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMPTOM_GROUPS = [
  {
    label: "Physical",
    tags: ["cramps", "bloating", "headache", "backache", "breast tenderness", "acne", "nausea", "constipation", "diarrhea", "cravings", "hot flashes", "joint pain", "dizziness"],
  },
  {
    label: "Emotional",
    tags: ["mood swings", "anxiety", "irritability", "sadness", "low motivation", "brain fog"],
  },
];

const DISCHARGE_OPTIONS = ["Sticky", "Creamy", "Egg white", "Watery", "Unusual"];

const FLOW_OPTIONS: Array<{ value: NonNullable<CycleDayEntry["flow"]>; label: string; Icon: any }> = [
  { value: "spotting", label: "Spotting", Icon: Droplet },
  { value: "light", label: "Light", Icon: Droplet },
  { value: "medium", label: "Medium", Icon: Droplets },
  { value: "heavy", label: "Heavy", Icon: Droplets }, 
];

const SEXUAL_ACTIVITY_OPTIONS: Array<{ value: NonNullable<CycleDayEntry["sexualActivity"]>; label: string; Icon: any }> = [
  { value: "none", label: "None", Icon: Shield },
  { value: "protected", label: "Protected", Icon: ShieldCheck },
  { value: "unprotected", label: "Unprotected", Icon: ShieldAlert },
];

function getSymptomIcon(tag: string) {
  const map: Record<string, any> = {
    cramps: Zap, bloating: Wind, headache: Activity, backache: Activity, "breast tenderness": Heart, fatigue: BatteryLow, acne: Sparkles, nausea: Frown, cravings: Smile, "hot flashes": Flame, dizziness: CloudRain, "mood swings": Brain, anxiety: Brain, irritability: Angry, sadness: Frown, "low motivation": BatteryLow, "brain fog": Brain, spotting: Droplet,
  };
  return map[tag] || Activity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

function formatDateDisplay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Fallback logic
function predictNextPeriod(entries: LoadedEntry[]) {
  const starts = entries.filter((e) => e.data.isPeriodStart).sort((a, b) => a.date.localeCompare(b.date));
  if (starts.length < 2) return null;
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const diff = (new Date(starts[i].date).getTime() - new Date(starts[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
    lengths.push(diff);
  }
  const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const lastStart = new Date(starts[starts.length - 1].date);
  lastStart.setDate(lastStart.getDate() + avg);
  return lastStart.toISOString().split("T")[0];
}

function IconScaleGroup({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  options: Array<{ num: number, label: string, Icon: any }>;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(({ num, label: optLabel, Icon }) => {
          const isSelected = value === num;
          return (
            <button
              key={num}
              onClick={() => onChange(num)}
              className={`option-button ${isSelected ? "selected" : ""}`}
              style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, flexGrow: 1, justifyContent: "center" }}
            >
              <Icon size={16} />
              <span style={{ fontSize: 13 }}>{optLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CyclePage() {
  const [entries, setEntries] = useState<LoadedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await loadAllRecords<CycleDayEntry>("cycle");
      setEntries(data);
    } catch (err) {
      console.error("Failed to load cycle entries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const currentEntry = useMemo(
    () => entries.find((e) => e.data.date === selectedDate),
    [entries, selectedDate]
  );

  const [form, setForm] = useState<Partial<CycleDayEntry>>({});
  
  useEffect(() => {
    if (currentEntry) {
      setForm(currentEntry.data);
    } else {
      setForm({ date: selectedDate });
    }
  }, [currentEntry, selectedDate]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: CycleDayEntry = {
        ...form,
        date: selectedDate,
        updatedAt: new Date().toISOString(),
      };
      
      await saveRecord<CycleDayEntry>("cycle", payload, selectedDate, currentEntry?.id);
      await fetchEntries();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const periodStatus = form.isPeriodStart ? "start" : form.isPeriodEnd ? "end" : "none";
  const setPeriodStatus = (status: "start" | "end" | "none") => {
    if (status === "start") setForm({ ...form, isPeriodStart: true, isPeriodEnd: false });
    else if (status === "end") setForm({ ...form, isPeriodStart: false, isPeriodEnd: true });
    else setForm({ ...form, isPeriodStart: false, isPeriodEnd: false });
  };

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ paddingTop: 20, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 28, fontWeight: 500, color: "var(--color-text-primary)" }}>
          Cycle
        </h1>
      </div>

      {/* ── Cycle Ring (collapsed if loading) ── */}
      {!loading && (
        <div style={{ marginBottom: 20 }}>
          <ProgressRing entries={entries} />
        </div>
      )}

      {/* ── Interactive Calendar (stays fixed at top while log grows below) ── */}
      <div style={{ marginBottom: 0 }}>
        <CycleCalendarInteractive
          entries={entries}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* ── Selected Day Log ── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Selected Day
            </p>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {formatDateDisplay(selectedDate)}
            </h2>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: "8px 16px", fontSize: 14 }}
          >
            {currentEntry ? "Edit Log" : "+ Log Day"}
          </button>
        </div>

        {currentEntry ? (
          <DayLogDetail entry={currentEntry} />
        ) : (
          <div style={{
            background: "var(--color-surface)",
            border: "0.5px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-card)",
            padding: 24,
            textAlign: "center",
          }}>
            <i className="fi fi-rr-add" style={{ fontSize: 28, color: "var(--color-text-muted)", marginBottom: 8, display: "block" }}></i>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text-muted)" }}>
              Nothing logged for {formatDateDisplay(selectedDate)} yet.
            </p>
          </div>
        )}
      </div>

      {/* ── Insights & History ── */}
      <div style={{ marginTop: 40, paddingTop: 32, borderTop: "0.5px solid var(--color-border)" }}>
        <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 20 }}>
          Insights & History
        </h2>
        {!loading && (
          <div className="stack">
            <PredictionChart entries={entries} />
            <div style={{ marginTop: 16 }}>
              <CycleHistoryBars entries={entries} />
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--color-bg)", zIndex: 99999, overflowY: "auto", padding: "20px 16px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)" }}>
              Daily Log
            </h2>
            <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 6 }}>
              Date
            </label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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

          <div style={{ marginBottom: 32 }}>
            <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}>
              Period Status
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPeriodStatus("none")} className={`option-button ${periodStatus === "none" ? "selected" : ""}`} style={{ flex: 1 }}>None</button>
              <button onClick={() => setPeriodStatus("start")} className={`option-button ${periodStatus === "start" ? "selected" : ""}`} style={{ flex: 1 }}>Start</button>
              <button onClick={() => setPeriodStatus("end")} className={`option-button ${periodStatus === "end" ? "selected" : ""}`} style={{ flex: 1 }}>End</button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}>
              Flow
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FLOW_OPTIONS.map(({ value, label, Icon }) => {
                const active = form.flow === value;
                return (
                  <button
                    key={value}
                    onClick={() => setForm({ ...form, flow: active ? undefined : value })}
                    className={`option-button ${active ? "selected" : ""}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <details style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", marginBottom: 16 }}>
            <summary style={{ padding: 16, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, cursor: "pointer", color: "var(--color-text-primary)" }}>
              Wellbeing & Scales
            </summary>
            <div style={{ padding: "0 16px 16px" }}>
              <IconScaleGroup
                label="Pain / Cramps"
                value={form.pain}
                onChange={(v) => setForm({ ...form, pain: form.pain === v ? undefined : v as any })}
                options={[
                  { num: 0, label: "None", Icon: Smile },
                  { num: 1, label: "Mild", Icon: Meh },
                  { num: 2, label: "Noticeable", Icon: Frown },
                  { num: 3, label: "Moderate", Icon: AlertCircle },
                  { num: 4, label: "Strong", Icon: AlertTriangle },
                  { num: 5, label: "Severe", Icon: Activity },
                ]}
              />
              <IconScaleGroup
                label="Mood"
                value={form.mood}
                onChange={(v) => setForm({ ...form, mood: form.mood === v ? undefined : v as any })}
                options={[
                  { num: 1, label: "Terrible", Icon: CloudRain },
                  { num: 2, label: "Bad", Icon: Frown },
                  { num: 3, label: "Okay", Icon: Meh },
                  { num: 4, label: "Good", Icon: Smile },
                  { num: 5, label: "Great", Icon: Heart },
                ]}
              />
              <IconScaleGroup
                label="Sleep"
                value={form.sleep}
                onChange={(v) => setForm({ ...form, sleep: form.sleep === v ? undefined : v as any })}
                options={[
                  { num: 0, label: "Terrible", Icon: AlertCircle },
                  { num: 1, label: "Poor", Icon: CloudRain },
                  { num: 2, label: "Fair", Icon: Meh },
                  { num: 3, label: "Good", Icon: Sunrise },
                  { num: 4, label: "Great", Icon: Moon },
                ]}
              />
              <IconScaleGroup
                label="Energy"
                value={form.energy}
                onChange={(v) => setForm({ ...form, energy: form.energy === v ? undefined : v as any })}
                options={[
                  { num: 0, label: "Dead", Icon: BatteryLow },
                  { num: 1, label: "Low", Icon: BatteryWarning },
                  { num: 2, label: "Okay", Icon: BatteryMedium },
                  { num: 3, label: "Good", Icon: BatteryFull },
                  { num: 4, label: "High", Icon: Zap },
                ]}
              />
            </div>
          </details>

          <details style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", marginBottom: 16 }}>
            <summary style={{ padding: 16, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, cursor: "pointer", color: "var(--color-text-primary)" }}>
              Symptoms
            </summary>
            <div style={{ padding: "0 16px 16px" }}>
              {SYMPTOM_GROUPS.map((group) => (
                <div key={group.label} style={{ marginBottom: 20 }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    {group.label}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {group.tags.map((tag) => {
                      const active = form.symptoms?.includes(tag);
                      const Icon = getSymptomIcon(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            const arr = form.symptoms || [];
                            const next = active ? arr.filter((t) => t !== tag) : [...arr, tag];
                            setForm({ ...form, symptoms: next });
                          }}
                          className={`option-button ${active ? "selected" : ""}`}
                          style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <Icon size={16} />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", marginBottom: 16 }}>
            <summary style={{ padding: 16, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, cursor: "pointer", color: "var(--color-text-primary)" }}>
              Discharge & More
            </summary>
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}>
                  Discharge Type
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DISCHARGE_OPTIONS.map((val) => {
                    const active = form.discharge === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setForm({ ...form, discharge: active ? undefined : val })}
                        className={`option-button ${active ? "selected" : ""}`}
                        style={{ padding: "8px 14px", fontSize: 13 }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", letterSpacing: "0.02em", display: "block", marginBottom: 8 }}>
                  Sexual Activity
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {SEXUAL_ACTIVITY_OPTIONS.map(({ value, label, Icon }) => {
                    const active = form.sexualActivity === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setForm({ ...form, sexualActivity: active ? undefined : value })}
                        className={`option-button ${active ? "selected" : ""}`}
                        style={{ flex: 1, padding: "10px 8px", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <Icon size={18} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                  <Thermometer size={14} /> BBT (°C/F)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.bbt || ""}
                  onChange={(e) => setForm({ ...form, bbt: e.target.value ? parseFloat(e.target.value) : undefined })}
                  style={{ width: "100%", padding: "10px", border: "0.5px solid var(--color-border-strong)", borderRadius: "var(--radius-btn)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", outline: "none" }}
                  placeholder="e.g. 36.5"
                />
              </div>
            </div>
          </details>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: "100%", padding: "16px", marginTop: 16 }}
          >
            {saving ? "Saving..." : "Save Daily Log"}
          </button>
        </div>
      )}
    </div>
  );
}
