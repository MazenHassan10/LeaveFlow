import type { TimeOffRequest } from "@/src/lib/app-data";
import { setRequestStatusAction, verifyMakeupAction } from "@/app/actions";
import { StatusBadge } from "./status-badge";

export function AdminRequestCard({ request }: { request: TimeOffRequest }) {
  return (
    <article className="request-card">
      <div>
        <strong>{request.requestType}</strong>
        <span>{request.totalRequestedHours}h requested · {request.totalMakeupHours}h make-up planned</span>
      </div>
      <StatusBadge value={request.status} />
      <div className="actions">
        <form action={setRequestStatusAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="status" value="Approved" />
          <button disabled={request.status !== "Pending"}>Approve</button>
        </form>
        <form action={setRequestStatusAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="status" value="Rejected" />
          <button className="secondary" disabled={request.status !== "Pending"}>Reject</button>
        </form>
      </div>
      {request.makeupEntries.map((entry) => (
        <div className="makeup-line" key={entry.id}>
          <span>{entry.date} · {entry.startTime}-{entry.endTime} · {entry.plannedHours}h</span>
          <StatusBadge value={entry.verificationStatus} />
          <form action={verifyMakeupAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="status" value="Worked" />
            <button className="secondary">Worked</button>
          </form>
          <form action={verifyMakeupAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="status" value="Not Worked" />
            <button className="secondary">Not worked</button>
          </form>
        </div>
      ))}
    </article>
  );
}
