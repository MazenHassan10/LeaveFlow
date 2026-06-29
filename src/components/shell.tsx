import type { UserProfile } from "@/src/lib/app-data";
import { Sidebar } from "./sidebar";

export function Shell({ profile, children }: { profile: UserProfile; children: React.ReactNode }) {
  return (
    <main className="shell">
      <Sidebar profile={profile} />
      <section className="content">{children}</section>
    </main>
  );
}
