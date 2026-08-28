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
  title: "SheZen — Encrypted Women's Health Haven",
  description: "Your private space. Zero trackers. Zero ads. Fully encrypted.",
  applicationName: "SheZen",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SheZen",
    startupImage: [
      {
        url: "/splash/apple-splash-portrait.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#C86D7C",
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-portrait.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
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
