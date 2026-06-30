import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { ensureProfile, getAdminSnapshot, getEmployeeSnapshot, getReportsSnapshot, isAdmin } from "@/src/lib/app-data";

export async function getSessionProfile() {
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

export async function requireActiveProfile() {
  const { profile, setupError } = await getSessionProfile();
  if (!profile) return { profile: null, setupError, snapshot: null };
  if (profile.status !== "Active") return { profile, setupError: null, snapshot: null };
  return { profile, setupError: null, snapshot: null };
}

export async function requireEmployeePage() {
  const result = await requireActiveProfile();
  if (!result.profile || result.profile.status !== "Active") return result;
  return { ...result, snapshot: await getEmployeeSnapshot(result.profile.id) };
}

export async function requireAdminPage() {
  const result = await requireActiveProfile();
  if (!result.profile || result.profile.status !== "Active") return result;
  if (!isAdmin(result.profile)) redirect("/employee");
  return { ...result, snapshot: await getAdminSnapshot() };
}

export async function requireReportsPage() {
  const result = await requireActiveProfile();
  if (!result.profile || result.profile.status !== "Active") return result;
  return { ...result, snapshot: await getReportsSnapshot() };
}
