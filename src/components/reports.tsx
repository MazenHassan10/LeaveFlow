import type { AppSnapshot } from "@/src/lib/app-data";
import { PageHeader } from "./page-header";
import { EmployeeProfileCard } from "./employee-profile-card";
import { StatusBadge } from "./status-badge";
import { CardList } from "./card-list";
import { ReportCalendar } from "./report-calendar";
import { formatTimeRange12Hour, formatTimestampInLosAngeles, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { auditActionLabel, auditTargetLabel } from "@/src/lib/audit-labels";
import { monthLabel, parseMonthParam } from "@/src/lib/report-calendar";
import { roleTracksPto } from "@/src/lib/pto";
import { cn } from "@/src/lib/utils";
import { buttonVariants } from "./ui/button";

function nameFor(snapshot: AppSnapshot, id: string) {
  return snapshot.profiles.find((profile) => profile.id === id)?.fullName || "Unknown employee";
}

export function Reports({ snapshot, month }: { snapshot: AppSnapshot; month?: string }) {
  const currentMonth = parseMonthParam(month);
  // Follows the calendar's month; newest first.
  const makeupEntries = snapshot.requests
    .flatMap((request) => request.makeupEntries.map((entry) => ({ request, entry })))
    .filter(({ entry }) => entry.date.startsWith(currentMonth))
    .sort((left, right) => `${right.entry.date}${right.entry.startTime}`.localeCompare(`${left.entry.date}${left.entry.startTime}`));
  // Only people whose PTO is tracked and who are active; the owner account and disabled users are hidden.
  const reportProfiles = snapshot.profiles.filter((profile) =>
    profile.status === "Active" && !profile.protectedOwner && roleTracksPto(profile.role)
  );
  const nameByEmail = new Map(snapshot.profiles.map((profile) => [profile.email.toLowerCase(), profile.fullName]));

  return (
    <section id="reports" className="page-section">
      <PageHeader eyebrow="Reports" title="Profiles, make-up work, and logs" />
      <section className="panel export-panel">
        <div>
          <h2>Export {monthLabel(currentMonth)}</h2>
          <p className="form-hint">
            Approved hours off and make-up hours for payroll or HR. Opens in Excel or Google Sheets.
            Change the month with the calendar below.
          </p>
        </div>
        <div className="actions">
          <a className={cn(buttonVariants({ variant: "secondary", size: "sm" }))} href={`/api/export?month=${currentMonth}&type=summary`} download>
            Summary CSV
          </a>
          <a className={cn(buttonVariants({ variant: "secondary", size: "sm" }))} href={`/api/export?month=${currentMonth}&type=detail`} download>
            Detail CSV
          </a>
        </div>
      </section>
      <ReportCalendar snapshot={snapshot} month={month} />
      <section className="panel">
        <h2>Employee profiles</h2>
        <div className="profile-grid">
          {reportProfiles.map((profile) => (
            <EmployeeProfileCard key={profile.id} profile={profile} snapshot={snapshot} />
          ))}
        </div>
      </section>
      <div className="grid two">
        <section className="panel">
          <h2>Make-up work · {monthLabel(currentMonth)}</h2>
          <CardList empty="No make-up shifts this month.">
            {makeupEntries.map(({ request, entry }) => (
              <div className="list-card" key={entry.id}>
                <strong>{nameFor(snapshot, request.employeeId)}</strong>
                <span>{formatWeekdayDateLabel(entry.date)} · {formatTimeRange12Hour(entry.startTime, entry.endTime)} · {entry.plannedHours}h</span>
                <StatusBadge value={entry.verificationStatus} />
                {entry.verifiedBy ? <small>Verified by {entry.verifiedBy}</small> : null}
              </div>
            ))}
          </CardList>
        </section>
        <section className="panel">
          <h2>Audit logs</h2>
          <CardList empty="No audit events yet.">
            {snapshot.auditEvents.map((event) => (
              <div className="list-card" key={event.id}>
                <strong>{auditActionLabel(event.action)}</strong>
                <span>{nameByEmail.get(event.actorEmail.toLowerCase()) ?? event.actorEmail}</span>
                <small>{auditTargetLabel(event.targetType)} · {formatTimestampInLosAngeles(event.createdAt)}</small>
              </div>
            ))}
          </CardList>
        </section>
      </div>
    </section>
  );
}
