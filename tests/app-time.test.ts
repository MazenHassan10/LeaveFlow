import assert from "node:assert/strict";
import {
  APP_TIME_ZONE,
  formatCivilDate,
  formatDateLabelInLosAngeles,
  formatTime12Hour,
  formatTimeRange12Hour,
  losAngelesDate,
  losAngelesMonth,
  losAngelesYear,
  yearInLosAngeles
} from "../src/lib/app-time";

assert.equal(APP_TIME_ZONE, "America/Los_Angeles");
assert.equal(formatCivilDate(2026, 7, 4), "2026-07-04");
assert.equal(losAngelesDate(new Date("2026-07-01T06:30:00.000Z")), "2026-06-30");
assert.equal(losAngelesMonth(new Date("2026-07-01T06:30:00.000Z")), "2026-06");
assert.equal(losAngelesYear(new Date("2027-01-01T07:30:00.000Z")), 2026);
assert.equal(yearInLosAngeles("2027-01-01T07:30:00.000Z"), 2026);
assert.equal(formatDateLabelInLosAngeles("2026-07-04"), "Jul 4");
assert.equal(formatTime12Hour("09:00"), "9:00 AM");
assert.equal(formatTime12Hour("13:00"), "1:00 PM");
assert.equal(formatTime12Hour("00:00"), "12:00 AM");
assert.equal(formatTime12Hour("12:00"), "12:00 PM");
assert.equal(formatTimeRange12Hour("09:00", "17:00"), "9:00 AM-5:00 PM");

console.log("App timezone tests passed.");
