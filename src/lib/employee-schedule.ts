import type { AppSnapshot, TimeOffRequest } from "./app-data";
import { addCivilDays } from "./app-time";
import { buildReportCalendarEvents, type ReportCalendarEvent } from "./report-calendar";

export const UPCOMING_WINDOW_DAYS = 30;

// Approved days off and make-up shifts from today through the next `days` days, soonest first.
// Uses the same events as the reminder emails so the page and the emails always agree.
export function buildUpcomingEvents(snapshot: AppSnapshot, today: string, days = UPCOMING_WINDOW_DAYS): ReportCalendarEvent[] {
  const lastDay = addCivilDays(today, days);
  return buildReportCalendarEvents(snapshot).filter((event) => event.date >= today && event.date <= lastDay);
}

function requestDates(request: TimeOffRequest) {
  return [...request.segments.map((segment) => segment.date), ...request.makeupEntries.map((entry) => entry.date)].sort();
}

function firstDate(request: TimeOffRequest) {
  return requestDates(request)[0] || "";
}

export type EmployeeRequestGroups = {
  pending: TimeOffRequest[];
  upcoming: TimeOffRequest[];
  past: TimeOffRequest[];
};

// Pending first, then approved requests with anything still ahead, then everything else.
export function groupEmployeeRequests(requests: TimeOffRequest[], today: string): EmployeeRequestGroups {
  const byFirstDate = (left: TimeOffRequest, right: TimeOffRequest) => firstDate(left).localeCompare(firstDate(right));
  const pending = requests.filter((request) => request.status === "Pending").sort(byFirstDate);
  const upcoming = requests
    .filter((request) => request.status === "Approved" && requestDates(request).some((date) => date >= today))
    .sort(byFirstDate);
  const shown = new Set([...pending, ...upcoming]);
  const past = requests
    .filter((request) => !shown.has(request))
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  return { pending, upcoming, past };
}
