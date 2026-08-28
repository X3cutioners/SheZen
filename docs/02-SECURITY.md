# Security Model — Zero-Knowledge Encryption

**The bar:** the server operator must never be able to read her data — not via a support backdoor, not via a breach, not under legal compulsion. If any implementation detail breaks this, it's a bug, not a shortcut.

## 1. Identifiers vs credentials vs encryption key — keep these three concepts separate

| Concept | What it is | Who/what holds it |
|---|---|---|
| **Identifier** | Random two-word name, assigned at signup (e.g. "quiet-harbor") | Server (lookup key only — never email/phone) |
| **Password** | What she sets, used to log in | Only she knows it; server stores only a hash for login gating |
| **Master encryption key** | Random key generated **locally**, encrypts her actual data | Never leaves the device in plaintext; never held by the server in unwrapped form |

**Do not conflate password with encryption key directly.** The design below wraps a single random master key with two independent secrets, so "forgot password" doesn't mean "data gone."

## 2. Key setup flow (signup)

```
Master Key (random, generated once, client-side, never sent to server)
  ├── wrapped by password (via Argon2id-derived key)   → stored on server, encrypted
  └── wrapped by recovery key (24-word phrase)          → stored on server, encrypted
```

Step by step:
1. Server assigns a random two-word identifier.
2. She sets a password (client-side only — never sent in plaintext to be stored; server stores a password hash for login auth, separate from the key-wrapping use).
3. Client generates a random master encryption key (e.g. 256-bit, via `crypto.getRandomValues`).
4. Client derives a **wrapping key** from her password via Argon2id + a random salt → uses it to encrypt (wrap) the master key → uploads: `wrapped_key_by_password`, `salt`.
5. Client generates a **24-word recovery key** (e.g. BIP39-style wordlist) → derives a second wrapping key from it → wraps the *same* master key again → uploads: `wrapped_key_by_recovery`.
6. **Force a confirmation step before backup activates**: show the recovery key once, then require her to re-enter 3 random words from it. Don't let her skip this. This is the single most important UX guardrail in the whole flow — most real-world data loss in zero-knowledge apps comes from users skipping the recovery-key save step, not from the crypto failing.
7. Only after that confirmation does cloud backup turn on.

## 3. Daily login / normal use

1. She logs in with identifier + password.
2. Server returns her salt and `wrapped_key_by_password`.
3. Client derives the wrapping key from her password + salt (Argon2id), unwraps the master key locally.
4. Master key decrypts her data locally. Server never sees the master key or plaintext at any point.
5. Master key lives only in memory (a JS variable) for the session — never persisted to IndexedDB/localStorage in plaintext. Re-derive each session.

## 4. Forgot password flow

1. She clicks "forgot password," enters her **recovery key** instead.
2. Server returns `wrapped_key_by_recovery` (+ its salt).
3. Client derives the recovery-based wrapping key, unwraps the master key.
4. She sets a new password → client wraps the *same* master key under the new password → uploads a fresh `wrapped_key_by_password`, replacing the old one.
5. Data was never re-encrypted — only which secret unwraps the master key changed. All existing ciphertext decrypts fine with the (unchanged) master key.

**No recovery key saved → no password reset → data is gone by design.** This must be stated plainly at onboarding, not buried in settings.

## 5. Lost password AND lost recovery key

This is an intentional dead end. There is no third door — a third door would mean the server has some path to the master key, which breaks the zero-knowledge guarantee entirely. Do not build a support-ticket override, an "verify your identity via email" bypass, or any admin unlock. If product wants to reduce how often users land here, the fix is UX (harder-to-lose recovery key: QR export, printable card, forced re-save prompts, optional second wrapped copy on a trusted second device / Shamir's Secret Sharing) — never a new secret path.

## 6. Encryption primitives

- **AES-256-GCM** (via WebCrypto `crypto.subtle`) or **XChaCha20-Poly1305** (via libsodium.js) for actual data encryption. Both are authenticated encryption — tampering is detectable, and a wrong key simply fails to decrypt (no ambiguous partial success).
- **Argon2id** for key derivation from password/recovery key (PBKDF2 with a high iteration count is an acceptable fallback only if Argon2id's bundle size becomes a real blocker).
- Each record (journal entry, cycle log entry, note) is encrypted individually — not batched into one blob — so partial sync and merge work cleanly.

## 7. What the server is allowed to store (and nothing more)

```
users:            id, two_word_identifier, password_hash, created_at
key_wrappings:    user_id, wrapped_by ('password'|'recovery'), wrapped_key, salt, updated_at
blobs:            id, user_id, ciphertext, nonce, updated_at, (optionally) record_type
```

No plaintext content, no email/phone (unless she explicitly opts into partner-sharing later, which is a separate, explicit feature — see `00-PRODUCT.md` §5.16), no analytics fields, no behavioral tracking columns. If a column doesn't need to exist for the encrypted-sync or auth flow to function, don't add it.

## 8. Threat model notes for the coding agent

- Treat "the server operator" as a potential adversary when deciding where logic runs — if a computation needs plaintext, it runs client-side, full stop.
- Notifications must not leak content on the lock screen (e.g. "New entry" not "Period starts in 2 days" if that's a sensitive-content risk in her context) — configurable, but default to the safe/generic wording.
- The decoy/disguise mode (see `00-PRODUCT.md` §7-8) must not be defeatable by simply checking recently-used-apps previews, clipboard, or browser history — this is a real limitation of PWAs vs native; document it honestly in-product rather than overclaiming.
