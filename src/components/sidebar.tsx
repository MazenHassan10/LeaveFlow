import type { UserProfile } from "@/src/lib/app-data";
import { isAdmin } from "@/src/lib/app-data";
import { SignOutButton } from "./auth-buttons";
import { IconBriefcase, IconShield, IconChartBar, IconChevronLeft } from "./icons";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LF";
}

export function Sidebar({ profile }: { profile: UserProfile }) {
  return (
    <aside className="sidebar">
      <input type="checkbox" id="sidebar-toggle" className="sr-only" />
      <div className="sidebar-header">
        <div className="brand">
          <span>LF</span>
          <div className="sidebar-label">
            <strong>LeaveFlow</strong>
            <small>Hours, approvals, make-up work</small>
          </div>
        </div>
        <label htmlFor="sidebar-toggle" className="sidebar-collapse-btn" aria-label="Toggle sidebar">
          <IconChevronLeft />
        </label>
      </div>
      <nav aria-label="Main navigation">
        <a href="#employee" title="My time off">
          <span className="nav-icon"><IconBriefcase /></span>
          <span className="sidebar-label">My time off</span>
        </a>
        {isAdmin(profile) ? (
          <a href="#admin" title="Admin">
            <span className="nav-icon"><IconShield /></span>
            <span className="sidebar-label">Admin</span>
          </a>
        ) : null}
        <a href="#reports" title="Reports">
          <span className="nav-icon"><IconChartBar /></span>
          <span className="sidebar-label">Reports</span>
        </a>
      </nav>
      <div className="signed-in">
        <span className="avatar" aria-hidden="true">{initialsFor(profile.fullName)}</span>
        <div className="signed-in-meta sidebar-label">
          <strong>{profile.fullName}</strong>
          <span>{profile.email}</span>
          <small>{profile.role} · {profile.status}</small>
        </div>
        <SignOutButton variant="secondary" />
      </div>
    </aside>
  );
}
