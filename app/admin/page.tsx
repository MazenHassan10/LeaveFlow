import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { AdminDashboard } from "@/src/components/admin-dashboard";
import { parseAdminTab } from "@/src/lib/admin-workspace";
import { requireAdminPage } from "@/src/lib/session";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ profile, setupError, snapshot }, { tab }] = await Promise.all([requireAdminPage(), searchParams]);

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <AdminDashboard snapshot={snapshot} viewerId={profile.id} initialTab={parseAdminTab(tab)} />
    </Shell>
  );
}
