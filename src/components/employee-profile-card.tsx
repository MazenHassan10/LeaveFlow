import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { StatusBadge } from "./status-badge";
import { Stat } from "./stat";

export function EmployeeProfileCard({ profile, snapshot }: { profile: UserProfile; snapshot: AppSnapshot }) {
  const balance = snapshot.balances[profile.id];
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);
  const pendingMakeup = requests
    .flatMap((request) => request.makeupEntries)
    .filter((entry) => entry.verificationStatus === "Pending").length;

  return (
    <article className="profile-card">
      <div className="avatar">{profile.fullName.slice(0, 2).toUpperCase()}</div>
      <div className="profile-main">
        <strong>{profile.fullName}</strong>
        <span>{profile.email}</span>
        <div className="pill-row">
          <StatusBadge value={profile.role} />
          <StatusBadge value={profile.status} />
          {profile.protectedOwner ? <StatusBadge value="Owner" /> : null}
        </div>
      </div>
      <div className="stat-grid">
        <Stat label="Used" value={`${balance?.usedHours ?? 0}h`} />
        <Stat label="Left" value={`${balance?.remainingHours ?? 0}h`} />
        <Stat label="Approved" value={requests.filter((r) => r.status === "Approved").length} />
        <Stat label="Pending" value={requests.filter((r) => r.status === "Pending").length} />
        <Stat label="Requested" value={`${requests.reduce((total, r) => total + r.totalRequestedHours, 0)}h`} />
        <Stat label="Make-up review" value={pendingMakeup} />
      </div>
    </article>
  );
}
