"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserProfile } from "@/src/lib/app-data";
import { SignOutButton } from "./auth-buttons";
import { IconBriefcase, IconShield, IconChartBar, IconChevronLeft, LeaveFlowLogo } from "./icons";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LF";
}

export function Sidebar({
  profile,
  canAccessAdmin,
  collapsed,
  onCollapsedChange
}: {
  profile: UserProfile;
  canAccessAdmin: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/employee", label: "My time off", icon: <IconBriefcase /> },
    ...(canAccessAdmin ? [{ href: "/admin", label: "Admin", icon: <IconShield /> }] : []),
    { href: "/reports", label: "Reports", icon: <IconChartBar /> },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="brand">
          <span><LeaveFlowLogo /></span>
          <div className="sidebar-label">
            <strong>LeaveFlow</strong>
            <small>Hours, approvals, make-up work</small>
          </div>
        </div>
        <button
          className="sidebar-collapse-btn"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <IconChevronLeft />
        </button>
      </div>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="sidebar-label">{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="signed-in">
        <span className="avatar" aria-hidden="true">{initialsFor(profile.fullName)}</span>
        <div className="signed-in-meta sidebar-label">
          <strong title={profile.fullName}>{profile.fullName}</strong>
          <span title={profile.email}>{profile.email}</span>
          <small title={`${profile.role} · ${profile.status}`}>{profile.role} · {profile.status}</small>
        </div>
        <SignOutButton variant="secondary" />
      </div>
    </aside>
  );
}

export function usePersistedSidebarState() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("leaveflow-sidebar-collapsed") === "true");
  }, []);

  function updateCollapsed(nextCollapsed: boolean) {
    setCollapsed(nextCollapsed);
    window.localStorage.setItem("leaveflow-sidebar-collapsed", String(nextCollapsed));
  }

  return [collapsed, updateCollapsed] as const;
}
