import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const {
  createTimeOffRequest,
  ensureProfile,
  getSnapshot,
  setRequestStatus,
  updateProfile,
  updatePtoAllowance
} = await import("../src/lib/app-data");

const admin: UserProfile = {
  id: "allowance-admin",
  authUserId: "allowance-admin",
  email: "allowance-admin@example.com",
  fullName: "Allowance Admin",
  role: "Admin",
  status: "Active",
  protectedOwner: false
};

function requestForm(date: string, start: string, end: string) {
  const data = new FormData();
  data.set("requestType", "PTO");
  data.set("reason", "Allowance test");
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  return data;
}

const employee = await ensureProfile({
  id: "allowance-employee-auth",
  email: "allowance-employee@example.com",
  name: "Allowance Employee"
});
await updateProfile(admin, employee.id, "Employee", "Active");

await createTimeOffRequest(employee, requestForm("2026-08-03", "09:00", "13:00"));
let snapshot = await getSnapshot();
const request = snapshot.requests.find((item) => item.employeeId === employee.id);
assert.ok(request);

await setRequestStatus(admin, request.id, "Approved");
await updatePtoAllowance(admin, employee.id, 24);

snapshot = await getSnapshot();
assert.equal(snapshot.balances[employee.id].annualAllowanceHours, 24);
assert.equal(snapshot.balances[employee.id].usedHours, 4);
assert.equal(snapshot.balances[employee.id].remainingHours, 20);

const newEmployee = await ensureProfile({
  id: "new-allowance-employee-auth",
  email: "new-allowance-employee@example.com",
  name: "New Allowance Employee"
});
await updateProfile(admin, newEmployee.id, "Employee", "Active");
await updatePtoAllowance(admin, newEmployee.id, "20.5");

snapshot = await getSnapshot();
assert.equal(snapshot.balances[newEmployee.id].annualAllowanceHours, 20.5);
assert.equal(snapshot.balances[newEmployee.id].usedHours, 0);
assert.equal(snapshot.balances[newEmployee.id].remainingHours, 20.5);

await assert.rejects(() => updatePtoAllowance(employee, employee.id, 12), /Admin access required/);
await assert.rejects(() => updatePtoAllowance(admin, employee.id, -1), /valid non-negative/);
await assert.rejects(() => updatePtoAllowance(admin, employee.id, "not-hours"), /valid non-negative/);

console.log("PTO allowance tests passed.");
