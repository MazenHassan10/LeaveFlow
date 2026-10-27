import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";
import { buildNewRequestEmail } from "../src/lib/email";
import { formatPacificRangeIn, formatPacificTimeIn } from "../src/lib/app-time";

process.env.DATABASE_URL = "";

const {
  cancelRequest, createTimeOffRequest, ensureProfile, getSnapshot, setRequestStatus,
  updatePendingRequest, updateProfile, updatePtoAllowance
} = await import("../src/lib/app-data");
const { buildUpcomingEvents, groupEmployeeRequests } = await import("../src/lib/employee-schedule");

const admin: UserProfile = {
  id: "er-admin", authUserId: "er-admin", email: "er-admin@example.com", fullName: "ER Admin",
  role: "Admin", status: "Active", protectedOwner: false
};
const alice = await ensureProfile({ id: "er-alice", email: "alice@example.com", name: "Alice" });
const bob = await ensureProfile({ id: "er-bob", email: "bob@example.com", name: "Bob" });
for (const person of [alice, bob]) {
  await updateProfile(admin, person.id, "Employee", "Active");
  person.status = "Active";
}

type Makeup = [string, string, string];
function form(type: string, reason: string, date: string, start: string, end: string, makeup: Makeup[] = []) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", reason);
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  for (const [d, s, e] of makeup) {
    data.append("makeupDate", d);
    data.append("makeupStart", s);
    data.append("makeupEnd", e);
  }
  return data;
}
const byReason = async (reason: string) => (await getSnapshot()).requests.find((r) => r.reason === reason)!;

// --- Make-up hours must cover the hours off (Additional / Emergency) ---
await assert.rejects(
  () => createTimeOffRequest(alice, form("Additional Time Off", "short", "2026-12-01", "09:00", "17:00", [["2026-12-06", "09:00", "15:00"]])),
  /covers 6h but you're taking 8h off\. Add 2h more/
);
await createTimeOffRequest(alice, form("Emergency/Exception", "covered", "2026-12-02", "09:00", "13:00",
  [["2026-12-06", "09:00", "11:00"], ["2026-12-07", "08:00", "10:00"]]));
assert.equal((await byReason("covered")).totalMakeupHours, 4);

// --- Cancel ---
await createTimeOffRequest(alice, form("PTO", "trip", "2026-12-10", "09:00", "17:00"));
const trip = await byReason("trip");
await assert.rejects(() => cancelRequest(bob, trip.id), /only cancel your own requests/);
await cancelRequest(alice, trip.id);
const cancelled = await byReason("trip");
assert.equal(cancelled.status, "Cancelled");
assert.ok(cancelled.cancelledAt);
await assert.rejects(() => cancelRequest(alice, trip.id), /Only pending requests can be cancelled/);
// A cancelled request no longer blocks submitting the same request again.
assert.deepEqual(await createTimeOffRequest(alice, form("PTO", "trip", "2026-12-10", "09:00", "17:00")), { status: "created" });

// --- Edit ---
await createTimeOffRequest(alice, form("Additional Time Off", "exam", "2026-12-14", "09:00", "17:00", [["2026-12-20", "09:00", "17:00"]]));
const exam = await byReason("exam");
await assert.rejects(() => updatePendingRequest(bob, exam.id, form("PTO", "exam", "2026-12-14", "09:00", "13:00")), /only edit your own requests/);
await assert.rejects(
  () => updatePendingRequest(alice, exam.id, form("Additional Time Off", "exam", "2026-12-14", "09:00", "17:00", [["2026-12-20", "09:00", "12:00"]])),
  /covers 3h but you're taking 8h off/
);
const edited = await updatePendingRequest(alice, exam.id, form("Additional Time Off", "exam (half day)", "2026-12-15", "13:00", "17:00",
  [["2026-12-20", "08:00", "10:00"], ["2026-12-21", "08:00", "10:00"]]));
