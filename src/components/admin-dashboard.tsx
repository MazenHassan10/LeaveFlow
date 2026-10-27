import type { AppSnapshot } from "@/src/lib/app-data";
import { roleTracksPto } from "@/src/lib/pto";
import { PageHeader } from "./page-header";
import { MetricCard } from "./metric-card";
import { UserRoleForm } from "./user-role-form";
import { PtoAllowanceForm } from "./pto-allowance-form";
import { CardList } from "./card-list";
import { ApprovalSections } from "./approval-sections";

export function AdminDashboard({ snapshot, viewerId }: { snapshot: AppSnapshot; viewerId?: string }) {
  const requests = snapshot.requests;
  const editableProfiles = snapshot.profiles.filter((profile) => !profile.protectedOwner);

  return (
    <section id="admin" className="page-section">
      <PageHeader
        eyebrow="Admin dashboard"
        title="Approvals and access"
        metric={`${requests.filter((r) => r.status === "Pending").length}`}
        metricLabel="pending"
      />
      <div className="metric-grid">
        <MetricCard label="Active employees" value={snapshot.profiles.filter((p) => p.status === "Active").length} />
        <MetricCard label="Pending users" value={snapshot.profiles.filter((p) => p.status === "Pending").length} />
        <MetricCard label="Make-up awaiting review" value={snapshot.requests.flatMap((r) => r.makeupEntries).filter((e) => e.verificationStatus === "Pending").length} />
      </div>
      <div className="grid two">
        <section className="panel">
          <h2>Time-off approvals</h2>
          <ApprovalSections snapshot={snapshot} viewerId={viewerId} />
        </section>
        <section className="panel">
          <h2>User roles</h2>
          <CardList empty="No editable users yet.">
            {editableProfiles.map((profile) => (
              <UserRoleForm key={profile.id} profile={profile} isSelf={profile.id === viewerId} />
            ))}
          </CardList>
        </section>
      </div>
      <section className="panel">
        <h2>PTO allowances</h2>
        <CardList empty="No editable employee balances yet.">
          {editableProfiles
            .filter((profile) => roleTracksPto(profile.role))
            .map((profile) => (
              <PtoAllowanceForm key={profile.id} profile={profile} balance={snapshot.balances[profile.id]} />
            ))}
        </CardList>
      </section>
    </section>
  );
}
