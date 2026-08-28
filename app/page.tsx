"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarHeart,
  BookHeart,
  ShieldCheck,
  Users,
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
        minHeight: "100dvh",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "var(--color-text-primary)",
        boxSizing: "border-box",
        padding: "16px 20px 24px",
      }}
    >
      {/* ─── Top Bar ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
          padding: "4px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              overflow: "hidden",
              background: "var(--color-brand)",
              boxShadow: "0 2px 8px rgba(var(--color-brand-rgb, 142 46 69) / 0.18)",
              flexShrink: 0,
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
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Download size={13} />
              <span>Install App</span>
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
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ─── Hero Body (2x2 Card Grid) ─── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
          padding: "16px 0",
        }}
      >
        {/* Glowing App Icon */}
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 10px 24px rgba(var(--color-brand-rgb, 142 46 69) / 0.22)",
            border: "2px solid rgba(255, 255, 255, 0.6)",
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <img src="/icons/icon-512.png" alt="SheZen App Icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Security Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "color-mix(in srgb, var(--color-brand) 10%, transparent)",
            color: "var(--color-brand)",
            padding: "4px 12px",
            borderRadius: 16,
            fontSize: 11.5,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          <ShieldCheck size={13} />
          <span>Zero-Knowledge • Local-First Sanctuary</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-voice)",
            fontSize: "clamp(26px, 4.5vw, 34px)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            lineHeight: 1.2,
            margin: "0 0 6px 0",
            letterSpacing: "-0.01em",
          }}
        >
          Your Private Women’s Health Haven
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(13px, 3vw, 14.5px)",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
            maxWidth: 480,
            margin: "0 auto 20px",
          }}
        >
          Confidential cycle prediction, mindful journaling, and peer support.
          Encrypted client-side on your device — zero trackers, zero ads.
        </p>

        {/* ─── 2x2 Feature Card Grid ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            width: "100%",
            textAlign: "left",
            marginBottom: 22,
          }}
        >
          {/* Card 1: Cycle & Fertility */}
          <div
            className="card"
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 16,
              border: "0.5px solid var(--color-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <CalendarHeart size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: "0 0 3px", color: "var(--color-text-primary)" }}>
                Cycle & Fertility
              </h3>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
                Period tracking, phase prediction & discrete symptom trends.
              </p>
            </div>
          </div>

          {/* Card 2: Haven Journal */}
          <div
            className="card"
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 16,
              border: "0.5px solid var(--color-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <BookHeart size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: "0 0 3px", color: "var(--color-text-primary)" }}>
                Haven Journal
              </h3>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
                Encrypted daily reflections & sensitive health notes with AES-256.
              </p>
            </div>
          </div>

          {/* Card 3: Anonymous Peer Community */}
          <div
            className="card"
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 16,
              border: "0.5px solid var(--color-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: "0 0 3px", color: "var(--color-text-primary)" }}>
                E2E Peer Chat
              </h3>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
                Anonymous avatar identity & Signal-style direct encrypted chat.
              </p>
            </div>
          </div>

          {/* Card 4: Zero-Knowledge & Decoy */}
          <div
            className="card"
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 16,
              border: "0.5px solid var(--color-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-brand)",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 16, fontWeight: 600, margin: "0 0 3px", color: "var(--color-text-primary)" }}>
                Decoy Duress PIN
              </h3>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.45 }}>
                Secondary PIN opens an empty dummy haven under coercion.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Call To Action (CTA) ─── */}
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handlePrimaryCTA}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "13px 24px",
              fontSize: 15,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(var(--color-brand-rgb, 142 46 69) / 0.28)",
              borderRadius: 12,
            }}
          >
            {unlocked ? (
              <>
                <span>Open Your Haven</span>
                <ArrowRight size={16} />
              </>
            ) : hasVault ? (
              <>
                <Lock size={15} />
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

          {/* Helper link */}
          <div style={{ fontSize: 12.5 }}>
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
          gap: 18,
          fontSize: 11.5,
          color: "var(--color-text-muted)",
          paddingTop: 12,
          borderTop: "0.5px solid var(--color-border)",
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={13} color="var(--color-success)" /> No email required
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={13} color="var(--color-success)" /> 100% Client encrypted
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={13} color="var(--color-success)" /> Zero tracking or ads
        </span>
      </footer>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </div>
  );
}
