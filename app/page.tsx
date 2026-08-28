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
    // Theme setup
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
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "var(--color-text-primary)",
        boxSizing: "border-box",
        padding: "10px 16px 14px",
      }}
    >
      {/* ─── Compact Header ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          padding: "2px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              overflow: "hidden",
              background: "var(--color-brand)",
              boxShadow: "0 2px 6px rgba(var(--color-brand-rgb, 142 46 69) / 0.2)",
              flexShrink: 0,
            }}
          >
            <img src="/icons/icon-192.png" alt="SheZen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span
            style={{
              fontFamily: "var(--font-voice)",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-brand)",
              letterSpacing: "0.02em",
            }}
          >
            SheZen
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isStandalone && (
            <button
              onClick={triggerPrompt}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "var(--color-surface-raised)",
                border: "0.5px solid var(--color-brand)",
                color: "var(--color-brand)",
                borderRadius: 16,
                padding: "3px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Download size={12} />
              <span>Install</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            style={{
              background: "var(--color-surface-raised)",
              border: "0.5px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ─── Hero Body (Centered & Compact) ─── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: 580,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
          gap: 12,
        }}
      >
        {/* App Icon */}
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 10px 24px rgba(var(--color-brand-rgb, 142 46 69) / 0.24)",
            border: "1.5px solid rgba(255, 255, 255, 0.5)",
            flexShrink: 0,
          }}
        >
          <img src="/icons/icon-512.png" alt="SheZen App Icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Title & Tagline */}
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "color-mix(in srgb, var(--color-brand) 10%, transparent)",
              color: "var(--color-brand)",
              padding: "3px 10px",
              borderRadius: 14,
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <ShieldCheck size={12} />
            <span>Zero-Knowledge • Local-First</span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-voice)",
              fontSize: "clamp(24px, 4vw, 30px)",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              lineHeight: 1.15,
              margin: "0 0 4px 0",
            }}
          >
            Your Private Women’s Health Haven
          </h1>

          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.4,
              maxWidth: 440,
              margin: "0 auto",
            }}
          >
            Encrypted cycle tracking, mindful journaling, and peer support.
            Stored solely on your device — zero trackers, zero ads.
          </p>
        </div>

        {/* ─── 3 Compact Feature Cards ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            width: "100%",
            textAlign: "left",
          }}
        >
          {/* Card 1: Cycle Prediction */}
          <div
            className="card"
            style={{
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderRadius: 12,
              border: "0.5px solid var(--color-border)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--color-brand) 14%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <CalendarHeart size={15} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 13.5, fontWeight: 600, margin: "2px 0 0" }}>
              Cycle & Symptoms
            </h3>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.35 }}>
              Period tracking, follicular/luteal phases & symptom logs.
            </p>
          </div>

          {/* Card 2: Haven Journal */}
          <div
            className="card"
            style={{
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderRadius: 12,
              border: "0.5px solid var(--color-border)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--color-brand) 14%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <BookHeart size={15} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 13.5, fontWeight: 600, margin: "2px 0 0" }}>
              Haven Journal
            </h3>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.35 }}>
              Private reflections with instant AES-256 client encryption.
            </p>
          </div>

          {/* Card 3: Zero-Knowledge & Decoy */}
          <div
            className="card"
            style={{
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderRadius: 12,
              border: "0.5px solid var(--color-border)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--color-brand) 14%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <ShieldCheck size={15} />
            </div>
            <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 13.5, fontWeight: 600, margin: "2px 0 0" }}>
              Decoy Duress PIN
            </h3>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.35 }}>
              Secondary passcode opens an empty haven under duress.
            </p>
          </div>
        </div>

        {/* ─── Call To Action (CTA) ─── */}
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <button
            onClick={handlePrimaryCTA}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 4px 12px rgba(var(--color-brand-rgb, 142 46 69) / 0.25)",
              borderRadius: 10,
            }}
          >
            {unlocked ? (
              <>
                <span>Open Your Haven</span>
                <ArrowRight size={15} />
              </>
            ) : hasVault ? (
              <>
                <Lock size={15} />
                <span>Unlock SheZen</span>
                <ArrowRight size={15} />
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Start Using SheZen</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>

          {/* Helper link */}
          <div style={{ fontSize: 12 }}>
            {!unlocked && hasVault && (
              <Link
                href="/setup"
                style={{
                  color: "var(--color-text-muted)",
                  textDecoration: "none",
                }}
              >
                Set up new device / reset
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
      </main>

      {/* ─── Trust Badges Footer ─── */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          fontSize: 11,
          color: "var(--color-text-muted)",
          paddingTop: 8,
          borderTop: "0.5px solid var(--color-border)",
          maxWidth: 580,
          margin: "0 auto",
          width: "100%",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={12} color="var(--color-success)" /> No email required
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={12} color="var(--color-success)" /> 100% Client encrypted
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={12} color="var(--color-success)" /> Zero tracking
        </span>
      </footer>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </div>
  );
}
