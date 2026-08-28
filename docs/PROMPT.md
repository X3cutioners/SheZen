# Master build prompt

Copy everything below the line into your coding agent (Claude Code, Cursor, etc.) as the first message, with all six doc files (`00-PRODUCT.md` through `05-DESIGN.md`) either attached or placed in a `/docs` folder in the repo the agent can read.

---

You're building a privacy-first personal data app for women — cycle tracking, journal, health notes, and a general encrypted vault — as an installable PWA, with a serverless backend on Vercel or Cloudflare Workers and NeonDB (serverless Postgres) as the database.

Before writing any code, read these docs in full — they contain product scope, architecture decisions, the encryption/security model, the database schema, the API spec, and the visual design system. Don't deviate from them without flagging the deviation and why:

- `docs/00-PRODUCT.md` — what this product is, the final feature list, and what's explicitly excluded
- `docs/01-ARCHITECTURE.md` — tech stack and repo structure
- `docs/02-SECURITY.md` — the zero-knowledge encryption model (this is the most important doc — the whole product's trust claim depends on getting this right)
- `docs/03-DATA-MODEL.md` — the Postgres schema
- `docs/04-API-SPEC.md` — the API surface
- `docs/05-DESIGN.md` — the "Blush & Berry" color palette, EB Garamond + Inter typography system, and component styling rules

## Non-negotiable constraints

1. **The server must never receive or store plaintext content or an unwrapped encryption key.** Every write to the database from a user's actual data (journal entries, cycle logs, notes) must already be ciphertext by the time it reaches an API route. If you find yourself adding a plaintext column for journal/cycle/note content, stop — that's a violation of the core product promise, not a shortcut.
2. **The app must be fully usable with zero account.** All four core modules (cycle, journal, health notes, vault) need to work against local IndexedDB storage alone, encrypted with a locally-generated key, before you build any auth/sync code. Build and verify this local-only path first.
3. **Follow the key-wrapping design in `02-SECURITY.md` exactly** — one random master key, wrapped twice (by password-derived key, by recovery-key-derived key), never a password used to derive the encryption key directly. Don't simplify this to "password = encryption key" even though it's less code — it breaks password-reset without losing data.
4. **Follow `05-DESIGN.md` for all visual work** — the Blush & Berry palette (as CSS custom properties, with the light/dark mode pairs given), EB Garamond for her content, Inter for UI chrome. Don't substitute a different palette or font pairing, and don't let the brand pink drift toward a bright/saturated hue — the muted tone is deliberate.

## Build order

Work in this sequence, and treat each phase as a checkpoint — don't move to the next phase until the current one actually works end to end, not just compiles.

### Phase 1 — Local-only vault (no server, no account)
- Set up the Next.js PWA shell: manifest, service worker (Workbox or `next-pwa`), install prompt.
- Set up the design system first: CSS custom properties from `05-DESIGN.md` (light + dark mode), EB Garamond and Inter loaded via `next/font/google` (or self-hosted) so both are bundled for offline use, and the base type scale. Build one or two core components (button, card, input) against these tokens before building screens, so every screen after this reuses the same primitives instead of ad hoc styling.
- Set up Dexie.js schema for local encrypted storage.
- Implement the crypto module (`/lib/crypto`): master key generation, Argon2id-based key derivation from a local passcode, AES-256-GCM (or libsodium XChaCha20-Poly1305 — pick one) encrypt/decrypt helpers. Master key lives in memory only for the session.
- Build the four core modules (cycle tracker, journal, health notes, vault/notes) writing/reading only to local encrypted IndexedDB, styled per `05-DESIGN.md` (journal/note bodies in EB Garamond, everything else in Inter). Get this fully working and usable before touching the backend.
- Build the data transparency dashboard (`00-PRODUCT.md` §5.13) — even at this stage it should truthfully show "0 trackers, 0 ads, nothing sent to servers," styled per the dashboard note in `05-DESIGN.md` §5 (a trust moment, not a settings page).

### Phase 2 — Privacy/security features that don't need a server
- App disguise / decoy mode (fake icon+name, decoy PIN → dummy screen)
- Panic/quick-exit gesture
- Screenshot/screen-recording block on sensitive screens (where the platform API allows it)
- One-tap local export/delete-everything
- Data-minimized input patterns (ranges, nicknames) across the module forms

### Phase 3 — Backend + opt-in cloud sync
- Set up NeonDB, run the schema from `03-DATA-MODEL.md` via Drizzle.
- Build the API routes from `04-API-SPEC.md`: signup, login, salt lookup, recovery unlock, recovery password-reset, sync push/pull/delete, export, account delete.
- Build the onboarding flow for backup: password set → master key wrap-by-password → recovery key generation → **forced recovery-key confirmation step (re-enter 3 random words) before backup activates.** Don't skip or soften this step.
- Wire up sync: local IndexedDB ⟷ server blobs, last-write-wins by `updated_at`.
- Build the forgot-password flow using the recovery key, per `02-SECURITY.md` §4.

### Phase 4 — Partner/doctor sharing (last, and only if you get here)
- Explicit, granular, revocable sharing of one data type with one chosen recipient. Build this only after everything above is solid — it's the one deliberate exception to the zero-knowledge default and deserves its own careful review before shipping.

## What to ask me before proceeding, if anything is ambiguous

- Whether to use Path A (single Next.js app on Vercel) or Path B (decoupled Cloudflare Workers API) from `01-ARCHITECTURE.md` — default to Path A unless told otherwise.
- Whether to use WebCrypto or libsodium.js for encryption — default to WebCrypto (`crypto.subtle`, AES-256-GCM) unless told otherwise, since it needs no extra dependency.
- The actual app name — use a placeholder and flag it for later. The color palette and typography are already decided (`05-DESIGN.md`) — don't treat those as open.

Start with Phase 1. Confirm the local-only encrypted vault works end-to-end (create an entry, close the tab, reopen, decrypt and see it again) before writing any server code.
