import assert from "node:assert/strict";
import type { AppSnapshot, TimeOffRequest, UserProfile } from "../src/lib/app-data";
import { buildSummaryRows } from "../src/lib/payroll-export";
import { buildReportCalendarEvents, buildShortNames } from "../src/lib/report-calendar";
import { buildMonthSummary } from "../src/lib/report-summary";

const P = (id: string, fullName: string, role: UserProfile["role"] = "Employee", status: UserProfile["status"] = "Active"): UserProfile =>
  ({ id, authUserId: id, email: `${id}@example.com`, fullName, role, status, protectedOwner: false });
const adam = P("adam", "Adam Masrawy");
const moI = P("mo-i", "Mohamed Ibrahim");
const moO = P("mo-o", "Mohamed Osama");
const boss = P("boss", "SCOPES Health", "Admin");

let n = 0;
type M = [string, string, string, "Pending" | "Worked" | "Not Worked"];
function R(emp: UserProfile, status: TimeOffRequest["status"], type: TimeOffRequest["requestType"], date: string, hours: [string, string], makeup: M[] = []): TimeOffRequest {
  const id = `r${++n}`;
  const h = (a: string, b: string) => Number(b.slice(0, 2)) - Number(a.slice(0, 2));
  return {
    id, employeeId: emp.id, requestType: type, reason: "", totalRequestedHours: h(...hours), totalMakeupHours: 0,
    isLateNotice: false, requiresMakeupPlan: type !== "PTO", status, submittedAt: "2026-10-01T00:00:00Z", approverEmail: null, approvedAt: null,
    segments: [{ id: `${id}s`, requestId: id, date, startTime: hours[0], endTime: hours[1], requestedHours: h(...hours) }],
    makeupEntries: makeup.map((m, i) => ({ id: `${id}m${i}`, requestId: id, date: m[0], startTime: m[1], endTime: m[2], plannedHours: h(m[1], m[2]), verificationStatus: m[3] })),
  } as TimeOffRequest;
}

const snapshot = {
  profiles: [adam, moI, moO, boss],
  balances: { adam: { employeeId: "adam", calendarYear: 2026, annualAllowanceHours: 48, usedHours: 4, remainingHours: 44, expiresOn: "2026-12-31" } },
  requests: [
    R(adam, "Approved", "Additional Time Off", "2026-11-05", ["09:00", "17:00"], [
      ["2026-11-02", "08:00", "10:00", "Pending"],   // past, still pending -> to mark
      ["2026-11-03", "08:00", "11:00", "Worked"],
      ["2026-11-04", "08:00", "09:00", "Not Worked"],
      ["2026-11-20", "08:00", "10:00", "Pending"],   // still ahead -> not to mark yet
      ["2026-12-01", "08:00", "10:00", "Pending"],   // next month
    ]),
    R(adam, "Approved", "PTO", "2026-11-12", ["09:00", "13:00"]),
    R(adam, "Pending", "PTO", "2026-11-13", ["09:00", "17:00"]),
    R(moI, "Approved", "PTO", "2026-11-09", ["09:00", "17:00"]),
    R(moO, "Rejected", "PTO", "2026-11-09", ["09:00", "17:00"]),
  ],
  auditEvents: [],
} as unknown as AppSnapshot;

const today = "2026-11-10";
const { rows, totals } = buildMonthSummary(snapshot, "2026-11", { today });
const adamRow = rows.find((row) => row.profile.id === "adam")!;
assert.equal(adamRow.offHours, 12);
assert.equal(adamRow.ptoHours, 4);
assert.equal(adamRow.additionalHours, 8);
assert.equal(adamRow.makeupCount, 4, "only November make-ups");
assert.equal(adamRow.makeupPlannedHours, 8);
assert.equal(adamRow.makeupWorkedHours, 3);
assert.equal(adamRow.notWorkedCount, 1);
assert.equal(adamRow.toMark, 1, "only past pending shifts need marking");
assert.equal(adamRow.balance?.remainingHours, 44);
assert.equal(rows.some((row) => row.profile.id === "boss"), false, "admins without tracked PTO are left out");

assert.deepEqual(totals, {
  offHours: 20, ptoHours: 12, otherOffHours: 8, peopleOff: 2,
  makeupPlannedHours: 8, makeupWorkedHours: 3, makeupCount: 4, notWorkedCount: 1, toMark: 1,
});

// The CSV export reads the same numbers.
const csv = buildSummaryRows(snapshot, "2026-11");
const adamCsv = csv.find((row) => row[0] === "Adam Masrawy")!;
assert.deepEqual(adamCsv.slice(4), [4, 8, 0, 12, 8, 3, 1, 4, 44]);

// One person.
const onlyMo = buildMonthSummary(snapshot, "2026-11", { personId: "mo-i", today });
assert.deepEqual(onlyMo.rows.map((row) => row.profile.id), ["mo-i"]);
assert.equal(onlyMo.totals.offHours, 8);
assert.equal(onlyMo.totals.toMark, 0);

// Short names stay unique when first names repeat.
const names = buildShortNames(snapshot.profiles);
assert.equal(names.get("adam"), "Adam");
assert.equal(names.get("mo-i"), "Mohamed I.");
assert.equal(names.get("mo-o"), "Mohamed O.");

// Calendar events carry what the filters and the day panel need.
const events = buildReportCalendarEvents(snapshot);
const makeupEvent = events.find((event) => event.id === "makeup-r1m1")!;
assert.equal(makeupEvent.employeeId, "adam");
assert.equal(makeupEvent.makeupStatus, "Worked");
assert.equal(makeupEvent.requestType, "Additional Time Off");
assert.equal(events.find((event) => event.type === "off" && event.employeeId === "mo-i")?.makeupStatus, undefined);

console.log("Report summary tests passed.");
