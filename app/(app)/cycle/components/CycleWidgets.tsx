"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { LoadedEntry } from "../page";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronLeft, ChevronRight, Droplet, Droplets, Heart, Smile, Meh, Frown, Zap, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning, Moon, Sunrise, AlertCircle, AlertTriangle, Activity } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

function parseDate(iso: string) {
  // Parses YYYY-MM-DD avoiding timezone offset issues
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getCycleHistory(entries: LoadedEntry[]) {
  const starts = entries
    .filter((e) => e.data.isPeriodStart)
    .sort((a, b) => a.data.date.localeCompare(b.data.date));

  const cycles = [];
  for (let i = 0; i < starts.length; i++) {
    const current = starts[i];
    const next = starts[i + 1];
    const startDate = parseDate(current.data.date);
    
    let endDate;
    let length = 0;
    if (next) {
      endDate = parseDate(next.data.date);
      length = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
    }

    // Find period end for this cycle
    const endEntry = entries
      .filter((e) => e.data.isPeriodEnd && e.data.date >= current.data.date && (!next || e.data.date < next.data.date))
      .sort((a, b) => a.data.date.localeCompare(b.data.date))[0];
    
    let periodLength = 5; // Default if not logged
    if (endEntry) {
      periodLength = Math.round((parseDate(endEntry.data.date).getTime() - startDate.getTime()) / DAY_MS) + 1;
    } else {
      // Look for the last day with flow
      const flows = entries
        .filter((e) => e.data.flow && e.data.date >= current.data.date && (!next || e.data.date < next.data.date))
        .sort((a, b) => b.data.date.localeCompare(a.data.date)); // descending
      if (flows.length > 0) {
         const lastFlow = parseDate(flows[0].data.date);
         periodLength = Math.max(1, Math.round((lastFlow.getTime() - startDate.getTime()) / DAY_MS) + 1);
      }
    }

    cycles.push({
      startIso: current.data.date,
      startDate,
      length,
      periodLength,
      isCurrent: !next,
    });
  }
  return cycles;
}

// ─── Components ──────────────────────────────────────────────────────────────

export function ProgressRing({ entries }: { entries: LoadedEntry[] }) {
  const cycles = useMemo(() => getCycleHistory(entries), [entries]);
  const current = cycles.find((c) => c.isCurrent);
  
  if (cycles.length < 2 || !current) {
    return (
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 24, textAlign: "center" }}>
        <i className="fi fi-rr-calendar-clock" style={{ fontSize: 48, color: "var(--color-brand)", display: "block", marginBottom: 16 }}></i>
        <p style={{ fontFamily: "var(--font-voice)", fontSize: 18, color: "var(--color-text-primary)", marginBottom: 4 }}>
          Not enough data yet.
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text-secondary)" }}>
          Log at least two periods to unlock cycle predictions and insights.
        </p>
      </div>
    );
  }

  // Calculate average length to predict the current cycle
  const pastCycles = cycles.filter((c) => !c.isCurrent && c.length > 0);
  const avgLength = Math.round(pastCycles.reduce((acc, c) => acc + c.length, 0) / pastCycles.length);
  
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0];
  const dayOfCycle = Math.max(1, Math.round((today.getTime() - current.startDate.getTime()) / DAY_MS) + 1);
  const isPeriod = dayOfCycle <= current.periodLength;
  
  // Ovulation usually around 14 days before next period
  const predictedOvulationDay = Math.max(1, avgLength - 14);
  const isOvulation = Math.abs(dayOfCycle - predictedOvulationDay) <= 2; // roughly 5 day fertile window
  const daysUntilNext = avgLength - dayOfCycle;

  // Ring SVG math
  const radius = 90;
  const stroke = 14;
  const center = radius + stroke;
  const size = center * 2;
  const circ = 2 * Math.PI * radius;

  // Render arc segments
  // 1. Base ring (background)
  // 2. Period arc
  const periodFrac = Math.min(1, current.periodLength / avgLength);
  const periodStrokeDasharray = `${periodFrac * circ} ${circ}`;
  
  // 3. Ovulation arc
  const ovStartFrac = Math.max(0, (predictedOvulationDay - 2) / avgLength);
  const ovLenFrac = 5 / avgLength;
  const ovStrokeDasharray = `${ovLenFrac * circ} ${circ}`;
  const ovOffset = circ - (ovStartFrac * circ);

  // 4. Current day indicator dot
  const currentFrac = Math.min(1, dayOfCycle / avgLength);
  const dotAngle = (currentFrac * 360) - 90; // -90 to start at top
  const dotX = center + radius * Math.cos((dotAngle * Math.PI) / 180);
  const dotY = center + radius * Math.sin((dotAngle * Math.PI) / 180);

  let statusText = "Cycle Day";
  if (isPeriod) statusText = "Period Phase";
  else if (isOvulation) statusText = "Fertile Window";
  else if (daysUntilNext > 0 && daysUntilNext <= 5) statusText = `Period in ${daysUntilNext} Days`;

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size, marginBottom: 24 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Base */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
          {/* Period */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-brand)" strokeWidth={stroke} strokeDasharray={periodStrokeDasharray} strokeLinecap="round" />
          {/* Ovulation */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-warning)" strokeWidth={stroke} strokeDasharray={ovStrokeDasharray} strokeDashoffset={ovOffset} strokeLinecap="round" />
        </svg>
        {/* Indicator Dot */}
        <div style={{
          position: "absolute",
          top: dotY - 10,
          left: dotX - 10,
          width: 20, height: 20,
          background: "var(--color-surface)",
          border: "4px solid var(--color-text-primary)",
          borderRadius: "50%",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }} />
        {/* Center Text */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ fontFamily: "var(--font-voice)", fontSize: 48, fontWeight: 400, color: "var(--color-text-primary)", lineHeight: 1 }}>
            {dayOfCycle}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
            {statusText}
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-brand)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)" }}>Period</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-warning)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)" }}>Ovulation</span>
        </div>
      </div>
    </div>
  );
}

