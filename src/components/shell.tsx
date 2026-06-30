import type { UserProfile } from "@/src/lib/app-data";
import { AnimatedShell } from "./animated-shell";
import { Sidebar } from "./sidebar";

export function Shell({ profile, children }: { profile: UserProfile; children: React.ReactNode }) {
  return (
    <AnimatedShell>
      <main className="shell">
        <Sidebar profile={profile} />
        <section className="content">{children}</section>
      </main>
    </AnimatedShell>
  );
}
