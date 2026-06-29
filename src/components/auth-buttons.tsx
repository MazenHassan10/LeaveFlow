"use client";

import { authClient } from "@/src/lib/auth-client";
import { IconGoogle, IconLogOut } from "./icons";

export function LoginButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
      type="button"
    >
      <IconGoogle />
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
      <IconLogOut />
      <span className="sidebar-label">Sign out</span>
    </button>
  );
}
