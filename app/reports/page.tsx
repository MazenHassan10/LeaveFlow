import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { Reports } from "@/src/components/reports";
import { getAuditEventsForMonth } from "@/src/lib/app-data";
import { parseMonthParam } from "@/src/lib/report-calendar";
import { requireReportsPage } from "@/src/lib/session";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string; person?: string }> }) {
  const { profile, setupError, snapshot } = await requireReportsPage();
  const { month, view, person } = await searchParams;

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  const activity = await getAuditEventsForMonth(parseMonthParam(month));

  return (
    <Shell profile={profile}>
      <Reports snapshot={snapshot} activity={activity} month={month} view={view} person={person} />
    </Shell>
  );
}
