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
