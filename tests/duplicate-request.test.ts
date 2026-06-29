import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const {
  canonicalDuplicateKey,
  createTimeOffRequest,
  deleteRequest,
  getSnapshot
} = await import("../src/lib/app-data");

const admin: UserProfile = {
  id: "duplicate-admin",
  authUserId: "duplicate-admin",
  email: "duplicate-admin@example.com",
  fullName: "Duplicate Admin",
  role: "Admin",
  status: "Active",
  protectedOwner: false
};

const employee: UserProfile = {
  id: "duplicate-employee",
  authUserId: "duplicate-employee",
  email: "duplicate-employee@example.com",
  fullName: "Duplicate Employee",
  role: "Employee",
  status: "Active",
  protectedOwner: false
};

const duplicateKeyPayload = {
  requestType: "Additional Time Off" as const,
  reason: "Same reason",
  segmentDate: "2026-08-01",
  segmentStart: "09:00",
  segmentEnd: "11:00",
  requestedHours: 2,
  makeupEntries: [
    { date: "2026-08-09", startTime: "12:00", endTime: "13:00", plannedHours: 1 },
    { date: "2026-08-08", startTime: "12:00", endTime: "14:00", plannedHours: 2 }
  ]
};

assert.equal(
  canonicalDuplicateKey(employee.id, duplicateKeyPayload),
  canonicalDuplicateKey(employee.id, {
    ...duplicateKeyPayload,
    makeupEntries: [...duplicateKeyPayload.makeupEntries].reverse()
  })
);

function form(reason = "Same reason", makeupEnd = "14:00") {
  const data = new FormData();
  data.set("requestType", "Additional Time Off");
  data.set("reason", reason);
  data.set("segmentDate", "2026-08-01");
  data.set("segmentStart", "09:00");
  data.set("segmentEnd", "11:00");
  data.append("makeupDate", "2026-08-08");
  data.append("makeupStart", "12:00");
  data.append("makeupEnd", makeupEnd);
  return data;
}

assert.deepEqual(await createTimeOffRequest(employee, form()), { status: "created" });
assert.deepEqual(await createTimeOffRequest(employee, form()), { status: "duplicate" });

let snapshot = await getSnapshot();
assert.equal(snapshot.requests.filter((request) => request.employeeId === employee.id).length, 1);

assert.deepEqual(await createTimeOffRequest(employee, form("Different reason")), { status: "created" });
assert.deepEqual(await createTimeOffRequest(employee, form("Same reason", "15:00")), { status: "created" });

snapshot = await getSnapshot();
assert.equal(snapshot.requests.filter((request) => request.employeeId === employee.id).length, 3);

const originalRequest = snapshot.requests.find((request) => request.employeeId === employee.id && request.reason === "Same reason" && request.totalMakeupHours === 2);
assert.ok(originalRequest);
await deleteRequest(admin, originalRequest.id);

assert.deepEqual(await createTimeOffRequest(employee, form()), { status: "created" });

console.log("Duplicate request tests passed.");
