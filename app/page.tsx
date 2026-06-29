import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { LoginButton, SignOutButton } from "@/src/components/auth-buttons";
import {
  AppSnapshot,
  TimeOffRequest,
  UserProfile,
  ensureProfile,
  getSnapshot,
  isAdmin
} from "@/src/lib/app-data";
import {
  setRequestStatusAction,
  submitTimeOffRequest,
  updateUserProfileAction,
  verifyMakeupAction
} from "./actions";

async function getSessionProfile() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.email) return { session: null, profile: null, setupError: null };
    const profile = await ensureProfile({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    });
    return { session, profile, setupError: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      setupError: error instanceof Error ? error.message : "Authentication is not configured yet."
    };
  }
}

export default async function Home() {
  const { profile, setupError } = await getSessionProfile();

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active") return <PendingScreen profile={profile} />;

  const snapshot = await getSnapshot();
  return (
    <Shell profile={profile}>
      <EmployeePortal profile={profile} snapshot={snapshot} />
      {isAdmin(profile) ? <AdminDashboard snapshot={snapshot} /> : null}
      <Reports snapshot={snapshot} />
    </Shell>
  );
}

function LoginScreen({ setupError }: { setupError: string | null }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Google login</p>
        <h1>Time-Off Tracker</h1>
        <p>Sign in with Google to request time off, approve requests, and verify make-up hours.</p>
        {setupError ? <div className="notice warning">Auth setup needs environment variables and database access before login can complete.</div> : null}
        <LoginButton />
      </section>
    </main>
  );
}

function PendingScreen({ profile }: { profile: UserProfile }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Access pending</p>
        <h1>Time-Off Tracker</h1>
        <p>{profile.email} is signed in, but an admin still needs to activate this profile.</p>
        <SignOutButton />
      </section>
    </main>
  );
}

function Shell({ profile, children }: { profile: UserProfile; children: React.ReactNode }) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span>TO</span>
          <div>
            <strong>Time-Off Tracker</strong>
            <small>Hours, approvals, make-up work</small>
          </div>
        </div>
        <nav>
          <a href="#employee">My time off</a>
          {isAdmin(profile) ? <a href="#admin">Admin</a> : null}
          <a href="#reports">Reports</a>
        </nav>
        <div className="signed-in">
          <strong>{profile.fullName}</strong>
          <span>{profile.email}</span>
          <small>{profile.role} · {profile.status}</small>
          <SignOutButton variant="secondary" />
        </div>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}

function EmployeePortal({ profile, snapshot }: { profile: UserProfile; snapshot: AppSnapshot }) {
  const balance = snapshot.balances[profile.id] || {
    employeeId: profile.id,
    calendarYear: new Date().getFullYear(),
    annualAllowanceHours: 48,
    usedHours: 0,
    remainingHours: 48,
    expiresOn: `${new Date().getFullYear()}-12-31`
  };
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);

  return (
    <section id="employee" className="page-section">
      <Header eyebrow="Employee portal" title="Request time off" metric={`${balance.remainingHours}h`} metricLabel="PTO left" />
      <div className="grid two">
        <form action={submitTimeOffRequest} className="panel form-panel">
          <h2>New request</h2>
          <label>Request type
            <select name="requestType">
              <option>PTO</option>
              <option>Additional Time Off</option>
              <option>Emergency/Exception</option>
            </select>
          </label>
          <label>Reason
            <textarea name="reason" placeholder="Brief written request" />
          </label>
          <div className="field-grid">
            <label>Date <input name="segmentDate" type="date" required /></label>
            <label>From <input name="segmentStart" type="time" required /></label>
            <label>To <input name="segmentEnd" type="time" required /></label>
          </div>
          <h3>Make-up plan</h3>
          <div className="field-grid">
            <label>Date <input name="makeupDate" type="date" /></label>
            <label>From <input name="makeupStart" type="time" /></label>
            <label>To <input name="makeupEnd" type="time" /></label>
          </div>
          <button>Submit request</button>
        </form>
        <section className="panel">
          <h2>My balance</h2>
          <div className="balance-bar"><span style={{ width: `${Math.min(100, (balance.usedHours / balance.annualAllowanceHours) * 100)}%` }} /></div>
          <div className="split"><span>Used: {balance.usedHours}h</span><span>Annual: {balance.annualAllowanceHours}h</span></div>
          <h2>My requests</h2>
          <CardList empty="No requests yet.">{requests.map((request) => <RequestCard key={request.id} request={request} />)}</CardList>
        </section>
      </div>
    </section>
  );
}

function AdminDashboard({ snapshot }: { snapshot: AppSnapshot }) {
  const requests = snapshot.requests;
  const editableProfiles = snapshot.profiles.filter((profile) => !profile.protectedOwner);
  return (
    <section id="admin" className="page-section">
      <Header eyebrow="Admin dashboard" title="Approvals and access" metric={`${requests.filter((request) => request.status === "Pending").length}`} metricLabel="pending" />
      <div className="metric-grid">
        <Metric label="Active employees" value={snapshot.profiles.filter((profile) => profile.status === "Active").length} />
        <Metric label="Pending users" value={snapshot.profiles.filter((profile) => profile.status === "Pending").length} />
        <Metric label="Make-up awaiting review" value={snapshot.requests.flatMap((request) => request.makeupEntries).filter((entry) => entry.verificationStatus === "Pending").length} />
      </div>
      <div className="grid two">
        <section className="panel">
          <h2>Time-off approvals</h2>
          <CardList empty="No requests submitted.">{requests.map((request) => <AdminRequestCard key={request.id} request={request} />)}</CardList>
        </section>
        <section className="panel">
          <h2>User roles</h2>
          <CardList empty="No editable users yet.">{editableProfiles.map((profile) => <UserRoleForm key={profile.id} profile={profile} />)}</CardList>
        </section>
      </div>
    </section>
  );
}

