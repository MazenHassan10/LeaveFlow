import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { Reports } from "@/src/components/reports";
import { requireReportsPage } from "@/src/lib/session";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { profile, setupError, snapshot } = await requireReportsPage();
  const { month } = await searchParams;

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <Reports snapshot={snapshot} month={month} />
    </Shell>
  );
}
