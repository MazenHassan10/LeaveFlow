"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/src/lib/auth";
import {
  createTimeOffRequest,
  ensureProfile,
  setRequestStatus,
  updateProfile,
  verifyMakeup
} from "@/src/lib/app-data";
import type { AppRole, MakeupStatus, ProfileStatus } from "@/src/lib/pto";

async function currentProfile() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) throw new Error("Sign in required.");
  return ensureProfile({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name
  });
}

export async function submitTimeOffRequest(formData: FormData) {
  const profile = await currentProfile();
  await createTimeOffRequest(profile, formData);
  revalidatePath("/");
}

export async function updateUserProfileAction(formData: FormData) {
  const actor = await currentProfile();
  await updateProfile(
    actor,
    String(formData.get("profileId")),
    String(formData.get("role")) as AppRole,
    String(formData.get("status")) as ProfileStatus
  );
  revalidatePath("/");
}

export async function setRequestStatusAction(formData: FormData) {
  const actor = await currentProfile();
  await setRequestStatus(actor, String(formData.get("requestId")), String(formData.get("status")) as "Approved" | "Rejected");
  revalidatePath("/");
}

export async function verifyMakeupAction(formData: FormData) {
  const actor = await currentProfile();
  await verifyMakeup(actor, String(formData.get("entryId")), String(formData.get("status")) as MakeupStatus);
  revalidatePath("/");
}
