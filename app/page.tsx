/**
 * app/page.tsx
 * Root page — determines where to send the user on first load:
 *   • First run (no key stored) → /setup
 *   • Key exists but locked    → /unlock
 *   • Already unlocked          → /(app)/cycle
 *
 * This runs as a client component so it can read IndexedDB.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isFirstRun } from "@/lib/local-db";
import { isUnlocked } from "@/lib/crypto";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (isUnlocked()) {
        router.replace("/cycle");
        return;
      }
      const firstRun = await isFirstRun();
      if (firstRun) {
        router.replace("/setup");
      } else {
        router.replace("/unlock");
      }
    })();
  }, [router]);

  // Brief loading state — no meaningful content to show here.
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <span className="text-meta">Loading…</span>
    </div>
  );
}
