import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const {
  createTimeOffRequest,
  deleteRequest,
  getSnapshot,
  setRequestStatus
} = await import("../src/lib/app-data");

const admin: UserProfile = {
  id: "delete-admin",
  authUserId: "delete-admin",
  email: "delete-admin@example.com",
  fullName: "Delete Admin",
  role: "Admin",
  status: "Active",
  protectedOwner: false
};

const employee: UserProfile = {
  id: "delete-employee",
  authUserId: "delete-employee",
  email: "delete-employee@example.com",
  fullName: "Delete Employee",
  role: "Employee",
  status: "Active",
  protectedOwner: false
};

function requestForm(type: string, date: string, start: string, end: string) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", "Delete test");
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  return data;
}

await createTimeOffRequest(employee, requestForm("PTO", "2026-07-01", "09:00", "12:00"));
await createTimeOffRequest(employee, requestForm("PTO", "2026-07-02", "09:00", "11:00"));

let snapshot = await getSnapshot();
const ptoRequests = snapshot.requests.filter((request) => request.employeeId === employee.id && request.requestType === "PTO");
assert.equal(ptoRequests.length, 2);

await setRequestStatus(admin, ptoRequests[0].id, "Approved");
await setRequestStatus(admin, ptoRequests[1].id, "Approved");

snapshot = await getSnapshot();
assert.equal(snapshot.balances[employee.id].usedHours, 5);
assert.equal(snapshot.balances[employee.id].remainingHours, 43);

const threeHourRequest = ptoRequests.find((request) => request.totalRequestedHours === 3);
assert.ok(threeHourRequest);

await deleteRequest(admin, threeHourRequest.id);
snapshot = await getSnapshot();
assert.equal(snapshot.requests.some((request) => request.id === threeHourRequest.id), false);
assert.equal(snapshot.balances[employee.id].usedHours, 2);
assert.equal(snapshot.balances[employee.id].remainingHours, 46);

await assert.rejects(() => deleteRequest(employee, ptoRequests[1].id), /Admin access required/);

console.log("Delete request tests passed.");
