"use client";

import { Fragment, useState } from "react";
import type { AppSnapshot } from "@/src/lib/app-data";
import { formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { buildEmployeeProfileMetrics } from "@/src/lib/employee-profile-metrics";
import type { MonthPersonRow } from "@/src/lib/report-summary";
import { StatusBadge } from "./status-badge";

type SortKey = "name" | "pto" | "off" | "makeup" | "worked" | "notWorked" | "toMark";

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "name", label: "Person" },
  { key: "pto", label: "PTO this year" },
  { key: "off", label: "Off", numeric: true },
  { key: "makeup", label: "Make-up", numeric: true },
  { key: "worked", label: "Worked", numeric: true },
  { key: "notWorked", label: "Not worked", numeric: true },
  { key: "toMark", label: "To mark", numeric: true },
];

function sortValue(row: MonthPersonRow, key: SortKey): number | string {
  switch (key) {
    case "name": return row.profile.fullName.toLowerCase();
    case "pto": return row.balance ? row.balance.usedHours / (row.balance.annualAllowanceHours || 1) : -1;
    case "off": return row.offHours;
    case "makeup": return row.makeupPlannedHours;
    case "worked": return row.makeupWorkedHours;
    case "notWorked": return row.makeupNotWorkedHours;
    case "toMark": return row.toMark;
  }
}

function PtoUsage({ row }: { row: MonthPersonRow }) {
  if (!row.balance) return <span className="muted-text">Not tracked</span>;
  const { usedHours, annualAllowanceHours, remainingHours } = row.balance;
  const share = annualAllowanceHours > 0 ? Math.min(usedHours / annualAllowanceHours, 1) : 1;
  return (
    <span className="pto-usage" title={`${remainingHours}h left`}>
      <span>{usedHours}h of {annualAllowanceHours}h</span>
      <span className={`usage-bar${share >= 0.9 ? " is-high" : ""}`} aria-hidden="true">
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
    </span>
  );
}

export function ReportPeopleTab({ rows, snapshot, month, monthName }: { rows: MonthPersonRow[]; snapshot: AppSnapshot; month: string; monthName: string }) {
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "name", descending: false });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!rows.length) return <p className="empty">No one to show for {monthName}.</p>;

  const sorted = [...rows].sort((left, right) => {
    const a = sortValue(left, sort.key);
    const b = sortValue(right, sort.key);
    const order = typeof a === "string" ? a.localeCompare(String(b)) : a - Number(b);
    return (sort.descending ? -order : order) || left.profile.fullName.localeCompare(right.profile.fullName);
  });

  function sortBy(key: SortKey) {
    // Names start A to Z; numbers start with the biggest.
    setSort((current) => current.key === key ? { key, descending: !current.descending } : { key, descending: key !== "name" });
  }

  return (
    <div className="data-table report-people-table" role="table" aria-label={`People, ${monthName}`}>
      <div className="data-row data-head" role="row">
        {COLUMNS.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className={column.numeric ? "align-end" : undefined}
            aria-sort={sort.key === column.key ? (sort.descending ? "descending" : "ascending") : "none"}
          >
            <button type="button" className="sort-button" onClick={() => sortBy(column.key)}>
              {column.label}
              <span aria-hidden="true">{sort.key === column.key ? (sort.descending ? "↓" : "↑") : ""}</span>
            </button>
          </span>
        ))}
      </div>
      {sorted.map((row) => {
        const isOpen = expanded === row.profile.id;
        const worked = isOpen
          ? buildEmployeeProfileMetrics(snapshot.requests.filter((request) => request.employeeId === row.profile.id)).workedMakeupDates
          : [];
        return (
          <Fragment key={row.profile.id}>
            <div className={`data-row${isOpen ? " is-open" : ""}`} role="row">
              <span role="cell" className="data-primary">
                <button
                  type="button"
                  className="person-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : row.profile.id)}
                >
                  <strong title={row.profile.fullName}>{row.profile.fullName}</strong>
                  <span aria-hidden="true" className="person-toggle-icon">{isOpen ? "−" : "+"}</span>
                </button>
                <small>{row.profile.role}{row.profile.status !== "Active" ? ` · ${row.profile.status}` : ""}</small>
              </span>
              <span role="cell" data-label="PTO this year"><PtoUsage row={row} /></span>
              <span role="cell" data-label="Off" className="align-end num">{row.offHours}h</span>
              <span role="cell" data-label="Make-up" className="align-end num">{row.makeupPlannedHours}h</span>
              <span role="cell" data-label="Worked" className="align-end num">{row.makeupWorkedHours}h</span>
              <span role="cell" data-label="Not worked" className="align-end num">{row.makeupNotWorkedHours}h</span>
              <span role="cell" data-label="To mark" className="align-end num">
                {row.toMark ? <StatusBadge value={String(row.toMark)} /> : 0}
              </span>
            </div>
            {isOpen ? (
              <div className="report-person-detail" role="row">
                <div role="cell">
                  <h3>Time off in {monthName}</h3>
                  {row.requests.length ? (
                    <ul className="plain-list">
                      {row.requests.flatMap((request) => request.segments.filter((segment) => segment.date.startsWith(month)).map((segment) => (
                        <li key={segment.id}>
                          <strong>{formatWeekdayDateLabel(segment.date)}</strong> · {formatTimeRange12Hour(segment.startTime, segment.endTime)} PT · {segment.requestedHours}h
                          <small>{request.requestType}{request.reason ? ` · ${request.reason}` : ""}</small>
                        </li>
                      )))}
                    </ul>
                  ) : <p className="form-hint">No approved time off this month.</p>}
                </div>
                <div role="cell">
                  <h3>Latest worked make-up</h3>
                  {worked.length ? (
                    <ul className="plain-list">
                      {worked.map((entry) => (
                        <li key={entry.id}>
                          <strong>{formatWeekdayDateLabel(entry.date)}</strong> · {formatTimeRange12Hour(entry.startTime, entry.endTime)} PT · {entry.hours}h
                        </li>
                      ))}
                    </ul>
                  ) : <p className="form-hint">No worked make-up shifts yet.</p>}
                </div>
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
