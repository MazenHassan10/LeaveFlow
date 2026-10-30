import type { AppSnapshot, AuditEvent } from "@/src/lib/app-data";
import { losAngelesDate } from "@/src/lib/app-time";
import { parseMonthParam } from "@/src/lib/report-calendar";
import { parseReportView } from "@/src/lib/report-views";
import { PageHeader } from "./page-header";
import { ReportsWorkspace } from "./reports-workspace";

type ReportsProps = {
  snapshot: AppSnapshot;
  // This month's audit events; the snapshot only carries the latest few.
  activity: AuditEvent[];
  month?: string;
  view?: string;
  person?: string;
};

export function Reports({ snapshot, activity, month, view, person }: ReportsProps) {
  const today = losAngelesDate();
  return (
    <section id="reports" className="page-section">
      <PageHeader eyebrow="Reports" title="Time off and make-up, month by month" />
      <ReportsWorkspace
        snapshot={snapshot}
        month={parseMonthParam(month)}
        thisMonth={today.slice(0, 7)}
        today={today}
        initialView={parseReportView(view)}
        initialPerson={person ?? "all"}
        activity={activity}
      />
    </section>
  );
}