assert.deepEqual(edited, { status: "updated" });
const afterEdit = (await getSnapshot()).requests.find((r) => r.id === exam.id)!;
assert.equal(afterEdit.status, "Pending");
assert.ok(afterEdit.editedAt);
assert.equal(afterEdit.reason, "exam (half day)");
assert.deepEqual(afterEdit.segments.map((s) => [s.date, s.startTime, s.endTime]), [["2026-12-15", "13:00", "17:00"]]);
assert.deepEqual(afterEdit.makeupEntries.map((m) => m.date), ["2026-12-20", "2026-12-21"]);
assert.equal(afterEdit.totalRequestedHours, 4);
// Editing into an exact copy of another of your requests is reported as a duplicate.
assert.deepEqual(
  await updatePendingRequest(alice, exam.id, form("Emergency/Exception", "covered", "2026-12-02", "09:00", "13:00",
    [["2026-12-06", "09:00", "11:00"], ["2026-12-07", "08:00", "10:00"]])),
  { status: "duplicate" }
);
// Approved requests can no longer be edited or cancelled by the employee.
await setRequestStatus(admin, exam.id, "Approved");
await assert.rejects(() => updatePendingRequest(alice, exam.id, form("PTO", "x", "2026-12-15", "09:00", "10:00")), /Only pending requests can be edited/);
await assert.rejects(() => cancelRequest(alice, exam.id), /Only pending requests can be cancelled/);

// PTO balance applies to edits too.
await updatePtoAllowance(admin, bob.id, 4);
await createTimeOffRequest(bob, form("PTO", "bob pto", "2026-12-03", "09:00", "11:00"));
const bobPtoId = (await byReason("bob pto")).id;
await assert.rejects(() => updatePendingRequest(bob, bobPtoId, form("PTO", "bob pto", "2026-12-03", "09:00", "17:00")), /needs 8h of PTO but only 4h is left/);

// --- Grouping and the Upcoming list ---
const snapshot = await getSnapshot();
const aliceRequests = snapshot.requests.filter((r) => r.employeeId === alice.id);
const groups = groupEmployeeRequests(aliceRequests, "2026-12-01");
assert.ok(groups.pending.every((r) => r.status === "Pending"));
assert.ok(groups.upcoming.some((r) => r.id === exam.id), "approved request with future dates is upcoming");
assert.ok(groups.past.some((r) => r.status === "Cancelled"), "cancelled requests go to past/closed");
assert.deepEqual(groups.pending.map((r) => r.segments[0].date), [...groups.pending.map((r) => r.segments[0].date)].sort());

const aliceSnapshot = { ...snapshot, profiles: snapshot.profiles.filter((p) => p.id === alice.id), requests: aliceRequests };
const upcoming = buildUpcomingEvents(aliceSnapshot, "2026-12-01");
assert.deepEqual(upcoming.map((e) => `${e.type}:${e.date}`), ["off:2026-12-15", "makeup:2026-12-20", "makeup:2026-12-21"], "approved only, soonest first");
assert.deepEqual(buildUpcomingEvents(aliceSnapshot, "2026-12-16").map((e) => e.date), ["2026-12-20", "2026-12-21"], "past days drop off");
assert.equal(buildUpcomingEvents(aliceSnapshot, "2026-10-01", 30).length, 0, "outside the 30-day window");

// --- Pacific -> Cairo, across both daylight-saving changes ---
assert.equal(formatPacificTimeIn("2026-10-28", "09:00"), "7:00 PM Cairo");
assert.equal(formatPacificTimeIn("2026-10-30", "09:00"), "6:00 PM Cairo");
assert.equal(formatPacificRangeIn("2026-11-08", "09:00", "17:00"), "7:00 PM – 3:00 AM Cairo (+1 day)");
assert.equal(formatPacificRangeIn("", "09:00", "17:00"), "");

// --- Admin emails for edits and cancellations ---
const request = (await getSnapshot()).requests.find((r) => r.id === exam.id)!;
const updatedMail = buildNewRequestEmail([admin], alice, request, "updated")!;
assert.equal(updatedMail.subject, "Updated LeaveFlow request from Alice");
assert.match(updatedMail.html, /Request updated/);
const cancelledMail = buildNewRequestEmail([admin], alice, request, "cancelled")!;
assert.equal(cancelledMail.subject, "Alice cancelled a LeaveFlow request");
assert.match(cancelledMail.text, /No action is needed/);

console.log("Employee request tests passed.");
