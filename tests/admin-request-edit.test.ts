import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";
import { buildRequestChangedEmail, requestChanges } from "../src/lib/email";

process.env.DATABASE_URL = "";

const {
  adminUpdateRequest, cancelRequest, createTimeOffRequest, ensureProfile, getSnapshot, setRequestStatus,
  updateProfile, updatePtoAllowance, verifyMakeup
} = await import("../src/lib/app-data");

const admin: UserProfile = {
  id: "ae-admin", authUserId: "ae-admin", email: "ae-admin@example.com", fullName: "AE Admin",
  role: "Admin", status: "Active", protectedOwner: false
};
const dana = await ensureProfile({ id: "ae-dana", email: "dana@example.com", name: "Dana" });
const eli = await ensureProfile({ id: "ae-eli", email: "eli@example.com", name: "Eli" });
const manny = await ensureProfile({ id: "ae-manny", email: "manny@example.com", name: "Manny" });
await updateProfile(admin, dana.id, "Employee", "Active");
await updateProfile(admin, eli.id, "Employee", "Active");
await updateProfile(admin, manny.id, "Manager", "Active");
dana.status = "Active";
eli.status = "Active";
manny.status = "Active";
manny.role = "Manager";

type Makeup = [string, string, string];
function form(type: string, reason: string, date: string, start: string, end: string, makeup: Makeup[] = [], note?: string) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", reason);
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  for (const [d, s, e] of makeup) {
    data.append("makeupDate", d);
    data.append("makeupStart", s);
    data.append("makeupEnd", e);
  }
  if (note) data.set("note", note);
  return data;
}
const byReason = async (reason: string) => (await getSnapshot()).requests.find((r) => r.reason === reason)!;
const byId = async (id: string) => (await getSnapshot()).requests.find((r) => r.id === id)!;
const balance = async (employeeId: string) => (await getSnapshot()).balances[employeeId];

// --- An approved request is fixed in place and stays approved; unchanged make-ups keep their marks ---
await createTimeOffRequest(dana, form("Additional Time Off", "midterm", "2026-12-14", "09:00", "17:00",
  [["2026-12-19", "09:00", "13:00"], ["2026-12-20", "09:00", "13:00"]]));
const midterm = await byReason("midterm");
await setRequestStatus(admin, midterm.id, "Approved");
const workedEntry = (await byId(midterm.id)).makeupEntries.find((entry) => entry.date === "2026-12-19")!;
await verifyMakeup(admin, workedEntry.id, "Worked");

const result = await adminUpdateRequest(admin, midterm.id, form("Additional Time Off", "midterm", "2026-12-15", "09:00", "17:00",
  [["2026-12-19", "09:00", "13:00"], ["2026-12-21", "09:00", "13:00"]], "Moved to the 15th as agreed."));
assert.equal(result.status, "updated");
const fixed = await byId(midterm.id);
assert.equal(fixed.status, "Approved");
assert.ok(fixed.editedAt);
assert.deepEqual(fixed.segments.map((s) => s.date), ["2026-12-15"]);
const kept = fixed.makeupEntries.find((entry) => entry.date === "2026-12-19")!;
assert.equal(kept.id, workedEntry.id, "an unchanged make-up shift keeps its id");
assert.equal(kept.verificationStatus, "Worked", "and keeps its Worked mark");
assert.equal(fixed.makeupEntries.find((entry) => entry.date === "2026-12-21")!.verificationStatus, "Pending");
assert.equal(fixed.makeupEntries.some((entry) => entry.date === "2026-12-20"), false);

// Make-ups must still cover the time off.
await assert.rejects(
  () => adminUpdateRequest(admin, midterm.id, form("Additional Time Off", "midterm", "2026-12-15", "09:00", "17:00", [["2026-12-19", "09:00", "13:00"]])),
  /covers 4h but you're taking 8h off/
);

// --- Approved PTO: the balance follows the edit ---
await updatePtoAllowance(admin, eli.id, 10);
await createTimeOffRequest(eli, form("PTO", "eli trip", "2026-12-03", "09:00", "17:00"));
const eliTrip = await byReason("eli trip");
await setRequestStatus(admin, eliTrip.id, "Approved");
assert.equal((await balance(eli.id)).usedHours, 8);
// Re-saving the same approved 8h is allowed even though only 2h are "left": its own hours count back.
assert.equal((await adminUpdateRequest(admin, eliTrip.id, form("PTO", "eli trip", "2026-12-03", "09:00", "17:00"))).status, "updated");
// Shrinking it to 4h frees 4h.
await adminUpdateRequest(admin, eliTrip.id, form("PTO", "eli trip", "2026-12-03", "09:00", "13:00"));
assert.equal((await balance(eli.id)).usedHours, 4);
assert.equal((await balance(eli.id)).remainingHours, 6);
// Growing past the allowance is refused (needs 12h, has 6h + its own 4h = 10h).
await assert.rejects(
  () => adminUpdateRequest(admin, eliTrip.id, form("PTO", "eli trip", "2026-12-03", "06:00", "18:00")),
  /needs 12h of PTO but only 10h is left/
);
// Switching it to Additional Time Off takes it off the PTO balance.
await adminUpdateRequest(admin, eliTrip.id, form("Additional Time Off", "eli trip", "2026-12-03", "09:00", "13:00", [["2026-12-06", "09:00", "13:00"]]));
assert.equal((await balance(eli.id)).usedHours, 0);
assert.equal((await byId(eliTrip.id)).status, "Approved");

