"use client";

import { useState } from "react";
import type { TimeOffRequest, UserProfile } from "@/src/lib/app-data";
import { verifyMakeupAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { DecisionControls } from "./decision-controls";
import { StatusBadge } from "./status-badge";
import { DeleteRequestForm } from "./delete-request-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { formatTimeRange12Hour, formatTimestampInLosAngeles, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { IconEdit } from "./icons";
import { RequestForm } from "./request-form";

// viewerId: the signed-in admin. Admins cannot decide or verify their own requests (separation of duties),
// so those controls are replaced by a note.
// Admins and Managers can fix a pending or approved request (their own included).
export function canAdminEdit(request: TimeOffRequest) {
  return request.status === "Pending" || request.status === "Approved";
}

export function AdminRequestCard({ request, profiles, viewerId, ptoRemaining }: {
  request: TimeOffRequest;
  profiles: UserProfile[];
  viewerId?: string;
  // The employee's PTO left, counting this request's own hours if it is approved PTO.
  ptoRemaining: number;
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const isOwnRequest = Boolean(viewerId) && request.employeeId === viewerId;
  const profile = profiles.find((item) => item.id === request.employeeId);
  const employeeName = profile?.fullName || "Unknown employee";
  const employeeEmail = profile?.email || "";

  if (editing) {
    return (
      <article className="request-card is-editing">
        <div>
          <strong title={employeeName}>{employeeName}</strong>
          {employeeEmail ? <span title={employeeEmail}>{employeeEmail}</span> : null}
        </div>
        <RequestForm
          mode="admin"
          editRequest={request}
          ptoRemaining={ptoRemaining}
          onCancel={() => setEditing(false)}
          onDone={(message) => { setEditing(false); setNotice(message); }}
        />
      </article>
    );
  }

  return (
    <article className="request-card">
      {notice ? <p className="notice success" role="status">{notice}</p> : null}
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
        {request.status === "Approved" && request.editedAt ? (
          <span title={`Edited ${formatTimestampInLosAngeles(request.editedAt)}`}><StatusBadge value="Edited" /></span>
        ) : null}
      </div>
      {request.makeupEntries.map((entry) => (
        <div className="makeup-line" key={entry.id}>
          <span>{formatWeekdayDateLabel(entry.date)} · {formatTimeRange12Hour(entry.startTime, entry.endTime)} · {entry.plannedHours}h</span>
          {/* Make-up work is only tracked (and markable) once the time off has been approved. */}
          {request.status === "Approved" ? <StatusBadge value={entry.verificationStatus} /> : null}
          {request.status === "Approved" && !isOwnRequest ? (
            <>
              <ActionForm action={verifyMakeupAction}>
                <input type="hidden" name="entryId" value={entry.id} />
                <input type="hidden" name="status" value="Worked" />
                <PendingSubmitButton className="secondary" pendingLabel="Saving...">Worked</PendingSubmitButton>
              </ActionForm>
              <ActionForm action={verifyMakeupAction}>
                <input type="hidden" name="entryId" value={entry.id} />
                <input type="hidden" name="status" value="Not Worked" />
                <PendingSubmitButton className="secondary" pendingLabel="Saving...">Not worked</PendingSubmitButton>
              </ActionForm>
            </>
          ) : null}
        </div>
      ))}
      {/* Destructive action last, separated from the everyday controls. */}
      <footer className="request-card-footer">
        {request.status === "Pending" && !isOwnRequest ? <DecisionControls requestId={request.id} /> : null}
        {isOwnRequest && (request.status === "Pending" || request.makeupEntries.some((entry) => entry.verificationStatus === "Pending")) ? (
          <p className="form-hint">This is your own request, so another admin needs to approve it and mark its make-up shifts.</p>
        ) : null}
        <div className="request-card-footer-actions">
          {canAdminEdit(request) ? (
            <button type="button" className="btn-ghost compact" onClick={() => { setNotice(""); setEditing(true); }}>
              <IconEdit />
              Edit
            </button>
          ) : null}
          <DeleteRequestForm requestId={request.id} />
        </div>
      </footer>
    </article>
  );
}
