/**
 * app/layout.tsx
 * Root layout for SheZen PWA.
 * Sets up fonts, theme, metadata, and PWA manifest link.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ebGaramond, inter } from "./fonts";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  themeColor: "#FAF2F0",
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
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              let theme = localStorage.getItem('sz_theme');
              if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
              } else {
                document.documentElement.setAttribute('data-theme', 'light');
              }
            } catch (e) {}
          `
        }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
