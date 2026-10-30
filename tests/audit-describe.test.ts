import assert from "node:assert/strict";
import { losAngelesDate } from "../src/lib/app-time";

process.env.DATABASE_URL = "";

const app = await import("../src/lib/app-data");
const { buildEmailAliases, describeAuditEvent, activityCategory } = await import("../src/lib/audit-labels");

const admin = await app.ensureProfile({ id: "ad-admin", email: "ad-admin@example.com", name: "Ana Admin" });
admin.role = "Admin";
admin.status = "Active";
const emp = await app.ensureProfile({ id: "ad-emp", email: "ad-emp@example.com", name: "Eve Employee" });
await app.updateProfile(admin, emp.id, "Employee", "Active");
emp.status = "Active";

function form(type: string, reason: string, date: string, start: string, end: string, makeup: [string, string, string][] = []) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", reason);
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  for (const [d, s, e] of makeup) { data.append("makeupDate", d); data.append("makeupStart", s); data.append("makeupEnd", e); }
  return data;
}
const byReason = async (reason: string) => (await app.getSnapshot()).requests.find((r) => r.reason === reason)!;

await app.createTimeOffRequest(emp, form("Additional Time Off", "exam", "2026-12-10", "09:00", "17:00", [["2026-12-13", "09:00", "17:00"]]));
const exam = await byReason("exam");
await app.setRequestStatus(admin, exam.id, "Approved", "Good luck!");
await app.adminUpdateRequest(admin, exam.id, form("Additional Time Off", "exam", "2026-12-11", "09:00", "17:00", [["2026-12-13", "09:00", "17:00"]]));
const entryId = (await byReason("exam")).makeupEntries[0].id;
await app.verifyMakeup(admin, entryId, "Worked");
await app.updatePtoAllowance(admin, emp.id, 40);
await app.createTimeOffRequest(emp, form("PTO", "trip", "2026-12-20", "09:00", "13:00"));
const trip = await byReason("trip");
await app.setRequestStatus(admin, trip.id, "Rejected", "Short-staffed");
await app.deleteRequest(admin, trip.id);
await app.changeProfileEmail(admin, emp.id, "eve.new@example.com");

// The month query returns this month's events, newest first.
const month = losAngelesDate().slice(0, 7);
const events = await app.getAuditEventsForMonth(month);
assert.ok(events.length >= 8);
assert.equal(events[0].action, "admin.profile_email_changed");
assert.deepEqual(await app.getAuditEventsForMonth("2001-01"), []);
assert.deepEqual(await app.getAuditEventsForMonth("not-a-month"), []);

const snapshot = await app.getSnapshot();
const say = (action: string) => {
  const event = events.find((item) => item.action === action);
  assert.ok(event, `missing ${action}`);
  const line = describeAuditEvent(event!, snapshot);
  return { sentence: `${line.actor} ${line.text}`, detail: line.detail, line };
};

assert.equal(say("admin.request_approved").sentence, "Ana Admin approved Eve Employee's request for Fri, Dec 11");
assert.equal(say("admin.request_approved").detail, "Note: Good luck!");
const edited = say("admin.request_updated");
assert.equal(edited.sentence, "Ana Admin edited Eve Employee's request for Fri, Dec 11");
assert.equal(edited.detail, "Thu, Dec 10, 9:00 AM-5:00 PM → Fri, Dec 11, 9:00 AM-5:00 PM");
assert.equal(say("admin.makeup_worked").sentence, "Ana Admin marked Eve Employee's make-up shift on Sun, Dec 13 as worked");
assert.equal(say("admin.pto_allowance_updated").sentence, "Ana Admin changed Eve Employee's PTO allowance");
assert.match(say("admin.pto_allowance_updated").detail ?? "", /48h → 40h for \d{4}/);
assert.equal(say("admin.request_rejected").detail, "Reason: Short-staffed");
// The rejected request was deleted afterwards: both events still name the person and the date.
assert.equal(say("admin.request_rejected").sentence, "Ana Admin rejected a request");
const deleted = say("admin.request_deleted");
assert.equal(deleted.sentence, "Ana Admin deleted Eve Employee's request for Sun, Dec 20");
assert.equal(deleted.detail, "It was rejected");
assert.equal(say("admin.profile_email_changed").detail, "ad-emp@example.com → eve.new@example.com");
// The first submission (the exam request, which still exists) is linked to the employee.
const firstSubmitEvent = events.filter((event) => event.action === "employee.request_submitted").at(-1)!;
// Without the alias map the old email shows; with it, her current name does.
assert.equal(describeAuditEvent(firstSubmitEvent, snapshot).actor, "ad-emp@example.com");
const firstSubmit = describeAuditEvent(firstSubmitEvent, snapshot, buildEmailAliases(events));
assert.equal(firstSubmit.actorId, emp.id);
assert.equal(firstSubmit.subjectId, emp.id);
assert.equal(`${firstSubmit.actor} ${firstSubmit.text}`, "Eve Employee submitted a request for Fri, Dec 11");

// Old events without details still read as sentences.
const bare = describeAuditEvent({ id: "x", actorEmail: "ad-admin@example.com", action: "admin.request_deleted", targetType: "time_off_request", targetId: "gone", createdAt: new Date().toISOString() }, snapshot);
assert.equal(`${bare.actor} ${bare.text}`, "Ana Admin deleted a request");

assert.equal(activityCategory("admin.request_approved"), "decisions");
assert.equal(activityCategory("employee.request_cancelled"), "requests");
assert.equal(activityCategory("admin.makeup_not_worked"), "makeup");
assert.equal(activityCategory("admin.profile_email_changed"), "people");

console.log("Audit describe tests passed.");
