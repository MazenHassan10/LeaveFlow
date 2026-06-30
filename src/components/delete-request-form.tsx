"use client";

import { deleteRequestAction } from "@/app/actions";
import { IconTrash } from "./icons";
import { PendingSubmitButton } from "./pending-submit-button";

export function DeleteRequestForm({ requestId }: { requestId: string }) {
  return (
    <form
      action={deleteRequestAction}
      onSubmit={(event) => {
        const confirmed = window.confirm("Permanently delete this request? This removes it from the employee view immediately.");
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <PendingSubmitButton className="btn-danger" pendingLabel="Deleting...">
        <IconTrash />
        Delete
      </PendingSubmitButton>
    </form>
  );
}
