"use client";

import { useState } from "react";
import { bulkVerifyMakeupAction, verifyMakeupAction } from "@/app/actions";
import type { MakeupRow } from "@/src/lib/admin-workspace";
import { formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { ActionForm } from "./action-form";
import { PendingSubmitButton } from "./pending-submit-button";

export function AdminMakeupsTab({ rows }: { rows: { due: MakeupRow[]; upcoming: MakeupRow[] } }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = rows.due.filter((row) => !row.isOwn).map((row) => row.entry.id);
  const activeSelection = [...selected].filter((id) => selectable.includes(id));
  const allChecked = selectable.length > 0 && activeSelection.length === selectable.length;

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

  return (
    <div className="makeups-tab">
      <p className="form-hint">Shifts that have already happened and still need marking. Oldest first.</p>
      {selectable.length > 1 ? (
        <label className="checkbox-label makeups-select-all">
          <input type="checkbox" checked={allChecked} onChange={(event) => toggle(selectable, event.target.checked)} />
          Select all {selectable.length} shifts
        </label>
      ) : null}
      {rows.due.length ? (
        <div className="data-table makeup-table" role="table" aria-label="Make-up shifts to mark">
          <div className="data-row data-head" role="row">
            <span role="columnheader"><span className="sr-only">Select</span></span>
            <span role="columnheader">Employee</span>
            <span role="columnheader">Shift (PT)</span>
            <span role="columnheader">Hours</span>
            <span role="columnheader" className="align-end">Mark</span>
          </div>
          {rows.due.map((row) => (
            <div className="data-row" role="row" key={row.entry.id}>
              <span role="cell">
                {row.isOwn ? null : (
                  <label className="check-hit">
                    <input
                      type="checkbox"
                      checked={activeSelection.includes(row.entry.id)}
                      aria-label={`Select ${row.employee?.fullName ?? "employee"}'s ${formatWeekdayDateLabel(row.entry.date)} shift`}
                      onChange={(event) => toggle([row.entry.id], event.target.checked)}
                    />
                  </label>
                )}
              </span>
              <span role="cell" className="data-primary">
                <strong>{row.employee?.fullName ?? "Unknown employee"}</strong>
                {row.request.reason ? <small>{row.request.reason}</small> : null}
              </span>
              <span role="cell">{formatWeekdayDateLabel(row.entry.date)} · {formatTimeRange12Hour(row.entry.startTime, row.entry.endTime)}</span>
              <span role="cell">{row.entry.plannedHours}h</span>
              <span role="cell" className="align-end row-actions">
                {row.isOwn ? (
                  <small className="form-hint">Another admin marks this</small>
                ) : (
                  <>
                    <ActionForm action={verifyMakeupAction}>
                      <input type="hidden" name="entryId" value={row.entry.id} />
                      <input type="hidden" name="status" value="Worked" />
                      <PendingSubmitButton className="secondary compact" pendingLabel="Saving...">Worked</PendingSubmitButton>
                    </ActionForm>
                    <ActionForm action={verifyMakeupAction}>
                      <input type="hidden" name="entryId" value={row.entry.id} />
                      <input type="hidden" name="status" value="Not Worked" />
                      <PendingSubmitButton className="secondary compact" pendingLabel="Saving...">Not worked</PendingSubmitButton>
                    </ActionForm>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">Every past make-up shift has been marked.</p>
      )}

      {activeSelection.length ? (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <span className="bulk-bar-count">{activeSelection.length} selected</span>
          <div className="decision-buttons">
            {(["Worked", "Not Worked"] as const).map((status) => (
              <ActionForm key={status} action={bulkVerifyMakeupAction} onDone={() => setSelected(new Set())}>
                {activeSelection.map((id) => <input key={id} type="hidden" name="entryId" value={id} />)}
                <input type="hidden" name="status" value={status} />
                <PendingSubmitButton className={status === "Worked" ? undefined : "secondary"} pendingLabel="Saving...">
                  Mark {status === "Worked" ? "worked" : "not worked"}
                </PendingSubmitButton>
              </ActionForm>
            ))}
            <button type="button" className="btn-ghost compact" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      ) : null}

      {rows.upcoming.length ? (
        <details className="past-requests">
          <summary>Upcoming make-up shifts ({rows.upcoming.length})</summary>
          <ul className="schedule-list">
            {rows.upcoming.map((row) => (
              <li className="schedule-row" key={row.entry.id}>
                <div>
                  <strong>{formatWeekdayDateLabel(row.entry.date)} · {row.employee?.fullName ?? "Unknown employee"}</strong>
                  <span>{formatTimeRange12Hour(row.entry.startTime, row.entry.endTime)} PT · {row.entry.plannedHours}h</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
