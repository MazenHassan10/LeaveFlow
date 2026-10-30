import type { AppSnapshot, AuditEvent, AuditMetadata } from "./app-data";
import { formatTimeRange12Hour, formatWeekdayDateLabel } from "./app-time";

// Plain-English descriptions for audit log action codes.
const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.profile_deleted": "Deleted a user",
  "admin.profile_updated": "Updated a user's name, role or status",
  "admin.profile_email_changed": "Changed a user's sign-in email",
  "admin.pto_allowance_updated": "Changed a PTO allowance",
  "admin.request_approved": "Approved a request",
  "admin.request_rejected": "Rejected a request",
  "admin.request_deleted": "Deleted a request",
  "admin.request_updated": "Edited a request",
  "admin.makeup_worked": "Marked a make-up shift as worked",
  "admin.makeup_not_worked": "Marked a make-up shift as not worked",
  "admin.makeup_pending": "Reset a make-up shift to pending",
  "employee.request_submitted": "Submitted a request",
  "employee.request_updated": "Edited their request",
  "employee.request_cancelled": "Cancelled their request",
  "user.profile_created": "Signed up",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const AUDIT_TARGET_LABELS: Record<string, string> = {
  time_off_request: "Request",
  user_profile: "User",
  pto_balance: "PTO balance",
  makeup_plan_entry: "Make-up shift",
};

export function auditTargetLabel(targetType: string) {
  return AUDIT_TARGET_LABELS[targetType] ?? targetType;
}

// ---------- Readable activity sentences ----------


export type ActivityCategory = "decisions" | "requests" | "makeup" | "people" | "other";

export type ActivityLine = {
  actor: string;
  // Lower-case verb phrase that follows the actor: "approved Adam Masrawy's request for Thu, Nov 12".
  text: string;
  detail: string | null;
  category: ActivityCategory;
  // Who the event was about, and who did it (for the person filter), when known.
  subjectId: string | null;
  actorId: string | null;
};

