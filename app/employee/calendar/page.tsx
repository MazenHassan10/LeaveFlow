import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { MyCalendar } from "@/src/components/my-calendar";
import { parseMonthParam } from "@/src/lib/report-calendar";
import { requireEmployeePage } from "@/src/lib/session";

export default async function MyCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [{ profile, setupError, snapshot }, { month }] = await Promise.all([requireEmployeePage(), searchParams]);

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <MyCalendar profile={profile} snapshot={snapshot} month={parseMonthParam(month)} />
    </Shell>
  );
}
