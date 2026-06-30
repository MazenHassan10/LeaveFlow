import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { AdminDashboard } from "@/src/components/admin-dashboard";
import { requireAdminPage } from "@/src/lib/session";

export default async function AdminPage() {
  const { profile, setupError, snapshot } = await requireAdminPage();

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <AdminDashboard snapshot={snapshot} />
    </Shell>
  );
}
