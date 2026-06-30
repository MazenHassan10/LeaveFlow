import * as React from "react";
import { cn } from "@/src/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-24 w-full rounded-lg border-2 border-[rgba(17,19,26,0.12)] bg-white px-4 py-3 text-[var(--ink)]", className)} {...props} />;
}
