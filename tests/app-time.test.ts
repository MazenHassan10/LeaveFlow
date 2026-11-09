import assert from "node:assert/strict";
import {
  APP_TIME_ZONE,
  formatCivilDate,
  formatDateLabelInLosAngeles,
  formatTime12Hour,
  formatTimeRange12Hour,
  losAngelesDateTime,
  losAngelesHour,
  shiftHasEnded,
  losAngelesDate,
  losAngelesMonth,
  losAngelesYear,
  tomorrowInLosAngeles,
  yearInLosAngeles
} from "../src/lib/app-time";

assert.equal(APP_TIME_ZONE, "America/Los_Angeles");
assert.equal(formatCivilDate(2026, 7, 4), "2026-07-04");
assert.equal(losAngelesDate(new Date("2026-07-01T06:30:00.000Z")), "2026-06-30");
assert.equal(losAngelesMonth(new Date("2026-07-01T06:30:00.000Z")), "2026-06");
assert.equal(losAngelesYear(new Date("2027-01-01T07:30:00.000Z")), 2026);
assert.equal(losAngelesHour(new Date("2026-07-01T15:00:00.000Z")), 8);
assert.equal(tomorrowInLosAngeles(new Date("2026-07-01T15:00:00.000Z")), "2026-07-02");
assert.equal(yearInLosAngeles("2027-01-01T07:30:00.000Z"), 2026);
assert.equal(formatDateLabelInLosAngeles("2026-07-04"), "Jul 4");
assert.equal(formatTime12Hour("09:00"), "9:00 AM");
assert.equal(formatTime12Hour("13:00"), "1:00 PM");
assert.equal(formatTime12Hour("00:00"), "12:00 AM");
assert.equal(formatTime12Hour("12:00"), "12:00 PM");
assert.equal(formatTime12Hour("24:00"), "12:00 AM"); // end-of-day marker reads as midnight
assert.equal(formatTimeRange12Hour("09:00", "17:00"), "9:00 AM-5:00 PM");
assert.equal(formatTimeRange12Hour("19:00", "24:00"), "7:00 PM-12:00 AM");

console.log("App timezone tests passed.");

// Make-up shifts become markable once their end time passes in Pacific time.
assert.equal(losAngelesDateTime(new Date("2026-11-16T01:00:00.000Z")), "2026-11-15 17:00");
assert.equal(shiftHasEnded("2026-11-15", "17:00", new Date("2026-11-16T00:59:00.000Z")), false, "4:59 PM PT: not yet");
assert.equal(shiftHasEnded("2026-11-15", "17:00", new Date("2026-11-16T01:00:00.000Z")), true, "5:00 PM PT: ended");
assert.equal(shiftHasEnded("2026-11-15", "17:00", "2026-11-15 16:59"), false);
assert.equal(shiftHasEnded("2026-11-15", "17:00", "2026-11-16"), true, "a bare date is the start of that day");
assert.equal(shiftHasEnded("2026-11-15", "17:00", "2026-11-15"), false);
assert.equal(shiftHasEnded("2026-11-15", "24:00", "2026-11-15 23:59"), false, "midnight end");
assert.equal(shiftHasEnded("2026-11-15", "24:00", "2026-11-16 00:00"), true);
// Cairo is ahead: 1 AM Monday in Cairo is still Sunday 3 PM in LA, so a 9-5 PT Sunday shift has not ended.
assert.equal(shiftHasEnded("2026-11-15", "17:00", new Date("2026-11-15T23:00:00.000Z")), false);
