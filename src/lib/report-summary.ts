import type { AppSnapshot, MakeupEntry, PtoBalance, TimeOffRequest, UserProfile } from "./app-data";
import { roleTracksPto } from "./pto";

// One month of approved time, per person. The Reports page and the payroll CSV both read this,
// so the numbers on screen and in the export always match.

export function roundHours(value: number) {
  return Number(value.toFixed(2));
}

export function inMonth(date: string, month: string) {
  return date.startsWith(month);
}

export function approvedRequests(snapshot: AppSnapshot) {
  return snapshot.requests.filter((request) => request.status === "Approved");
}

// Everyone whose PTO is tracked and is active, plus anyone with approved time in the month.
export function monthPeople(snapshot: AppSnapshot, month: string) {
  const withEvents = new Set(
    approvedRequests(snapshot)
      .filter((request) => [...request.segments.map((s) => s.date), ...request.makeupEntries.map((m) => m.date)].some((date) => inMonth(date, month)))
      .map((request) => request.employeeId)
  );
  return snapshot.profiles
    .filter((profile) => withEvents.has(profile.id) || (profile.status === "Active" && !profile.protectedOwner && roleTracksPto(profile.role)))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export type MonthMakeup = { request: TimeOffRequest; entry: MakeupEntry };

export type MonthPersonRow = {
  profile: UserProfile;
  ptoHours: number;
  additionalHours: number;
  emergencyHours: number;
  offHours: number;
  makeupPlannedHours: number;
  makeupWorkedHours: number;
  makeupNotWorkedHours: number;
  makeupPendingHours: number;
  makeupCount: number;
  notWorkedCount: number;
  // Pending make-up shifts whose date has arrived: an admin should mark them.
  toMark: number;
  // Current-year balance, only for roles whose PTO is tracked.
  balance: PtoBalance | null;
  requests: TimeOffRequest[];
  makeups: MonthMakeup[];
};

export type MonthTotals = {
  offHours: number;
  ptoHours: number;
  otherOffHours: number;
  peopleOff: number;
  makeupPlannedHours: number;
  makeupWorkedHours: number;
  makeupCount: number;
  notWorkedCount: number;
  toMark: number;
};

export function buildMonthSummary(snapshot: AppSnapshot, month: string, options: { personId?: string; today?: string } = {}) {
  const { personId = "all", today = "" } = options;
  const approved = approvedRequests(snapshot);
  const rows: MonthPersonRow[] = monthPeople(snapshot, month)
    .filter((profile) => personId === "all" || profile.id === personId)
    .map((profile) => {
      const mine = approved.filter((request) => request.employeeId === profile.id);
      const offHours = (type: TimeOffRequest["requestType"]) => roundHours(mine
        .filter((request) => request.requestType === type)
        .flatMap((request) => request.segments)
        .filter((segment) => inMonth(segment.date, month))
        .reduce((total, segment) => total + segment.requestedHours, 0));
      const makeups = mine
        .flatMap((request) => request.makeupEntries.map((entry) => ({ request, entry })))
        .filter(({ entry }) => inMonth(entry.date, month))
        .sort((left, right) => `${left.entry.date}${left.entry.startTime}`.localeCompare(`${right.entry.date}${right.entry.startTime}`));
      const makeupHours = (status?: string) => roundHours(makeups
        .filter(({ entry }) => !status || entry.verificationStatus === status)
        .reduce((total, { entry }) => total + entry.plannedHours, 0));
      const ptoHours = offHours("PTO");
      const additionalHours = offHours("Additional Time Off");
      const emergencyHours = offHours("Emergency/Exception");
      const balance = snapshot.balances[profile.id];
      return {
        profile,
        ptoHours,
        additionalHours,
        emergencyHours,
        offHours: roundHours(ptoHours + additionalHours + emergencyHours),
        makeupPlannedHours: makeupHours(),
        makeupWorkedHours: makeupHours("Worked"),
        makeupNotWorkedHours: makeupHours("Not Worked"),
        makeupPendingHours: makeupHours("Pending"),
        makeupCount: makeups.length,
        notWorkedCount: makeups.filter(({ entry }) => entry.verificationStatus === "Not Worked").length,
        toMark: today ? makeups.filter(({ entry }) => entry.verificationStatus === "Pending" && entry.date <= today).length : 0,
        balance: balance && roleTracksPto(profile.role) ? balance : null,
        requests: mine.filter((request) => request.segments.some((segment) => inMonth(segment.date, month))),
        makeups,
      };
    });

  const sum = (pick: (row: MonthPersonRow) => number) => roundHours(rows.reduce((total, row) => total + pick(row), 0));
  const totals: MonthTotals = {
    offHours: sum((row) => row.offHours),
    ptoHours: sum((row) => row.ptoHours),
    otherOffHours: sum((row) => row.additionalHours + row.emergencyHours),
    peopleOff: rows.filter((row) => row.offHours > 0).length,
    makeupPlannedHours: sum((row) => row.makeupPlannedHours),
    makeupWorkedHours: sum((row) => row.makeupWorkedHours),
    makeupCount: sum((row) => row.makeupCount),
    notWorkedCount: sum((row) => row.notWorkedCount),
    toMark: sum((row) => row.toMark),
  };
  return { rows, totals };
}
