"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarHeart,
  BookHeart,
  ShieldCheck,
  ArrowRight,
  Lock,
  Sparkles,
  Download,
  Sun,
  Moon,
  CheckCircle2,
  Users,
  KeyRound,
  EyeOff
} from "lucide-react";
import { isFirstRun } from "@/lib/local-db";
import { isUnlocked } from "@/lib/crypto";
import { usePWAInstall, IOSInstallModal } from "@/components/PWAInstallPrompt";

export default function WelcomePage() {
  const router = useRouter();
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { isStandalone, triggerPrompt, showIOSModal, setShowIOSModal } = usePWAInstall();

  useEffect(() => {
    // Check theme
    const storedTheme = (localStorage.getItem("sz_theme") as "light" | "dark") || "light";
    setTheme(storedTheme);

    // Check unlock & first-run state
    const unlockedState = isUnlocked();
    setUnlocked(unlockedState);

    isFirstRun().then((first) => {
      setHasVault(!first);
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("sz_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handlePrimaryCTA = () => {
    if (unlocked) {
      router.push("/cycle");
    } else if (hasVault) {
      router.push("/unlock");
    } else {
      router.push("/setup");
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        color: "var(--color-text-primary)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* ─── Top Bar ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          maxWidth: 960,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--color-brand)",
              boxShadow: "0 2px 8px rgba(var(--color-brand-rgb, 142 46 69) / 0.2)",
            }}
          >
            <img src="/icons/icon-192.png" alt="SheZen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span
            style={{
              fontFamily: "var(--font-voice)",
              fontSize: 22,
              fontWeight: 600,
              color: "var(--color-brand)",
              letterSpacing: "0.02em",
            }}
          >
            SheZen
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isStandalone && (
            <button
              onClick={triggerPrompt}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "var(--color-surface-raised)",
                border: "0.5px solid var(--color-brand)",
                color: "var(--color-brand)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Download size={13} />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            style={{
              background: "var(--color-surface-raised)",
              border: "0.5px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              borderRadius: "50%",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px 48px",
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Glowing App Icon */}
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 22,
            overflow: "hidden",
            marginBottom: 20,
            boxShadow: "0 14px 32px rgba(var(--color-brand-rgb, 142 46 69) / 0.28)",
            border: "2px solid rgba(255, 255, 255, 0.4)",
            position: "relative",
          }}
        >
          <img src="/icons/icon-512.png" alt="SheZen App Icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Privacy Shield Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
            color: "var(--color-brand)",
            padding: "5px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          <ShieldCheck size={14} />
          <span>Zero-Knowledge • Local-First • Encrypted</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-voice)",
            fontSize: "clamp(32px, 6vw, 44px)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            lineHeight: 1.15,
            marginBottom: 12,
            letterSpacing: "-0.01em",
          }}
        >
          Your Private Women’s Health Haven
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(14px, 3.5vw, 16px)",
            color: "var(--color-text-secondary)",
            lineHeight: 1.55,
            maxWidth: 520,
            marginBottom: 32,
          }}
        >
          A confidential space for cycle prediction, mindful journaling, and peer support.
          Encrypted directly on your device — no trackers, no surveillance, only for your eyes.
        </p>

        {/* ─── 3 Feature Cards ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            width: "100%",
            marginBottom: 34,
            textAlign: "left",
          }}
        >
          {/* Card 1: Cycle Prediction */}
          <div
            className="card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRadius: 14,
              border: "0.5px solid var(--color-border)",
              transition: "transform 0.2s ease",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 15%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <CalendarHeart size={18} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: 0 }}>
              Cycle & Symptoms
            </h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
              Track periods, follicular & luteal phases, mood, and symptoms with discrete offline intelligence.
            </p>
          </div>

          {/* Card 2: Haven Journal */}
          <div
            className="card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRadius: 14,
              border: "0.5px solid var(--color-border)",
              transition: "transform 0.2s ease",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 15%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <BookHeart size={18} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: 0 }}>
              Haven Journal
            </h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
              Safe sanctuary for daily reflections, notes, and emotional well-being with instant AES-256 encryption.
            </p>
          </div>

          {/* Card 3: Zero-Knowledge & Decoy */}
          <div
            className="card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRadius: 14,
              border: "0.5px solid var(--color-border)",
              transition: "transform 0.2s ease",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 15%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: 0 }}>
              Duress & Decoy Mode
            </h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
              Secondary decoy PIN opens an empty haven under duress. Biometric fast unlock & anonymous peer chat.
            </p>
          </div>
        </div>

        {/* ─── Call To Action (CTA) ─── */}
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={handlePrimaryCTA}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "14px 24px",
              fontSize: 15,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(var(--color-brand-rgb, 142 46 69) / 0.3)",
              borderRadius: 12,
            }}
          >
            {unlocked ? (
              <>
                <span>Open Your Haven</span>
                <ArrowRight size={17} />
              </>
            ) : hasVault ? (
              <>
                <Lock size={16} />
                <span>Unlock SheZen</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Start Using SheZen</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Secondary helper links */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, fontSize: 12.5 }}>
            {!unlocked && hasVault && (
              <Link
                href="/setup"
                style={{
                  color: "var(--color-text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>Set up new device / reset</span>
              </Link>
            )}
            {!unlocked && !hasVault && (
              <Link
                href="/unlock"
                style={{
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Already have a haven? <strong>Unlock here</strong>
              </Link>
            )}
          </div>
        </div>

        {/* ─── Trust Badges ─── */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "0.5px solid var(--color-border)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 18,
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} color="var(--color-success)" /> No email required
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} color="var(--color-success)" /> 100% Client-side encrypted
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} color="var(--color-success)" /> Zero tracking or ads
          </span>
        </div>
      </main>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </div>
  );
}