export function CycleCalendarInteractive({
  entries,
  selectedDate,
  onSelectDate,
}: {
  entries: LoadedEntry[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();

  // Map of date string to entry
  const entryMap = useMemo(() => {
    const map = new Map<string, LoadedEntry>();
    entries.forEach((e) => {
      if (e.data?.date) {
        map.set(e.data.date, e);
      }
    });
    return map;
  }, [entries]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today.toISOString().split("T")[0]);
  };

  const todayIso = new Date().toISOString().split("T")[0];

  const grid = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);

  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "16px 14px" }}>
      {/* Month header & navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 19, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={goToToday}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "4px 10px", height: "auto" }}
          >
            Today
          </button>
          <button onClick={prevMonth} className="option-button" style={{ padding: "6px 8px", borderRadius: 8 }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="option-button" style={{ padding: "6px 8px", borderRadius: 8 }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center", marginBottom: 6 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {grid.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} style={{ height: 38 }} />;

          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const entry = entryMap.get(iso);
          const isPeriod = entry?.data.isPeriodStart || entry?.data.flow;
          const hasOtherData = entry && (entry.data.symptoms?.length || entry.data.mood || entry.data.pain || entry.data.note);
          const isSelected = iso === selectedDate;
          const isToday = iso === todayIso;

          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              style={{
                height: 38,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                border: isSelected
                  ? "2px solid var(--color-brand)"
                  : isToday
                  ? "1px solid var(--color-border-strong)"
                  : "1px solid transparent",
                background: isPeriod
                  ? isSelected
                    ? "var(--color-brand)"
                    : "rgba(var(--color-brand-rgb, 168 64 96) / 0.18)"
                  : isSelected
                  ? "var(--color-surface-raised)"
                  : "transparent",
                color: isPeriod && isSelected
                  ? "#fff"
                  : isPeriod
                  ? "var(--color-brand)"
                  : "var(--color-text-primary)",
                cursor: "pointer",
                padding: 0,
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: isSelected || isToday || isPeriod ? 600 : 400, lineHeight: 1 }}>
                {d}
              </span>

              {/* Data indicator dot */}
              <div style={{ display: "flex", gap: 2, height: 4, marginTop: 2 }}>
                {isPeriod && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: isPeriod && isSelected ? "#fff" : "var(--color-brand)",
                    }}
                  />
                )}
                {hasOtherData && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: isSelected ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-brand)" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Period / Flow</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-text-muted)" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Logged details</span>
        </div>
      </div>
    </div>
  );
}

