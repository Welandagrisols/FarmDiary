import assert from "node:assert/strict";
import test from "node:test";
import { savePendingRecords } from "../lib/save-pending-records.ts";
import { formatWriteError } from "../lib/write-error-message.ts";

const closedSeasonMessage = "This crop cycle is closed.";

test("write errors preserve server details alongside the screen fallback", () => {
  const message = formatWriteError(
    new Error("new row violates row-level security policy"),
    "Could not save cost.",
    closedSeasonMessage,
  );

  assert.equal(
    message,
    "Could not save cost.\n\nDetails: new row violates row-level security policy",
  );
});

test("network write errors explain that entries remain available for retry", () => {
  const message = formatWriteError(
    new Error("fetch failed"),
    "Could not save harvest.",
    closedSeasonMessage,
  );

  assert.match(message, /Check your connection and try again/);
  assert.match(message, /entries are still on this screen/);
});

test("closed-season write errors keep the specific reopening instruction", () => {
  const message = formatWriteError(
    new Error(closedSeasonMessage),
    "Could not save cost.",
    closedSeasonMessage,
  );

  assert.equal(message, closedSeasonMessage);
});

test("retrying a partially saved sequence skips completed records", async () => {
  const records = ["labour", "inputs", "transport"];
  const completed = new Set();
  const calls = [];
  let failInputsOnce = true;
  const save = async (record, index) => {
    calls.push(record);
    if (index === 1 && failInputsOnce) {
      failInputsOnce = false;
      throw new Error("temporary write failure");
    }
  };

  await assert.rejects(savePendingRecords(records, completed, save), /temporary write failure/);
  assert.deepEqual([...completed], [0]);
  assert.deepEqual(calls, ["labour", "inputs"]);

  await savePendingRecords(records, completed, save);
  assert.deepEqual(calls, ["labour", "inputs", "inputs", "transport"]);
  assert.deepEqual([...completed], [0, 1, 2]);
});
