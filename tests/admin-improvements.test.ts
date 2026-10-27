import assert from "node:assert/strict";
import type { AppSnapshot, TimeOffRequest, UserProfile } from "../src/lib/app-data";
import { buildAdminReminderEmail, buildEmployeeReminderEmail, buildRequestDecisionEmail } from "../src/lib/email";
import { buildApprovalGroups, DEFAULT_APPROVAL_FILTERS, filterApprovalGroups, requestMonths } from "../src/lib/approval-groups";
import { auditActionLabel } from "../src/lib/audit-labels";
import { buildDetailRows, buildSummaryRows, toCsv } from "../src/lib/payroll-export";

process.env.DATABASE_URL = "";
const { createTimeOffRequest, ensureProfile, getSnapshot, normalizeDecisionNote, setRequestStatus, updateProfile } =
  await import("../src/lib/app-data");

const admin: UserProfile = { id: "ai-admin", authUserId: "ai-admin", email: "ana@example.com", fullName: "Ana Admin", role: "Admin", status: "Active", protectedOwner: false };

// ---------- Decision notes ----------
assert.throws(() => normalizeDecisionNote("Rejected", "   "), /short reason for the rejection/);
assert.equal(normalizeDecisionNote("Approved", "  "), null);
assert.equal(normalizeDecisionNote("Rejected", "  Short   staffed  "), "Short staffed");
assert.throws(() => normalizeDecisionNote("Approved", "x".repeat(501)), /500 characters/);

const employee = await ensureProfile({ id: "ai-emp", email: "emp@example.com", name: "Jordan" });
await updateProfile(admin, employee.id, "Employee", "Active");
employee.status = "Active";
const form = (reason: string, date: string) => {
  const data = new FormData();
  data.set("requestType", "PTO"); data.set("reason", reason); data.set("segmentDate", date);
  data.set("segmentStart", "09:00"); data.set("segmentEnd", "13:00");
  return data;
};
await createTimeOffRequest(employee, form("note test", "2026-11-03"));
const pending = (await getSnapshot()).requests.find((r) => r.reason === "note test")!;
await assert.rejects(() => setRequestStatus(admin, pending.id, "Rejected"), /short reason/);
await setRequestStatus(admin, pending.id, "Rejected", "We're short-staffed that week.");
const decided = (await getSnapshot()).requests.find((r) => r.id === pending.id)!;
assert.equal(decided.status, "Rejected");
assert.equal(decided.approverComment, "We're short-staffed that week.");
await assert.rejects(() => setRequestStatus(admin, pending.id, "Approved"), /already been decided/);

const decisionEmail = buildRequestDecisionEmail(employee, decided, "Ana Admin");
assert.match(decisionEmail.html, /Note from Ana Admin/);
assert.match(decisionEmail.html, /short-staffed that week/);
assert.match(decisionEmail.html, /Hi Jordan,/);
assert.match(decisionEmail.text, /Decided by: Ana Admin/);
assert.match(decisionEmail.text, /Tue, Nov 3/, "weekday dates in emails");

// ---------- Reminder polish ----------
const event = { id: "e", date: "2026-10-30", type: "makeup" as const, employeeName: "Jordan", employeeEmail: "emp@example.com", startTime: "08:00", endTime: "09:00", hours: 1 };
const adminReminder = buildAdminReminderEmail(admin, "2026-10-30", [event], 4);
assert.match(adminReminder.html, /Hi Ana Admin,/);
assert.match(adminReminder.text, /in 4 days \(Fri, Oct 30\)/);
assert.match(adminReminder.html, /width:92px;white-space:nowrap;[^>]*>\s*Make-up/, "Type column is wide and does not wrap");
const employeeReminder = buildEmployeeReminderEmail({ name: "Jordan", email: "emp@example.com" }, "2026-10-30", [event], 1);
assert.match(employeeReminder.html, /Hi Jordan,/);
assert.match(employeeReminder.html, /Fri, Oct 30/);

// ---------- Audit labels ----------
assert.equal(auditActionLabel("admin.request_approved"), "Approved a request");
assert.equal(auditActionLabel("employee.request_cancelled"), "Cancelled their request");
assert.equal(auditActionLabel("something.new"), "something.new");
const { auditTargetLabel } = await import("../src/lib/audit-labels");
assert.equal(auditTargetLabel("time_off_request"), "Request");

// ---------- Approval filters ----------
function req(id: string, employeeId: string, status: TimeOffRequest["status"], date: string, reason = "", makeup?: string): TimeOffRequest {
  return {
    id, employeeId, requestType: "Additional Time Off", reason, totalRequestedHours: 8, totalMakeupHours: 8,
    isLateNotice: false, requiresMakeupPlan: true, status, submittedAt: "2026-01-01T00:00:00Z",
    segments: [{ id: `${id}-s`, requestId: id, date, startTime: "09:00", endTime: "17:00", requestedHours: 8 }],
    makeupEntries: makeup ? [{ id: `${id}-m`, requestId: id, date: makeup, startTime: "09:00", endTime: "17:00", plannedHours: 8, verificationStatus: "Worked" }] : [],
  };
}
const profiles = [
  { id: "a", fullName: "Adam Masrawy", email: "marketing@scopeshealthcare.com" },
  { id: "m", fullName: "Mohamed Ibrahim", email: "mohamed@example.com" },
];
const requests = [
  req("p-old", "a", "Pending", "2026-05-01", "Midterm exams"),
  req("a-old", "m", "Approved", "2026-06-10", "Wedding", "2026-06-20"),
  req("a-recent", "a", "Approved", "2026-10-20", "Midterm exams"),
  req("a-next", "m", "Approved", "2026-12-02", "Trip", "2026-12-12"),
  req("r-recent", "m", "Rejected", "2026-10-10", "Travel"),
];
const recentFrom = "2026-09-27"; // 30 days before Oct 27
const groups = buildApprovalGroups(requests);
const ids = (filtered: ReturnType<typeof filterApprovalGroups>, key: string) => filtered.find((g) => g.key === key)!.requests.map((r) => r.id);

