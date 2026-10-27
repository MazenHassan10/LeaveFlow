import type { TimeOffRequest } from "./app-data";

export type ApprovalGroupKey = "pending" | "approved" | "rejected" | "cancelled";

export type ApprovalGroup = {
  key: ApprovalGroupKey;
  title: string;
  empty: string;
  requests: TimeOffRequest[];
};

const APPROVAL_GROUPS: Array<Omit<ApprovalGroup, "requests"> & { status: TimeOffRequest["status"] }> = [
  { key: "pending", title: "Pending approvals", empty: "No pending approvals.", status: "Pending" },
  { key: "approved", title: "Approved", empty: "No approved requests.", status: "Approved" },
  { key: "rejected", title: "Rejected", empty: "No rejected requests.", status: "Rejected" },
  { key: "cancelled", title: "Cancelled by employee", empty: "No cancelled requests.", status: "Cancelled" },
];

export function buildApprovalGroups(requests: TimeOffRequest[]): ApprovalGroup[] {
  return APPROVAL_GROUPS.map(({ status, ...group }) => ({
    ...group,
    requests: requests.filter((request) => request.status === status),
  }));
}

export const RECENT_WINDOW_DAYS = 30;

export type ApprovalFilters = {
  employeeId: string; // "all" or a profile id
  month: string; // "any" or YYYY-MM, matched against the days off and make-up dates
  query: string; // matches employee name, email or reason
  showAll: boolean; // when false, decided requests are limited to recent and upcoming ones
};

export const DEFAULT_APPROVAL_FILTERS: ApprovalFilters = { employeeId: "all", month: "any", query: "", showAll: false };

export function requestEventDates(request: TimeOffRequest) {
  return [...request.segments.map((segment) => segment.date), ...request.makeupEntries.map((entry) => entry.date)];
}

export function requestMonths(requests: TimeOffRequest[]) {
  return [...new Set(requests.flatMap((request) => requestEventDates(request).map((date) => date.slice(0, 7))))].sort().reverse();
}

// Pending requests are never hidden by the recency window so nothing waiting gets missed;
// decided ones show only if they have a date within the last 30 days or coming up.
export function requestMatchesFilters(
  request: TimeOffRequest,
  filters: ApprovalFilters,
  employee: { fullName: string; email: string } | undefined,
  recentFrom: string
) {
  const dates = requestEventDates(request);
  if (filters.employeeId !== "all" && request.employeeId !== filters.employeeId) return false;
  if (filters.month !== "any" && !dates.some((date) => date.startsWith(filters.month))) return false;
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = `${employee?.fullName ?? ""} ${employee?.email ?? ""} ${request.reason}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (!filters.showAll && request.status !== "Pending" && !dates.some((date) => date >= recentFrom)) return false;
  return true;
}

export type FilteredApprovalGroup = ApprovalGroup & { total: number };

export function filterApprovalGroups(
  groups: ApprovalGroup[],
  filters: ApprovalFilters,
  profiles: Array<{ id: string; fullName: string; email: string }>,
  recentFrom: string
): FilteredApprovalGroup[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return groups.map((group) => ({
    ...group,
    total: group.requests.length,
    requests: group.requests.filter((request) => requestMatchesFilters(request, filters, byId.get(request.employeeId), recentFrom)),
  }));
}
