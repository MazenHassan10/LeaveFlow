import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const { roleHasAdminAccess, roleTracksPto } = await import("../src/lib/pto");
const {
  createTimeOffRequest,
  ensureProfile,
  getSnapshot,
  isAdmin,
  setRequestStatus,
  updateProfile
} = await import("../src/lib/app-data");

// Pure role predicates.
assert.equal(roleHasAdminAccess("Manager"), true);
assert.equal(roleTracksPto("Manager"), true);
assert.equal(roleHasAdminAccess("Employee"), false);
assert.equal(roleTracksPto("Admin"), false);

// A Manager (Active) is treated as an admin.
const manager = await ensureProfile({
  id: "manager-role-auth",
  email: "manager-role@example.com",
  name: "Manager Role"
});
manager.role = "Manager";
manager.status = "Active";
assert.equal(isAdmin(manager), true);

// Promoting an employee to Manager seeds a PTO balance immediately (memory branch).
const promoted = await ensureProfile({
  id: "promoted-auth",
  email: "promoted@example.com",
  name: "Promoted Person"
});
promoted.status = "Active";
await updateProfile(manager, promoted.id, "Manager", "Active");
let snapshot = await getSnapshot();
assert.ok(snapshot.balances[promoted.id], "promoted manager should have a seeded balance");

// A Manager can approve ANOTHER employee's request.
const employee = await ensureProfile({
  id: "mgr-test-employee-auth",
  email: "mgr-test-employee@example.com",
  name: "Managed Employee"
});
employee.status = "Active";

function requestForm(date: string, start: string, end: string) {
  const data = new FormData();
  data.set("requestType", "PTO");
  data.set("reason", "Manager role test");
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  return data;
}

await createTimeOffRequest(employee, requestForm("2026-09-01", "09:00", "12:00"));
snapshot = await getSnapshot();
const employeeRequest = snapshot.requests.find((request) => request.employeeId === employee.id);
assert.ok(employeeRequest);
await setRequestStatus(manager, employeeRequest.id, "Approved");
snapshot = await getSnapshot();
assert.equal(snapshot.requests.find((request) => request.id === employeeRequest.id)?.status, "Approved");

// A Manager CANNOT approve their own request (separation of duties).
await createTimeOffRequest(manager, requestForm("2026-09-05", "09:00", "11:00"));
snapshot = await getSnapshot();
const ownRequest = snapshot.requests.find((request) => request.employeeId === manager.id);
assert.ok(ownRequest);
await assert.rejects(() => setRequestStatus(manager, ownRequest.id, "Approved"), /your own request/);

console.log("Manager role tests passed.");
