"use client";

import Link from "next/link";
import { useState } from "react";
import type { MakeupEntry } from "@/src/lib/app-data";
import { formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";
import type { MonthPersonRow } from "@/src/lib/report-summary";
import { StatusBadge } from "./status-badge";

type MakeupState = "toMark" | "upcoming" | "worked" | "notWorked";
type Filter = "all" | MakeupState;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "toMark", label: "To mark" },
  { value: "upcoming", label: "Upcoming" },
  { value: "worked", label: "Worked" },
  { value: "notWorked", label: "Not worked" },
];
const STATE_LABELS: Record<MakeupState, string> = {
  toMark: "To mark",
  upcoming: "Upcoming",
  worked: "Worked",
  notWorked: "Not worked",
};
// A person's list starts short; the rest is behind "Show all".
const ROWS_BEFORE_MORE = 5;

function stateOf(entry: MakeupEntry, today: string): MakeupState {
  if (entry.verificationStatus === "Worked") return "worked";
  if (entry.verificationStatus === "Not Worked") return "notWorked";
  return entry.date <= today ? "toMark" : "upcoming";
}

export function ReportMakeupTab({ rows, today, monthName }: { rows: MonthPersonRow[]; today: string; monthName: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const all = rows.flatMap((row) => row.makeups.map((item) => stateOf(item.entry, today)));
  const count = (value: Filter) => value === "all" ? all.length : all.filter((state) => state === value).length;
  const groups = rows
    .map((row) => ({ row, items: row.makeups.filter(({ entry }) => filter === "all" || stateOf(entry, today) === filter) }))
    .filter((group) => group.items.length);

  return (
    <div className="report-makeup">
      <div className="segmented" role="group" aria-label="Make-up status">
        {FILTERS.map((option) => (
          <button key={option.value} type="button" className="segment" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
            {option.label} <span className="segment-count">{count(option.value)}</span>
          </button>
        ))}
      </div>

      {groups.length ? groups.map(({ row, items }) => {
        const expanded = showAll.has(row.profile.id);
        const visible = expanded ? items : items.slice(0, ROWS_BEFORE_MORE);
        return (
          <section className="report-makeup-group" key={row.profile.id} aria-label={row.profile.fullName}>
            <header className="report-makeup-head">
              <strong>{row.profile.fullName}</strong>
              <span>
                {row.makeupCount} shift{row.makeupCount === 1 ? "" : "s"} · {row.makeupPlannedHours}h planned · {row.makeupWorkedHours}h worked
              </span>
              <span className="pill-row">
                {row.toMark ? <StatusBadge value={`${row.toMark} to mark`} /> : null}
                {row.notWorkedCount ? <StatusBadge value={`${row.notWorkedCount} not worked`} /> : null}
              </span>
            </header>
            <ul className="report-makeup-list">
              {visible.map(({ entry }) => {
                const state = stateOf(entry, today);
                return (
                  <li key={entry.id}>
                    <span><strong>{formatWeekdayDateLabel(entry.date)}</strong> · {formatTimeRange12Hour(entry.startTime, entry.endTime)} PT · {entry.plannedHours}h</span>
                    <span className="report-makeup-state">
                      <StatusBadge value={STATE_LABELS[state]} />
                      {state === "toMark" ? <Link href="/admin?tab=makeups">Mark in Admin</Link> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            {items.length > ROWS_BEFORE_MORE ? (
              <button
                type="button"
                className="btn-ghost compact report-makeup-more"
                onClick={() => setShowAll((current) => {
                  const next = new Set(current);
                  if (expanded) next.delete(row.profile.id); else next.add(row.profile.id);
                  return next;
                })}
              >
                {expanded ? "Show fewer" : `Show all ${items.length}`}
              </button>
            ) : null}
          </section>
        );
      }) : (
        <p className="empty">No {filter === "all" ? "" : `${FILTERS.find((option) => option.value === filter)!.label.toLowerCase()} `}make-up shifts in {monthName}.</p>
      )}
    </div>
  );
}
