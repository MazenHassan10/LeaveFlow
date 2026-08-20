"use client";

import type { UserProfile } from "@/src/lib/app-data";
import { roleHasAdminAccess } from "@/src/lib/pto";
import { AnimatedShell } from "./animated-shell";
import { Sidebar, usePersistedSidebarState } from "./sidebar";

export function Shell({ profile, children }: { profile: UserProfile; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistedSidebarState();
  const canAccessAdmin = roleHasAdminAccess(profile.role) && profile.status === "Active";

  return (
    <AnimatedShell>
      <main className={`shell ${collapsed ? "is-collapsed" : ""}`}>
        <Sidebar
          profile={profile}
          canAccessAdmin={canAccessAdmin}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
        <section className="content">{children}</section>
      </main>
    </AnimatedShell>
  );
}
