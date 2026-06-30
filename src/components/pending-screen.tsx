import type { UserProfile } from "@/src/lib/app-data";
import { SignOutButton } from "./auth-buttons";
import { AnimatedAuthPanel } from "./animated-auth-panel";
import { LeaveFlowLogo } from "./icons";

export function PendingScreen({ profile }: { profile: UserProfile }) {
  return (
    <AnimatedAuthPanel>
      <LeaveFlowLogo className="auth-logo" />
      <p className="eyebrow">Access pending</p>
      <h1>LeaveFlow</h1>
      <p>{profile.email} is signed in, but an admin still needs to activate this profile.</p>
      <SignOutButton />
    </AnimatedAuthPanel>
  );
}
