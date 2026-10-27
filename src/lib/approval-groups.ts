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
