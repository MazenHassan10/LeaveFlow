import type { TimeOffRequest, UserProfile } from "@/src/lib/app-data";
import { verifyMakeupAction } from "@/app/actions";
import { DecisionControls } from "./decision-controls";
import { StatusBadge } from "./status-badge";
import { DeleteRequestForm } from "./delete-request-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";

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
        {request.segments.length ? (
          <div className="requested-time-list" aria-label="Requested time off">
            {request.segments.map((segment) => (
              <span className="requested-time-pill" key={segment.id}>
                {formatWeekdayDateLabel(segment.date)} · {formatTimeRange12Hour(segment.startTime, segment.endTime)} · {segment.requestedHours}h
              </span>
            ))}
          </div>
        ) : null}
        {request.reason ? <p className="request-reason" title={request.reason}>{request.reason}</p> : null}
        {request.approverComment ? <p className="decision-note"><strong>Note:</strong> {request.approverComment}</p> : null}
      </div>
      <div className="pill-row">
        <StatusBadge value={request.status} />
        {request.status === "Pending" && request.editedAt ? <StatusBadge value="Updated" /> : null}
      </div>
      <div className="actions">
        {request.status === "Pending" ? <DecisionControls requestId={request.id} /> : null}
        <DeleteRequestForm requestId={request.id} />
      </div>
      {request.makeupEntries.map((entry) => (
        <div className="makeup-line" key={entry.id}>
          <span>{formatWeekdayDateLabel(entry.date)} · {formatTimeRange12Hour(entry.startTime, entry.endTime)} · {entry.plannedHours}h</span>
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
