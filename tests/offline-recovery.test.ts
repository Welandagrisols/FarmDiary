import assert from "node:assert/strict";
import test from "node:test";
import { applyOfflineMutation } from "../lib/offline-mutations";
import { processOfflineQueue, PendingSyncItem } from "../lib/offline-sync";

const queueItem = (
  id: string,
  operation: PendingSyncItem["operation"],
  data: Record<string, unknown>,
  retries = 0,
): PendingSyncItem => ({
  id,
  table: "costs",
  operation,
  data,
  retries,
  timestamp: 1,
});

test("queued inserts are idempotent and updates preserve the cached record", () => {
  type CostRow = { id: string; farm_id?: string; amount_kes?: number; notes?: string };
  const original: CostRow = { id: "cost-1", farm_id: "farm-a", amount_kes: 100, notes: "seed" };
  const inserted = applyOfflineMutation<CostRow>([], "insert", original);
  const repeatedInsert = applyOfflineMutation<CostRow>(inserted.rows, "insert", original);
  const updated = applyOfflineMutation<CostRow>(repeatedInsert.rows, "update", {
    id: "cost-1",
    notes: "fertilizer",
  });

  assert.equal(repeatedInsert.rows.length, 1);
  assert.deepEqual(updated.record, {
    id: "cost-1",
    farm_id: "farm-a",
    amount_kes: 100,
    notes: "fertilizer",
  });
});

test("queued deletes remove the matching record", () => {
  const rows: { id: string; farm_id?: string }[] = [
    { id: "cost-1", farm_id: "farm-a" },
    { id: "cost-2", farm_id: "farm-a" },
  ];

  assert.deepEqual(
    applyOfflineMutation(rows, "delete", { id: "cost-1" }).rows,
    [{ id: "cost-2", farm_id: "farm-a" }],
  );
});

test("reconnect sync keeps global FIFO order across tables", async () => {
  const queue = [
    { ...queueItem("farm-1", "insert", { id: "farm-1" }), table: "farms" },
    { ...queueItem("season-1", "insert", { id: "season-1" }), table: "seasons" },
    queueItem("cost-1", "insert", { id: "cost-1" }),
  ];
  const events: string[] = [];

  const result = await processOfflineQueue(queue, {
    syncItem: async (item) => { events.push(`sync:${item.id}`); },
    removeFromQueue: async (id) => { events.push(`remove:${id}`); },
    incrementRetry: async (id) => { events.push(`retry:${id}`); },
    addToDeadLetter: async (item) => { events.push(`dead:${item.id}`); },
  });

  assert.equal(result.failed, false);
  assert.equal(result.synced, 3);
  assert.deepEqual(events, [
    "sync:farm-1", "remove:farm-1",
    "sync:season-1", "remove:season-1",
    "sync:cost-1", "remove:cost-1",
  ]);
});

test("a network failure leaves the current and later items queued without using retry attempts", async () => {
  const queue = [
    queueItem("cost-1", "insert", { id: "cost-1" }),
    queueItem("cost-2", "insert", { id: "cost-2" }),
  ];
  const events: string[] = [];

  const result = await processOfflineQueue(queue, {
    syncItem: async (item) => {
      events.push(`sync:${item.id}`);
      throw new TypeError("Network request failed");
    },
    removeFromQueue: async (id) => { events.push(`remove:${id}`); },
    incrementRetry: async (id) => { events.push(`retry:${id}`); },
    addToDeadLetter: async (item) => { events.push(`dead:${item.id}`); },
  });

  assert.equal(result.failed, true);
  assert.deepEqual(events, ["sync:cost-1"]);
});

test("dead-letter persistence succeeds before the item is removed", async () => {
  const item = queueItem("cost-1", "insert", { id: "cost-1" }, 5);
  const events: string[] = [];

  const result = await processOfflineQueue([item], {
    syncItem: async () => { throw new Error("must not sync"); },
    removeFromQueue: async (id) => { events.push(`remove:${id}`); },
    incrementRetry: async () => { throw new Error("must not retry"); },
    addToDeadLetter: async (queued) => { events.push(`dead:${queued.id}`); },
  });

  assert.equal(result.failed, false);
  assert.deepEqual(result.droppedTables, ["costs"]);
  assert.deepEqual(events, ["dead:cost-1", "remove:cost-1"]);

  const failedPersistence = await processOfflineQueue([item], {
    syncItem: async () => { throw new Error("must not sync"); },
    removeFromQueue: async (id) => { events.push(`removed-unrecoverable:${id}`); },
    incrementRetry: async () => undefined,
    addToDeadLetter: async () => { throw new Error("storage full"); },
  });
  assert.equal(failedPersistence.failed, true);
  assert.equal(events.includes("removed-unrecoverable:cost-1"), false);
});