// --- Pending requests can be edited by an admin and stay pending ---
await createTimeOffRequest(dana, form("PTO", "dana pending", "2026-12-22", "09:00", "13:00"));
const danaPending = await byReason("dana pending");
await adminUpdateRequest(admin, danaPending.id, form("PTO", "dana pending", "2026-12-23", "09:00", "13:00"));
assert.equal((await byId(danaPending.id)).status, "Pending");
assert.equal((await byId(danaPending.id)).segments[0].date, "2026-12-23");

// --- Rejected and cancelled requests are locked; non-admins can't use it ---
await createTimeOffRequest(dana, form("PTO", "dana rejected", "2026-12-28", "09:00", "10:00"));
const danaRejected = await byReason("dana rejected");
await setRequestStatus(admin, danaRejected.id, "Rejected", "Short-staffed.");
await assert.rejects(() => adminUpdateRequest(admin, danaRejected.id, form("PTO", "x", "2026-12-28", "09:00", "10:00")), /Only pending or approved requests can be edited/);
await createTimeOffRequest(dana, form("PTO", "dana cancelled", "2026-12-29", "09:00", "10:00"));
const danaCancelled = await byReason("dana cancelled");
await cancelRequest(dana, danaCancelled.id);
await assert.rejects(() => adminUpdateRequest(admin, danaCancelled.id, form("PTO", "x", "2026-12-29", "09:00", "10:00")), /Only pending or approved requests can be edited/);
await assert.rejects(() => adminUpdateRequest(dana, midterm.id, form("PTO", "x", "2026-12-15", "09:00", "10:00")), /Admin access required/);

// --- A Manager can edit their own approved request ---
await createTimeOffRequest(manny, form("Additional Time Off", "manny exam", "2026-12-08", "09:00", "13:00", [["2026-12-12", "09:00", "13:00"]]));
const mannyExam = await byReason("manny exam");
await setRequestStatus(admin, mannyExam.id, "Approved");
const own = await adminUpdateRequest(manny, mannyExam.id, form("Additional Time Off", "manny exam", "2026-12-09", "09:00", "13:00", [["2026-12-12", "09:00", "13:00"]]));
assert.equal(own.status, "updated");
assert.equal((await byId(mannyExam.id)).segments[0].date, "2026-12-09");

// --- Duplicate check is for the request's owner, not the admin ---
await createTimeOffRequest(dana, form("PTO", "dup a", "2026-11-30", "09:00", "10:00"));
await createTimeOffRequest(dana, form("PTO", "dup b", "2026-11-30", "10:00", "11:00"));
const dupB = await byReason("dup b");
assert.equal((await adminUpdateRequest(admin, dupB.id, form("PTO", "dup a", "2026-11-30", "09:00", "10:00"))).status, "duplicate");

// --- The change email shows before and after, and the note ---
const before = structuredClone(await byId(eliTrip.id));
const after = structuredClone(before);
after.segments = [{ ...after.segments[0], date: "2026-12-04" }];
const changes = requestChanges(before, after);
assert.deepEqual(changes.map((change) => change.label), ["Time off"]);
const email = buildRequestChangedEmail([eli], { employee: eli, before, after, editor: admin, note: "Moved by a day.", audience: "employee" })!;
assert.deepEqual(email.to, ["eli@example.com"]);
assert.equal(email.subject, "Your time-off request was updated");
assert.match(email.text, /AE Admin updated your Additional Time Off request\. It is still approved\./);
assert.match(email.text, /Before: Thu, Dec 3/);
assert.match(email.text, /After: {2}Fri, Dec 4/);
assert.match(email.html, /Moved by a day\./);
const adminEmail = buildRequestChangedEmail([admin], { employee: manny, before, after, editor: manny, audience: "admins" })!;
assert.match(adminEmail.subject, /Manny updated their own time-off request/);

console.log("Admin request edit tests passed.");
