import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { EmployeePortal } from "@/src/components/employee-portal";
import { requireEmployeePage } from "@/src/lib/session";

export default async function EmployeePage() {
  const { profile, setupError, snapshot } = await requireEmployeePage();

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <EmployeePortal profile={profile} snapshot={snapshot} />
    </Shell>
  );
}
