import type { AppSnapshot } from "@/src/lib/app-data";
import type { AdminTab } from "@/src/lib/admin-workspace";
import { losAngelesDate } from "@/src/lib/app-time";
import { AdminWorkspace } from "./admin-workspace";
import { PageHeader } from "./page-header";

export function AdminDashboard({ snapshot, viewerId, initialTab = "requests" }: {
  snapshot: AppSnapshot;
  viewerId?: string;
  initialTab?: AdminTab;
}) {
  return (
    <section id="admin" className="page-section">
      <PageHeader eyebrow="Admin dashboard" title="Needs your attention" />
      <AdminWorkspace snapshot={snapshot} viewerId={viewerId} today={losAngelesDate()} initialTab={initialTab} />
    </section>
  );
}
