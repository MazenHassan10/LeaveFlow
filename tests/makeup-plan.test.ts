import assert from "node:assert/strict";
import { parseMakeupEntries } from "../src/lib/app-data";

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

assert.throws(
  () => parseMakeupEntries(formData([["2026-07-10", "09:00", ""]])),
  /Each make-up row needs/
);

assert.throws(
  () => parseMakeupEntries(formData([["2026-07-10", "13:00", "09:00"]])),
  /valid start and end/
);

console.log("Make-up plan parsing tests passed.");
