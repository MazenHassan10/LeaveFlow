import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";
import { buildSignInEmailChangedEmail } from "../src/lib/email";

process.env.DATABASE_URL = "";

const {
  changeProfileEmail, createTimeOffRequest, ensureProfile, getSnapshot, normalizeEmail, updateProfile
} = await import("../src/lib/app-data");

const admin = await ensureProfile({ id: "ce-admin-auth", email: "ce-admin@example.com", name: "CE Admin" });
admin.role = "Admin";
admin.status = "Active";
const omar = await ensureProfile({ id: "ce-omar-auth", email: "omar.old@gmail.com", name: "Omar" });
await updateProfile(admin, omar.id, "Employee", "Active");
omar.status = "Active";

function ptoForm(date: string, reason: string) {
  const data = new FormData();
  data.set("requestType", "PTO");
  data.set("reason", reason);
  data.set("segmentDate", date);
  data.set("segmentStart", "09:00");
  data.set("segmentEnd", "13:00");
  return data;
}
await createTimeOffRequest(omar, ptoForm("2026-12-07", "omar pto"));

// Email format is checked and normalized.
assert.equal(normalizeEmail("  Omar.New@Gmail.com "), "omar.new@gmail.com");
assert.throws(() => normalizeEmail("not-an-email"), /valid email/);

// Permissions: admins only, and never your own sign-in.
await assert.rejects(() => changeProfileEmail(omar, omar.id, "x@gmail.com"), /Admin access required/);
await assert.rejects(() => changeProfileEmail(admin, admin.id, "x@gmail.com"), /Another admin needs to change your own/);
await assert.rejects(() => changeProfileEmail(admin, omar.id, "OMAR.OLD@gmail.com"), /already their sign-in email/);

// He tried signing in with the new account first, which made an empty Pending profile.
const stray = await ensureProfile({ id: "ce-omar-new-auth", email: "omar.new@gmail.com", name: "Omar (new)" });
assert.equal(stray.status, "Pending");

const result = await changeProfileEmail(admin, omar.id, "Omar.New@gmail.com");
assert.deepEqual(result, { oldEmail: "omar.old@gmail.com", newEmail: "omar.new@gmail.com", removedEmptyProfile: true });

let snapshot = await getSnapshot();
assert.equal(snapshot.profiles.some((p) => p.id === stray.id), false, "the empty duplicate profile is removed");
const moved = snapshot.profiles.find((p) => p.id === omar.id)!;
assert.equal(moved.email, "omar.new@gmail.com");
assert.equal(moved.status, "Active");
assert.equal(snapshot.requests.filter((r) => r.employeeId === omar.id).length, 1, "his requests stay on the profile");

// Signing in with the new Google account lands on the same profile.
const signedIn = await ensureProfile({ id: "ce-omar-new-auth", email: "omar.new@gmail.com", name: "Omar" });
assert.equal(signedIn.id, omar.id);
// The old Google account no longer reaches it; it would only get a fresh Pending profile.
const oldLogin = await ensureProfile({ id: "ce-omar-auth", email: "omar.old@gmail.com", name: "Omar" });
assert.notEqual(oldLogin.id, omar.id);
assert.equal(oldLogin.status, "Pending");

// A profile that has requests is never removed to make room.
const lina = await ensureProfile({ id: "ce-lina-auth", email: "lina@gmail.com", name: "Lina" });
await updateProfile(admin, lina.id, "Employee", "Active");
lina.status = "Active";
await createTimeOffRequest(lina, ptoForm("2026-12-08", "lina pto"));
await assert.rejects(() => changeProfileEmail(admin, omar.id, "lina@gmail.com"), /Lina \(lina@gmail.com\) already uses that email and has 1 request/);
snapshot = await getSnapshot();
assert.ok(snapshot.profiles.some((p) => p.id === lina.id));

// The notice goes to both addresses.
const email = buildSignInEmailChangedEmail(moved as UserProfile, "omar.old@gmail.com", "omar.new@gmail.com", admin);
assert.deepEqual(email.to, ["omar.old@gmail.com", "omar.new@gmail.com"]);
assert.equal(email.subject, "Your LeaveFlow sign-in email was changed");
assert.match(email.text, /sign in with Google using omar\.new@gmail\.com/);
assert.match(email.text, /CE Admin changed the Google account/);

console.log("Change sign-in email tests passed.");
