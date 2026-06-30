import assert from "node:assert/strict";
import { parseMakeupEntries } from "../src/lib/app-data";
import { calculateHours } from "../src/lib/pto";
import { SHIFT_PRESETS, shiftPresetFor } from "../src/lib/shift-presets";

function formData(rows: Array<[string, string, string]>) {
  const data = new FormData();

  for (const [date, start, end] of rows) {
    data.append("makeupDate", date);
    data.append("makeupStart", start);
    data.append("makeupEnd", end);
  }

  return data;
}

const entries = parseMakeupEntries(formData([
  ["2026-07-10", "09:00", "11:30"],
  ["", "", ""],
  ["2026-07-11", "13:00", "15:00"]
]));

assert.equal(entries.length, 2);
assert.equal(entries[0].plannedHours, 2.5);
assert.equal(entries[1].plannedHours, 2);

const expectedPresetHours = new Map([
  ["full-day", 8],
  ["first-half", 4],
  ["second-half", 4],
  ["first-two", 2],
  ["second-two", 2],
  ["third-two", 2],
  ["fourth-two", 2],
]);

for (const preset of SHIFT_PRESETS) {
  if (preset.value === "custom") continue;
  assert.equal(calculateHours(preset.startTime, preset.endTime), preset.hours);
  assert.equal(preset.hours, expectedPresetHours.get(preset.value));
}

const fullDay = shiftPresetFor("full-day");
const presetEntries = parseMakeupEntries(formData([["2026-07-12", fullDay.startTime, fullDay.endTime]]));
assert.equal(presetEntries[0].plannedHours, 8);
assert.equal(shiftPresetFor("unknown").value, "custom");

assert.throws(
  () => parseMakeupEntries(formData([["2026-07-10", "09:00", ""]])),
  /Each make-up row needs/
);

assert.throws(
  () => parseMakeupEntries(formData([["2026-07-10", "13:00", "09:00"]])),
  /valid start and end/
);

console.log("Make-up plan parsing tests passed.");
