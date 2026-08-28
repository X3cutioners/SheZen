/**
 * lib/local-db/index.ts
 * Dexie.js schema for SheZen local encrypted storage.
 *
 * ALL content stored here is ciphertext — plaintext never touches IndexedDB.
 * The only non-encrypted fields are structural metadata (id, type, dates)
 * needed for local querying and sync ordering.
 *
 * SSR-safe: the Dexie instance is created lazily inside getDB(), which only
 * runs client-side (inside useEffect / event handlers — never at module load).
 */

import Dexie, { type Table } from "dexie";
import type { WrappedKey, EncryptedRecord } from "@/lib/crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecordType = "cycle" | "journal" | "notes" | "vault";

export interface KeyStoreEntry {
  /** Always "local" — only one row ever exists */
  id: string;
  wrappedKey: WrappedKey;
  createdAt: number;
}

export interface LocalRecord {
  id: string;
  type: RecordType;
  /** AES-256-GCM encrypted payload — readable only with the master key */
  payload: EncryptedRecord;
  /** ISO 8601 date string — NOT secret, used for sorting */
  date: string;
  /** Unix ms timestamp for last-write-wins sync */
  updatedAt: number;
  /** Soft-delete tombstone for sync reconciliation */
  deletedAt?: number;
}

// ─── Dexie class ─────────────────────────────────────────────────────────────

class SheZenDB extends Dexie {
  keyStore!: Table<KeyStoreEntry, string>;
  records!: Table<LocalRecord, string>;

  constructor() {
    super("shezen-vault");
    this.version(1).stores({
      keyStore: "id, createdAt",
      records: "id, type, date, updatedAt, deletedAt",
    });
  }
}

// ─── Lazy singleton — only ever constructed in the browser ────────────────────

let _db: SheZenDB | null = null;

export function getDB(): SheZenDB {
  if (typeof window === "undefined") {
    throw new Error("SheZenDB must only be accessed client-side.");
  }
  if (!_db) {
    _db = new SheZenDB();
  }
  return _db;
}

// ─── Key store helpers ────────────────────────────────────────────────────────

export async function isFirstRun(): Promise<boolean> {
  const count = await getDB().keyStore.where("id").equals("local").count();
  return count === 0;
}

export async function saveWrappedKey(wrappedKey: WrappedKey): Promise<void> {
  await getDB().keyStore.put({ id: "local", wrappedKey, createdAt: Date.now() });
}

export async function loadWrappedKey(): Promise<WrappedKey | null> {
  const entry = await getDB().keyStore.get("local");
  return entry?.wrappedKey ?? null;
}

export async function saveDecoyWrappedKey(wrappedKey: WrappedKey): Promise<void> {
  await getDB().keyStore.put({ id: "decoy", wrappedKey, createdAt: Date.now() });
}

export async function loadDecoyWrappedKey(): Promise<WrappedKey | null> {
  const entry = await getDB().keyStore.get("decoy");
  return entry?.wrappedKey ?? null;
}

export async function deleteDecoyWrappedKey(): Promise<void> {
  await getDB().keyStore.delete("decoy");
}

export async function deleteEverything(): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.keyStore, db.records, async () => {
    await db.keyStore.clear();
    await db.records.clear();
  });
}

// ─── Record CRUD ──────────────────────────────────────────────────────────────

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

export async function saveRecord<T extends object>(
  type: RecordType,
  data: T,
  date: string,
  existingId?: string
): Promise<string> {
  const key = requireKey();
  const id = existingId ?? crypto.randomUUID();
  const payload = await encryptRecord(JSON.stringify(data), key);
  const record: LocalRecord = {
    id,
    type,
    payload,
    date,
    updatedAt: Date.now(),
    deletedAt: undefined,
  };
  await getDB().records.put(record);
  return id;
}

export async function loadRecord<T>(id: string): Promise<T | null> {
  const key = requireKey();
  const record = await getDB().records.get(id);
  if (!record || record.deletedAt) return null;
  try {
    const plaintext = await decryptRecord(record.payload, key);
    return JSON.parse(plaintext) as T;
  } catch (err) {
    // Fails if encrypted with a different master key (e.g. real vs decoy)
    return null;
  }
}

export async function loadAllRecords<T>(
  type: RecordType
): Promise<Array<{ id: string; date: string; updatedAt: number; data: T }>> {
  const key = requireKey();
  const records = await getDB()
    .records.where("type")
    .equals(type)
    .filter((r) => !r.deletedAt)
    .toArray();

  records.sort((a, b) => b.date.localeCompare(a.date));

  const results = await Promise.all(
    records.map(async (r) => {
      try {
        const plaintext = await decryptRecord(r.payload, key);
        return {
          id: r.id,
          date: r.date,
          updatedAt: r.updatedAt,
          data: JSON.parse(plaintext) as T,
        };
      } catch (err) {
        // This record was encrypted with a different key!
        // Plausible deniability: silently ignore it so it remains hidden in this vault.
        return null;
      }
    })
  );

  return results.filter((r) => r !== null) as Array<{ id: string; date: string; updatedAt: number; data: T }>;
}

export async function deleteRecord(id: string): Promise<void> {
  await getDB().records.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function totalRecordCount(): Promise<number> {
  // To get an accurate count for the *current* vault, we'd technically need to decrypt everything.
  // For the privacy screen, returning a slightly inflated count isn't terrible, but
  // let's actually just decrypt and count to preserve deniability.
  const key = requireKey();
  const records = await getDB().records.filter((r) => !r.deletedAt).toArray();
  let count = 0;
  for (const r of records) {
    try {
      await decryptRecord(r.payload, key);
      count++;
    } catch (e) {
      // Ignored
    }
  }
  return count;
}

// ─── Local File Backup & Restore (.shezen file) ───────────────────────────────

export interface SheZenBackupFile {
  format: "shezen-encrypted-vault";
  version: 1;
  exportedAt: string;
  wrappedKey: WrappedKey;
  records: LocalRecord[];
}

export async function exportLocalVaultFile(): Promise<SheZenBackupFile> {
  const db = getDB();
  const wrappedKey = await loadWrappedKey();
  if (!wrappedKey) throw new Error("Vault not found.");
  const records = await db.records.toArray();

  return {
    format: "shezen-encrypted-vault",
    version: 1,
    exportedAt: new Date().toISOString(),
    wrappedKey,
    records,
  };
}

export async function importLocalVaultFile(
  backup: SheZenBackupFile,
  passcode: string
): Promise<{ recordCount: number }> {
  if (backup.format !== "shezen-encrypted-vault" || !backup.wrappedKey) {
    throw new Error("Invalid SheZen backup file format.");
  }

  // Validate the passcode against the backup's wrappedKey
  const { unlockVault, setSessionMasterKey } = await import("@/lib/crypto");
  const masterKey = await unlockVault(passcode, backup.wrappedKey);

  // Save the imported wrapped key as our local vault
  const db = getDB();
  await saveWrappedKey(backup.wrappedKey);
  setSessionMasterKey(masterKey);

  // Import all records
  if (Array.isArray(backup.records) && backup.records.length > 0) {
    await db.records.bulkPut(backup.records);
  }

  return { recordCount: backup.records?.length || 0 };
}
