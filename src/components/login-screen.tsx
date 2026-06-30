import { LoginButton } from "./auth-buttons";
import { AnimatedAuthPanel } from "./animated-auth-panel";
import { LeaveFlowLogo } from "./icons";

export function LoginScreen({ setupError }: { setupError: string | null }) {
  return (
    <AnimatedAuthPanel>
      <LeaveFlowLogo className="auth-logo" />
      <p className="eyebrow">Sign in to continue</p>
      <h1>LeaveFlow</h1>
      <p>Sign in with Google to request time off, approve requests, and verify make-up hours.</p>
      {setupError ? (
        <div className="notice warning">
          Auth setup needs environment variables and database access before login can complete.
        </div>
      ) : null}
      <LoginButton />
    </AnimatedAuthPanel>
  );
}
