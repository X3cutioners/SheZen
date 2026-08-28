"use client";

/**
 * app/setup/page.tsx — Zero-Knowledge Onboarding Flow.
 * Flow: Welcome → Avatar → Name → Passcode → 24-Word Recovery Key → Mandatory 3-Word Verification → Creating
 *
 * All colours via CSS variables. Lucide icons only. No emoji.
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  ChevronLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Download,
  Copy,
  KeyRound,
  ShieldCheck,
  FileText,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { AVATARS } from "@/lib/avatars";
import { generateRecoveryKey, recoveryKeyToPassphrase, deriveRecoveryWrappingKey } from "@/lib/crypto/recovery";

// ─── Word lists for default name generation ───────────────────────────────────

const ADJ = [
  "Quiet","Gentle","Golden","Silver","Wild","Soft","Bright","Tender","Warm",
  "Misty","Rosy","Calm","Serene","Lunar","Velvet","Starry","Dewy","Ivory",
  "Sage","Mossy","Sunny","Amber","Pearl","Coral","Lilac","Crisp","Hazy",
];
const NOUNS = [
  "Bloom","River","Dawn","Moon","Rose","Ember","Mist","Wave","Pine","Grove",
  "Leaf","Shore","Glow","Petal","Willow","Fern","Brook","Tide","Meadow",
  "Spark","Echo","Vale","Garden","Rain","Cloud","Cedar","Path","Song",
];
const randomName = () =>
  `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;

// ─── Step dots ────────────────────────────────────────────────────────────────

type Step = "welcome" | "avatar" | "name" | "passcode" | "recovery_key" | "verify_key" | "creating";
const STEPS: Step[] = ["welcome", "avatar", "name", "passcode", "recovery_key", "verify_key"];

function Dots({ current }: { current: Step }) {
  const i = STEPS.indexOf(current);
  if (i < 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {STEPS.map((_, j) => (
        <div
          key={j}
          style={{
            height: 5,
            borderRadius: 3,
            width: j === i ? 22 : 5,
            background: j <= i ? "var(--color-brand)" : "var(--color-border-strong)",
            transition: "all .3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function Screen({ children, stepKey, dir }: { children: React.ReactNode; stepKey: number; dir: "forward" | "back" }) {
  return (
    <div key={stepKey} className={dir === "forward" ? "step-enter" : "step-enter-back"}
      style={{ minHeight: "100dvh", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

const MIN = 6;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [key, setKey] = useState(0);

  // Identity State
  const [avatar, setAvatar] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [name, setName] = useState(randomName);
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("available");
  const [nameError, setNameError] = useState("");

  // Passcode State
  const [pass, setPass] = useState("");
  const [conf, setConf] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Recovery Key State
  const [recoveryWords, setRecoveryWords] = useState<string[]>([]);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({});
  const [verifyError, setVerifyError] = useState("");

  // Welcome Carousel
  const [welcomeStep, setWelcomeStep] = useState(0);
  const welcomeData = [
    {
      title: "Track your cycle",
      desc: "Log your period, symptoms, and mood. See local-first predictions based on your history."
    },
    {
      title: "Private journal & haven",
      desc: "Record your mood, thoughts, and symptoms in a safe, encrypted space."
    },
    {
      title: "Your data stays yours",
      desc: "Everything you log is locked behind a zero-knowledge vault. No servers, no selling."
    },
    {
      title: "Your private space",
      desc: "Just you and your data. No email or phone number required."
    }
  ];

  // Fetch unique name
  const fetchUniqueName = useCallback(async () => {
    try {
      const res = await fetch("/api/username/generate");
      if (res.ok) {
        const data = await res.json();
        if (data.username) {
          setName(data.username);
          setNameStatus("available");
          setNameError("");
        }
      }
    } catch {
      setName(randomName());
    }
  }, []);

  useEffect(() => {
    fetchUniqueName();
  }, [fetchUniqueName]);

  async function checkNameAvailability(candidate: string) {
    setName(candidate);
    const trimmed = candidate.trim();
    if (trimmed.length < 2) {
      setNameStatus("taken");
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameStatus("checking");
    try {
      const res = await fetch(`/api/username/check?name=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.available) {
        setNameStatus("available");
        setNameError("");
      } else {
        setNameStatus("taken");
        setNameError(data.error || "This name is already taken.");
      }
    } catch {
      setNameStatus("available");
      setNameError("");
    }
  }

  const go = useCallback((next: Step, d: "forward" | "back" = "forward") => {
    setDir(d);
    setStep(next);
    setKey((k) => k + 1);
    setError("");
  }, []);

  function pickAvatar(id: string) {
    setAvatar(id);
    setPopId(id);
    setTimeout(() => setPopId(null), 300);
  }

  // ─── Passcode Handling ──────────────────────────────────────────────────────

  function handlePasscodeNext() {
    if (!confirming) {
      if (pass.length < MIN) {
        setError(`Need at least ${MIN} characters.`);
        return;
      }
      setConfirming(true);
      setError("");
      return;
    }

    if (conf !== pass) {
      setError("Passcodes do not match — please try again.");
      setConf("");
      return;
    }

    // Passcode confirmed! Generate 24-word recovery key
    const words = generateRecoveryKey();
    setRecoveryWords(words);

    // Pick 3 distinct random word indices for verification
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * 24));
    }
    setVerifyIndices(Array.from(indices).sort((a, b) => a - b));
    setVerifyInputs({});
    setVerifyError("");

    go("recovery_key", "forward");
  }

  // ─── Download & Copy Recovery Key ──────────────────────────────────────────

  function handleDownloadRecoveryTxt() {
    if (recoveryWords.length === 0) return;
    const content = [
      "==================================================",
      "             SHEZEN RECOVERY KEY                  ",
      "==================================================",
      "",
      "IMPORTANT & CONFIDENTIAL:",
      "This 24-word recovery key is the ONLY way to restore",
      "your encrypted SheZen vault if you forget your passcode.",
      "Keep this file secure, offline, and private.",
      "",
      "SheZen Name: " + name,
      "Generated:   " + new Date().toLocaleString(),
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

  // ─── Verify Recovery Key & Create Vault ─────────────────────────────────────

  async function handleVerifyAndFinish() {
    setVerifyError("");

    // Check all 3 words
    for (const idx of verifyIndices) {
      const entered = (verifyInputs[idx] || "").trim().toLowerCase();
      const expected = recoveryWords[idx].toLowerCase();
      if (!entered || entered !== expected) {
        setVerifyError(`Word #${idx + 1} is incorrect. Please check your saved recovery key.`);
        return;
      }
    }

    // Verification passed! Create encrypted vault
    go("creating", "forward");

    try {
      const { setupNewVault, setSessionMasterKey, wrapMasterKey } = await import("@/lib/crypto");
      const { saveWrappedKey } = await import("@/lib/local-db");

      // 1. Create master key & passcode-wrapped key
      const { masterKey, wrappedKey } = await setupNewVault(pass);
      await saveWrappedKey(wrappedKey);

      // 2. Derive recovery wrapping key and create recovery wrapping
      const recoveryPhrase = recoveryKeyToPassphrase(recoveryWords);
      const { wrappingKey: recoveryWrappingKey, salt: recoverySalt } = await deriveRecoveryWrappingKey(recoveryPhrase);
      const wrappedByRecovery = await wrapMasterKey(masterKey, recoveryWrappingKey, recoverySalt);

      // 3. Store local profile & recovery key
      localStorage.setItem("sz_avatar", avatar ?? "bloom");
      localStorage.setItem("sz_name", name);
      localStorage.setItem("sz_recovery_words", JSON.stringify(recoveryWords));
      localStorage.setItem("sz_recovery_wrapping", JSON.stringify(wrappedByRecovery));

      // 4. Activate master key in session and open haven!
      setSessionMasterKey(masterKey);
      router.replace("/cycle");
    } catch (e: any) {
      console.error(e);
      setVerifyError("Something went wrong initializing vault. Please try again.");
      go("verify_key", "back");
    }
  }

  const chars = confirming ? conf.length : pass.length;
  const targetLen = confirming ? pass.length : MIN;
  const pct = Math.min(100, (chars / targetLen) * 100);
  const barColor = chars === 0 ? "var(--color-border-strong)" : chars >= MIN ? "var(--color-success)" : "var(--color-warning)";

  // ── WELCOME CAROUSEL ────────────────────────────────────────────────────────
  if (step === "welcome") return (
    <Screen stepKey={key + welcomeStep} dir={dir}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 28px 48px" }}>
        
        <div style={{ marginBottom: "auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <Sparkles size={40} color="var(--color-brand)" />
          </div>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 32, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.15, marginBottom: 14 }}>
            {welcomeData[welcomeStep].title}
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.5, maxWidth: 300 }}>
            {welcomeData[welcomeStep].desc}
          </p>
        </div>

        {/* Carousel Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 40 }}>
          {welcomeData.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === welcomeStep ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === welcomeStep ? "var(--color-brand)" : "var(--color-border-strong)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>

        <div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "15px 24px", fontSize: 15 }}
            onClick={() => {
              if (welcomeStep < welcomeData.length - 1) {
                setDir("forward");
                setWelcomeStep((ws) => ws + 1);
              } else {
                go("avatar", "forward");
              }
            }}
          >
            {welcomeStep < welcomeData.length - 1 ? "Next" : "Get started"}
          </button>
        </div>
      </div>
    </Screen>
  );

  // ── AVATAR ──────────────────────────────────────────────────────────────────
  if (step === "avatar") return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ padding: "48px 24px 40px", maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <Dots current="avatar" />
        <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 26, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
          Choose your avatar
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-muted)", marginBottom: 28 }}>
          Stored locally on your device — change it anytime.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: "auto" }}>
          {AVATARS.map((av) => {
            const sel = avatar === av.id;
            const pop = popId === av.id;
            return (
              <button
                key={av.id}
                onClick={() => pickAvatar(av.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  outline: "none",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: sel ? "2.5px solid var(--color-brand)" : "2px solid transparent",
                    boxShadow: sel ? "0 0 0 4px var(--color-brand-light)" : "none",
                    transform: pop ? "scale(1.15)" : sel ? "scale(1.05)" : "scale(1)",
                    transition: "transform .2s ease, box-shadow .2s ease, border .2s ease",
                  }}
                >
                  {av.svg}
                </div>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: sel ? "var(--color-brand)" : "var(--color-text-muted)", fontWeight: sel ? 600 : 400 }}>
                  {av.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ paddingTop: 24 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px" }}
            onClick={() => go("name", "forward")}
            disabled={!avatar}
          >
            Continue
            <ArrowRight size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
          </button>
        </div>
      </div>
    </Screen>
  );

  // ── NAME ────────────────────────────────────────────────────────────────────
  if (step === "name") return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ padding: "48px 24px 40px", maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <Dots current="name" />
        <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 26, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
          Your SheZen Name
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-muted)", marginBottom: 28 }}>
          Your unique identifier across SheZen, community & backup.
        </p>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => checkNameAvailability(e.target.value)}
            style={{ fontSize: 18, fontWeight: 500, paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={fetchUniqueName}
            title="Generate another name"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-brand)" }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {nameStatus === "checking" && <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Checking availability…</p>}
        {nameStatus === "available" && <p style={{ fontSize: 12, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 4 }}><Check size={14} /> Name is available</p>}
        {nameStatus === "taken" && <p style={{ fontSize: 12, color: "var(--color-danger)" }}>{nameError}</p>}

        <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px" }}
            onClick={() => go("passcode", "forward")}
            disabled={nameStatus !== "available" || !name.trim()}
          >
            Continue
            <ArrowRight size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
          </button>
          <button
            onClick={() => go("avatar", "back")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "10px" }}
          >
            <ChevronLeft size={15} /> Back
          </button>
        </div>
      </div>
    </Screen>
  );

  // ── PASSCODE ────────────────────────────────────────────────────────────────
  if (step === "passcode") return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ padding: "48px 24px 40px", maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <Dots current="passcode" />

        <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
          {confirming ? "Confirm your passcode" : "Create a passcode"}
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-muted)", marginBottom: 28 }}>
          {confirming ? "Enter it once more to confirm." : "Locks your data on this device. Only you can open it."}
        </p>

        <input
          key={confirming ? "c" : "p"}
          className="input"
          type="password"
          placeholder={confirming ? "Re-enter passcode" : "At least 6 characters"}
          value={confirming ? conf : pass}
          onChange={(e) => confirming ? setConf(e.target.value) : setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePasscodeNext()}
          autoFocus
          autoComplete="new-password"
          style={{ fontSize: 17, letterSpacing: ".12em", textAlign: "center", marginBottom: 10 }}
        />

        {!confirming && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-strong)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: barColor, transition: "width .2s ease" }} />
            </div>
            <p style={{ fontSize: 12, textAlign: "center", marginTop: 6, color: chars === 0 ? "var(--color-text-muted)" : chars >= MIN ? "var(--color-success)" : "var(--color-warning)" }}>
              {chars === 0 ? `Minimum ${MIN} characters` : chars >= MIN ? `${chars} characters — looks strong` : `${MIN - chars} more characters needed`}
            </p>
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "var(--color-danger)", textAlign: "center", marginBottom: 8 }}>{error}</p>}

        <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px", opacity: confirming ? (conf.length > 0 ? 1 : 0.45) : (chars >= MIN ? 1 : 0.45) }}
            onClick={handlePasscodeNext}
            disabled={confirming ? conf.length === 0 : chars < MIN}
          >
            Continue to Recovery Key
            <ArrowRight size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
          </button>

          {confirming ? (
            <button onClick={() => { setConfirming(false); setConf(""); setError(""); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "10px" }}>
              <ChevronLeft size={15} /> Back
            </button>
          ) : (
            <button onClick={() => go("name", "back")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "10px" }}>
              <ChevronLeft size={15} /> Back
            </button>
          )}
        </div>
      </div>
    </Screen>
  );

  // ── RECOVERY KEY DISPLAY ────────────────────────────────────────────────────
  if (step === "recovery_key") return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ padding: "36px 24px 32px", maxWidth: 520, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <Dots current="recovery_key" />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyRound size={20} color="var(--color-brand)" />
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Your Recovery Key
            </h2>
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.45 }}>
          Write down or download these 24 words. It is the <strong>ONLY</strong> way to restore your encrypted SheZen data if you ever forget your passcode.
        </p>

        {/* 24 Words Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            padding: 12,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            marginBottom: 14,
          }}
        >
          {recoveryWords.map((word, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                background: "var(--color-surface-raised)",
                borderRadius: 8,
                fontSize: 11.5,
              }}
            >
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", width: 16, textAlign: "right", userSelect: "none" }}>
                {i + 1}.
              </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--color-text-primary)" }}>
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons: Download .txt and Copy */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, padding: "8px 12px", gap: 6 }}
            onClick={handleDownloadRecoveryTxt}
          >
            <Download size={14} /> Download .txt Key
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 12, padding: "8px 12px", gap: 6 }}
            onClick={handleCopyRecoveryWords}
          >
            {copiedRecovery ? <Check size={14} color="var(--color-brand)" /> : <Copy size={14} />}
            {copiedRecovery ? "Copied!" : "Copy Words"}
          </button>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px" }}
            onClick={() => go("verify_key", "forward")}
          >
            I've Saved My Key
            <ArrowRight size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
          </button>
          <button
            onClick={() => go("passcode", "back")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "10px" }}
          >
            <ChevronLeft size={15} /> Back
          </button>
        </div>
      </div>
    </Screen>
  );

  // ── MANDATORY VERIFICATION STEP ─────────────────────────────────────────────
  if (step === "verify_key") return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ padding: "36px 24px 32px", maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <Dots current="verify_key" />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} color="var(--color-brand)" />
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Verify Recovery Key
            </h2>
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
          Enter the 3 words from your recovery phrase to confirm you have safely saved it.
        </p>

        {/* 3 Verification inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {verifyIndices.map((idx) => (
            <div key={idx}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                Word #{idx + 1}
              </label>
              <input
                className="input"
                type="text"
                placeholder={`Enter word #${idx + 1}`}
                value={verifyInputs[idx] || ""}
                onChange={(e) => setVerifyInputs({ ...verifyInputs, [idx]: e.target.value })}
                style={{ width: "100%", fontSize: 14, fontFamily: "monospace" }}
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>
          ))}
        </div>

        {verifyError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(var(--color-danger-rgb, 220 38 38) / 0.08)", borderRadius: 8, border: "1px solid var(--color-danger)", marginBottom: 14 }}>
            <AlertCircle size={16} color="var(--color-danger)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--color-danger)", fontWeight: 500 }}>{verifyError}</span>
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "13px" }}
            onClick={handleVerifyAndFinish}
            disabled={verifyIndices.some((idx) => !(verifyInputs[idx] || "").trim())}
          >
            Verify & Open SheZen
            <ArrowRight size={16} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} />
          </button>
          <button
            onClick={() => go("recovery_key", "back")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "10px" }}
          >
            <ChevronLeft size={15} /> Back to Recovery Words
          </button>
        </div>
      </div>
    </Screen>
  );

  // ── CREATING ─────────────────────────────────────────────────────────────────
  return (
    <Screen stepKey={key} dir={dir}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div className="shimmer" style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", marginBottom: 24, border: "2px solid var(--color-brand-light)" }}>
          {AVATARS.find((a) => a.id === avatar)?.svg ?? AVATARS[0].svg}
        </div>
        <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 8 }}>
          Creating your haven…
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-muted)" }}>
          Encrypting with your passcode and recovery key.
        </p>
      </div>
    </Screen>
  );
}
