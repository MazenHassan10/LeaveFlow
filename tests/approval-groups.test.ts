import assert from "node:assert/strict";
import { buildApprovalGroups } from "../src/lib/approval-groups";
import type { TimeOffRequest } from "../src/lib/app-data";

function request(id: string, status: TimeOffRequest["status"]): TimeOffRequest {
  return {
    id,
    employeeId: "employee-id",
    requestType: "PTO",
    reason: "",
    totalRequestedHours: 2,
    totalMakeupHours: 0,
    isLateNotice: false,
    requiresMakeupPlan: false,
    status,
    submittedAt: "2026-07-01T00:00:00.000Z",
    segments: [],
    makeupEntries: [],
  };
}

const groups = buildApprovalGroups([
  request("pending-1", "Pending"),
  request("approved-1", "Approved"),
  request("approved-2", "Approved"),
  request("rejected-1", "Rejected"),
  request("cancelled-1", "Cancelled"),
]);

assert.deepEqual(groups.map((group) => group.key), ["pending", "approved", "rejected", "cancelled"]);
assert.deepEqual(groups.map((group) => group.requests.length), [1, 2, 1, 1]);
assert.equal(groups[0].title, "Pending approvals");
assert.equal(groups[1].empty, "No approved requests.");
// Employee-cancelled requests stay visible to admins in their own group.
assert.equal(groups[3].title, "Cancelled by employee");
assert.deepEqual(groups[3].requests.map((item) => item.id), ["cancelled-1"]);

console.log("Approval grouping tests passed.");
