import type { AppSnapshot, TimeOffRequest, UserProfile } from "./app-data";
import { formatTime12Hour, formatWeekdayDateLabel } from "./app-time";
import { roleTracksPto } from "./pto";

export type ExportKind = "summary" | "detail";

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

// Quotes every cell and neutralizes leading =, +, -, @ so spreadsheet apps never run a cell as a formula.
function csvCell(value: string | number) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Array<string | number>>) {
  // BOM so Excel opens UTF-8 (names with accents) correctly.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function approvedRequests(snapshot: AppSnapshot) {
  return snapshot.requests.filter((request) => request.status === "Approved");
}

function inMonth(date: string, month: string) {
  return date.startsWith(month);
}

// Everyone whose PTO is tracked and is active, plus anyone with approved time in the month.
function exportProfiles(snapshot: AppSnapshot, month: string) {
  const withEvents = new Set(
    approvedRequests(snapshot)
      .filter((request) => [...request.segments.map((s) => s.date), ...request.makeupEntries.map((m) => m.date)].some((date) => inMonth(date, month)))
      .map((request) => request.employeeId)
  );
  return snapshot.profiles
    .filter((profile) => withEvents.has(profile.id) || (profile.status === "Active" && !profile.protectedOwner && roleTracksPto(profile.role)))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export const SUMMARY_HEADER = [
  "Employee", "Email", "Role", "Month",
  "PTO hours", "Additional time off hours", "Emergency/Exception hours", "Total hours off",
  "Make-up hours planned", "Make-up hours worked", "Make-up hours not worked", "Make-up hours not yet marked",
  "PTO hours left (current year)"
];

// One row per employee: approved hours off and make-up hours whose dates fall in the month.
export function buildSummaryRows(snapshot: AppSnapshot, month: string) {
  const approved = approvedRequests(snapshot);
  const rows = exportProfiles(snapshot, month).map((profile: UserProfile) => {
    const mine = approved.filter((request) => request.employeeId === profile.id);
    const offHours = (type: TimeOffRequest["requestType"]) => roundHours(mine
      .filter((request) => request.requestType === type)
      .flatMap((request) => request.segments)
      .filter((segment) => inMonth(segment.date, month))
      .reduce((total, segment) => total + segment.requestedHours, 0));
    const makeup = mine.flatMap((request) => request.makeupEntries).filter((entry) => inMonth(entry.date, month));
    const makeupHours = (status?: string) => roundHours(makeup
      .filter((entry) => !status || entry.verificationStatus === status)
      .reduce((total, entry) => total + entry.plannedHours, 0));
    const pto = offHours("PTO");
    const additional = offHours("Additional Time Off");
    const emergency = offHours("Emergency/Exception");
    const balance = snapshot.balances[profile.id];
    return [
      profile.fullName, profile.email, profile.role, month,
      pto, additional, emergency, roundHours(pto + additional + emergency),
      makeupHours(), makeupHours("Worked"), makeupHours("Not Worked"), makeupHours("Pending"),
      balance && roleTracksPto(profile.role) ? balance.remainingHours : ""
    ];
  });
  return [SUMMARY_HEADER, ...rows];
}

export const DETAIL_HEADER = [
  "Date", "Weekday", "Employee", "Email", "Entry", "Request type", "Start (PT)", "End (PT)", "Hours", "Make-up status", "Reason"
];

// One row per approved day off or make-up shift in the month, in date order.
export function buildDetailRows(snapshot: AppSnapshot, month: string) {
  const byId = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const rows: Array<Array<string | number>> = [];
  for (const request of approvedRequests(snapshot)) {
    const profile = byId.get(request.employeeId);
    const base = [profile?.fullName ?? "Unknown employee", profile?.email ?? ""];
    for (const segment of request.segments.filter((s) => inMonth(s.date, month))) {
      rows.push([segment.date, formatWeekdayDateLabel(segment.date).split(",")[0], ...base, "Day off", request.requestType,
        formatTime12Hour(segment.startTime), formatTime12Hour(segment.endTime), segment.requestedHours, "", request.reason]);
    }
    for (const entry of request.makeupEntries.filter((m) => inMonth(m.date, month))) {
      rows.push([entry.date, formatWeekdayDateLabel(entry.date).split(",")[0], ...base, "Make-up", request.requestType,
        formatTime12Hour(entry.startTime), formatTime12Hour(entry.endTime), entry.plannedHours,
        entry.verificationStatus === "Pending" ? "Not yet marked" : entry.verificationStatus, request.reason]);
    }
  }
  rows.sort((left, right) => `${left[0]}${left[6]}${left[2]}`.localeCompare(`${right[0]}${right[6]}${right[2]}`));
  return [DETAIL_HEADER, ...rows];
}

export function exportFileName(kind: ExportKind, month: string) {
  return `leaveflow-${kind}-${month}.csv`;
}
