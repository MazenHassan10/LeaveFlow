import type { AppSnapshot } from "@/src/lib/app-data";
import { PageHeader } from "./page-header";
import { EmployeeProfileCard } from "./employee-profile-card";
import { StatusBadge } from "./status-badge";
import { CardList } from "./card-list";

function nameFor(snapshot: AppSnapshot, id: string) {
  return snapshot.profiles.find((profile) => profile.id === id)?.fullName || "Unknown employee";
}

export function Reports({ snapshot }: { snapshot: AppSnapshot }) {
  const makeupEntries = snapshot.requests.flatMap((request) =>
    request.makeupEntries.map((entry) => ({ request, entry }))
  );

  return (
    <section id="reports" className="page-section">
      <PageHeader eyebrow="Reports" title="Profiles, make-up work, and logs" />
      <section className="panel">
        <h2>Employee profiles</h2>
        <div className="profile-grid">
          {snapshot.profiles.map((profile) => (
            <EmployeeProfileCard key={profile.id} profile={profile} snapshot={snapshot} />
          ))}
        </div>
      </section>
      <div className="grid two">
        <section className="panel">
          <h2>Make-up work</h2>
          <CardList empty="No make-up entries yet.">
            {makeupEntries.map(({ request, entry }) => (
              <div className="list-card" key={entry.id}>
                <strong>{nameFor(snapshot, request.employeeId)}</strong>
                <span>{entry.date} · {entry.startTime}-{entry.endTime} · {entry.plannedHours}h</span>
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
                <strong>{event.action}</strong>
                <span>{event.actorEmail}</span>
                <small>{event.targetType} · {new Date(event.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </CardList>
        </section>
      </div>
    </section>
  );
}
