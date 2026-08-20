import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const {
  createTimeOffRequest,
  deleteProfile,
  ensureProfile,
  getSnapshot,
  setRequestStatus
} = await import("../src/lib/app-data");

const admin: UserProfile = {
  id: "delete-user-admin",
  authUserId: "delete-user-admin",
  email: "delete-user-admin@example.com",
  fullName: "Delete User Admin",
  role: "Admin",
  status: "Active",
  protectedOwner: false
};

// Seed the employee through ensureProfile so it lives in the in-memory store,
// then activate it so it can file requests.
const employee = await ensureProfile({
  id: "delete-user-employee-auth",
  email: "delete-user-employee@example.com",
  name: "Delete User Employee"
});
employee.status = "Active";

function requestForm(type: string, date: string, start: string, end: string) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", "Delete user test");
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  return data;
}

await createTimeOffRequest(employee, requestForm("PTO", "2026-08-03", "09:00", "12:00"));
const created = await getSnapshot();
const employeeRequest = created.requests.find((request) => request.employeeId === employee.id);
assert.ok(employeeRequest, "employee request should exist before delete");

await setRequestStatus(admin, employeeRequest.id, "Approved");

let snapshot = await getSnapshot();
assert.ok(snapshot.profiles.some((profile) => profile.id === employee.id));
assert.ok(snapshot.balances[employee.id]);
assert.equal(snapshot.requests.some((request) => request.employeeId === employee.id), true);

// Admins cannot delete themselves.
await assert.rejects(() => deleteProfile(admin, admin.id), /your own account/);

// Non-admins are rejected.
await assert.rejects(() => deleteProfile(employee, admin.id), /Admin access required/);

// Protected owners are shielded from deletion.
const owner = snapshot.profiles.find((profile) => profile.protectedOwner);
assert.ok(owner, "seeded protected owner should exist");
await deleteProfile(admin, owner.id);
snapshot = await getSnapshot();
assert.equal(snapshot.profiles.some((profile) => profile.id === owner.id), true);

// Deleting the employee removes the profile, its balance, and its requests.
await deleteProfile(admin, employee.id);
snapshot = await getSnapshot();
assert.equal(snapshot.profiles.some((profile) => profile.id === employee.id), false);
assert.equal(snapshot.balances[employee.id], undefined);
assert.equal(snapshot.requests.some((request) => request.employeeId === employee.id), false);

console.log("Delete user tests passed.");
