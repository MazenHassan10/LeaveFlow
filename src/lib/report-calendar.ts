import type { AppSnapshot } from "./app-data";
import { APP_TIME_ZONE, formatCivilDate, losAngelesMonth } from "./app-time";

export type ReportCalendarEvent = {
  id: string;
  date: string;
  type: "off" | "makeup";
  employeeName: string;
  employeeEmail: string;
  startTime: string;
  endTime: string;
  hours: number;
};

export function parseMonthParam(value: string | undefined, today = new Date()) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  return losAngelesMonth(today);
}

export function addMonths(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12));
  return formatCivilDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1).slice(0, 7);
}

export function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1, 12)));
}

export function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const last = new Date(Date.UTC(year, monthNumber, 0, 12));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const days: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(formatCivilDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
  }
  return days;
}

export function buildReportCalendarEvents(snapshot: AppSnapshot) {
  const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const events: ReportCalendarEvent[] = [];

  for (const request of snapshot.requests) {
    if (request.status !== "Approved") continue;
    const profile = profileById.get(request.employeeId);
    const employeeName = profile?.fullName || "Unknown employee";
    const employeeEmail = profile?.email || "";

    for (const segment of request.segments) {
      events.push({
        id: `off-${segment.id}`,
        date: segment.date,
        type: "off",
        employeeName,
        employeeEmail,
        startTime: segment.startTime,
        endTime: segment.endTime,
        hours: segment.requestedHours,
      });
    }

    for (const entry of request.makeupEntries) {
      events.push({
        id: `makeup-${entry.id}`,
        date: entry.date,
        type: "makeup",
        employeeName,
        employeeEmail,
        startTime: entry.startTime,
        endTime: entry.endTime,
        hours: entry.plannedHours,
      });
    }
  }

  return events.sort((left, right) => `${left.date}${left.startTime}`.localeCompare(`${right.date}${right.startTime}`));
}

export function groupEventsByDate(events: ReportCalendarEvent[]) {
  return events.reduce<Record<string, ReportCalendarEvent[]>>((groups, event) => {
    groups[event.date] ||= [];
    groups[event.date].push(event);
    return groups;
  }, {});
}
