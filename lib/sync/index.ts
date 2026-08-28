/**
 * lib/sync/index.ts
 * Client-side sync engine: push local records to server, pull server updates.
 * Uses last-write-wins by updatedAt. All data remains ciphertext throughout.
 */

import { getDB } from "@/lib/local-db";
import type { LocalRecord } from "@/lib/local-db";

export interface SyncBlob {
  id: string;
  ciphertext: string;
  nonce: string;
  recordType: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export type SyncStatus = "idle" | "syncing" | "error" | "success";

/** Push all local records that have been modified since lastSyncAt to the server. */
export async function pushToServer(lastSyncAt?: number): Promise<void> {
  // Get all local records (including soft-deleted) modified since last sync.
  // We access IndexedDB directly here since we need raw encrypted payloads.
  const db = (await import("@/lib/local-db")).getDB();
  const records = await db.records
    .filter((r) => !lastSyncAt || r.updatedAt > lastSyncAt)
    .toArray();

  if (records.length === 0) return;

  const blobs: SyncBlob[] = records.map((r) => ({
    id: r.id,
    ciphertext: r.payload.ciphertext,
    nonce: r.payload.iv,
    recordType: r.type,
    updatedAt: new Date(r.updatedAt).toISOString(),
    deletedAt: r.deletedAt ? new Date(r.deletedAt).toISOString() : null,
  }));

  const res = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blobs }),
  });

  if (!res.ok) {
    throw new Error(`Sync push failed: ${res.status}`);
  }
}

/** Pull updates from server since lastSyncAt, merge with local (last-write-wins). */
export async function pullFromServer(lastSyncAt?: number): Promise<number> {
  const params = lastSyncAt ? `?since=${new Date(lastSyncAt).toISOString()}` : "";
  const res = await fetch(`/api/sync/pull${params}`);

  if (!res.ok) {
    throw new Error(`Sync pull failed: ${res.status}`);
  }

  const { blobs }: { blobs: SyncBlob[] } = await res.json();

  if (blobs.length === 0) return 0;

  const db = (await import("@/lib/local-db")).getDB();

  for (const blob of blobs) {
    const serverUpdatedAt = new Date(blob.updatedAt).getTime();
    const local = await db.records.get(blob.id);

    if (!local || local.updatedAt <= serverUpdatedAt) {
      // Server wins (newer or we don't have it)
      await db.records.put({
        id: blob.id,
        type: (blob.recordType ?? "vault") as LocalRecord["type"],
        payload: { ciphertext: blob.ciphertext, iv: blob.nonce },
        date: blob.updatedAt.split("T")[0],
        updatedAt: serverUpdatedAt,
        deletedAt: blob.deletedAt ? new Date(blob.deletedAt).getTime() : undefined,
      });
    }
    // If local is newer, local already wins — push will send our version to server.
  }

  return blobs.length;
}

/** Full bi-directional sync. Returns number of records synced. */
export async function syncAll(lastSyncAt?: number): Promise<number> {
  await pushToServer(lastSyncAt);
  return pullFromServer(lastSyncAt);
}
