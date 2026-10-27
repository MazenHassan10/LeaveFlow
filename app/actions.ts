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

// Every form action returns { status, message } instead of throwing. In production Next.js
// replaces the whole page with a generic error screen when a server action throws, and
// hides the message, so refusals (own make-up, invalid name, not enough PTO...) must be returned.
export type ActionState = { status: "idle" | "done" | "error"; message: string };
export type DecisionState = ActionState;

async function runAction(work: () => Promise<string>, fallback: string): Promise<ActionState> {
  try {
    const message = await work();
    revalidateDashboardRoutes();
    return { status: "done", message };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : fallback };
  }
}

export async function cancelRequestAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await cancelRequest(await currentProfile(), String(formData.get("requestId")));
    return "Request cancelled.";
  }, "The request could not be cancelled.");
}

export async function updateUserProfileAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateProfile(
      await currentProfile(),
      String(formData.get("profileId")),
      String(formData.get("role")) as AppRole,
      String(formData.get("status")) as ProfileStatus,
      formData.has("fullName") ? String(formData.get("fullName")) : undefined
    );
    return "Saved.";
  }, "The user could not be saved.");
}

export async function deleteUserProfileAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteProfile(await currentProfile(), String(formData.get("profileId")));
    return "User deleted.";
  }, "The user could not be deleted.");
}

export async function updatePtoAllowanceAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updatePtoAllowance(
      await currentProfile(),
      String(formData.get("employeeId")),
      String(formData.get("annualAllowanceHours"))
    );
    return "Allowance saved.";
  }, "The allowance could not be saved.");
}

export async function setRequestStatusAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status")) as "Approved" | "Rejected";
  return runAction(async () => {
    await setRequestStatus(
      await currentProfile(),
      String(formData.get("requestId")),
      status,
      formData.has("note") ? String(formData.get("note")) : null
    );
    return status === "Approved" ? "Approved." : "Rejected.";
  }, "The request could not be updated.");
}

export async function deleteRequestAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteRequest(await currentProfile(), String(formData.get("requestId")));
    return "Request deleted.";
  }, "The request could not be deleted.");
}

export async function verifyMakeupAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await verifyMakeup(await currentProfile(), String(formData.get("entryId")), String(formData.get("status")) as MakeupStatus);
    return "Saved.";
  }, "The make-up shift could not be updated.");
}
