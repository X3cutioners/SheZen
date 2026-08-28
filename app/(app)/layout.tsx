"use client";

/**
 * app/(app)/layout.tsx
 * Layout for the main app shell — wraps all four module pages.
 * Includes the bottom navigation bar with Lucide icons.
 *
 * Guard: if the vault is locked, redirect to /unlock.
 */

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isUnlocked, lockSession } from "@/lib/crypto";
import {
  CalendarHeart,
  BookHeart,
  Stethoscope,
  Sparkles,
  Fingerprint,
  Users,
  Lock,
  X,
  RefreshCw,
  Check,
} from "lucide-react";
import { HeaderActions } from "@/components/Sidebar";
import { AutoInstallBanner } from "@/components/PWAInstallPrompt";
import { AVATARS } from "@/lib/avatars";
import { generateRandomName } from "@/lib/name-generator";

// Lucide mapping for nav
const NAV_ITEMS = [
  { href: "/cycle", label: "Cycle", Icon: CalendarHeart },
  { href: "/journal", label: "Journal", Icon: BookHeart },
  { href: "/notes", label: "Health", Icon: Stethoscope },
  { href: "/haven", label: "Haven", Icon: Sparkles },
  { href: "/community", label: "Community", Icon: Users },
  { href: "/privacy", label: "Privacy", Icon: Fingerprint },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("SheZen");
  const [userAvatar, setUserAvatar] = useState("bloom");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState("SheZen");
  const [editAvatar, setEditAvatar] = useState("bloom");

  useEffect(() => {
    if (!isUnlocked()) {
      router.replace("/unlock");
    } else {
      // Hydrate the name client-side only to avoid SSR mismatch
      const storedName = localStorage.getItem("sz_name");
      if (storedName) {
        setUserName(storedName);
        setEditName(storedName);
      }
      const storedAvatar = localStorage.getItem("sz_avatar");
      if (storedAvatar) {
        setUserAvatar(storedAvatar);
        setEditAvatar(storedAvatar);
      }
    }
  }, [router]);

  function handleOpenProfile() {
    setEditName(userName);
    setEditAvatar(userAvatar);
    setShowProfileModal(true);
  }

  function handleSaveProfile() {
    const finalName = editName.trim() || "SheZen";
    localStorage.setItem("sz_name", finalName);
    localStorage.setItem("sz_avatar", editAvatar);
    setUserName(finalName);
    setUserAvatar(editAvatar);
    setShowProfileModal(false);
  }

  useEffect(() => {
    // 1. App Switcher / Background Lock (10-second grace period)
    const GRACE_PERIOD_MS = 10000;
    let hiddenAt: number | null = null;
    let lockTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        lockTimer = setTimeout(() => {
          lockSession();
          router.replace("/unlock");
        }, GRACE_PERIOD_MS);
      } else if (document.visibilityState === "visible") {
        if (hiddenAt) {
          const elapsed = Date.now() - hiddenAt;
          if (elapsed >= GRACE_PERIOD_MS) {
            lockSession();
            router.replace("/unlock");
          } else {
            if (lockTimer) {
              clearTimeout(lockTimer);
              lockTimer = null;
            }
          }
          hiddenAt = null;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 2. Shake to Lock
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = 0;
    const SHAKE_THRESHOLD = 15; // acceleration magnitude threshold

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity;
      if (!current || current.x === null || current.y === null || current.z === null) return;

      const currentTime = new Date().getTime();
      if ((currentTime - lastTime) > 100) {
        const diffTime = (currentTime - lastTime);
        const speed = Math.abs(current.x + current.y + current.z - lastX - lastY - lastZ) / diffTime * 10000;

        if (speed > SHAKE_THRESHOLD * 100) {
          // Shake detected!
          lockSession();
          router.replace("/unlock");
        }
        
        lastX = current.x;
        lastY = current.y;
        lastZ = current.z;
        lastTime = currentTime;
      }
    };

    // Note: iOS requires permission for DeviceMotionEvent, but Android works automatically if supported.
    window.addEventListener("devicemotion", handleMotion);

    return () => {
      if (lockTimer) clearTimeout(lockTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [router]);

  const avatarSvg = AVATARS.find(a => a.id === userAvatar)?.svg ?? AVATARS[0].svg;
  const editAvatarSvg = AVATARS.find(a => a.id === editAvatar)?.svg ?? AVATARS[0].svg;

  return (
    <div style={{ background: "var(--color-bg)", paddingBottom: "70px" }}>
      {/* Top header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--color-bg)",
          borderBottom: "0.5px solid var(--color-border)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={handleOpenProfile}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
          title="Click to change avatar & name"
        >
          <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--color-brand)", boxShadow: "0 2px 8px rgba(var(--color-brand-rgb, 168 64 96) / 0.15)", flexShrink: 0 }}>
            {avatarSvg}
          </div>
          <span
            style={{
              fontFamily: "var(--font-voice)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-brand)",
              letterSpacing: "0.02em",
            }}
          >
            {userName}
          </span>
        </button>

        <HeaderActions />
      </header>

      {/* Profile & Avatar Edit Modal */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: "100%",
              borderRadius: 20,
              padding: "24px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              background: "var(--color-surface)",
              maxHeight: "90dvh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-voice)", fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                Customize Profile
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Current Selected Avatar Preview */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid var(--color-brand)",
                  boxShadow: "0 6px 20px rgba(var(--color-brand-rgb, 168 64 96) / 0.25)",
                  marginBottom: 10,
                }}
              >
                {editAvatarSvg}
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                Select an avatar below
              </p>
            </div>

            {/* Avatars Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {AVATARS.map((av) => {
                const isSelected = editAvatar === av.id;
                return (
                  <button
                    key={av.id}
                    onClick={() => setEditAvatar(av.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: isSelected ? "2.5px solid var(--color-brand)" : "2px solid transparent",
                        boxShadow: isSelected ? "0 0 0 3px var(--color-brand-light)" : "none",
                        transform: isSelected ? "scale(1.08)" : "scale(1)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {av.svg}
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 11,
                        color: isSelected ? "var(--color-brand)" : "var(--color-text-muted)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {av.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Name Input */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                SheZen Name
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your anonymous name"
                  style={{ flex: 1, fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setEditName(generateRandomName())}
                  className="btn btn-secondary"
                  style={{ padding: "0 12px", display: "flex", alignItems: "center", gap: 6 }}
                  title="Generate random name"
                >
                  <RefreshCw size={14} />
                  <span style={{ fontSize: 12 }}>Shuffle</span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowProfileModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveProfile}
                style={{ flex: 1 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <main>{children}</main>

      {/* Bottom navigation */}
      {/* Auto Install Banner on Open (until dismissed or installed) */}
      <AutoInstallBanner />

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--color-surface)",
          borderTop: "0.5px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-around",
          padding: "10px 0 max(10px, env(safe-area-inset-bottom))",
          zIndex: 20,
        }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                textDecoration: "none",
                color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                transition: "color 0.2s ease",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 10,
                  fontWeight: active ? 500 : 400,
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
