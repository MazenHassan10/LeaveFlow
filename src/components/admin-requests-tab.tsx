"use client";

import { useState } from "react";
import { bulkDecideAction } from "@/app/actions";
import type { AppSnapshot, TimeOffRequest } from "@/src/lib/app-data";
import { groupByPersonAndReason, requestMatches, type AdminFilters } from "@/src/lib/admin-workspace";
import { addCivilDays, formatTimeRange12Hour, formatTimestampInLosAngeles, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { RECENT_WINDOW_DAYS, requestEventDates } from "@/src/lib/approval-groups";
import { ActionForm } from "./action-form";
import { AdminRequestCard } from "./admin-request-card";
import { DecisionControls } from "./decision-controls";
import { DeleteRequestForm } from "./delete-request-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { StatusBadge } from "./status-badge";

export type RequestView = "Pending" | "Approved" | "Rejected" | "Cancelled";
const VIEWS: RequestView[] = ["Pending", "Approved", "Rejected", "Cancelled"];

type AdminRequestsTabProps = {
  snapshot: AppSnapshot;
  filters: AdminFilters;
  viewerId?: string;
  today: string;
  view: RequestView;
  onViewChange: (view: RequestView) => void;
};

export function AdminRequestsTab({ snapshot, filters, viewerId, today, view, onViewChange }: AdminRequestsTabProps) {
  const [showOlder, setShowOlder] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const byId = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const matching = snapshot.requests.filter((request) => requestMatches(request, filters, byId.get(request.employeeId)));
  const countFor = (status: RequestView) => matching.filter((request) => request.status === status).length;

  const pending = matching.filter((request) => request.status === "Pending");
  const selectableIds = new Set(pending.filter((request) => request.employeeId !== viewerId).map((request) => request.id));
  // Drop selections that are no longer pending (decided elsewhere, or filtered out).
  const activeSelection = [...selected].filter((id) => selectableIds.has(id));

  function toggle(ids: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const recentFrom = addCivilDays(today, -RECENT_WINDOW_DAYS);
  const decided = matching
    .filter((request) => request.status === view)
    .filter((request) => showOlder || requestEventDates(request).some((date) => date >= recentFrom));
  const hiddenOlder = countFor(view) - decided.length;

  return (
    <div className="requests-tab">
      <div className="segmented" role="group" aria-label="Request status">
        {VIEWS.map((status) => (
          <button key={status} type="button" aria-pressed={view === status} className="segment" onClick={() => onViewChange(status)}>
            {status} <span className="segment-count">{countFor(status)}</span>
          </button>
        ))}
      </div>

      {view === "Pending" ? (
        pending.length ? (
          <>
            {groupByPersonAndReason(pending, snapshot.profiles).map((group) => {
              const groupIds = group.requests.map((request) => request.id).filter((id) => selectableIds.has(id));
              const allChecked = groupIds.length > 0 && groupIds.every((id) => activeSelection.includes(id));
              const name = group.employee?.fullName ?? "Unknown employee";
              return (
                <section className="request-group" key={group.key} aria-label={`${name}: ${group.reason || "no reason"}`}>
                  <header className="request-group-head">
                    {/* A single request is selected from its own row; the group box is for 2+. */}
                    {groupIds.length > 1 ? (
                      <label className="check-hit">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          aria-label={`Select all of ${name}'s requests`}
                          onChange={(event) => toggle(groupIds, event.target.checked)}
                        />
                      </label>
                    ) : <span />}
                    <div className="request-group-title">
                      <strong>{name}</strong>
                      <span>
                        {group.reason ? `${group.reason} · ` : ""}
                        {group.requests.length} day{group.requests.length === 1 ? "" : "s"} · {group.offHours}h off
                        {group.makeupHours ? ` · ${group.makeupHours}h make-up` : ""}
                      </span>
                    </div>
                    {groupIds.length > 1 ? (
                      <ActionForm action={bulkDecideAction} className="request-group-approve">
                        {groupIds.map((id) => <input key={id} type="hidden" name="requestId" value={id} />)}
                        <input type="hidden" name="status" value="Approved" />
                        <PendingSubmitButton className="compact" pendingLabel="Approving...">Approve all {groupIds.length}</PendingSubmitButton>
                      </ActionForm>
                    ) : null}
                  </header>
                  {group.requests.map((request) => (
                    <PendingRow
                      key={request.id}
                      request={request}
                      isOwn={request.employeeId === viewerId}
                      checked={activeSelection.includes(request.id)}
                      onCheck={(on) => toggle([request.id], on)}
                    />
                  ))}
                </section>
              );
            })}
            {activeSelection.length ? (
              <BulkDecisionBar ids={activeSelection} onDone={() => setSelected(new Set())} onClear={() => setSelected(new Set())} />
            ) : null}
          </>
        ) : (
          <p className="empty">No requests are waiting for a decision{filters.employeeId !== "all" || filters.month !== "any" || filters.query ? " for these filters" : ""}.</p>
        )
      ) : (
        <>
          <div className="requests-tab-toolbar">
            <label className="checkbox-label">
              <input type="checkbox" checked={showOlder} onChange={(event) => setShowOlder(event.target.checked)} />
              Include older {view.toLowerCase()} requests
            </label>
            {!showOlder && hiddenOlder > 0 ? <small>{hiddenOlder} older hidden · showing the last {RECENT_WINDOW_DAYS} days and upcoming</small> : null}
          </div>
          {decided.length ? (
            <div className="stack">
              {decided.map((request) => (
                <AdminRequestCard key={request.id} request={request} profiles={snapshot.profiles} viewerId={viewerId} />
              ))}
            </div>
          ) : (
            <p className="empty">No {view.toLowerCase()} requests {showOlder ? "match these filters" : "in the last 30 days or coming up"}.</p>
          )}
        </>
      )}
    </div>
  );
}

function PendingRow({ request, isOwn, checked, onCheck }: {
  request: TimeOffRequest;
  isOwn: boolean;
  checked: boolean;
  onCheck: (on: boolean) => void;
}) {
  const firstMakeup = request.makeupEntries[0];
  return (
    <div className="pending-row">
      {isOwn ? <span /> : (
        <label className="check-hit">
          <input type="checkbox" checked={checked} aria-label={`Select request for ${request.segments.map((s) => formatWeekdayDateLabel(s.date)).join(", ")}`} onChange={(event) => onCheck(event.target.checked)} />
        </label>
      )}
      <div className="pending-row-main">
        <div className="pending-row-when">
          {request.segments.map((segment) => (
            <span key={segment.id}>
              <strong>{formatWeekdayDateLabel(segment.date)}</strong> · {formatTimeRange12Hour(segment.startTime, segment.endTime)} PT · {segment.requestedHours}h
            </span>
          ))}
          <span className="pill-row">
            <StatusBadge value={request.requestType === "PTO" ? "PTO" : request.requestType === "Emergency/Exception" ? "Emergency" : "Additional"} />
            {request.isLateNotice ? <StatusBadge value="Late notice" /> : null}
            {request.editedAt ? <StatusBadge value="Updated" /> : null}
          </span>
        </div>
        {firstMakeup ? (
          <small>
            Make-up: {formatWeekdayDateLabel(firstMakeup.date)} {formatTimeRange12Hour(firstMakeup.startTime, firstMakeup.endTime)}
            {request.makeupEntries.length > 1 ? ` + ${request.makeupEntries.length - 1} more` : ""} · {request.totalMakeupHours}h total
          </small>
        ) : null}
        <details className="pending-row-details">
          <summary>Details</summary>
          {request.makeupEntries.length ? (
            <ul className="schedule-list">
              {request.makeupEntries.map((entry) => (
                <li className="schedule-row" key={entry.id}>
                  <div>
                    <strong>{formatWeekdayDateLabel(entry.date)}</strong>
                    <span>{formatTimeRange12Hour(entry.startTime, entry.endTime)} PT · {entry.plannedHours}h make-up</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <small className="request-decision">
            Submitted {formatTimestampInLosAngeles(request.submittedAt)}
            {request.editedAt ? ` · edited ${formatTimestampInLosAngeles(request.editedAt)}` : ""}
          </small>
          <DeleteRequestForm requestId={request.id} />
        </details>
      </div>
      <div className="pending-row-actions">
        {isOwn ? <small className="form-hint">Your request · another admin decides</small> : <DecisionControls requestId={request.id} />}
      </div>
    </div>
  );
}

function BulkDecisionBar({ ids, onDone, onClear }: { ids: string[]; onDone: () => void; onClear: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const hidden = ids.map((id) => <input key={id} type="hidden" name="requestId" value={id} />);

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <span className="bulk-bar-count">{ids.length} selected</span>
      {rejecting ? (
        <ActionForm action={bulkDecideAction} className="bulk-bar-reject" onDone={onDone}>
          {hidden}
          <input type="hidden" name="status" value="Rejected" />
          <label>
            Reason for rejecting (sent to each employee)
            <textarea name="note" required maxLength={500} rows={2} autoFocus placeholder="We're short-staffed that week. Could you move it to the following week?" />
          </label>
          <div className="decision-buttons">
            <PendingSubmitButton className="btn-danger" pendingLabel="Rejecting...">Reject {ids.length}</PendingSubmitButton>
            <button type="button" className="btn-ghost compact" onClick={() => setRejecting(false)}>Back</button>
          </div>
        </ActionForm>
      ) : (
        <div className="decision-buttons">
          <ActionForm action={bulkDecideAction} onDone={onDone}>
            {hidden}
            <input type="hidden" name="status" value="Approved" />
            <PendingSubmitButton pendingLabel="Approving...">Approve {ids.length}</PendingSubmitButton>
          </ActionForm>
          <button type="button" className="secondary" onClick={() => setRejecting(true)}>Reject {ids.length}</button>
          <button type="button" className="btn-ghost compact" onClick={onClear}>Clear</button>
        </div>
      )}
    </div>
  );
}

