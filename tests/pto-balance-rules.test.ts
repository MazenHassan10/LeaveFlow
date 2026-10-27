import assert from "node:assert/strict";
import type { UserProfile } from "../src/lib/app-data";

process.env.DATABASE_URL = "";

const { createTimeOffRequest, ensureProfile, getSnapshot, setRequestStatus, updateProfile, updatePtoAllowance } =
  await import("../src/lib/app-data");
const { losAngelesYear } = await import("../src/lib/app-time");

const year = losAngelesYear();
const admin: UserProfile = {
  id: "bal-admin", authUserId: "bal-admin", email: "bal-admin@example.com", fullName: "Bal Admin",
  role: "Admin", status: "Active", protectedOwner: false
};

const employee = await ensureProfile({ id: "bal-emp", email: "bal-emp@example.com", name: "Bal Employee" });
await updateProfile(admin, employee.id, "Employee", "Active");
employee.status = "Active";
await updatePtoAllowance(admin, employee.id, 10); // custom allowance: 10h

function form(type: string, date: string, start: string, end: string, makeup?: [string, string, string]) {
  const data = new FormData();
  data.set("requestType", type);
  data.set("reason", `${type} ${date}`);
  data.set("segmentDate", date);
  data.set("segmentStart", start);
  data.set("segmentEnd", end);
  if (makeup) {
    data.append("makeupDate", makeup[0]);
    data.append("makeupStart", makeup[1]);
    data.append("makeupEnd", makeup[2]);
  }
  return data;
}
const find = async (reason: string) => (await getSnapshot()).requests.find((r) => r.reason === reason)!;
const balance = async () => (await getSnapshot()).balances[employee.id];

// Submission: a PTO request bigger than the balance is refused up front.
await assert.rejects(() => createTimeOffRequest(employee, form("PTO", `${year}-12-01`, "09:00", "20:00")), /needs 11h of PTO but only 10h is left/);

// Two 8h requests can each be submitted (only approved PTO counts), but approval enforces the balance.
await createTimeOffRequest(employee, form("PTO", `${year}-12-02`, "09:00", "17:00"));
await createTimeOffRequest(employee, form("PTO", `${year}-12-03`, "09:00", "17:00"));
await setRequestStatus(admin, (await find(`PTO ${year}-12-02`)).id, "Approved");
assert.equal((await balance()).usedHours, 8);
assert.equal((await balance()).remainingHours, 2);
const secondId = (await find(`PTO ${year}-12-03`)).id;
await assert.rejects(() => setRequestStatus(admin, secondId, "Approved"), /needs 8h of PTO but only 2h is left/);
assert.equal((await find(`PTO ${year}-12-03`)).status, "Pending", "a refused approval must not change the request");

// Submission now sees the reduced balance.
await assert.rejects(() => createTimeOffRequest(employee, form("PTO", `${year}-12-04`, "09:00", "12:00")), /only 2h is left/);

// Additional time off with a make-up plan does not use PTO, so it is never blocked by the balance.
await createTimeOffRequest(employee, form("Additional Time Off", `${year}-12-07`, "09:00", "17:00", [`${year}-12-12`, "09:00", "17:00"]));

// PTO is charged to the year it is taken: next year's day off leaves this year's balance alone.
await createTimeOffRequest(employee, form("PTO", `${year + 1}-01-05`, "09:00", "13:00"));
await setRequestStatus(admin, (await find(`PTO ${year + 1}-01-05`)).id, "Approved");
assert.equal((await balance()).usedHours, 8);
assert.equal((await balance()).calendarYear, year);

console.log("PTO balance rule tests passed.");
