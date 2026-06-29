"use client";

import { authClient } from "@/src/lib/auth-client";

export function LoginButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
      type="button"
    >
      Continue with Google
    </button>
  );
}

export function SignOutButton({ variant }: { variant?: "secondary" }) {
  return (
    <button
      className={variant === "secondary" ? "secondary" : undefined}
      onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
      type="button"
    >
      Sign out
    </button>
  );
}
