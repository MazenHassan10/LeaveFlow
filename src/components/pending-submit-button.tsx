"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Working...",
  disabled,
  className,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending} {...props}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
