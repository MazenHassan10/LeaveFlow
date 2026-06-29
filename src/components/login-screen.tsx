import { LoginButton } from "./auth-buttons";

export function LoginScreen({ setupError }: { setupError: string | null }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Sign in to continue</p>
        <h1>LeaveFlow</h1>
        <p>Sign in with Google to request time off, approve requests, and verify make-up hours.</p>
        {setupError ? (
          <div className="notice warning">
            Auth setup needs environment variables and database access before login can complete.
          </div>
        ) : null}
        <LoginButton />
      </section>
    </main>
  );
}
