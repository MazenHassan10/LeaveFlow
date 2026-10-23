import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const { ensureProfile, getSnapshot, updateProfile } = await import("../src/lib/app-data");

const manager: UserProfile = {
  id: "rename-manager",
  authUserId: "rename-manager",
  email: "rename-manager@example.com",
  fullName: "Rename Manager",
  role: "Manager",
  status: "Active",
  protectedOwner: false
};

const employee = await ensureProfile({
  id: "rename-employee-auth",
  email: "rename-employee@example.com",
  name: "Google Name"
});

// A Manager (admin privileges) can rename an employee; whitespace is tidied.
await updateProfile(manager, employee.id, "Employee", "Active", "  Jordan   Rivera ");
let snapshot = await getSnapshot();
let renamed = snapshot.profiles.find((p) => p.id === employee.id);
assert.equal(renamed?.fullName, "Jordan Rivera");
assert.equal(renamed?.email, "rename-employee@example.com", "email must not change");

// Omitting the name leaves it untouched.
await updateProfile(manager, employee.id, "Employee", "Active");
snapshot = await getSnapshot();
assert.equal(snapshot.profiles.find((p) => p.id === employee.id)?.fullName, "Jordan Rivera");

// Signing in again does not overwrite the admin-set name with the Google name.
await ensureProfile({ id: "rename-employee-auth", email: "rename-employee@example.com", name: "Google Name" });
snapshot = await getSnapshot();
assert.equal(snapshot.profiles.find((p) => p.id === employee.id)?.fullName, "Jordan Rivera");

// Validation and permissions.
await assert.rejects(() => updateProfile(manager, employee.id, "Employee", "Active", "   "), /Name is required/);
await assert.rejects(() => updateProfile(manager, employee.id, "Employee", "Active", "x".repeat(101)), /100 characters/);
await assert.rejects(() => updateProfile(renamed!, employee.id, "Employee", "Active", "Hacker"), /Admin access required/);

console.log("Rename user tests passed.");