export function DayLogDetail({ entry }: { entry: LoadedEntry }) {
  const d = entry.data;

  const painLabels = ["None", "Mild", "Noticeable", "Moderate", "Strong", "Severe"];
  const moodLabels = ["", "Terrible", "Bad", "Okay", "Good", "Great"];
  const sleepLabels = ["Terrible", "Poor", "Fair", "Good", "Great"];
  const energyLabels = ["Dead", "Low", "Okay", "Good", "High"];

  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 18 }}>
      {/* Period & Flow */}
      {(d.flow || d.isPeriodStart || d.isPeriodEnd) && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>
            Period & Flow
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {d.isPeriodStart && (
              <span className="checkbox-chip checked" style={{ background: "var(--color-brand)", color: "#fff" }}>
                Period Start
              </span>
            )}
            {d.isPeriodEnd && (
              <span className="checkbox-chip checked" style={{ background: "var(--color-brand)", color: "#fff" }}>
                Period End
              </span>
            )}
            {d.flow && (
              <span className="checkbox-chip checked" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Droplet size={14} /> Flow: {d.flow.charAt(0).toUpperCase() + d.flow.slice(1)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Wellbeing Scales */}
      {(d.pain !== undefined || d.mood !== undefined || d.sleep !== undefined || d.energy !== undefined) && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 8 }}>
            Wellbeing & State
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {d.pain !== undefined && (
              <div style={{ background: "var(--color-surface-raised)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} color="var(--color-brand)" />
                <div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Pain / Cramps</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{painLabels[d.pain] || d.pain}</div>
                </div>
              </div>
            )}
            {d.mood !== undefined && (
              <div style={{ background: "var(--color-surface-raised)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Heart size={16} color="var(--color-brand)" />
                <div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Mood</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{moodLabels[d.mood] || d.mood}</div>
                </div>
              </div>
            )}
            {d.sleep !== undefined && (
              <div style={{ background: "var(--color-surface-raised)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Moon size={16} color="var(--color-brand)" />
                <div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Sleep</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{sleepLabels[d.sleep] || d.sleep}</div>
                </div>
              </div>
            )}
            {d.energy !== undefined && (
              <div style={{ background: "var(--color-surface-raised)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} color="var(--color-brand)" />
                <div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Energy</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{energyLabels[d.energy] || d.energy}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Symptoms */}
      {d.symptoms && d.symptoms.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>
            Symptoms
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {d.symptoms.map((s) => (
              <span key={s} className="checkbox-chip" style={{ fontSize: 12, padding: "4px 10px" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Discharge & Sexual Activity & BBT */}
      {(d.discharge || d.sexualActivity || d.bbt !== undefined) && (
        <div style={{ marginBottom: d.note ? 14 : 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>
            Additional Details
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {d.discharge && (
              <span className="checkbox-chip" style={{ fontSize: 12 }}>
                Discharge: {d.discharge}
              </span>
            )}
            {d.sexualActivity && (
              <span className="checkbox-chip" style={{ fontSize: 12 }}>
                Intimacy: {d.sexualActivity.charAt(0).toUpperCase() + d.sexualActivity.slice(1)}
              </span>
            )}
            {d.bbt !== undefined && (
              <span className="checkbox-chip" style={{ fontSize: 12 }}>
                BBT: {d.bbt}°
              </span>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {d.note && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>
            Note
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-surface-raised)", borderRadius: 8, padding: "8px 12px" }}>
            {d.note}
          </p>
        </div>
      )}
    </div>
  );
}

export function PredictionChart({ entries }: { entries: LoadedEntry[] }) {
  const cycles = useMemo(() => getCycleHistory(entries), [entries]);
  const pastCycles = cycles.filter((c) => !c.isCurrent && c.length > 0);
  const [tooltipActive, setTooltipActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTooltipActive(false);
      }
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, []);
  
  if (pastCycles.length < 2) {
    return (
      <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 20, textAlign: "center" }}>
        <i className="fi fi-rr-chart-histogram" style={{ fontSize: 32, color: "var(--color-brand)", display: "block", marginBottom: 10 }}></i>
        <p style={{ fontFamily: "var(--font-voice)", fontSize: 17, color: "var(--color-text-primary)", marginBottom: 4 }}>
          Prediction Models
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", margin: "0 auto", maxWidth: 320 }}>
          Log at least 2 full cycles with period start and end dates to unlock personalized ovulation & period predictions.
        </p>
      </div>
    );
  }

  const avgLength = Math.round(pastCycles.reduce((acc, c) => acc + c.length, 0) / pastCycles.length);
  const current = cycles.find((c) => c.isCurrent);
  
  let nextDateStr = "Unknown";
  let chartData: any[] = [];
  
  if (current) {
    const nextDate = new Date(current.startDate);
    nextDate.setDate(nextDate.getDate() + avgLength);
    nextDateStr = nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    for (let i = -3; i <= 3; i++) {
      const d = new Date(nextDate);
      d.setDate(d.getDate() + i);
      const prob = i === 0 ? 100 : i === -1 || i === 1 ? 75 : i === -2 || i === 2 ? 40 : 15;
      chartData.push({
        name: d.getDate().toString(),
        prob,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 20 }}
      onClick={() => setTooltipActive(true)}
    >
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
        Next Period Prediction
      </p>
      <p style={{ fontFamily: "var(--font-voice)", fontSize: 18, color: "var(--color-text-primary)", marginBottom: 18 }}>
        Most likely to start around <strong>{nextDateStr}</strong>
      </p>
      
      <div style={{ width: "100%", height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
            <Tooltip
              active={tooltipActive}
              cursor={{ fill: "var(--color-bg)" }}
              contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text-primary)", fontSize: 12 }}
            />
            <Bar dataKey="prob" radius={[4, 4, 0, 0]} onClick={() => setTooltipActive(true)}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.prob === 100 ? "var(--color-brand)" : "var(--color-brand-light)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CycleHistoryBars({ entries }: { entries: LoadedEntry[] }) {
  const cycles = useMemo(() => getCycleHistory(entries), [entries]);
  const pastCycles = cycles.filter((c) => !c.isCurrent && c.length > 0).slice(-5).reverse();
  
  if (pastCycles.length === 0) return null;

  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 20 }}>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
        Past Cycle History
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {pastCycles.map((c, i) => {
          const nonPeriod = c.length - c.periodLength;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Started {c.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-primary)", fontWeight: 600 }}>
                  {c.length} Days ({c.periodLength}d period)
                </span>
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--color-surface-raised)" }}>
                <div style={{ width: `${(c.periodLength / c.length) * 100}%`, background: "var(--color-brand)" }} />
                <div style={{ width: `${(nonPeriod / c.length) * 100}%`, background: "var(--color-border-strong)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
