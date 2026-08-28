"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Lock } from "lucide-react";
import { lockSession } from "@/lib/crypto";
import { useRouter } from "next/navigation";

export function HeaderActions() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("sz_theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("sz_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLock = () => {
    lockSession();
    router.replace("/unlock");
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={toggleTheme}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          padding: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Toggle Theme"
      >
        {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
      </button>

      <button
        onClick={handleLock}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          padding: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Lock Vault"
      >
        <Lock size={22} />
      </button>
    </div>
  );
}
