"use client";

import Link from "next/link";
import { cancelRequestAction } from "@/app/actions";
import type { TimeOffRequest } from "@/src/lib/app-data";
import {
  formatPacificRangeIn,
  formatTimeRange12Hour,
  formatTimestampInLosAngeles,
  formatWeekdayDateLabel
} from "@/src/lib/app-time";
import { ActionForm } from "./action-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { StatusBadge } from "./status-badge";

function ScheduleRow({ date, startTime, endTime, hours, badge }: {
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  badge?: string;
}) {
  const cairo = formatPacificRangeIn(date, startTime, endTime);
  return (
    <li className="schedule-row">
      <div>
        <strong>{formatWeekdayDateLabel(date)}</strong>
        <span>{formatTimeRange12Hour(startTime, endTime)} PT · {hours}h</span>
        {cairo ? <small>{cairo}</small> : null}
      </div>
      {badge ? <StatusBadge value={badge} /> : null}
    </li>
  );
}

function decisionLine(request: TimeOffRequest) {
  if (request.status === "Approved" && request.approvedAt) {
    return `Approved${request.approverEmail ? ` by ${request.approverEmail}` : ""} on ${formatTimestampInLosAngeles(request.approvedAt)}`;
  }
  if (request.status === "Rejected" && request.approvedAt) {
    return `Rejected${request.approverEmail ? ` by ${request.approverEmail}` : ""} on ${formatTimestampInLosAngeles(request.approvedAt)}`;
  }
  if (request.status === "Cancelled") {
    return `Cancelled by you${request.cancelledAt ? ` on ${formatTimestampInLosAngeles(request.cancelledAt)}` : ""}`;
  }
  return `Submitted ${formatTimestampInLosAngeles(request.submittedAt)}${request.editedAt ? ` · edited ${formatTimestampInLosAngeles(request.editedAt)}` : ""}`;
}

export function RequestCard({ request }: { request: TimeOffRequest }) {
  const isPending = request.status === "Pending";
  // Make-up verification only means something once the request is approved.
  const showVerification = request.status === "Approved";

  return (
    <article className="request-card employee-request-card">
      <header className="employee-request-head">
        <div>
          <strong>{request.requestType}</strong>
          <span>{request.totalRequestedHours}h off{request.totalMakeupHours ? ` · ${request.totalMakeupHours}h make-up` : ""}</span>
        </div>
        <StatusBadge value={request.status} />
      </header>

      <section aria-label="Time off">
        <p className="schedule-label">Time off</p>
        <ul className="schedule-list">
          {request.segments.map((segment) => (
            <ScheduleRow
              key={segment.id}
              date={segment.date}
              startTime={segment.startTime}
              endTime={segment.endTime}
              hours={segment.requestedHours}
            />
          ))}
        </ul>
      </section>

      {request.makeupEntries.length ? (
        <section aria-label="Make-up plan">
          <p className="schedule-label">Make-up plan</p>
          <ul className="schedule-list">
            {request.makeupEntries.map((entry) => (
              <ScheduleRow
                key={entry.id}
                date={entry.date}
                startTime={entry.startTime}
                endTime={entry.endTime}
                hours={entry.plannedHours}
                badge={showVerification ? entry.verificationStatus : undefined}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {request.reason ? <p className="request-reason">{request.reason}</p> : null}
      {request.isLateNotice ? <p className="notice warning">Late notice: under 14 calendar days.</p> : null}
      <small className="request-decision">{decisionLine(request)}</small>
      {request.approverComment ? <p className="decision-note"><strong>Note from your admin:</strong> {request.approverComment}</p> : null}

      {isPending ? (
        <div className="actions">
          <Link className="btn-ghost compact" href={`/employee?edit=${request.id}#request-form`} scroll>
            Edit
          </Link>
          <ActionForm
            action={cancelRequestAction}
            confirmMessage="Cancel this request? Admins will be notified. You can submit a new one any time."
          >
            <input type="hidden" name="requestId" value={request.id} />
            <PendingSubmitButton className="secondary compact" pendingLabel="Cancelling...">Cancel request</PendingSubmitButton>
          </ActionForm>
        </div>
      ) : null}
    </article>
  );
}
