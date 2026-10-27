"use client";

import { useState, type KeyboardEvent } from "react";
import type { AppSnapshot } from "@/src/lib/app-data";
import {
  ADMIN_TABS,
  buildAttentionCounts,
  buildMakeupRows,
  DEFAULT_ADMIN_FILTERS,
  hasActiveFilters,
  type AdminFilters,
  type AdminTab
} from "@/src/lib/admin-workspace";
import { requestMonths } from "@/src/lib/approval-groups";
import { monthLabel } from "@/src/lib/report-calendar";
import { AdminAllowancesTab } from "./admin-allowances-tab";
import { AdminMakeupsTab } from "./admin-makeups-tab";
import { AdminPeopleTab } from "./admin-people-tab";
import { AdminRequestsTab, type RequestView } from "./admin-requests-tab";
import { DropdownField } from "./dropdown-field";

const TAB_LABELS: Record<AdminTab, string> = {
  requests: "Requests",
  makeups: "Make-ups",
  people: "People",
  allowances: "PTO allowances",
};

type AdminWorkspaceProps = {
  snapshot: AppSnapshot;
  viewerId?: string;
  today: string; // Pacific date, computed on the server so it matches the first render
  initialTab: AdminTab;
};

export function AdminWorkspace({ snapshot, viewerId, today, initialTab }: AdminWorkspaceProps) {
  const [filters, setFilters] = useState<AdminFilters>(DEFAULT_ADMIN_FILTERS);
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [requestView, setRequestView] = useState<RequestView>("Pending");

  const counts = buildAttentionCounts(snapshot, filters, viewerId, today);
  const update = (patch: Partial<AdminFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const filtered = hasActiveFilters(filters);

  // Keep the open tab in the URL so it can be linked to and survives a refresh, without a navigation.
  function openTab(next: AdminTab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = ADMIN_TABS.indexOf(tab);
    const next = ADMIN_TABS[(index + (event.key === "ArrowRight" ? 1 : ADMIN_TABS.length - 1)) % ADMIN_TABS.length];
    openTab(next);
    document.getElementById(`admin-tab-${next}`)?.focus();
  }

  const requesterIds = new Set(snapshot.requests.map((request) => request.employeeId));
  const employeeOptions = [
    { value: "all", label: "All employees" },
    ...snapshot.profiles
      .filter((profile) => !profile.protectedOwner && (requesterIds.has(profile.id) || profile.status !== "Disabled"))
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map((profile) => ({ value: profile.id, label: profile.fullName })),
  ];
  const monthOptions = [
    { value: "any", label: "Any month" },
    ...requestMonths(snapshot.requests).map((month) => ({ value: month, label: monthLabel(month) })),
  ];

  const badges: Partial<Record<AdminTab, number>> = {
    requests: counts.requestsToDecide,
    makeups: counts.makeupsToMark,
    people: counts.newSignups,
  };

  const cards = [
    { label: "Requests to decide", value: counts.requestsToDecide, urgent: counts.requestsToDecide > 0, go: () => { setRequestView("Pending"); openTab("requests"); } },
    { label: "Make-ups to mark", value: counts.makeupsToMark, urgent: counts.makeupsToMark > 0, go: () => openTab("makeups") },
    { label: "New sign-ups", value: counts.newSignups, urgent: counts.newSignups > 0, go: () => openTab("people") },
    { label: counts.offLabel, value: counts.offCount, urgent: false, go: () => { setRequestView("Approved"); openTab("requests"); } },
  ];

  return (
    <div className="admin-workspace">
      <div className="admin-filter-bar" role="search" aria-label="Filter the dashboard">
        <label>
          Employee
          <DropdownField ariaLabel="Employee" value={filters.employeeId} options={employeeOptions} placeholder="All employees" onChange={(employeeId) => update({ employeeId })} />
        </label>
        <label>
          Month
          <DropdownField ariaLabel="Month" value={filters.month} options={monthOptions} placeholder="Any month" onChange={(month) => update({ month })} />
        </label>
        <label className="admin-filter-search">
          Search
          <input type="search" value={filters.query} placeholder="Name, email or reason" onChange={(event) => update({ query: event.target.value })} />
        </label>
        {filtered ? (
          <button className="btn-ghost compact admin-filter-reset" type="button" onClick={() => setFilters(DEFAULT_ADMIN_FILTERS)}>
            Reset filters
          </button>
        ) : null}
      </div>

      <div className="attention-grid" aria-label={filtered ? "Needs attention (filtered)" : "Needs attention"}>
        {cards.map((card) => (
          <button key={card.label} type="button" className={`attention-card${card.urgent ? " is-urgent" : ""}`} onClick={card.go}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {ADMIN_TABS.map((key) => (
          <button
            key={key}
            id={`admin-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`admin-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            className="admin-tab"
            onClick={() => openTab(key)}
            onKeyDown={onTabKeyDown}
          >
            {TAB_LABELS[key]}
            {badges[key] ? <span className="admin-tab-badge">{badges[key]}</span> : null}
          </button>
        ))}
      </div>

      <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="admin-panel">
        {tab === "requests" ? (
          <AdminRequestsTab snapshot={snapshot} filters={filters} viewerId={viewerId} today={today} view={requestView} onViewChange={setRequestView} />
        ) : null}
        {tab === "makeups" ? (
          <AdminMakeupsTab rows={buildMakeupRows(snapshot, filters, viewerId, today)} />
        ) : null}
        {tab === "people" ? <AdminPeopleTab snapshot={snapshot} filters={filters} viewerId={viewerId} /> : null}
        {tab === "allowances" ? <AdminAllowancesTab snapshot={snapshot} filters={filters} /> : null}
      </div>
    </div>
  );
}
