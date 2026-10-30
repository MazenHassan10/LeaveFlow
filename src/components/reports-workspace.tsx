"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { AppSnapshot } from "@/src/lib/app-data";
import { addMonths, buildReportCalendarEvents, buildShortNames, monthLabel } from "@/src/lib/report-calendar";
import { buildMonthSummary, monthPeople } from "@/src/lib/report-summary";
import { REPORT_VIEWS, type ReportView } from "@/src/lib/report-views";
import { DropdownField } from "./dropdown-field";
import { IconChevronLeft } from "./icons";
import { ReportCalendar } from "./report-calendar";
import { ReportMakeupTab } from "./report-makeup-tab";
import { ReportPeopleTab } from "./report-people-tab";

const VIEW_LABELS: Record<ReportView, string> = {
  calendar: "Calendar",
  people: "People",
  makeup: "Make-up",
  activity: "Activity",
};

type ReportsWorkspaceProps = {
  snapshot: AppSnapshot;
  month: string;
  thisMonth: string;
  today: string;
  initialView: ReportView;
  initialPerson: string;
  // Activity is rendered on the server and passed in.
  activityTab: ReactNode;
};

export function ReportsWorkspace({ snapshot, month, thisMonth, today, initialView, initialPerson, activityTab }: ReportsWorkspaceProps) {
  const [view, setView] = useState<ReportView>(initialView);
  const [person, setPerson] = useState(initialPerson);

  const people = monthPeople(snapshot, month);
  const personId = people.some((profile) => profile.id === person) ? person : "all";
  const { rows, totals } = buildMonthSummary(snapshot, month, { personId, today });
  const events = buildReportCalendarEvents(snapshot).filter((event) => personId === "all" || event.employeeId === personId);
  const shortNames = buildShortNames(snapshot.profiles);
  const monthName = monthLabel(month);

  // Tab and person live in the URL so links and refreshes keep them, without reloading the page.
  function syncUrl(next: { view?: ReportView; person?: string }) {
    const url = new URL(window.location.href);
    const nextView = next.view ?? view;
    const nextPerson = next.person ?? personId;
    if (nextView === "calendar") url.searchParams.delete("view"); else url.searchParams.set("view", nextView);
    if (nextPerson === "all") url.searchParams.delete("person"); else url.searchParams.set("person", nextPerson);
    window.history.replaceState(window.history.state, "", url);
  }

  function openView(next: ReportView) {
    setView(next);
    syncUrl({ view: next });
  }

  function pickPerson(next: string) {
    setPerson(next);
    syncUrl({ person: next });
  }

  function monthHref(target: string) {
    const params = new URLSearchParams({ month: target });
    if (view !== "calendar") params.set("view", view);
    if (personId !== "all") params.set("person", personId);
    return `/reports?${params}`;
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = REPORT_VIEWS.indexOf(view);
    const next = REPORT_VIEWS[(index + (event.key === "ArrowRight" ? 1 : REPORT_VIEWS.length - 1)) % REPORT_VIEWS.length];
    openView(next);
    document.getElementById(`report-tab-${next}`)?.focus();
  }

  const personOptions = [
    { value: "all", label: "Everyone" },
    ...people.map((profile) => ({ value: profile.id, label: profile.fullName })),
  ];

  return (
    <div className="admin-workspace reports-workspace">
      <div className="report-month-bar" role="group" aria-label="Report month and filters">
        <div className="report-month-nav">
          <Link className="btn-ghost compact icon-only month-step" href={monthHref(addMonths(month, -1))} aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}>
            <IconChevronLeft />
          </Link>
          <h2 className="report-month-title">{monthName}</h2>
          <Link className="btn-ghost compact icon-only month-step is-next" href={monthHref(addMonths(month, 1))} aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}>
            <IconChevronLeft />
          </Link>
          {month !== thisMonth ? <Link className="btn-ghost compact" href={monthHref(thisMonth)}>This month</Link> : null}
        </div>
        <label className="report-person-filter">
          <span className="sr-only">Person</span>
          <DropdownField ariaLabel="Person" value={personId} options={personOptions} placeholder="Everyone" onChange={pickPerson} />
        </label>
        <details className="export-menu">
          <summary>Export {monthName}</summary>
          <div className="export-menu-list">
            <a href={`/api/export?month=${month}&type=summary`} download>
              <strong>Summary CSV</strong>
              <small>One row per person: hours off and make-up</small>
            </a>
            <a href={`/api/export?month=${month}&type=detail`} download>
              <strong>Detail CSV</strong>
              <small>Every day off and make-up shift</small>
            </a>
          </div>
        </details>
      </div>

      <div className="attention-grid report-totals" aria-label={`Totals for ${monthName}${personId !== "all" ? ", one person" : ""}`}>
        <div className="attention-card">
          <span>Time off approved</span>
          <strong>{totals.offHours}h</strong>
          <small>{totals.ptoHours}h PTO · {totals.otherOffHours}h other</small>
        </div>
        <div className="attention-card">
          <span>People off</span>
          <strong>{totals.peopleOff}</strong>
          <small>of {rows.length} {rows.length === 1 ? "person" : "people"}</small>
        </div>
        <div className="attention-card">
          <span>Make-up planned</span>
          <strong>{totals.makeupPlannedHours}h</strong>
          <small>{totals.makeupCount} shift{totals.makeupCount === 1 ? "" : "s"}</small>
        </div>
        <div className="attention-card">
          <span>Make-up worked</span>
          <strong>{totals.makeupWorkedHours}h</strong>
          <small>{totals.notWorkedCount} not worked</small>
        </div>
        <Link className={`attention-card${totals.toMark ? " is-urgent" : ""}`} href="/admin?tab=makeups">
          <span>Still to mark</span>
          <strong>{totals.toMark}</strong>
          <small>{totals.toMark ? "Mark them in Admin" : "All caught up"}</small>
        </Link>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Report sections">
        {REPORT_VIEWS.map((key) => (
          <button
            key={key}
            id={`report-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={view === key}
            aria-controls={`report-panel-${key}`}
            tabIndex={view === key ? 0 : -1}
            className="admin-tab"
            onClick={() => openView(key)}
            onKeyDown={onTabKeyDown}
          >
            {VIEW_LABELS[key]}
          </button>
        ))}
      </div>

      <div id={`report-panel-${view}`} role="tabpanel" aria-labelledby={`report-tab-${view}`} className="admin-panel">
        {view === "calendar" ? <ReportCalendar month={month} today={today} events={events} shortNames={shortNames} /> : null}
        {view === "people" ? <ReportPeopleTab rows={rows} snapshot={snapshot} month={month} monthName={monthName} /> : null}
        {view === "makeup" ? <ReportMakeupTab rows={rows} today={today} monthName={monthName} /> : null}
        {view === "activity" ? activityTab : null}
      </div>
    </div>
  );
}
