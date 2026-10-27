import assert from "node:assert/strict";
import type { AppSnapshot, TimeOffRequest, UserProfile } from "../src/lib/app-data";
import {
  buildAttentionCounts,
  buildMakeupRows,
  DEFAULT_ADMIN_FILTERS,
  groupByPersonAndReason,
  hasActiveFilters,
  offWindow,
  parseAdminTab,
  profileMatches
} from "../src/lib/admin-workspace";

const profile = (id: string, fullName: string, status: UserProfile["status"] = "Active", role: UserProfile["role"] = "Employee"): UserProfile =>
  ({ id, authUserId: id, email: `${id}@example.com`, fullName, role, status, protectedOwner: false });

function req(id: string, employeeId: string, status: TimeOffRequest["status"], date: string, reason: string,
  makeup: Array<[string, "Pending" | "Worked" | "Not Worked"]> = []): TimeOffRequest {
  return {
    id, employeeId, requestType: "Additional Time Off", reason, totalRequestedHours: 8, totalMakeupHours: 8 * makeup.length,
    isLateNotice: false, requiresMakeupPlan: true, status, submittedAt: "2026-10-01T00:00:00Z",
    segments: [{ id: `${id}-s`, requestId: id, date, startTime: "09:00", endTime: "17:00", requestedHours: 8 }],
    makeupEntries: makeup.map(([d, v], i) => ({ id: `${id}-m${i}`, requestId: id, date: d, startTime: "09:00", endTime: "17:00", plannedHours: 8, verificationStatus: v })),
  };
}

const today = "2026-10-27";
const viewer = "mazen";
const snapshot = {
  profiles: [profile("adam", "Adam Masrawy"), profile("mo", "Mohamed Ibrahim"), profile("mazen", "Mazen Hassan", "Active", "Manager"), profile("new", "New Person", "Pending")],
  balances: {},
  requests: [
    req("a1", "adam", "Pending", "2026-11-03", "Midterm exams"),
    req("a2", "adam", "Pending", "2026-10-28", "Midterm exams "),
    req("a3", "adam", "Pending", "2026-11-20", "Dentist"),
    req("m1", "mo", "Approved", "2026-10-29", "Wedding", [["2026-10-26", "Pending"], ["2026-11-02", "Pending"], ["2026-10-20", "Worked"]]),
    req("z1", "mazen", "Pending", "2026-11-05", "Trip"),
    req("z2", "mazen", "Approved", "2026-10-02", "Exam", [["2026-10-09", "Pending"]]),
  ],
  auditEvents: [],
} as unknown as AppSnapshot;

// Tabs and filters
assert.equal(parseAdminTab("makeups"), "makeups");
assert.equal(parseAdminTab("nope"), "requests");
assert.equal(parseAdminTab(undefined), "requests");
assert.equal(hasActiveFilters(DEFAULT_ADMIN_FILTERS), false);
assert.equal(hasActiveFilters({ ...DEFAULT_ADMIN_FILTERS, query: " x " }), true);
assert.equal(profileMatches(snapshot.profiles[0], { ...DEFAULT_ADMIN_FILTERS, query: "masraw" }), true);
assert.equal(profileMatches(snapshot.profiles[0], { ...DEFAULT_ADMIN_FILTERS, employeeId: "mo" }), false);

// Grouping: same person + same reason (case/space-insensitive), sorted by date
const pending = snapshot.requests.filter((r) => r.status === "Pending");
const groups = groupByPersonAndReason(pending, snapshot.profiles);
assert.deepEqual(groups.map((g) => `${g.employee?.fullName}|${g.reason}|${g.requests.map((r) => r.id).join(",")}`), [
  "Adam Masrawy|Midterm exams|a2,a1",
  "Mazen Hassan|Trip|z1",
  "Adam Masrawy|Dentist|a3",
]);
assert.equal(groups[0].offHours, 16);

// Make-ups: due = past + unmarked on approved requests; own flagged
const rows = buildMakeupRows(snapshot, DEFAULT_ADMIN_FILTERS, viewer, today);
assert.deepEqual(rows.due.map((r) => `${r.employee?.fullName} ${r.entry.date} own=${r.isOwn}`), [
  "Mazen Hassan 2026-10-09 own=true",
  "Mohamed Ibrahim 2026-10-26 own=false",
]);
assert.deepEqual(rows.upcoming.map((r) => r.entry.date), ["2026-11-02"]);
assert.equal(buildMakeupRows(snapshot, { ...DEFAULT_ADMIN_FILTERS, month: "2026-11" }, viewer, today).due.length, 0, "month filter applies to make-up dates");

// Off window
assert.deepEqual(offWindow(today, "any"), { from: "2026-10-27", to: "2026-11-02", label: "Off this week" });
assert.deepEqual(offWindow(today, "2026-11"), { from: "2026-11-01", to: "2026-11-30", label: "Off in November" });

// Attention counts: own items excluded from to-dos; every number follows the filters
let counts = buildAttentionCounts(snapshot, DEFAULT_ADMIN_FILTERS, viewer, today);
assert.deepEqual(counts, { requestsToDecide: 3, makeupsToMark: 1, newSignups: 1, offCount: 1, offLabel: "Off this week" });
counts = buildAttentionCounts(snapshot, { ...DEFAULT_ADMIN_FILTERS, employeeId: "adam" }, viewer, today);
assert.deepEqual([counts.requestsToDecide, counts.makeupsToMark, counts.newSignups, counts.offCount], [3, 0, 0, 0]);
counts = buildAttentionCounts(snapshot, { ...DEFAULT_ADMIN_FILTERS, query: "midterm" }, viewer, today);
assert.equal(counts.requestsToDecide, 2);
counts = buildAttentionCounts(snapshot, { ...DEFAULT_ADMIN_FILTERS, month: "2026-11" }, viewer, today);
assert.equal(counts.requestsToDecide, 2, "Nov pending, excluding the viewer's own");
assert.equal(counts.offLabel, "Off in November");

console.log("Admin workspace tests passed.");
