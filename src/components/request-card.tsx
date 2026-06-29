import type { TimeOffRequest } from "@/src/lib/app-data";
import { StatusBadge } from "./status-badge";

export function RequestCard({ request }: { request: TimeOffRequest }) {
  return (
    <article className="request-card">
      <div>
        <strong>{request.requestType}</strong>
        <span>{request.totalRequestedHours} requested hours</span>
      </div>
      <StatusBadge value={request.status} />
      {request.isLateNotice ? (
        <p className="notice warning">Late notice: under 14 calendar days.</p>
      ) : null}
    </article>
  );
}
