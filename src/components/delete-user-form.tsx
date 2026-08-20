"use client";

import { deleteUserProfileAction } from "@/app/actions";
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
    <form
      action={deleteUserProfileAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Permanently delete ${fullName} (${email})? This removes their account, PTO balance, and all requests. This cannot be undone.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="profileId" value={profileId} />
      <PendingSubmitButton className="btn-danger" pendingLabel="Deleting...">
        <IconTrash />
        Delete
      </PendingSubmitButton>
    </form>
  );
}
