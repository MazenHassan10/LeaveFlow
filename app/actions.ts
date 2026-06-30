"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/lib/auth";
import {
  createTimeOffRequest,
  deleteRequest,
  ensureProfile,
  setRequestStatus,
  updatePtoAllowance,
  updateProfile,
  verifyMakeup
} from "@/src/lib/app-data";
import type { AppRole, MakeupStatus, ProfileStatus } from "@/src/lib/pto";

export type SubmitRequestState = {
  status: "idle" | "created" | "duplicate" | "error";
  message: string;
};

function revalidateDashboardRoutes() {
  revalidatePath("/employee");
  revalidatePath("/admin");
  revalidatePath("/reports");
}

async function currentProfile() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) throw new Error("Sign in required.");
  return ensureProfile({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name
  });
}

export async function submitTimeOffRequest(_previousState: SubmitRequestState, formData: FormData): Promise<SubmitRequestState> {
  try {
    const profile = await currentProfile();
    const result = await createTimeOffRequest(profile, formData);
    revalidateDashboardRoutes();

    if (result.status === "duplicate") {
      return { status: "duplicate", message: "This exact request already exists, so it was not submitted again." };
    }

    return { status: "created", message: "Request submitted." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Request could not be submitted."
    };
  }
}

export async function updateUserProfileAction(formData: FormData) {
  const actor = await currentProfile();
  await updateProfile(
    actor,
    String(formData.get("profileId")),
    String(formData.get("role")) as AppRole,
    String(formData.get("status")) as ProfileStatus
  );
  revalidateDashboardRoutes();
}

export async function updatePtoAllowanceAction(formData: FormData) {
  const actor = await currentProfile();
  await updatePtoAllowance(
    actor,
    String(formData.get("employeeId")),
    String(formData.get("annualAllowanceHours"))
  );
  revalidateDashboardRoutes();
}

export async function setRequestStatusAction(formData: FormData) {
  const actor = await currentProfile();
  await setRequestStatus(actor, String(formData.get("requestId")), String(formData.get("status")) as "Approved" | "Rejected");
  revalidateDashboardRoutes();
}

export async function deleteRequestAction(formData: FormData) {
  const actor = await currentProfile();
  await deleteRequest(actor, String(formData.get("requestId")));
  revalidateDashboardRoutes();
}

export async function verifyMakeupAction(formData: FormData) {
  const actor = await currentProfile();
  await verifyMakeup(actor, String(formData.get("entryId")), String(formData.get("status")) as MakeupStatus);
  revalidateDashboardRoutes();
}