export function activityCategory(action: string): ActivityCategory {
  if (action === "admin.request_approved" || action === "admin.request_rejected") return "decisions";
  if (action.startsWith("admin.makeup_")) return "makeup";
  if (action.includes("request_")) return "requests";
  if (action.startsWith("admin.profile_") || action === "admin.pto_allowance_updated" || action === "user.profile_created") return "people";
  return "other";
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// "2026-11-12 09:00-17:00" -> "Thu, Nov 12, 9:00 AM-5:00 PM"
function scheduleLabel(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  return raw.split(", ").map((part) => {
    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(part);
    return match ? `${formatWeekdayDateLabel(match[1])}, ${formatTimeRange12Hour(match[2], match[3])}` : part;
  }).join("; ");
}

function datesLabel(date: string | null, extraDays: number) {
  if (!date) return "";
  return ` for ${formatWeekdayDateLabel(date)}${extraDays > 0 ? ` + ${extraDays} more day${extraDays === 1 ? "" : "s"}` : ""}`;
}

// Old sign-in email -> current one, from recorded email changes, so earlier events still show the person's name.
export function buildEmailAliases(events: AuditEvent[]) {
  const aliases = new Map<string, string>();
  for (const event of [...events].reverse()) {
    if (event.action !== "admin.profile_email_changed") continue;
    const from = text(event.metadata?.from);
    const to = text(event.metadata?.to);
    if (from && to) aliases.set(from.toLowerCase(), to.toLowerCase());
  }
  return aliases;
}

function currentEmail(email: string, aliases?: Map<string, string>) {
  let current = email.toLowerCase();
  for (let hops = 0; aliases?.has(current) && hops < 10; hops += 1) current = aliases.get(current)!;
  return current;
}

export function describeAuditEvent(
  event: AuditEvent,
  snapshot: Pick<AppSnapshot, "profiles" | "requests">,
  emailAliases?: Map<string, string>
): ActivityLine {
  const meta: AuditMetadata = event.metadata ?? {};
  const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const actorEmail = currentEmail(event.actorEmail, emailAliases);
  const actorProfile = snapshot.profiles.find((profile) => profile.email.toLowerCase() === actorEmail);
  const actor = actorProfile?.fullName ?? event.actorEmail;
  const category = activityCategory(event.action);

  // Resolve who and when the event is about, from the live data first, then from what was saved with it.
  let subjectId: string | null = null;
  let subjectName: string | null = null;
  let date: string | null = null;
  let extraDays = 0;
  if (event.targetType === "time_off_request") {
    const request = snapshot.requests.find((item) => item.id === event.targetId);
    if (request) {
      subjectId = request.employeeId;
      subjectName = profileById.get(request.employeeId)?.fullName ?? null;
      const dates = request.segments.map((segment) => segment.date).sort();
      date = dates[0] ?? null;
      extraDays = Math.max(dates.length - 1, 0);
    } else {
      subjectName = text(meta.employee);
      date = text(meta.date);
      extraDays = Number(meta.extraDays) || 0;
    }
  } else if (event.targetType === "makeup_plan_entry") {
    for (const request of snapshot.requests) {
      const entry = request.makeupEntries.find((item) => item.id === event.targetId);
      if (entry) {
        subjectId = request.employeeId;
        subjectName = profileById.get(request.employeeId)?.fullName ?? null;
        date = entry.date;
        break;
      }
    }
  } else if (event.targetType === "user_profile" || event.targetType === "pto_balance") {
    const profile = event.targetId ? profileById.get(event.targetId) : undefined;
    subjectId = profile?.id ?? null;
    subjectName = profile?.fullName ?? text(meta.name);
  }

  const isSelf = Boolean(actorProfile && subjectId && actorProfile.id === subjectId);
  const whose = isSelf ? "their own" : subjectName ? `${subjectName}'s` : "a";
  const request = `${whose} request${datesLabel(date, extraDays)}`;
  const note = text(meta.note);
  let line: string;
  let detail: string | null = null;

  switch (event.action) {
    case "admin.request_approved":
      line = `approved ${request}`;
      detail = note ? `Note: ${note}` : null;
      break;
    case "admin.request_rejected":
      line = `rejected ${request}`;
      detail = note ? `Reason: ${note}` : null;
      break;
    case "admin.request_updated": {
      line = `edited ${request}`;
      const from = scheduleLabel(meta.from);
      const to = scheduleLabel(meta.to);
      detail = [from && to ? `${from} → ${to}` : null, note ? `Note: ${note}` : null].filter(Boolean).join(" · ") || null;
      break;
    }
    case "admin.request_deleted":
      line = subjectName || date ? `deleted ${request}` : "deleted a request";
      detail = text(meta.status) ? `It was ${String(meta.status).toLowerCase()}` : null;
      break;
    case "employee.request_submitted":
      line = `submitted a request${datesLabel(date, extraDays)}`;
      break;
    case "employee.request_updated":
      line = `edited their request${datesLabel(date, extraDays)}`;
      break;
    case "employee.request_cancelled":
      line = `cancelled their request${datesLabel(date, extraDays)}`;
      break;
    case "admin.makeup_worked":
    case "admin.makeup_not_worked":
    case "admin.makeup_pending": {
      const target = `${isSelf ? "their own" : subjectName ? `${subjectName}'s` : "a"} make-up shift${date ? ` on ${formatWeekdayDateLabel(date)}` : ""}`;
      line = event.action === "admin.makeup_pending"
        ? `reset ${target} to not marked`
        : `marked ${target} as ${event.action === "admin.makeup_worked" ? "worked" : "not worked"}`;
      break;
    }
    case "admin.profile_updated":
      line = `updated ${subjectName ?? "a user"}`;
      detail = [text(meta.role), text(meta.status)].filter(Boolean).join(" · ") || null;
      break;
    case "admin.profile_deleted":
      line = `deleted the user ${subjectName ?? "who has since been removed"}`;
      detail = text(meta.email);
      break;
    case "admin.profile_email_changed":
      line = `changed ${subjectName ? `${subjectName}'s` : "a user's"} sign-in email`;
      detail = text(meta.from) && text(meta.to) ? `${meta.from} → ${meta.to}` : null;
      break;
    case "admin.pto_allowance_updated":
      line = `changed ${subjectName ? `${subjectName}'s` : "a"} PTO allowance`;
      detail = meta.to !== undefined && meta.to !== null
        ? `${meta.from !== undefined && meta.from !== null ? `${meta.from}h → ` : ""}${meta.to}h${meta.year ? ` for ${meta.year}` : ""}`
        : null;
      break;
    case "user.profile_created":
      line = "signed up";
      break;
    default:
      line = auditActionLabel(event.action).toLowerCase();
  }

  return { actor, text: line, detail, category, subjectId, actorId: actorProfile?.id ?? null };
}
