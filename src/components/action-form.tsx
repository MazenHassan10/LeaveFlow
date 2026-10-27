"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";

const initialState: ActionState = { status: "idle", message: "" };

type ActionFormProps = {
  action: (previousState: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  id?: string;
  // Asked before submitting; the submission is cancelled if the user declines.
  confirmMessage?: string;
};

// A form for a server action that returns { status, message }: shows refusals inline instead of
// crashing the page, and refreshes server data after a successful change.
export function ActionForm({ action, children, className, id, confirmMessage }: ActionFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "done") router.refresh();
  }, [state, router]);

  function confirmSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={formAction} className={className} id={id} onSubmit={confirmMessage ? confirmSubmit : undefined}>
      {children}
      {state.status === "error" ? <p className="notice warning action-error" role="alert">{state.message}</p> : null}
    </form>
  );
}
