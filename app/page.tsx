import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { ensureProfile, getSnapshot, isAdmin } from "@/src/lib/app-data";
import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { EmployeePortal } from "@/src/components/employee-portal";
import { AdminDashboard } from "@/src/components/admin-dashboard";
import { Reports } from "@/src/components/reports";

async function getSessionProfile() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.email) return { session: null, profile: null, setupError: null };
    const profile = await ensureProfile({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
    return { session, profile, setupError: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      setupError: error instanceof Error ? error.message : "Authentication is not configured yet.",
    };
  }
}

export default async function Home() {
  const { profile, setupError } = await getSessionProfile();

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active") return <PendingScreen profile={profile} />;

  const snapshot = await getSnapshot();
  return (
    <Shell profile={profile}>
      <EmployeePortal profile={profile} snapshot={snapshot} />
      {isAdmin(profile) ? <AdminDashboard snapshot={snapshot} /> : null}
      <Reports snapshot={snapshot} />
    </Shell>
  );
}
