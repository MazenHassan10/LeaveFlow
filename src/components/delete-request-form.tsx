"use client";

import { deleteRequestAction } from "@/app/actions";
import { IconTrash } from "./icons";

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
      <button className="btn-danger" type="submit">
        <IconTrash />
        Delete
      </button>
    </form>
  );
}
