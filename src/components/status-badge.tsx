import type { BadgeProps } from "./ui/badge";
import { Badge } from "./ui/badge";

function variantFor(value: string): BadgeProps["variant"] {
  const key = value.toLowerCase();
  if (["approved", "worked", "active", "admin", "owner"].includes(key)) return "success";
  if (["pending", "not worked", "late notice", "not marked", "to mark"].includes(key) || / (to mark|not worked)$/.test(key)) return "warning";
  if (key === "upcoming") return "default";
  if (["rejected", "disabled"].includes(key)) return "destructive";
  if (key === "employee" || key === "cancelled") return "default";
  if (key === "manager") return "violet";
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
