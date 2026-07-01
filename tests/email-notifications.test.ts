import assert from "node:assert/strict";
import { buildDayBeforeReminderEmail, buildNewRequestEmail, buildRequestDecisionEmail } from "../src/lib/email";
import type { TimeOffRequest, UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const {
  createTimeOffRequest,
  ensureProfile,
  getSnapshot,
  setRequestStatus,
  updateProfile
} = await import("../src/lib/app-data");
const {
  sendDayBeforeAdminReminders,
  shouldSendDayBeforeReminders
} = await import("../src/lib/reminders");

const admin: UserProfile = {
  id: "admin-id",
  authUserId: "admin-auth",
  email: "admin@example.com",
  fullName: "Admin User",
  role: "Admin",
  status: "Active",
  protectedOwner: false
};

const employee: UserProfile = {
  id: "employee-id",
  authUserId: "employee-auth",
  email: "employee@example.com",
  fullName: "Employee User",
  role: "Employee",
  status: "Active",
  protectedOwner: false
};

const request: TimeOffRequest = {
  id: "request-id",
  employeeId: employee.id,
  requestType: "PTO",
  reason: "Family appointment",
  totalRequestedHours: 4,
  totalMakeupHours: 0,
  isLateNotice: false,
  requiresMakeupPlan: false,
  status: "Pending",
  submittedAt: "2026-07-01T16:00:00.000Z",
  segments: [
    { id: "segment-id", requestId: "request-id", date: "2026-07-02", startTime: "09:00", endTime: "13:00", requestedHours: 4 }
  ],
  makeupEntries: []
};

const newRequestEmail = buildNewRequestEmail([admin], employee, request);
assert.ok(newRequestEmail);
assert.deepEqual(newRequestEmail.to, ["admin@example.com"]);
assert.equal(newRequestEmail.subject, "New LeaveFlow request from Employee User");
assert.match(newRequestEmail.text, /Family appointment/);
assert.match(newRequestEmail.text, /9:00 AM-1:00 PM/);
assert.match(newRequestEmail.text, /\/admin/);

const approvedEmail = buildRequestDecisionEmail(employee, {
  ...request,
  status: "Approved",
  approverEmail: "admin@example.com"
});
assert.deepEqual(approvedEmail.to, ["employee@example.com"]);
assert.equal(approvedEmail.subject, "Your LeaveFlow request was approved");
assert.match(approvedEmail.text, /Approver: admin@example.com/);
assert.match(approvedEmail.text, /\/employee/);

const reminderEmail = buildDayBeforeReminderEmail(admin, "2026-07-02", [
  {
    id: "event-id",
    date: "2026-07-02",
    type: "makeup",
    employeeName: "Employee User",
    employeeEmail: "employee@example.com",
    startTime: "18:00",
    endTime: "20:00",
    hours: 2
  }
]);
assert.deepEqual(reminderEmail.to, ["admin@example.com"]);
assert.match(reminderEmail.text, /Make-up: Employee User/);
assert.match(reminderEmail.text, /6:00 PM-8:00 PM/);

assert.equal(shouldSendDayBeforeReminders(new Date("2026-07-01T15:00:00.000Z")), true);
assert.equal(shouldSendDayBeforeReminders(new Date("2026-07-01T14:00:00.000Z")), false);

const owner = await ensureProfile({ id: "email-owner", email: "apatel@scopeshealthcare.com", name: "Owner Admin" });
const reminderEmployee = await ensureProfile({ id: "email-employee", email: "email.employee@example.com", name: "Email Employee" });
await updateProfile(owner, reminderEmployee.id, "Employee", "Active");

const form = new FormData();
form.set("requestType", "PTO");
form.set("segmentDate", "2026-07-02");
form.set("segmentStart", "09:00");
form.set("segmentEnd", "13:00");
form.set("reason", "Reminder coverage");

await createTimeOffRequest(reminderEmployee, form);
const duplicate = await createTimeOffRequest(reminderEmployee, form);
assert.deepEqual(duplicate, { status: "duplicate" });

const snapshot = await getSnapshot();
const reminderRequest = snapshot.requests.find((item) => item.employeeId === reminderEmployee.id && item.reason === "Reminder coverage");
assert.ok(reminderRequest);
await setRequestStatus(owner, reminderRequest.id, "Approved");

const firstReminder = await sendDayBeforeAdminReminders(new Date("2026-07-01T15:00:00.000Z"));
assert.equal(firstReminder.skipped, false);
assert.equal(firstReminder.events, 1);

const secondReminder = await sendDayBeforeAdminReminders(new Date("2026-07-01T15:00:00.000Z"));
assert.equal(secondReminder.skipped, false);
assert.equal(secondReminder.sent, 0);

console.log("Email notification tests passed.");
