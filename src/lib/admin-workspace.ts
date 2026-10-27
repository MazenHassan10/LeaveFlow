import type { AppSnapshot, MakeupEntry, TimeOffRequest, UserProfile } from "./app-data";
import { addCivilDays } from "./app-time";
import { requestEventDates } from "./approval-groups";
import { monthLabel } from "./report-calendar";

// One filter bar narrows everything on the admin dashboard: the attention cards,
// the tab badges and every tab's contents.
export type AdminFilters = {
  employeeId: string; // "all" or a profile id
  month: string; // "any" or YYYY-MM (days off and make-up dates)
  query: string; // name, email or reason
};

export const DEFAULT_ADMIN_FILTERS: AdminFilters = { employeeId: "all", month: "any", query: "" };

export const ADMIN_TABS = ["requests", "makeups", "people", "allowances"] as const;
export type AdminTab = typeof ADMIN_TABS[number];

export function parseAdminTab(value: string | undefined): AdminTab {
  return (ADMIN_TABS as readonly string[]).includes(value ?? "") ? (value as AdminTab) : "requests";
}

export function hasActiveFilters(filters: AdminFilters) {
  return filters.employeeId !== "all" || filters.month !== "any" || filters.query.trim() !== "";
}

function textMatches(query: string, ...fields: Array<string | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

// Month does not apply to people: it only narrows date-based items.
export function profileMatches(profile: UserProfile, filters: AdminFilters) {
  if (filters.employeeId !== "all" && profile.id !== filters.employeeId) return false;
  return textMatches(filters.query, profile.fullName, profile.email);
}

export function requestMatches(request: TimeOffRequest, filters: AdminFilters, employee: UserProfile | undefined) {
  if (filters.employeeId !== "all" && request.employeeId !== filters.employeeId) return false;
  if (filters.month !== "any" && !requestEventDates(request).some((date) => date.startsWith(filters.month))) return false;
  return textMatches(filters.query, employee?.fullName, employee?.email, request.reason);
}

function firstDate(request: TimeOffRequest) {
  return [...requestEventDates(request)].sort()[0] ?? "";
}

export type RequestGroup = {
  key: string;
  employee: UserProfile | undefined;
  reason: string;
  requests: TimeOffRequest[];
  offHours: number;
  makeupHours: number;
};

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

// Pending requests from the same person for the same reason (e.g. six midterm days) form one group.
export function groupByPersonAndReason(requests: TimeOffRequest[], profiles: UserProfile[]): RequestGroup[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const groups = new Map<string, RequestGroup>();
  for (const request of [...requests].sort((left, right) => firstDate(left).localeCompare(firstDate(right)))) {
    const reason = request.reason.trim();
    const key = `${request.employeeId}|${reason.toLowerCase()}`;
    const group = groups.get(key) ?? {
      key, employee: byId.get(request.employeeId), reason, requests: [], offHours: 0, makeupHours: 0
    };
    group.requests.push(request);
    group.offHours = roundHours(group.offHours + request.totalRequestedHours);
    group.makeupHours = roundHours(group.makeupHours + request.totalMakeupHours);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export type MakeupRow = {
  entry: MakeupEntry;
  request: TimeOffRequest;
  employee: UserProfile | undefined;
  isOwn: boolean;
};

// Unmarked make-up shifts on approved requests: "due" once the shift's date has passed.
export function buildMakeupRows(snapshot: AppSnapshot, filters: AdminFilters, viewerId: string | undefined, today: string) {
  const byId = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const rows: MakeupRow[] = [];
  for (const request of snapshot.requests) {
    if (request.status !== "Approved") continue;
    const employee = byId.get(request.employeeId);
    if (filters.employeeId !== "all" && request.employeeId !== filters.employeeId) continue;
    if (!textMatches(filters.query, employee?.fullName, employee?.email, request.reason)) continue;
    for (const entry of request.makeupEntries) {
      if (entry.verificationStatus !== "Pending") continue;
      if (filters.month !== "any" && !entry.date.startsWith(filters.month)) continue;
      rows.push({ entry, request, employee, isOwn: Boolean(viewerId) && request.employeeId === viewerId });
    }
  }
  rows.sort((left, right) => `${left.entry.date}${left.entry.startTime}`.localeCompare(`${right.entry.date}${right.entry.startTime}`));
  return {
    due: rows.filter((row) => row.entry.date < today),
    upcoming: rows.filter((row) => row.entry.date >= today),
  };
}

// "Off this week" by default; "Off in {month}" when a month is picked.
export function offWindow(today: string, month: string) {
  if (month === "any") return { from: today, to: addCivilDays(today, 6), label: "Off this week" };
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, label: `Off in ${monthLabel(month).split(" ")[0]}` };
}

export type AttentionCounts = {
  requestsToDecide: number;
  makeupsToMark: number;
  newSignups: number;
  offCount: number;
  offLabel: string;
};

export function buildAttentionCounts(snapshot: AppSnapshot, filters: AdminFilters, viewerId: string | undefined, today: string): AttentionCounts {
  const byId = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const matching = snapshot.requests.filter((request) => requestMatches(request, filters, byId.get(request.employeeId)));
  const window = offWindow(today, filters.month);
  const off = new Set(
    matching
      .filter((request) => request.status === "Approved")
      .filter((request) => request.segments.some((segment) => segment.date >= window.from && segment.date <= window.to))
      .map((request) => request.employeeId)
  );
  return {
    // Only what this admin can act on: their own requests need another admin.
    requestsToDecide: matching.filter((request) => request.status === "Pending" && request.employeeId !== viewerId).length,
    makeupsToMark: buildMakeupRows(snapshot, filters, viewerId, today).due.filter((row) => !row.isOwn).length,
    newSignups: snapshot.profiles.filter((profile) => profile.status === "Pending" && profileMatches(profile, filters)).length,
    offCount: off.size,
    offLabel: window.label,
  };
}
