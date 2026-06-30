"use client";

import { useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { IconGoogle, IconLogOut } from "./icons";
import { Button } from "./ui/button";

export function LoginButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      className="auth-google-button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await authClient.signIn.social({ provider: "google", callbackURL: "/" });
        } finally {
          setLoading(false);
        }
      }}
      type="button"
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : <IconGoogle />}
      {loading ? "Opening Google..." : "Continue with Google"}
    </Button>
  );
}

export function SignOutButton({ variant }: { variant?: "secondary" }) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant={variant === "secondary" ? "secondary" : "default"}
      className={variant === "secondary" ? "secondary" : undefined}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } });
      }}
      type="button"
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : <IconLogOut />}
      <span className="sidebar-label">{loading ? "Signing out..." : "Sign out"}</span>
    </Button>
  );
}
