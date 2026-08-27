/**
 * lib/local-db/index.ts
 * Dexie.js schema for SheZen local encrypted storage.
 *
 * ALL content stored here (journal entries, cycle logs, notes, vault items)
 * is ciphertext — plaintext never touches IndexedDB. The only plaintext
 * fields are structural metadata (id, record_type, dates) needed for local
 * querying and sync.
 *
 * Schema:
 *  - keyStore: one row, the wrapped master key blob
 *  - records:  one row per encrypted record (journal, cycle, notes, vault)
 */

import Dexie, { type Table } from "dexie";
import type { WrappedKey, EncryptedRecord } from "@/lib/crypto";

// ─── Stored types ─────────────────────────────────────────────────────────────

export type RecordType = "cycle" | "journal" | "notes" | "vault";

/**
 * The key storage entry — one row per passcode wrapping.
 * Only ever has a single row (id = "local").
 */
export interface KeyStoreEntry {
  id: string; // always "local"
  wrappedKey: WrappedKey;
  createdAt: number; // unix timestamp ms
}

/**
 * A single encrypted record in local storage.
 * `payload` contains the ciphertext+IV of the JSON-serialised record content.
 */
export interface LocalRecord {
  /** UUID generated client-side */
  id: string;
  type: RecordType;
  /** The encrypted payload — decrypted on read using the session master key */
  payload: EncryptedRecord;
  /** ISO 8601 date string — used for sorting and sync; NOT secret */
  date: string;
  /** Unix timestamp (ms) — used for last-write-wins sync */
  updatedAt: number;
  /** Soft-delete flag for sync tombstones */
  deletedAt?: number;
}

// ─── Dexie database class ─────────────────────────────────────────────────────

class SheZenDB extends Dexie {
  keyStore!: Table<KeyStoreEntry, string>;
  records!: Table<LocalRecord, string>;

  constructor() {
    super("shezen-vault");

    this.version(1).stores({
      // keyStore: just one row, keyed by "local"
      keyStore: "id, createdAt",

      // records: indexed by id, type, date, updatedAt for filtering/sorting
      // Only non-sensitive fields are indexed — the encrypted payload is opaque.
      records: "id, type, date, updatedAt, deletedAt",
    });
  }
}

export const db = new SheZenDB();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True if this is a first-run (no key stored yet). */
export async function isFirstRun(): Promise<boolean> {
  const count = await db.keyStore.count();
  return count === 0;
}

/** Store the wrapped key (call once during setup). */
export async function saveWrappedKey(wrappedKey: WrappedKey): Promise<void> {
  await db.keyStore.put({
    id: "local",
    wrappedKey,
    createdAt: Date.now(),
  });
}

/** Load the wrapped key (call during unlock). Returns null if not found. */
export async function loadWrappedKey(): Promise<WrappedKey | null> {
  const entry = await db.keyStore.get("local");
  return entry?.wrappedKey ?? null;
}

/** Wipe all local data (export-then-delete-everything feature). */
export async function deleteEverything(): Promise<void> {
  await db.transaction("rw", db.keyStore, db.records, async () => {
    await db.keyStore.clear();
    await db.records.clear();
  });
}

// ─── Record CRUD helpers ──────────────────────────────────────────────────────

import { v4 as uuidv4 } from "uuid";
import {
  encryptRecord,
  decryptRecord,
  getSessionMasterKey,
} from "@/lib/crypto";

function requireKey(): CryptoKey {
  const key = getSessionMasterKey();
  if (!key) throw new Error("Vault is locked. Unlock before accessing records.");
  return key;
}

/**
 * Save an encrypted record to IndexedDB.
 * Accepts any JSON-serialisable plaintext object; encrypts it before storage.
 */
export async function saveRecord<T extends object>(
  type: RecordType,
  data: T,
  date: string,
  existingId?: string
): Promise<string> {
  const key = requireKey();
  const id = existingId ?? uuidv4();
  const payload = await encryptRecord(JSON.stringify(data), key);
  const record: LocalRecord = {
    id,
    type,
    payload,
    date,
    updatedAt: Date.now(),
    deletedAt: undefined,
  };
  await db.records.put(record);
  return id;
}

/**
 * Load and decrypt a single record by ID.
 * Returns null if not found or deleted.
 */
export async function loadRecord<T>(id: string): Promise<T | null> {
  const key = requireKey();
  const record = await db.records.get(id);
  if (!record || record.deletedAt) return null;
  const plaintext = await decryptRecord(record.payload, key);
  return JSON.parse(plaintext) as T;
}

/**
 * Load and decrypt all records of a given type, sorted by date descending.
 */
export async function loadAllRecords<T>(
  type: RecordType
): Promise<Array<{ id: string; date: string; updatedAt: number; data: T }>> {
  const key = requireKey();
  const records = await db.records
    .where("type")
    .equals(type)
    .filter((r) => !r.deletedAt)
    .toArray();

  // Sort by date descending
  records.sort((a, b) => b.date.localeCompare(a.date));

  const results = await Promise.all(
    records.map(async (r) => {
      const plaintext = await decryptRecord(r.payload, key);
      return {
        id: r.id,
        date: r.date,
        updatedAt: r.updatedAt,
        data: JSON.parse(plaintext) as T,
      };
    })
  );
  return results;
}

/**
 * Soft-delete a record (for sync tombstone behaviour).
 */
export async function deleteRecord(id: string): Promise<void> {
  await db.records.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}

/**
 * Hard-delete a record (use only for the delete-everything flow).
 */
export async function hardDeleteRecord(id: string): Promise<void> {
  await db.records.delete(id);
}

/**
 * Count of live records by type.
 */
export async function countRecords(type: RecordType): Promise<number> {
  return db.records
    .where("type")
    .equals(type)
    .filter((r) => !r.deletedAt)
    .count();
}

/** Total live record count across all types. */
export async function totalRecordCount(): Promise<number> {
  return db.records.filter((r) => !r.deletedAt).count();
}
