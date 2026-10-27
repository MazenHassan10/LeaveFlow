import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { losAngelesDate, losAngelesYear } from "@/src/lib/app-time";
import { buildUpcomingEvents, groupEmployeeRequests } from "@/src/lib/employee-schedule";
import { PTO_ALLOWANCE_HOURS } from "@/src/lib/pto";
import { PageHeader } from "./page-header";
import { RequestForm } from "./request-form";
import { RequestCard } from "./request-card";
import { CardList } from "./card-list";
import { BalanceRing } from "./balance-ring";
import { UpcomingSchedule } from "./upcoming-schedule";

export function EmployeePortal({
  profile,
  snapshot,
  editRequestId,
  justUpdated
}: {
  profile: UserProfile;
  snapshot: AppSnapshot;
  editRequestId?: string;
  justUpdated?: boolean;
}) {
  const calendarYear = losAngelesYear();
  const today = losAngelesDate();
  const balance = snapshot.balances[profile.id] || {
    employeeId: profile.id,
    calendarYear,
    annualAllowanceHours: PTO_ALLOWANCE_HOURS,
    usedHours: 0,
    remainingHours: PTO_ALLOWANCE_HOURS,
    expiresOn: `${calendarYear}-12-31`,
  };
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);
  const groups = groupEmployeeRequests(requests, today);
  // Only the employee's own pending request can be edited; anything else falls back to a new request.
  const editRequest = groups.pending.find((request) => request.id === editRequestId) ?? null;

  return (
    <section id="employee" className="page-section">
      <PageHeader
        eyebrow="Employee portal"
        title="Request time off"
        metric={`${balance.remainingHours}h`}
        metricLabel="PTO left"
      />
      {justUpdated ? <p className="notice success">Request updated. Admins have been notified.</p> : null}
      <div className="grid two">
        <RequestForm key={editRequest?.id ?? "new"} ptoRemaining={balance.remainingHours} editRequest={editRequest} />
        <section className="panel">
          <UpcomingSchedule events={buildUpcomingEvents(snapshot, today)} />
          <h2>My balance</h2>
          <BalanceRing
            used={balance.usedHours}
            total={balance.annualAllowanceHours}
            remaining={balance.remainingHours}
          />
          <h2>My requests</h2>
          {groups.pending.length ? (
            <>
              <p className="schedule-label">Awaiting approval ({groups.pending.length})</p>
              <CardList empty="">
                {groups.pending.map((request) => <RequestCard key={request.id} request={request} />)}
              </CardList>
            </>
          ) : null}
          {groups.upcoming.length ? (
            <>
              <p className="schedule-label">Approved and coming up ({groups.upcoming.length})</p>
              <CardList empty="">
                {groups.upcoming.map((request) => <RequestCard key={request.id} request={request} />)}
              </CardList>
            </>
          ) : null}
          {groups.past.length ? (
            <details className="past-requests">
              <summary>Past and closed requests ({groups.past.length})</summary>
              <CardList empty="">
                {groups.past.map((request) => <RequestCard key={request.id} request={request} />)}
              </CardList>
            </details>
          ) : null}
          {!requests.length ? <p className="empty">No requests yet.</p> : null}
        </section>
      </div>
    </section>
  );
}
