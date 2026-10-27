"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/lib/auth";
import {
  cancelRequest,
  createTimeOffRequest,
  deleteProfile,
  deleteRequest,
  ensureProfile,
  setRequestStatus,
  updatePendingRequest,
  updatePtoAllowance,
  updateProfile,
  verifyMakeup
} from "@/src/lib/app-data";
import type { AppRole, MakeupStatus, ProfileStatus } from "@/src/lib/pto";

export type SubmitRequestState = {
  status: "idle" | "created" | "updated" | "duplicate" | "error";
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

export async function updateTimeOffRequest(_previousState: SubmitRequestState, formData: FormData): Promise<SubmitRequestState> {
  try {
    const profile = await currentProfile();
    const result = await updatePendingRequest(profile, String(formData.get("requestId")), formData);
    revalidateDashboardRoutes();

    if (result.status === "duplicate") {
      return { status: "duplicate", message: "You already have an identical request, so nothing was changed." };
    }

    return { status: "updated", message: "Request updated. Admins have been notified." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Request could not be updated."
    };
  }
}

export async function cancelRequestAction(formData: FormData) {
  const profile = await currentProfile();
  await cancelRequest(profile, String(formData.get("requestId")));
  revalidateDashboardRoutes();
}

export async function updateUserProfileAction(formData: FormData) {
  const actor = await currentProfile();
  await updateProfile(
    actor,
    String(formData.get("profileId")),
    String(formData.get("role")) as AppRole,
    String(formData.get("status")) as ProfileStatus,
    formData.has("fullName") ? String(formData.get("fullName")) : undefined
  );
  revalidateDashboardRoutes();
}

export async function deleteUserProfileAction(formData: FormData) {
  const actor = await currentProfile();
  await deleteProfile(actor, String(formData.get("profileId")));
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

export type DecisionState = { status: "idle" | "done" | "error"; message: string };

// Returns errors instead of throwing: production hides thrown server-action messages,
// and admins need to see refusals such as an insufficient PTO balance.
export async function setRequestStatusAction(_previousState: DecisionState, formData: FormData): Promise<DecisionState> {
  try {
    const actor = await currentProfile();
    const status = String(formData.get("status")) as "Approved" | "Rejected";
    await setRequestStatus(
      actor,
      String(formData.get("requestId")),
      status,
      formData.has("note") ? String(formData.get("note")) : null
    );
    revalidateDashboardRoutes();
    return { status: "done", message: status === "Approved" ? "Approved." : "Rejected." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The request could not be updated." };
  }
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
