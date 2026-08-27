/**
 * app/fonts.ts
 * Font definitions for SheZen.
 * 
 * Two fonts, two jobs (from 05-DESIGN.md):
 *   EB Garamond → --font-voice  → her content (journal bodies, note content, emotional moments)
 *   Inter        → --font-sans  → UI chrome (nav, buttons, labels, settings)
 *
 * Self-loaded via next/font/google so both are bundled for offline PWA use.
 */

import { EB_Garamond, Inter } from "next/font/google";

export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-voice",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});
