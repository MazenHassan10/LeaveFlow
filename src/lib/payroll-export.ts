import type { AppSnapshot } from "./app-data";
import { formatTime12Hour, formatWeekdayDateLabel } from "./app-time";
import { approvedRequests, buildMonthSummary, inMonth } from "./report-summary";

export type ExportKind = "summary" | "detail";

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

export const SUMMARY_HEADER = [
  "Employee", "Email", "Role", "Month",
  "PTO hours", "Additional time off hours", "Emergency/Exception hours", "Total hours off",
  "Make-up hours planned", "Make-up hours worked", "Make-up hours not worked", "Make-up hours not yet marked",
  "PTO hours left (current year)"
];

// One row per employee: approved hours off and make-up hours whose dates fall in the month.
export function buildSummaryRows(snapshot: AppSnapshot, month: string) {
  const rows = buildMonthSummary(snapshot, month).rows.map((row) => [
    row.profile.fullName, row.profile.email, row.profile.role, month,
    row.ptoHours, row.additionalHours, row.emergencyHours, row.offHours,
    row.makeupPlannedHours, row.makeupWorkedHours, row.makeupNotWorkedHours, row.makeupPendingHours,
    row.balance ? row.balance.remainingHours : ""
  ]);
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
