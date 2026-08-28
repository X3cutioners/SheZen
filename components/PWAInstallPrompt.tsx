"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, X, Smartphone, Share2, PlusSquare, CheckCircle2, ArrowUpRight } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Hook to manage PWA install prompt state and actions
 */
export function usePWAInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running in standalone PWA mode
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(standaloneCheck);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    if (standaloneCheck) return;

    // If deferredPrompt was already captured globally
    if (globalDeferredPrompt) {
      setIsInstallable(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      globalDeferredPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerPrompt = useCallback(async () => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const choice = await globalDeferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
          setIsInstallable(false);
        }
        globalDeferredPrompt = null;
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers that support install via browser UI
      alert("To install SheZen on this browser, tap your browser's menu (⋮ or ⋯) and select 'Install SheZen' or 'Add to Home Screen'.");
    }
  }, [isIOS]);

  return {
    isStandalone,
    isInstallable,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    triggerPrompt,
  };
}

/**
 * Top Navigation Install Button — Visible only when NOT in standalone mode
 */
export function TopNavInstallButton() {
  const { isStandalone, triggerPrompt, showIOSModal, setShowIOSModal } = usePWAInstall();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || isStandalone) return null;

  return (
    <>
      <button
        onClick={triggerPrompt}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--color-surface-raised)",
          border: "0.5px solid var(--color-brand)",
          color: "var(--color-brand)",
          borderRadius: 20,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: "0 2px 6px rgba(var(--color-brand-rgb, 168 64 96) / 0.12)",
        }}
        title="Install SheZen App for offline privacy & fast access"
      >
        <Download size={13} strokeWidth={2.5} />
        <span>Install App</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
}

/**
 * Auto-Prompt Banner — appears right on opening until dismissed or installed
 */
export function AutoInstallBanner() {
  const { isStandalone, triggerPrompt, showIOSModal, setShowIOSModal } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("sz_pwa_dismissed") === "true";
      setDismissed(isDismissed);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("sz_pwa_dismissed", "true");
    }
  }

  if (!mounted || isStandalone || dismissed) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 76,
          left: 16,
          right: 16,
          maxWidth: 480,
          margin: "0 auto",
          zIndex: 9990,
          background: "var(--color-surface)",
          border: "1.5px solid var(--color-brand)",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* App Icon thumbnail */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--color-brand-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(var(--color-brand-rgb, 168 64 96) / 0.2)",
          }}
        >
          <img src="/icons/icon-192.png" alt="SheZen App Icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-voice)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.2 }}>
            Install SheZen App
          </p>
          <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "2px 0 0", lineHeight: 1.3 }}>
            Offline access, instant biometrics & zero-knowledge security.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={triggerPrompt}
            className="btn btn-primary"
            style={{ fontSize: 12, padding: "8px 14px", fontWeight: 600, gap: 5, borderRadius: 10 }}
          >
            <Download size={13} strokeWidth={2.5} /> Install
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
}

/**
 * Clean iOS Safari Install Guide Modal
 */
export function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 380,
          width: "100%",
          borderRadius: 20,
          padding: 22,
          background: "var(--color-surface)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Smartphone size={20} color="var(--color-brand)" />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                Install on iPhone / iPad
              </h3>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                Add SheZen to your Home Screen
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface-raised)", padding: "10px 12px", borderRadius: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand)", fontWeight: 700, fontSize: 13 }}>
              1
            </div>
            <p style={{ fontSize: 12.5, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.4 }}>
              Tap the <strong>Share</strong> button <Share2 size={13} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> in Safari's bottom toolbar.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface-raised)", padding: "10px 12px", borderRadius: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand)", fontWeight: 700, fontSize: 13 }}>
              2
            </div>
            <p style={{ fontSize: 12.5, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.4 }}>
              Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={13} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} />.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface-raised)", padding: "10px 12px", borderRadius: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand)", fontWeight: 700, fontSize: 13 }}>
              3
            </div>
            <p style={{ fontSize: 12.5, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.4 }}>
              Tap <strong>Add</strong> in the top right corner. SheZen will launch as a standalone app!
            </p>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", fontSize: 13, padding: "10px" }} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
