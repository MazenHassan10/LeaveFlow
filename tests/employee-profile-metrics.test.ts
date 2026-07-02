import assert from "node:assert/strict";
import { buildEmployeeProfileMetrics } from "../src/lib/employee-profile-metrics";
import type { MakeupEntry, TimeOffRequest } from "../src/lib/app-data";

function makeup(id: string, status: MakeupEntry["verificationStatus"], date: string): MakeupEntry {
  return {
    id,
    requestId: "request-id",
    date,
    startTime: "18:00",
    endTime: "20:00",
    plannedHours: 2,
    verificationStatus: status,
  };
}

function request(
  id: string,
  requestType: TimeOffRequest["requestType"],
  status: TimeOffRequest["status"],
  hours: number,
  makeupEntries: MakeupEntry[] = []
): TimeOffRequest {
  return {
    id,
    employeeId: "employee-id",
    requestType,
    reason: "",
    totalRequestedHours: hours,
    totalMakeupHours: makeupEntries.reduce((total, entry) => total + entry.plannedHours, 0),
    isLateNotice: false,
    requiresMakeupPlan: requestType !== "PTO",
    status,
    submittedAt: "2026-07-01T00:00:00.000Z",
    segments: [],
    makeupEntries: makeupEntries.map((entry) => ({ ...entry, requestId: id })),
  };
}

const metrics = buildEmployeeProfileMetrics([
  request("approved-additional", "Additional Time Off", "Approved", 3, [
    makeup("worked-1", "Worked", "2026-07-05"),
    makeup("pending-1", "Pending", "2026-07-06"),
  ]),
  request("pending-additional", "Additional Time Off", "Pending", 4, [
    makeup("worked-ignored-parent", "Worked", "2026-07-07"),
  ]),
  request("rejected-additional", "Additional Time Off", "Rejected", 5),
  request("approved-pto", "PTO", "Approved", 2, [
    makeup("worked-2", "Worked", "2026-07-08"),
    makeup("not-worked-1", "Not Worked", "2026-07-09"),
  ]),
  request("approved-emergency", "Emergency/Exception", "Approved", 1, [
    makeup("worked-3", "Worked", "2026-07-10"),
    makeup("worked-4", "Worked", "2026-07-11"),
  ]),
]);

assert.equal(metrics.approvedAdditionalTimeOffHours, 3);
assert.equal(metrics.approvedAdditionalTimeOffCount, 1);
assert.equal(metrics.pendingMakeupReviewCount, 1);
assert.deepEqual(metrics.workedMakeupDates.map((entry) => entry.id), ["worked-4", "worked-3", "worked-2"]);
assert.equal(metrics.extraWorkedMakeupDateCount, 1);
assert.equal(metrics.workedMakeupDates.some((entry) => entry.id === "worked-ignored-parent"), false);
assert.equal(metrics.workedMakeupDates.some((entry) => entry.id === "not-worked-1"), false);

console.log("Employee profile metrics tests passed.");
