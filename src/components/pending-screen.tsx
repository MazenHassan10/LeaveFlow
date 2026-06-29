import type { UserProfile } from "@/src/lib/app-data";
import { SignOutButton } from "./auth-buttons";

export function PendingScreen({ profile }: { profile: UserProfile }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Access pending</p>
        <h1>LeaveFlow</h1>
        <p>{profile.email} is signed in, but an admin still needs to activate this profile.</p>
        <SignOutButton />
      </section>
    </main>
  );
}
