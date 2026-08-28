# Product Spec — [App Name: working title "Vault"]

> Replace "Vault" with your real app name everywhere before handing this to a coding agent. Search-and-replace is safe — the name isn't used as an identifier anywhere in code, only in copy/branding.

## 1. What this is

A **private-by-design personal data app for women** — cycle tracking, journal, health notes, and a general vault — built around one promise: *your data never leaves your device unencrypted, and the operator (you) cannot read it, even if compelled.*

This is **not** a safety/SOS app, a marketplace, or a social app. Those were explicitly considered and dropped in favor of focus. Do not add them back without a deliberate product decision.

## 2. Core problem this owns

She wants to track deeply personal data (cycle, mood, health, private notes) without:
- It being sold, profiled, or leaked (see: Flo Health data-sharing scandals, post-Roe cycle-data-as-legal-liability concerns)
- Requiring an account/phone number/email just to start using it
- Anyone who picks up her phone being able to casually see it

## 3. Who it's for

A woman who wants a private space for cycle/health/journal data and is specifically wary of apps that harvest or sell personal data — not a specific life-stage or crisis persona. The differentiator is the privacy model, not a demographic feature set.

## 4. Product principles (non-negotiable — apply these to every feature decision)

1. **Zero-knowledge by default.** If a feature requires the server to see plaintext, it needs an explicit, separate opt-in — it can never be silently added to the default path.
2. **No account required to use the core app.** Account/identifier only enters the picture when she opts into cloud backup.
3. **No behavioral analytics, no ad SDKs, no "anonymized" data sales.** Monetization is subscription or one-time purchase, not data.
4. **Local-first.** Predictions, insights, and pattern detection run on-device. Nothing is computed server-side that could be computed client-side.
5. **Honesty over false comfort.** If a security tradeoff means data is unrecoverable in some scenario (lost passphrase + lost recovery key), say so plainly in the product, not just in a policy page.
6. **The litmus test for any new feature:** *Does this need her data to leave the device, or her identity to be known to a server?* If yes, it needs a deliberate, explicit, revocable opt-in — or it doesn't belong.

## 5. Final feature list (MVP scope)

### Core modules (private-first views into one vault)
1. **Cycle tracker** — period/ovulation prediction, symptom logging, fully on-device computation
2. **Journal** — daily entries, mood tracking, gratitude prompts, separate biometric/PIN lock from the app-level lock
3. **Health notes** — sleep, symptoms, medication/supplement reminders, general private log (not clinical)
4. **Vault/notes** — general-purpose encrypted notes for anything sensitive

### Privacy/security features (this is the actual product identity — treat as core, not "settings")
5. **No-login-required mode** — fully usable with zero account, phone number, or email
6. **Local-only insights** — pattern detection (e.g. cycle irregularity, symptom correlation) computed entirely on-device, never transmitted
7. **App disguise / decoy mode** — fake icon and name, decoy PIN opens a blank/dummy screen
8. **Panic/quick-exit gesture** — instantly switches to decoy screen or closes the app
9. **Screenshot/screen-recording block** on sensitive screens (journal, vault) — where the platform allows it
10. **Local encrypted export/backup** — she exports an encrypted file to her own storage; the server never holds a copy
11. **Optional E2E-encrypted cloud sync** — off by default, multi-device only if she opts in; key never held by the server (see `03-SECURITY.md`)
12. **One-tap export/delete-everything** — no dark patterns, no retention tricks
13. **Data transparency dashboard** — a real, visible screen: "0 trackers. 0 ads. Nothing sent to our servers unless you enable backup."
14. **Data-minimized inputs** — ranges instead of exact values, nicknames instead of names, wherever the UI can offer it
15. **Plain-language permission prompts** — explained in context, at time of use, never buried in a policy page

### Deliberate exception feature
16. **Opt-in partner/doctor sharing** — explicit, granular, revocable sharing of one specific data type (e.g. cycle only) with one chosen person. Not a default. Not broad. Build this last.

## 6. Explicitly excluded from this product (do not build without a deliberate re-scoping decision)

- Community/forums, social feed
- Marketplace, gynecologist booking, gov-scheme notifications
- Gamification/leaderboards (implies server-side scorekeeping across users — contradicts local-first)
- Ads or "personalized content" of any kind
- Safety/SOS features, background location, emergency dispatch integrations

These were all considered during product discovery and cut on purpose — see reasoning in the source discussion if you need to revisit any of them.

## 7. Platform decision

**PWA-first**, built with a Vercel- or Cloudflare-Workers-hosted API and NeonDB (serverless Postgres) as the backend. This product profile is unusually PWA-friendly — no background location, no device-control features, no telephony. Local-first storage (IndexedDB) covers the offline/local data model fully.

Two things push toward native later, if ever: (a) the app-disguise trick is more convincing natively, and (b) OS-level keystore/biometric APIs give tighter guarantees than WebAuthn in a browser. Neither blocks MVP — ship PWA first.

## 8. Monetization

Subscription or one-time purchase. No ad-tech, no data sales — this is a constraint the product architecture already assumes (see `03-SECURITY.md`), not just a business decision.
