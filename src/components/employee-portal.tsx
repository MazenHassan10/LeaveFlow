import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { PageHeader } from "./page-header";
import { RequestForm } from "./request-form";
import { RequestCard } from "./request-card";
import { CardList } from "./card-list";
import { BalanceRing } from "./balance-ring";
import { losAngelesYear } from "@/src/lib/app-time";

export function EmployeePortal({ profile, snapshot }: { profile: UserProfile; snapshot: AppSnapshot }) {
  const calendarYear = losAngelesYear();
  const balance = snapshot.balances[profile.id] || {
    employeeId: profile.id,
    calendarYear,
    annualAllowanceHours: 48,
    usedHours: 0,
    remainingHours: 48,
    expiresOn: `${calendarYear}-12-31`,
  };
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);

  return (
    <section id="employee" className="page-section">
      <PageHeader
        eyebrow="Employee portal"
        title="Request time off"
        metric={`${balance.remainingHours}h`}
        metricLabel="PTO left"
      />
      <div className="grid two">
        <RequestForm />
        <section className="panel">
          <h2>My balance</h2>
          <BalanceRing
            used={balance.usedHours}
            total={balance.annualAllowanceHours}
            remaining={balance.remainingHours}
          />
          <h2>My requests</h2>
          <CardList empty="No requests yet.">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </CardList>
        </section>
      </div>
    </section>
  );
}
