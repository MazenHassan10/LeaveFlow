import type { AppSnapshot } from "@/src/lib/app-data";
import { formatTimestampInLosAngeles, losAngelesDate } from "@/src/lib/app-time";
import { auditActionLabel, auditTargetLabel } from "@/src/lib/audit-labels";
import { parseMonthParam } from "@/src/lib/report-calendar";
import { CardList } from "./card-list";
import { PageHeader } from "./page-header";
import { parseReportView } from "@/src/lib/report-views";
import { ReportsWorkspace } from "./reports-workspace";

type ReportsProps = {
  snapshot: AppSnapshot;
  month?: string;
  view?: string;
  person?: string;
};

export function Reports({ snapshot, month, view, person }: ReportsProps) {
  const today = losAngelesDate();
  const currentMonth = parseMonthParam(month);
  const nameByEmail = new Map(snapshot.profiles.map((profile) => [profile.email.toLowerCase(), profile.fullName]));

  const activityTab = (
    <section className="panel">
      <CardList empty="No activity yet.">
        {snapshot.auditEvents.map((event) => (
          <div className="list-card" key={event.id}>
            <strong>{auditActionLabel(event.action)}</strong>
            <span>{nameByEmail.get(event.actorEmail.toLowerCase()) ?? event.actorEmail}</span>
            <small>{auditTargetLabel(event.targetType)} · {formatTimestampInLosAngeles(event.createdAt)}</small>
          </div>
        ))}
      </CardList>
    </section>
  );

  return (
    <section id="reports" className="page-section">
      <PageHeader eyebrow="Reports" title="Time off and make-up, month by month" />
      <ReportsWorkspace
        snapshot={snapshot}
        month={currentMonth}
        thisMonth={today.slice(0, 7)}
        today={today}
        initialView={parseReportView(view)}
        initialPerson={person ?? "all"}
        activityTab={activityTab}
      />
    </section>
  );
}
