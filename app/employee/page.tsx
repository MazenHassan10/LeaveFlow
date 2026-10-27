import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { Shell } from "@/src/components/shell";
import { EmployeePortal } from "@/src/components/employee-portal";
import { requireEmployeePage } from "@/src/lib/session";

type EmployeePageProps = {
  searchParams: Promise<{ edit?: string; updated?: string }>;
};

export default async function EmployeePage({ searchParams }: EmployeePageProps) {
  const [{ profile, setupError, snapshot }, params] = await Promise.all([requireEmployeePage(), searchParams]);

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active" || !snapshot) return <PendingScreen profile={profile} />;

  return (
    <Shell profile={profile}>
      <EmployeePortal
        profile={profile}
        snapshot={snapshot}
        editRequestId={params.edit}
        justUpdated={params.updated === "1"}
      />
    </Shell>
  );
}
