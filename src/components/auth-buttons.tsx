"use client";

import { authClient } from "@/src/lib/auth-client";
import { IconGoogle, IconLogOut } from "./icons";
import { Button } from "./ui/button";

export function LoginButton() {
  return (
    <Button
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
      type="button"
    >
      <IconGoogle />
      Continue with Google
    </Button>
  );
}

export function SignOutButton({ variant }: { variant?: "secondary" }) {
  return (
    <Button
      variant={variant === "secondary" ? "secondary" : "default"}
      className={variant === "secondary" ? "secondary" : undefined}
      onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
      type="button"
    >
      <IconLogOut />
      <span className="sidebar-label">Sign out</span>
    </Button>
  );
}
