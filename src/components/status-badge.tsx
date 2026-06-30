import type { BadgeProps } from "./ui/badge";
import { Badge } from "./ui/badge";

function variantFor(value: string): BadgeProps["variant"] {
  const key = value.toLowerCase();
  if (["approved", "worked", "active", "admin", "owner"].includes(key)) return "success";
  if (["pending", "not worked"].includes(key)) return "warning";
  if (["rejected", "disabled"].includes(key)) return "destructive";
  if (key === "employee") return "default";
  return "violet";
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      variant={variantFor(value)}
      className={`status status-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`}
    >
      {value}
    </Badge>
  );
}
