"use client";

import { deleteUserProfileAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { IconTrash } from "./icons";
import { PendingSubmitButton } from "./pending-submit-button";

export function DeleteUserForm({
  profileId,
  fullName,
  email,
}: {
  profileId: string;
  fullName: string;
  email: string;
}) {
  return (
    <ActionForm
      action={deleteUserProfileAction}
      confirmMessage={`Permanently delete ${fullName} (${email})? This removes their account, PTO balance, and all requests. This cannot be undone.`}
    >
      <input type="hidden" name="profileId" value={profileId} />
      <PendingSubmitButton className="btn-danger" pendingLabel="Deleting...">
        <IconTrash />
        Delete
      </PendingSubmitButton>
    </ActionForm>
  );
}
