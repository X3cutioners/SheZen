# Data Model — NeonDB (Postgres) via Drizzle

This schema only covers what's needed for **auth + zero-knowledge sync**. All actual content (journal text, cycle symptoms, note bodies) lives encrypted inside `blobs.ciphertext` — there are no separate `journal_entries` / `cycle_logs` tables with plaintext columns on the server, by design.

## 1. Drizzle schema (`/lib/db/schema.ts`)

```ts
import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

// One row per account. Only created when she opts into backup/sync.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Random two-word identifier, e.g. "quiet-harbor" — NOT email/phone.
  identifier: varchar("identifier", { length: 64 }).notNull().unique(),
  // Login gate only — NOT used to derive the encryption key directly.
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Two rows per user: one wrapped-by-password, one wrapped-by-recovery-key.
export const keyWrappings = pgTable("key_wrappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wrappedBy: varchar("wrapped_by", { length: 16 }).notNull(), // 'password' | 'recovery'
  wrappedKey: text("wrapped_key").notNull(),   // ciphertext of the master key
  salt: text("salt").notNull(),                // NOT secret — needed to re-derive the wrapping key
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userWrapIdx: index("user_wrap_idx").on(table.userId, table.wrappedBy),
}));

// One row per encrypted record (journal entry, cycle log entry, note, etc.)
export const blobs = pgTable("blobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce").notNull(),
  // Optional — only include if you need per-module sync (e.g. sync journal
  // without pulling vault notes). Weigh this against "even metadata is
  // information" — decide deliberately, don't add it by default.
  recordType: varchar("record_type", { length: 32 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // soft delete for sync — tombstone, not hard delete, so other devices can reconcile
}, (table) => ({
  userUpdatedIdx: index("user_updated_idx").on(table.userId, table.updatedAt),
}));
```

## 2. Deliberately absent tables

Do not create tables for: journal content, cycle symptoms, health notes, vault note bodies, analytics events, session/behavior tracking. If a coding agent's plan includes any of these as plaintext-bearing tables, that's a sign the zero-knowledge boundary has been crossed somewhere in the design — stop and re-check against `02-SECURITY.md`.

## 3. Neon connection notes (for both Vercel and Cloudflare Workers)

Both runtimes are edge/serverless and can't hold a persistent TCP connection open — use Neon's HTTP driver, not `pg` or a standard TCP pool:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

If you later add a long-running worker/cron process outside the edge runtime (e.g. for scheduled cleanup jobs), that process *can* use a pooled TCP connection via Neon's pooler endpoint — but the request-serving API paths should stick to the HTTP driver.

## 4. Migrations

Use `drizzle-kit` for migrations. Keep migrations in `/lib/db/migrations`, generate with `drizzle-kit generate`, apply with `drizzle-kit migrate` (or push in dev). Don't hand-write SQL migrations unless Drizzle can't express something you need.

## 5. Data lifecycle

- **Export/delete-everything**: a single endpoint that either returns all of a user's `blobs` rows as a downloadable encrypted archive, or hard-deletes `users` (cascades to `key_wrappings` and `blobs`). No soft-delete-and-retain-for-30-days pattern here — "delete everything" should mean everything, immediately, per the no-dark-patterns principle in `00-PRODUCT.md`.
- **Sync tombstones** (`deleted_at` on `blobs`) are for *device sync reconciliation* only (so another device knows a record was deleted rather than never having existed) — these should still be purged permanently after a short window (e.g. 30 days) once all known devices have likely synced, not kept indefinitely.
