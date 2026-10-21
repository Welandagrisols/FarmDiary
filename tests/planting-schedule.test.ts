import assert from "node:assert/strict";
import test from "node:test";
import { CROP_TEMPLATES, generatePlannedSchedule } from "../constants/farmData";

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

test("each planting block gets its own complete schedule and planting-relative dates", () => {
  const template = CROP_TEMPLATES[0];
  const blocks = [
    { id: "planting-upper", name: "Upper Field", planting_date: "2026-03-01", acres: 1.25 },
    { id: "planting-river", name: "River Plot", planting_date: "2026-03-18", acres: 2.5 },
    { id: "planting-home", name: "Home Plot", planting_date: "2026-04-02", acres: 0.75 },
  ];

  const schedule = generatePlannedSchedule(template, blocks);

  assert.equal(schedule.length, template.stages.length * blocks.length);
  assert.equal(new Set(schedule.map((activity) => activity.id)).size, schedule.length);

  for (const block of blocks) {
    const activities = schedule.filter((activity) => activity.blockId === block.id);
    assert.equal(activities.length, template.stages.length);
    assert.ok(activities.every((activity) => activity.blockName === block.name));

    const firstStage = template.stages[0];
    const firstActivity = activities.find((activity) => activity.stage === firstStage.title);
    assert.ok(firstActivity);
    assert.equal(
      firstActivity.plannedDate,
      addDays(block.planting_date, firstStage.offsetDays),
    );
  }
});
