import { pgTable, uuid, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keyWrappings = pgTable(
  "key_wrappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    wrappedBy: varchar("wrapped_by", { length: 16 }).notNull(),
    wrappedKey: text("wrapped_key").notNull(),
    salt: text("salt").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({ userWrapIdx: index("user_wrap_idx").on(table.userId, table.wrappedBy) })
);

export const blobs = pgTable(
  "blobs",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    recordType: varchar("record_type", { length: 32 }),
    updatedAt: timestamp("updated_at").notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({ userUpdatedIdx: index("user_updated_idx").on(table.userId, table.updatedAt) })
);

// ─── shared_reports ───────────────────────────────────────────────────────────
// Ephemeral encrypted report blobs for granular partner/doctor sharing.
// The decryption key is in the URL hash fragment (#key=...) — server has zero access.
export const sharedReports = pgTable(
  "shared_reports",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    shareType: varchar("share_type", { length: 32 }).notNull(), // 'partner' | 'doctor'
    dataType: varchar("data_type", { length: 32 }).notNull(), // 'cycle' | 'health' | 'all'
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    pinHash: text("pin_hash"), // optional bcrypt hash
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

// ─── COMMUNITY ─────────────────────────────────────────────────────────────────
// Community identity — deliberately NOT foreign-keyed to `users` for absolute identity separation
export const anonIdentities = pgTable("anon_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonHandle: varchar("anon_handle", { length: 32 }).notNull().unique(), // e.g. "quiet-fern-42"
  avatar: varchar("avatar", { length: 32 }).notNull().default("bloom"), // 'bloom' | 'luna' | 'aurora' | 'marina' | 'fern' | 'cosmos' | 'rain' | 'ember'
  publicKey: text("public_key").notNull(), // ECDH / X25519 public key string for E2E chat
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"), // 'active' | 'banned' | 'deleted'
});

// Public feed posts — encrypted at rest, server-readable for moderation & crisis intervention
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorAnonId: uuid("author_anon_id").notNull().references(() => anonIdentities.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 32 }).notNull().default("general"), // 'general' | 'cycle' | 'pcos' | 'mood' | 'wellness'
  moodTag: varchar("mood_tag", { length: 32 }), // 'advice' | 'vent' | 'tip' | 'celebrate'
  reactions: text("reactions"), // JSON encoded reaction counts
  body: text("body").notNull(), // encrypted at rest, NOT E2E (allows moderation)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: varchar("status", { length: 16 }).notNull().default("visible"), // 'visible' | 'removed' | 'under_review'
});

export const replies = pgTable("replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorAnonId: uuid("author_anon_id").notNull().references(() => anonIdentities.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: varchar("status", { length: 16 }).notNull().default("visible"),
});

// 1:1 anon chat — genuinely E2E, server stores ciphertext only
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderAnonId: uuid("sender_anon_id").notNull().references(() => anonIdentities.id, { onDelete: "cascade" }),
  recipientAnonId: uuid("recipient_anon_id").notNull().references(() => anonIdentities.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(), // encrypted client-to-client
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reports — carries a decrypted copy of reported content submitted by the reporter's client
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterAnonId: uuid("reporter_anon_id").notNull().references(() => anonIdentities.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 16 }).notNull(), // 'post' | 'reply' | 'chat_message'
  targetId: uuid("target_id").notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  reportedContent: text("reported_content"),
  status: varchar("status", { length: 16 }).notNull().default("open"), // 'open' | 'actioned' | 'dismissed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── PARTNER ACCESS GRANTS ─────────────────────────────────────────────────────
export const sharedAccessGrants = pgTable("shared_access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  partnerPublicKey: text("partner_public_key").notNull(),
  dataType: varchar("data_type", { length: 32 }).notNull(), // 'cycle' | 'journal' | 'health' | 'all'
  status: varchar("status", { length: 16 }).notNull().default("active"), // 'active' | 'revoked'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const sharedKeyWrappings = pgTable("shared_key_wrappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  grantId: uuid("grant_id").notNull().references(() => sharedAccessGrants.id, { onDelete: "cascade" }),
  blobId: uuid("blob_id").notNull().references(() => blobs.id, { onDelete: "cascade" }),
  wrappedKey: text("wrapped_key").notNull(), // record key, wrapped with partner's public key
});

export type User = typeof users.$inferSelect;
export type KeyWrapping = typeof keyWrappings.$inferSelect;
export type Blob = typeof blobs.$inferSelect;
export type SharedReport = typeof sharedReports.$inferSelect;
export type AnonIdentity = typeof anonIdentities.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Reply = typeof replies.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type SharedAccessGrant = typeof sharedAccessGrants.$inferSelect;
export type SharedKeyWrapping = typeof sharedKeyWrappings.$inferSelect;
