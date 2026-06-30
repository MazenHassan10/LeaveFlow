import * as React from "react";
import { cn } from "@/src/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full rounded-lg border-2 border-[rgba(17,19,26,0.12)] bg-white px-4 py-3 text-[var(--ink)]", className)} {...props} />;
}
