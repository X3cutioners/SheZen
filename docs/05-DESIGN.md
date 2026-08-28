# Design System — "Blush & Berry"

Muted, dusty tones — not bright pastel, not clinical. The goal: reads clearly feminine, private, and grown-up. Avoid anything that looks like a teen diary app or a bubblegum period tracker — the berry stays deep and rich, the background stays a quiet neutral, not painted pink.

## 1. Color palette

### Light mode (default)

| Token | Hex | Usage |
|---|---|---|
| `--color-brand` | `#8E2E45` | Primary accent — buttons, active states, links, key icons |
| `--color-brand-hover` | `#7A2839` | Hover/pressed state for brand-colored controls |
| `--color-brand-light` | `#E2A6A0` | Secondary accent — badges, highlights, chart accents, selected states (subtle) |
| `--color-bg` | `#FAF2F0` | App background (blush-tinted cream, not pink) |
| `--color-surface` | `#FFFFFF` | Cards, sheets, modals — sits above `--color-bg` |
| `--color-border` | `#F2DDD8` | Default hairline border on cards/inputs |
| `--color-border-strong` | `#E9D3CE` | Emphasized border (focus-adjacent, dividers) |
| `--color-text-primary` | `#3A1A1F` | Body text, headings — near-black with a warm undertone, not pure black |
| `--color-text-secondary` | `#6B4A4E` | Supporting text, labels |
| `--color-text-muted` | `#B5847E` | Timestamps, placeholders, hints |
| `--color-on-brand` | `#FAF2F0` | Text/icons placed on `--color-brand` fills |

### Semantic states (kept separate from brand — don't reuse berry for these)

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#3F7D5A` | Confirmations (muted green, not bright) |
| `--color-warning` | `#B08A3E` | Non-urgent warnings (muted amber/gold — fits the palette better than a stock yellow) |
| `--color-danger` | `#B0413F` | Destructive actions, errors (distinct from brand berry — more orange-red, less plum, so "delete" never gets confused with a normal brand button) |

### Dark mode

Don't just invert — keep the same warm undertone so it still reads as the same product at night, not a generic dark theme.

| Token | Hex | Usage |
|---|---|---|
| `--color-brand` (dark) | `#D98A96` | Lighter/desaturated berry so it has contrast against a dark background |
| `--color-brand-hover` (dark) | `#E2A6A0` | |
| `--color-bg` (dark) | `#211417` | Near-black with a warm plum undertone, not pure black |
| `--color-surface` (dark) | `#2E1B20` | Cards — one step lighter than background |
| `--color-border` (dark) | `#4A2E33` | |
| `--color-text-primary` (dark) | `#F5E6E3` | |
| `--color-text-secondary` (dark) | `#C79E9A` | |
| `--color-text-muted` (dark) | `#8C6A66` | |

Implement as CSS custom properties toggled by `[data-theme="dark"]` (or `prefers-color-scheme`), not as a separate Tailwind config — keeps light/dark in sync from one source of truth.

```css
:root {
  --color-brand: #8E2E45;
  --color-brand-hover: #7A2839;
  --color-brand-light: #E2A6A0;
  --color-bg: #FAF2F0;
  --color-surface: #FFFFFF;
  --color-border: #F2DDD8;
  --color-border-strong: #E9D3CE;
  --color-text-primary: #3A1A1F;
  --color-text-secondary: #6B4A4E;
  --color-text-muted: #B5847E;
  --color-on-brand: #FAF2F0;
  --color-success: #3F7D5A;
  --color-warning: #B08A3E;
  --color-danger: #B0413F;
}

[data-theme="dark"] {
  --color-brand: #D98A96;
  --color-brand-hover: #E2A6A0;
  --color-bg: #211417;
  --color-surface: #2E1B20;
  --color-border: #4A2E33;
  --color-text-primary: #F5E6E3;
  --color-text-secondary: #C79E9A;
  --color-text-muted: #8C6A66;
}
```

## 2. Typography

**Two fonts, two jobs. Don't mix them within the same element.**

| Font | Role | Where it's used |
|---|---|---|
| **EB Garamond** | `--font-voice` — her content, the emotional register | Journal entries, note bodies, cycle-day reflections, key marketing/onboarding headlines, the app's own "voice" moments (empty states, the transparency dashboard headline) |
| **Inter** | `--font-sans` — the interface, the UI chrome | Navigation, buttons, form labels, inputs, settings, dates/timestamps in list views, all system-generated copy |

**Rule of thumb:** if it's something *she* wrote or a screen designed to feel personal → serif. If it's the app talking to her functionally (a button, a label, a settings toggle) → sans.

### Loading fonts (do this, not a live Google Fonts CDN call)

Load both fonts via `next/font/google` (or self-host the `.woff2` files) so they're bundled into the build and get cached by the service worker for offline use — a PWA that needs a live network call to render its own headings breaks the offline promise on first load.

```ts
// app/fonts.ts
import { EB_Garamond, Inter } from "next/font/google";

export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-voice",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
});
```

### Type scale

| Use | Font | Size | Weight |
|---|---|---|---|
| Screen title / large heading | EB Garamond | 24px | 500 |
| Section heading | Inter | 16px | 500 |
| Journal/note body text | EB Garamond | 17px, line-height 1.6 | 400 |
| UI body text | Inter | 15px | 400 |
| Labels, buttons | Inter | 14px | 500 |
| Timestamps, hints, metadata | Inter | 12–13px | 400 |
| Italic accents (dates above journal entries, quiet emphasis) | EB Garamond italic | 13px | 400 |

Only two weights per font family (400 regular, 500 medium) — don't introduce bold (700) anywhere; it fights the soft, personal tone.

## 3. Component rules

- **Cards** (journal entry, vault note, cycle summary): `--color-surface` background, `0.5px solid var(--color-border)`, `12px` radius, `16px` padding.
- **Primary button**: `--color-brand` fill, `--color-on-brand` text, `8px` radius. One primary button per screen max — everything else is a secondary/ghost style (transparent fill, `--color-border-strong` outline).
- **Destructive actions** (delete entry, delete account): use `--color-danger`, never `--color-brand` — they must look visually distinct from a normal save/confirm action.
- **Focus states**: a visible outline using `--color-brand-light`, not a color from outside the palette.
- **Icons**: simple line icons (not filled/solid), sized 20px inline, colored `--color-text-secondary` by default, `--color-brand` when active/selected. Avoid decorative or "cute" icon sets — keep the icon language quiet so the palette and type carry the personality.
- **Empty states**: EB Garamond headline + Inter body, no illustrations that skew juvenile (no cartoon characters, no oversized emoji-style icons).

## 4. What to avoid (guardrails, not just preferences)

- No bright/saturated pink (`#FF4D8D`-style hues) anywhere — it pulls the whole product toward "teen diary app," which undercuts the private/mature positioning.
- No gradients on brand surfaces — flat fills only, keeps it feeling calm rather than trendy.
- No stock emoji in UI copy or notifications.
- Don't let `--color-brand-light` (#E2A6A0) carry body text on a light background — contrast is too low; it's for accents/badges only, paired with a dark text color on top if used as a fill.

## 5. Data transparency dashboard — specific styling note

This screen ("0 trackers. 0 ads. Nothing sent to our servers.") is a trust moment, not a settings page — give it more breathing room than a typical list screen, use the EB Garamond headline treatment, and avoid making it look like a legal/compliance page. It should feel reassuring, not like fine print.
