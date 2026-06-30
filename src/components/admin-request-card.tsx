import type { TimeOffRequest, UserProfile } from "@/src/lib/app-data";
import { setRequestStatusAction, verifyMakeupAction } from "@/app/actions";
import { StatusBadge } from "./status-badge";
import { DeleteRequestForm } from "./delete-request-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { formatTimeRange12Hour } from "@/src/lib/app-time";

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
          <PendingSubmitButton disabled={request.status !== "Pending"} pendingLabel="Approving...">Approve</PendingSubmitButton>
        </form>
        <form action={setRequestStatusAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="status" value="Rejected" />
          <PendingSubmitButton className="secondary" disabled={request.status !== "Pending"} pendingLabel="Rejecting...">Reject</PendingSubmitButton>
        </form>
        <DeleteRequestForm requestId={request.id} />
      </div>
      {request.makeupEntries.map((entry) => (
        <div className="makeup-line" key={entry.id}>
          <span>{entry.date} · {formatTimeRange12Hour(entry.startTime, entry.endTime)} · {entry.plannedHours}h</span>
          <StatusBadge value={entry.verificationStatus} />
          <form action={verifyMakeupAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="status" value="Worked" />
            <PendingSubmitButton className="secondary" pendingLabel="Saving...">Worked</PendingSubmitButton>
          </form>
          <form action={verifyMakeupAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="status" value="Not Worked" />
            <PendingSubmitButton className="secondary" pendingLabel="Saving...">Not worked</PendingSubmitButton>
          </form>
        </div>
      ))}
    </article>
  );
}
