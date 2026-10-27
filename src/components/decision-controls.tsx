"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { setRequestStatusAction, type DecisionState } from "@/app/actions";
import { PendingSubmitButton } from "./pending-submit-button";

type Mode = "idle" | "approve" | "reject";

const initialState: DecisionState = { status: "idle", message: "" };

// Approve in one click, or open a note box. A note is required to reject and is
// included in the employee's email.
export function DecisionControls({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [state, formAction] = useActionState(setRequestStatusAction, initialState);

  useEffect(() => {
    if (state.status === "done") router.refresh();
  }, [state, router]);

  const rejecting = mode === "reject";

  return (
    <div className="decision-controls">
      {state.status === "error" ? <p className="notice warning" role="alert">{state.message}</p> : null}
      {mode === "idle" ? (
        <div className="decision-buttons">
          <form action={formAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="status" value="Approved" />
            <PendingSubmitButton pendingLabel="Approving...">Approve</PendingSubmitButton>
          </form>
          <button className="secondary" type="button" onClick={() => setMode("reject")}>Reject</button>
          <button className="btn-ghost compact" type="button" onClick={() => setMode("approve")}>Approve with a note</button>
        </div>
      ) : (
        <form action={formAction} className="decision-note-form">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="status" value={rejecting ? "Rejected" : "Approved"} />
          <label>
            {rejecting ? "Reason for rejecting (shared with the employee)" : "Note to the employee (optional)"}
            <textarea
              name="note"
              required={rejecting}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder={rejecting ? "e.g. We're short-staffed that week. Could you move it to the following week?" : "e.g. Approved. Please confirm the Thanksgiving make-up."}
            />
          </label>
          <div className="decision-buttons">
            <PendingSubmitButton className={rejecting ? "btn-danger" : undefined} pendingLabel={rejecting ? "Rejecting..." : "Approving..."}>
              {rejecting ? "Confirm reject" : "Confirm approve"}
            </PendingSubmitButton>
            <button className="btn-ghost compact" type="button" onClick={() => setMode("idle")}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
}
