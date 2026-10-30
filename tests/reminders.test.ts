import assert from "node:assert/strict";
import { buildAdminReminderEmail, buildEmployeeReminderEmail } from "../src/lib/email";
import type { ReportCalendarEvent } from "../src/lib/report-calendar";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const { createTimeOffRequest, ensureProfile, setRequestStatus, getSnapshot, updateProfile } = await import("../src/lib/app-data");
const { REMINDER_LEAD_DAYS, sendScheduledReminders, shouldSendReminders } = await import("../src/lib/reminders");

assert.deepEqual([...REMINDER_LEAD_DAYS], [4, 1]);
// 8 AM Pacific: 15:00 UTC in summer (PDT), 16:00 UTC in winter (PST).
assert.equal(shouldSendReminders(new Date("2026-07-01T15:00:00.000Z")), true);
assert.equal(shouldSendReminders(new Date("2026-11-04T16:00:00.000Z")), true);
assert.equal(shouldSendReminders(new Date("2026-11-04T15:00:00.000Z")), false);

// Email content.
const admin: UserProfile = {
  id: "rem-admin", authUserId: "rem-admin", email: "rem-admin@example.com", fullName: "Rem Admin",
  role: "Admin", status: "Active", protectedOwner: false
};
const makeup: ReportCalendarEvent = {
  id: "m1", date: "2026-11-08", type: "makeup", employeeName: "Jordan", employeeEmail: "jordan@example.com",
  startTime: "09:00", endTime: "17:00", hours: 8, requestId: "r", employeeId: "e", requestType: "Additional Time Off" as const, reason: ""
};
const adminFourDay = buildAdminReminderEmail(admin, "2026-11-08", [makeup], 4);
assert.equal(adminFourDay.subject, "LeaveFlow reminder: time off and make-up plans in 4 days");
assert.match(adminFourDay.text, /in 4 days/);
assert.match(adminFourDay.text, /Make-up: Jordan \(jordan@example.com\), 9:00 AM-5:00 PM \(8h\)/);

const employeeDayBefore = buildEmployeeReminderEmail({ name: "Jordan", email: "jordan@example.com" }, "2026-11-08", [makeup], 1);
assert.deepEqual(employeeDayBefore.to, ["jordan@example.com"]);
assert.equal(employeeDayBefore.subject, "LeaveFlow reminder: your make-up work tomorrow");
assert.match(employeeDayBefore.html, /Make-up shift reminder/);
assert.match(employeeDayBefore.text, /9:00 AM-5:00 PM PT \(8h\)/);

const offFourDay = buildEmployeeReminderEmail(
  { name: "Jordan", email: "jordan@example.com" }, "2026-11-08", [{ ...makeup, type: "off" }], 4
);
assert.equal(offFourDay.subject, "LeaveFlow reminder: your time off in 4 days");

// Scheduler: a day off tomorrow and a make-up shift in 4 days, both approved.
const owner = await ensureProfile({ id: "rem-owner", email: "admin@leaveflow.local", name: "Owner" });
const employee = await ensureProfile({ id: "rem-emp", email: "rem.employee@example.com", name: "Rem Employee" });
await updateProfile(owner, employee.id, "Employee", "Active");

const form = new FormData();
form.set("requestType", "Additional Time Off");
form.set("reason", "Reminder schedule");
form.set("segmentDate", "2026-11-05");
form.set("segmentStart", "09:00");
form.set("segmentEnd", "17:00");
form.append("makeupDate", "2026-11-08");
form.append("makeupStart", "09:00");
form.append("makeupEnd", "17:00");
await createTimeOffRequest(employee, form);
const request = (await getSnapshot()).requests.find((r) => r.reason === "Reminder schedule");
assert.ok(request);
await setRequestStatus(owner, request.id, "Approved");

// Wed Nov 4, 8 AM PST: tomorrow = Nov 5 (day off), +4 days = Nov 8 (make-up).
const now = new Date("2026-11-04T16:00:00.000Z");
const first = await sendScheduledReminders(now);
assert.equal(first.skipped, false);
const fourDay = first.leads.find((lead) => lead.daysAhead === 4);
const oneDay = first.leads.find((lead) => lead.daysAhead === 1);
assert.deepEqual({ date: fourDay?.date, events: fourDay?.events }, { date: "2026-11-08", events: 1 });
assert.deepEqual({ date: oneDay?.date, events: oneDay?.events }, { date: "2026-11-05", events: 1 });
// Each lead reaches the admin(s) and the employee (in-memory mode records attempts as not sent).
const admins = (await getSnapshot()).profiles.filter((p) => (p.role === "Admin" || p.role === "Manager") && p.status === "Active").length;
assert.equal(fourDay!.sent + fourDay!.failed, admins + 1);
assert.equal(oneDay!.sent + oneDay!.failed, admins + 1);

// Second run in the same hour sends nothing again.
const second = await sendScheduledReminders(now);
assert.equal(second.sent + second.failed, 0);

// Outside 8 AM Pacific nothing runs.
assert.equal((await sendScheduledReminders(new Date("2026-11-04T18:00:00.000Z"))).skipped, true);

console.log("Reminder tests passed.");