function Reports({ snapshot }: { snapshot: AppSnapshot }) {
  const makeupEntries = snapshot.requests.flatMap((request) =>
    request.makeupEntries.map((entry) => ({ request, entry }))
  );
  return (
    <section id="reports" className="page-section">
      <Header eyebrow="Reports" title="Profiles, make-up work, and logs" />
      <section className="panel">
        <h2>Employee profiles</h2>
        <div className="profile-grid">
          {snapshot.profiles.map((profile) => <EmployeeProfileCard key={profile.id} profile={profile} snapshot={snapshot} />)}
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
                <Status value={entry.verificationStatus} />
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

function Header({ eyebrow, title, metric, metricLabel }: { eyebrow: string; title: string; metric?: string; metricLabel?: string }) {
  return (
    <header className="page-header">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
      {metric ? <div className="metric"><strong>{metric}</strong><span>{metricLabel}</span></div> : null}
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="summary-card"><strong>{value}</strong><span>{label}</span></div>;
}

function RequestCard({ request }: { request: TimeOffRequest }) {
  return (
    <article className="request-card">
      <div><strong>{request.requestType}</strong><span>{request.totalRequestedHours} requested hours</span></div>
      <Status value={request.status} />
      {request.isLateNotice ? <p className="notice warning">Late notice: under 14 calendar days.</p> : null}
    </article>
  );
}

function AdminRequestCard({ request }: { request: TimeOffRequest }) {
  return (
    <article className="request-card">
      <div><strong>{request.requestType}</strong><span>{request.totalRequestedHours}h requested · {request.totalMakeupHours}h make-up planned</span></div>
      <Status value={request.status} />
      <div className="actions">
        <form action={setRequestStatusAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="status" value="Approved" /><button disabled={request.status !== "Pending"}>Approve</button></form>
        <form action={setRequestStatusAction}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="status" value="Rejected" /><button className="secondary" disabled={request.status !== "Pending"}>Reject</button></form>
      </div>
      {request.makeupEntries.map((entry) => (
        <div className="makeup-line" key={entry.id}>
          <span>{entry.date} · {entry.startTime}-{entry.endTime} · {entry.plannedHours}h</span>
          <Status value={entry.verificationStatus} />
          <form action={verifyMakeupAction}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="status" value="Worked" /><button className="secondary">Worked</button></form>
          <form action={verifyMakeupAction}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="status" value="Not Worked" /><button className="secondary">Not worked</button></form>
        </div>
      ))}
    </article>
  );
}

function UserRoleForm({ profile }: { profile: UserProfile }) {
  return (
    <form action={updateUserProfileAction} className="user-row">
      <input type="hidden" name="profileId" value={profile.id} />
      <div><strong>{profile.fullName}</strong><span>{profile.email}</span></div>
      <select name="role" defaultValue={profile.role}><option>Employee</option><option>Admin</option></select>
      <select name="status" defaultValue={profile.status}><option>Pending</option><option>Active</option><option>Disabled</option></select>
      <button>Save</button>
    </form>
  );
}

function EmployeeProfileCard({ profile, snapshot }: { profile: UserProfile; snapshot: AppSnapshot }) {
  const balance = snapshot.balances[profile.id];
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);
  const pendingMakeup = requests.flatMap((request) => request.makeupEntries).filter((entry) => entry.verificationStatus === "Pending").length;
  return (
    <article className="profile-card">
      <div className="avatar">{profile.fullName.slice(0, 2).toUpperCase()}</div>
      <div className="profile-main">
        <strong>{profile.fullName}</strong>
        <span>{profile.email}</span>
        <div className="pill-row"><Status value={profile.role} /><Status value={profile.status} />{profile.protectedOwner ? <Status value="Owner" /> : null}</div>
      </div>
      <div className="stat-grid">
        <Stat label="Used" value={`${balance?.usedHours ?? 0}h`} />
        <Stat label="Left" value={`${balance?.remainingHours ?? 0}h`} />
        <Stat label="Approved" value={requests.filter((request) => request.status === "Approved").length} />
        <Stat label="Pending" value={requests.filter((request) => request.status === "Pending").length} />
        <Stat label="Requested" value={`${requests.reduce((total, request) => total + request.totalRequestedHours, 0)}h`} />
        <Stat label="Make-up review" value={pendingMakeup} />
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function Status({ value }: { value: string }) {
  return <span className={`status status-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{value}</span>;
}

function CardList({ empty, children }: { empty: string; children: React.ReactNode[] | React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return Array.isArray(items) && items.length === 0 ? <p className="empty">{empty}</p> : <div className="stack">{items}</div>;
}

function nameFor(snapshot: AppSnapshot, id: string) {
  return snapshot.profiles.find((profile) => profile.id === id)?.fullName || "Unknown employee";
}
