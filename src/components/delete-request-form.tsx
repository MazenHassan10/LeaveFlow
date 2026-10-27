"use client";

import { deleteRequestAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { IconTrash } from "./icons";
import { PendingSubmitButton } from "./pending-submit-button";

export function DeleteRequestForm({ requestId }: { requestId: string }) {
  return (
    <ActionForm
      action={deleteRequestAction}
      confirmMessage="Permanently delete this request? This removes it from the employee view immediately."
    >
      <input type="hidden" name="requestId" value={requestId} />
      <PendingSubmitButton className="btn-danger" pendingLabel="Deleting...">
        <IconTrash />
        Delete
      </PendingSubmitButton>
    </ActionForm>
  );
}
