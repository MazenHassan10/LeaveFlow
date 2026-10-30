import type { AppSnapshot } from "./app-data";
import type { MakeupStatus, RequestType } from "./pto";
import { APP_TIME_ZONE, formatCivilDate, losAngelesMonth } from "./app-time";

export type ReportCalendarEvent = {
  id: string;
  date: string;
  type: "off" | "makeup";
  requestId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  startTime: string;
  endTime: string;
  hours: number;
  requestType: RequestType;
  reason: string;
  // Make-up shifts only: Pending, Worked or Not Worked.
  makeupStatus?: MakeupStatus;
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
        requestId: request.id,
        employeeId: request.employeeId,
        employeeName,
        employeeEmail,
        startTime: segment.startTime,
        endTime: segment.endTime,
        hours: segment.requestedHours,
        requestType: request.requestType,
        reason: request.reason ?? "",
      });
    }

    for (const entry of request.makeupEntries) {
      events.push({
        id: `makeup-${entry.id}`,
        date: entry.date,
        type: "makeup",
        requestId: request.id,
        employeeId: request.employeeId,
        employeeName,
        employeeEmail,
        startTime: entry.startTime,
        endTime: entry.endTime,
        hours: entry.plannedHours,
        requestType: request.requestType,
        reason: request.reason ?? "",
        makeupStatus: entry.verificationStatus,
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

// Short names for tight spaces: the first name, plus a last initial when two people share it
// ("Mohamed I." and "Mohamed O.").
export function buildShortNames(profiles: Array<{ id: string; fullName: string }>) {
  const parts = profiles.map((profile) => ({ id: profile.id, words: profile.fullName.trim().split(/\s+/) }));
  const firstCounts = new Map<string, number>();
  for (const { words } of parts) {
    const first = (words[0] || "").toLowerCase();
    firstCounts.set(first, (firstCounts.get(first) || 0) + 1);
  }
  const names = new Map<string, string>();
  for (const { id, words } of parts) {
    const first = words[0] || "";
    const shared = (firstCounts.get(first.toLowerCase()) || 0) > 1;
    const last = words.length > 1 ? words[words.length - 1] : "";
    names.set(id, shared && last ? `${first} ${last[0].toUpperCase()}.` : first);
  }
  return names;
}
