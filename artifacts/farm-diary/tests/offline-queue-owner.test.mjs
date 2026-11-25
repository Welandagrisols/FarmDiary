import assert from "node:assert/strict";
import test from "node:test";
import {
  assignUnownedQueueItems,
  queueItemsForUser,
} from "../lib/offline-queue-owner.ts";

test("offline writes remain visible only to their account", () => {
  const queue = [
    { id: "a", user_id: "user-a" },
    { id: "b", user_id: "user-b" },
    { id: "legacy" },
  ];

  assert.deepEqual(queueItemsForUser(queue, "user-a").map((item) => item.id), ["a", "legacy"]);
  assert.deepEqual(queueItemsForUser(queue, "user-b").map((item) => item.id), ["b", "legacy"]);
});

test("sign-out assigns old unowned writes to the account that created them", () => {
  const owned = assignUnownedQueueItems([
    { id: "a", user_id: "user-a" },
    { id: "legacy" },
  ], "user-a");

  assert.deepEqual(owned, [
    { id: "a", user_id: "user-a" },
    { id: "legacy", user_id: "user-a" },
  ]);
});
