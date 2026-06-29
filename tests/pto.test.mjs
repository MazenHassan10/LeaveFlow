import assert from "node:assert/strict";
import {
  ORIGINAL_ADMIN_EMAIL,
  approveRequest,
  buildRequest,
  calculateHours,
  canAccessAdmin,
  getRoleForLogin,
  verifyMakeupEntry
} from "../src/pto.js";

assert.equal(calculateHours("09:00", "13:30"), 4.5);
assert.equal(calculateHours("13:00", "09:00"), 0);

const owner = getRoleForLogin(ORIGINAL_ADMIN_EMAIL);
assert.equal(owner.role, "Admin");
assert.equal(owner.status, "Active");
assert.equal(canAccessAdmin(owner), true);

const pending = getRoleForLogin("new.person@example.com");
assert.equal(pending.status, "Pending");

const request = buildRequest({
  employeeId: "employee-1",
  type: "Additional Time Off",
  reason: "Appointment",
  todayISO: "2026-06-27",
  segments: [
    { date: "2026-07-01", startTime: "09:00", endTime: "12:00" },
    { date: "2026-07-02", startTime: "14:00", endTime: "16:00" }
  ],
  makeupEntries: [
    { date: "2026-07-10", startTime: "09:00", endTime: "14:00" }
  ]
});

assert.equal(request.totalRequestedHours, 5);
assert.equal(request.totalMakeupHours, 5);
assert.equal(request.isLateNotice, true);
assert.equal(request.requiresMakeupPlan, true);

const ptoRequest = buildRequest({
  employeeId: "employee-1",
  type: "PTO",
  reason: "Family need",
  todayISO: "2026-06-27",
  segments: [{ date: "2026-07-20", startTime: "09:00", endTime: "13:00" }],
  makeupEntries: []
});

const approval = approveRequest(
  ptoRequest,
  { annualAllowanceHours: 48, usedHours: 8, remainingHours: 40 },
  ORIGINAL_ADMIN_EMAIL
);
assert.equal(approval.balance.usedHours, 12);
assert.equal(approval.balance.remainingHours, 36);
assert.equal(approval.request.status, "Approved");

const verified = verifyMakeupEntry(request.makeupEntries[0], "Worked", ORIGINAL_ADMIN_EMAIL);
assert.equal(verified.verificationStatus, "Worked");
assert.equal(verified.verifiedBy, ORIGINAL_ADMIN_EMAIL);

console.log("PTO policy tests passed.");
