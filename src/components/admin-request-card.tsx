import type { TimeOffRequest, UserProfile } from "@/src/lib/app-data";
import { setRequestStatusAction, verifyMakeupAction } from "@/app/actions";
import { StatusBadge } from "./status-badge";
import { DeleteRequestForm } from "./delete-request-form";

export function AdminRequestCard({ request, profiles }: { request: TimeOffRequest; profiles: UserProfile[] }) {
  const profile = profiles.find((item) => item.id === request.employeeId);
  const employeeName = profile?.fullName || "Unknown employee";
  const employeeEmail = profile?.email || "";

  return (
    <article className="request-card">
      <div>
        <strong title={employeeName}>{employeeName}</strong>
        {employeeEmail ? <span title={employeeEmail}>{employeeEmail}</span> : null}
        <span>{request.requestType} · {request.totalRequestedHours}h requested · {request.totalMakeupHours}h make-up planned</span>
        {request.reason ? <p className="request-reason" title={request.reason}>{request.reason}</p> : null}
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
        <DeleteRequestForm requestId={request.id} />
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
