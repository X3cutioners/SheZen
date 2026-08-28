# Architecture

## 1. Stack decision

| Layer | Choice | Why |
|---|---|---|
| Frontend | PWA — **Next.js (App Router)** deployed on **Vercel**, or **SvelteKit/Vite + React** if you want a lighter client | Next.js on Vercel gives you the frontend and edge/serverless API routes in one deploy if you don't split the backend out. Choose this if you want one repo, one deploy. |
| Backend API (if split out) | **Hono** running on **Cloudflare Workers** | Hono is small, fast, and designed for Workers/edge runtimes. Use this path if you want the API decoupled from the frontend deploy, or want Cloudflare's edge network specifically. |
| Database | **NeonDB** (serverless Postgres) | Works with both Vercel (via `@neondatabase/serverless` HTTP driver, no TCP needed) and Cloudflare Workers (same driver — Workers can't hold TCP connections open, so the HTTP driver is required either way). |
| ORM | **Drizzle ORM** | Lightweight, works with Neon's serverless driver on edge runtimes (Prisma's edge support is heavier and less reliable on Workers as of this writing — verify current status before committing). |
| Local storage (client) | **IndexedDB** via **Dexie.js** | Stores ciphertext blobs and sync metadata client-side. Storage-at-rest security doesn't depend on IndexedDB's own protections because everything in it is already encrypted before it's written. |
| Client crypto | **WebCrypto API** (`crypto.subtle`) for AES-256-GCM, or **libsodium.js** if you want XChaCha20-Poly1305 | Both are fine; libsodium has nicer nonce handling. Pick one and use it consistently — don't mix. |
| Key derivation | **Argon2id** (via `hash-wasm` or `argon2-browser` in the client) | PBKDF2 is an acceptable fallback if Argon2id's WASM bundle size is a real problem, but Argon2id is preferred. |
| PWA tooling | **Workbox** (via `next-pwa` or manual service worker) | Handles offline caching, install prompt, manifest generation. |
| Auth | Custom — see `03-SECURITY.md`. Not NextAuth/Clerk/etc., because those assume the server can see credentials in ways that conflict with the zero-knowledge model. | |

**Pick one deployment path before starting build**, don't build both in parallel:
- **Path A (simpler):** Everything in one Next.js app on Vercel — API routes + frontend + Neon.
- **Path B (decoupled):** Next.js PWA on Vercel (or Cloudflare Pages) + separate Hono API on Cloudflare Workers + Neon, called via `fetch` from the client.

If you're not sure, default to **Path A** for MVP. Split later if you need Workers-specific edge behavior the API doesn't get from Vercel.

## 2. High-level data flow

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (PWA, browser)                                         │
│                                                                 │
│  Plaintext data (journal entry, cycle log, note)               │
│         │                                                       │
│         ▼                                                       │
│  Encrypt with derived key (WebCrypto/libsodium)                 │
│         │                                                       │
│         ▼                                                       │
│  Store ciphertext in IndexedDB (local-first, works offline)     │
│         │                                                       │
│         ▼ (only if cloud backup is opted in)                    │
│  Upload ciphertext blob + minimal sync metadata                 │
└─────────────────────────────────────────┬───────────────────┘
                                            │  ciphertext only — server never sees plaintext or the key
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER (API on Vercel or Cloudflare Workers)                  │
│  - Stores opaque ciphertext blobs                              │
│  - Stores salt (not secret) + wrapped master key copies        │
│  - Has zero ability to decrypt anything                        │
└─────────────────────────────────────────┬───────────────────┘
                                            ▼
                                    NeonDB (Postgres)
```

## 3. App modes

The app must work fully in **no-login mode**:
- All 4 core modules (cycle, journal, health notes, vault) work with zero network calls, zero account.
- Data lives only in IndexedDB, encrypted with a locally-generated master key wrapped by a local passcode (see `03-SECURITY.md`).
- The moment she wants **cloud backup or multi-device sync**, she's walked into account creation (two-word random identifier + password) — this is the *only* thing that requires a server round-trip for core functionality.

Do not gate any core module behind login. Login/account only unlocks backup + sync.

## 4. Repo structure (Path A — recommended starting point)

```
/app                    → Next.js App Router pages
  /api                  → API routes (signup, login, salt, sync, recovery)
  /(app)                → the actual PWA screens (cycle, journal, notes, vault, settings)
/lib
  /crypto               → key derivation, wrap/unwrap, encrypt/decrypt helpers (client-only)
  /db                    → Drizzle schema + Neon client (server-only)
  /local-db              → Dexie.js schema + IndexedDB helpers (client-only)
  /sync                   → push/pull sync logic, conflict resolution (last-write-wins by updated_at)
/public
  manifest.json
  service-worker.js (or generated by next-pwa)
/docs                    → this doc set
```

## 5. Sync model

- Per-record encryption, not one blob per sync — makes partial sync and merge tractable.
- Conflict resolution: last-write-wins by `updated_at` for MVP. A CRDT can come later if merge conflicts turn out to matter in practice — don't build one speculatively.
- Server stores minimal unencrypted metadata only: `id`, `updated_at`, `record_type` (if you want per-module sync instead of syncing everything at once) — nothing else. See `02-DATA-MODEL.md` for exact fields and the tradeoff on `record_type`.

## 6. What NOT to build in MVP

- No CRDT / operational transform — last-write-wins is enough until proven otherwise.
- No native app, no background location, no push-notification infrastructure beyond basic reminders (medication/journal prompts), which are local notifications, not server-triggered.
- No admin dashboard beyond what's needed to operate the service (billing, abuse reports) — and even that should never expose user data.
