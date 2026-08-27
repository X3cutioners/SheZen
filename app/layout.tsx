/**
 * app/layout.tsx
 * Root layout for SheZen PWA.
 * Sets up fonts, theme, metadata, and PWA manifest link.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ebGaramond, inter } from "./fonts";

export const metadata: Metadata = {
  title: "SheZen",
  description: "Your private space. Zero trackers. Zero ads. Fully encrypted.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SheZen",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF2F0" },
    { media: "(prefers-color-scheme: dark)", color: "#211417" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ebGaramond.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
