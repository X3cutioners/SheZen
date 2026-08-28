# API Spec

All endpoints deal only in ciphertext, salts, and wrapped keys — the server never receives plaintext content or an unwrapped encryption key. Reject any request payload shape that would imply otherwise.

Base path: `/api` (Next.js API routes) or root (if split out to a standalone Hono app on Cloudflare Workers).

## Auth & account setup

### `POST /signup`
Creates an account. Called only when she opts into backup/sync — never required for core app use.

Request:
```json
{
  "password_hash": "…",            // hashed client-side is NOT sufficient on its own — server should also hash what it receives with a server-side algorithm (Argon2id/bcrypt) for storage; see note below
  "wrapped_key_by_password": "…",
  "password_salt": "…",
  "wrapped_key_by_recovery": "…",
  "recovery_salt": "…"
}
```
Response:
```json
{ "identifier": "quiet-harbor", "user_id": "uuid" }
```
Note: password should be hashed *again* server-side before storage (don't just store whatever the client sends as-is) — client-side hashing alone doesn't protect against a compromised server storing crackable values if the client hash isn't itself treated as a fresh secret to re-hash.

### `POST /login`
Request: `{ "identifier": "quiet-harbor", "password": "…" }`
Response (on success): `{ "user_id": "uuid", "salt": "…", "wrapped_key_by_password": "…" }`
- Verifies password against stored hash server-side.
- Returns the salt + wrapped key so the client can unwrap the master key locally.

### `GET /salt?identifier=quiet-harbor`
Returns the password salt for a given identifier, so a new/second device can begin key derivation before login completes. Response: `{ "salt": "…" }`

### `POST /recovery/unlock`
Request: `{ "identifier": "quiet-harbor", "recovery_key_hash": "…" }` (or however you choose to verify recovery-key possession without transmitting it in reusable plaintext — consider a challenge-response instead of sending the recovery key itself)
Response: `{ "salt": "…", "wrapped_key_by_recovery": "…" }`

### `POST /recovery/reset-password`
Called after the client has unwrapped the master key via the recovery key and derived a new password wrapping locally.
Request:
```json
{ "user_id": "uuid", "new_password_hash": "…", "new_wrapped_key_by_password": "…", "new_salt": "…" }
```
Response: `{ "ok": true }`

## Sync

### `GET /sync/pull?since=<timestamp>&record_type=<optional>`
Auth required. Returns all blobs updated (or deleted) since the given timestamp for the authenticated user.
Response:
```json
{
  "blobs": [
    { "id": "uuid", "ciphertext": "…", "nonce": "…", "record_type": "journal", "updated_at": "…", "deleted_at": null }
  ]
}
```

### `POST /sync/push`
Auth required. Upserts one or more encrypted records.
Request:
```json
{
  "blobs": [
    { "id": "uuid", "ciphertext": "…", "nonce": "…", "record_type": "journal", "updated_at": "…" }
  ]
}
```
Response: `{ "accepted": ["uuid", …] }`
- Conflict resolution: last-write-wins by `updated_at`. If an incoming record's `updated_at` is older than what's stored, the server keeps the stored version and reports it back so the client can reconcile locally.

### `POST /sync/delete`
Request: `{ "ids": ["uuid", …] }` → soft-deletes (sets `deleted_at`) rather than hard-deleting, so other devices can reconcile the tombstone. Auth required.

## Account data lifecycle

### `GET /export`
Auth required. Returns the full set of the user's encrypted blobs as a downloadable archive (still ciphertext — decryption happens client-side after download). This is distinct from the local export/backup feature (`00-PRODUCT.md` §10), which never touches the server at all.

### `DELETE /account`
Auth required, should require re-confirmation (password re-entry) given the irreversibility. Cascades to delete `users`, `key_wrappings`, and `blobs` rows immediately — no soft-delete/retention window.

## Rate limiting & abuse notes

- `/login`, `/recovery/unlock`, `/signup` should be rate-limited per identifier and per IP — these are the endpoints most exposed to brute-force/enumeration attempts, especially since the identifier space (two-word names) is smaller than an email space.
- Do not return different error messages for "identifier doesn't exist" vs "password wrong" — both should look identical to the client to avoid identifier enumeration.
