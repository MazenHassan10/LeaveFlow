import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

const badgeVariants = cva(
  "inline-flex w-max items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,var(--color-primary-50),var(--color-primary-100))] text-[var(--color-primary-600)]",
        success: "bg-[linear-gradient(135deg,var(--color-success-50),var(--color-success-100))] text-[var(--color-success-600)]",
        warning: "bg-[linear-gradient(135deg,var(--color-warning-50),var(--color-warning-100))] text-[var(--color-warning-600)]",
        destructive: "bg-[linear-gradient(135deg,var(--color-danger-50),var(--color-danger-100))] text-[var(--color-danger-600)]",
        violet: "bg-[var(--color-accent-50)] text-[var(--color-accent-600)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
