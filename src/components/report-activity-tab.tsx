"use client";

import { useState } from "react";
import type { AppSnapshot, AuditEvent } from "@/src/lib/app-data";
import { formatTimestampInLosAngeles } from "@/src/lib/app-time";
import { buildEmailAliases, describeAuditEvent, type ActivityCategory } from "@/src/lib/audit-labels";

type Filter = "all" | Exclude<ActivityCategory, "other">;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "decisions", label: "Decisions" },
  { value: "requests", label: "Requests" },
  { value: "makeup", label: "Make-up marks" },
  { value: "people", label: "People" },
];
const PAGE_SIZE = 25;

type ReportActivityTabProps = {
  events: AuditEvent[];
  snapshot: AppSnapshot;
  // "all" or a profile id: shows events by that person or about them.
  personId: string;
  monthName: string;
};

export function ReportActivityTab({ events, snapshot, personId, monthName }: ReportActivityTabProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const person = personId === "all" ? null : snapshot.profiles.find((profile) => profile.id === personId) ?? null;
  const aliases = buildEmailAliases(events);
  const lines = events
    .map((event) => ({ event, line: describeAuditEvent(event, snapshot, aliases) }))
    .filter(({ line }) => !person || line.subjectId === person.id || line.actorId === person.id);
  const count = (value: Filter) => value === "all" ? lines.length : lines.filter(({ line }) => line.category === value).length;
  const visible = lines.filter(({ line }) => filter === "all" || line.category === filter);

  return (
    <div className="report-activity">
      <div className="segmented" role="group" aria-label="Activity type">
        {FILTERS.map((option) => (
          <button key={option.value} type="button" className="segment" aria-pressed={filter === option.value} onClick={() => { setFilter(option.value); setShown(PAGE_SIZE); }}>
            {option.label} <span className="segment-count">{count(option.value)}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <ol className="activity-list">
          {visible.slice(0, shown).map(({ event, line }) => (
            <li key={event.id}>
              <time dateTime={event.createdAt}>{formatTimestampInLosAngeles(event.createdAt)}</time>
              <p>
                <strong>{line.actor}</strong> {line.text}
                {line.detail ? <small>{line.detail}</small> : null}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">No activity{person ? ` for ${person.fullName}` : ""} in {monthName}.</p>
      )}

      {visible.length > shown ? (
        <button type="button" className="btn-ghost compact activity-more" onClick={() => setShown((current) => current + PAGE_SIZE)}>
          Show more ({visible.length - shown} left)
        </button>
      ) : null}
    </div>
  );
}