let filtered = filterApprovalGroups(groups, DEFAULT_APPROVAL_FILTERS, profiles, recentFrom);
assert.deepEqual(ids(filtered, "pending"), ["p-old"], "pending is never hidden by recency");
assert.deepEqual(ids(filtered, "approved"), ["a-recent", "a-next"], "old decided requests hidden by default");
assert.equal(filtered.find((g) => g.key === "approved")!.total, 3);
filtered = filterApprovalGroups(groups, { ...DEFAULT_APPROVAL_FILTERS, showAll: true }, profiles, recentFrom);
assert.deepEqual(ids(filtered, "approved"), ["a-old", "a-recent", "a-next"]);
filtered = filterApprovalGroups(groups, { ...DEFAULT_APPROVAL_FILTERS, employeeId: "m", showAll: true }, profiles, recentFrom);
assert.deepEqual(ids(filtered, "approved"), ["a-old", "a-next"]);
filtered = filterApprovalGroups(groups, { ...DEFAULT_APPROVAL_FILTERS, month: "2026-06", showAll: true }, profiles, recentFrom);
assert.deepEqual(ids(filtered, "approved"), ["a-old"], "month matches days off and make-up dates");
filtered = filterApprovalGroups(groups, { ...DEFAULT_APPROVAL_FILTERS, query: "MIDTERM" }, profiles, recentFrom);
assert.deepEqual([...ids(filtered, "pending"), ...ids(filtered, "approved")], ["p-old", "a-recent"], "search is case-insensitive on reason");
filtered = filterApprovalGroups(groups, { ...DEFAULT_APPROVAL_FILTERS, query: "mohamed@" }, profiles, recentFrom);
assert.deepEqual(ids(filtered, "rejected"), ["r-recent"], "search matches email");
assert.deepEqual(requestMonths(requests), ["2026-12", "2026-10", "2026-06", "2026-05"]);

// ---------- CSV export ----------
const snapshot = {
  profiles: [
    { id: "a", authUserId: "a", email: "marketing@scopeshealthcare.com", fullName: "Adam Masrawy", role: "Employee", status: "Active", protectedOwner: false },
    { id: "x", authUserId: "x", email: "evil@example.com", fullName: "=HYPERLINK(\"http://bad\")", role: "Employee", status: "Active", protectedOwner: false },
    { id: "o", authUserId: "o", email: "owner@example.com", fullName: "Owner", role: "Admin", status: "Active", protectedOwner: true },
  ],
  balances: { a: { employeeId: "a", calendarYear: 2026, annualAllowanceHours: 48, usedHours: 4, remainingHours: 44, expiresOn: "2026-12-31" } },
  requests: [
    { ...req("pto", "a", "Approved", "2026-11-02", "Dentist, \"quick\""), requestType: "PTO", makeupEntries: [] },
    { ...req("add", "a", "Approved", "2026-11-04", "Midterm", "2026-11-08"),
      makeupEntries: [
        { id: "m1", requestId: "add", date: "2026-11-08", startTime: "09:00", endTime: "17:00", plannedHours: 8, verificationStatus: "Worked" },
        { id: "m2", requestId: "add", date: "2026-11-09", startTime: "08:00", endTime: "09:00", plannedHours: 1, verificationStatus: "Pending" },
        { id: "m3", requestId: "add", date: "2026-12-01", startTime: "08:00", endTime: "09:00", plannedHours: 1, verificationStatus: "Pending" },
      ] },
    req("pending-ignored", "a", "Pending", "2026-11-20"),
  ],
  auditEvents: [],
} as unknown as AppSnapshot;
snapshot.requests[0].segments[0] = { ...snapshot.requests[0].segments[0], endTime: "13:00", requestedHours: 4 };

const summary = buildSummaryRows(snapshot, "2026-11");
const adam = summary.find((row) => row[0] === "Adam Masrawy")!;
// PTO 4, Additional 8, Emergency 0, total 12; make-up planned 9 (Dec excluded), worked 8, not worked 0, unmarked 1; PTO left 44
assert.deepEqual(adam.slice(4), [4, 8, 0, 12, 9, 8, 0, 1, 44]);
assert.equal(summary.some((row) => row[0] === "Owner"), false, "owner account excluded");

const detail = buildDetailRows(snapshot, "2026-11");
assert.deepEqual(detail.slice(1).map((row) => `${row[0]} ${row[4]}`), ["2026-11-02 Day off", "2026-11-04 Day off", "2026-11-08 Make-up", "2026-11-09 Make-up"]);
assert.equal(detail[4][9], "Not yet marked");

const csv = toCsv(summary);
assert.ok(csv.startsWith("﻿"), "BOM for Excel");
assert.match(csv, /"'=HYPERLINK\(""http:\/\/bad""\)"/, "formula neutralized and quotes escaped");
assert.match(toCsv(detail), /"Dentist, ""quick"""/, "commas and quotes escaped");

console.log("Admin improvement tests passed.");

// ---------- Verifying a make-up shift that doesn't exist fails cleanly ----------
{
  const { verifyMakeup } = await import("../src/lib/app-data");
  await assert.rejects(() => verifyMakeup(admin, "no-such-entry", "Worked"), /no longer exists/);
  console.log("Missing make-up verification test passed.");
}
