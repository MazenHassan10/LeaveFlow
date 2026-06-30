import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,var(--color-primary-400),var(--color-success-500))] text-neutral-950 shadow-sm hover:-translate-y-px",
        secondary: "bg-[var(--surface-raised)] text-[var(--ink)] shadow-[inset_0_0_0_1.5px_rgba(17,19,26,0.14)]",
        outline: "border-2 border-[rgba(17,19,26,0.12)] bg-[var(--surface)] text-[var(--ink)]",
        ghost: "bg-transparent text-[var(--ink-secondary)] shadow-none hover:bg-[rgba(0,194,255,0.12)] hover:text-[var(--ink)]",
        destructive: "bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)]",
      },
      size: {
        default: "px-5",
        sm: "min-h-9 px-3",
        icon: "h-10 w-10 min-w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn("ui-button", buttonVariants({ variant, size }), className)} {...props} />;
}
