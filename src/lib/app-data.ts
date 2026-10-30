import { createHash } from "crypto";
import { Pool } from "pg";
import { normalizeDatabaseUrl } from "./database";
import { formatCivilDate, losAngelesDate, losAngelesYear } from "./app-time";
import { buildReportCalendarEvents } from "./report-calendar";
import { sendNewRequestEmail, sendRequestChangedEmail, sendRequestDecisionEmail, sendSignInEmailChangedEmail, type RequestEmailKind } from "./email";
import {
  AppRole,
  MakeupStatus,
  ORIGINAL_ADMIN_EMAIL,
  PTO_ALLOWANCE_HOURS,
  ProfileStatus,
  RequestStatus,
  RequestType,
  calculateHours,
  isLateNotice,
  roleForEmail,
  roleHasAdminAccess,
  roleTracksPto
} from "./pto";

export type UserProfile = {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: AppRole;
  status: ProfileStatus;
  protectedOwner: boolean;
};

export type PtoBalance = {
  employeeId: string;
  calendarYear: number;
  annualAllowanceHours: number;
  usedHours: number;
  remainingHours: number;
  expiresOn: string;
};

export type TimeOffSegment = {
  id: string;
  requestId: string;
  date: string;
  startTime: string;
  endTime: string;
  requestedHours: number;
  note?: string;
};

export type MakeupEntry = {
  id: string;
  requestId: string;
  date: string;
  startTime: string;
  endTime: string;
  plannedHours: number;
  verificationStatus: MakeupStatus;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
};

export type TimeOffRequest = {
  id: string;
  employeeId: string;
  requestType: RequestType;
  reason: string;
  totalRequestedHours: number;
  totalMakeupHours: number;
  isLateNotice: boolean;
  requiresMakeupPlan: boolean;
  status: RequestStatus;
  approverEmail?: string | null;
  approverComment?: string | null;
  approvedAt?: string | null;
  editedAt?: string | null;
  cancelledAt?: string | null;
  submittedAt: string;
  segments: TimeOffSegment[];
  makeupEntries: MakeupEntry[];
};

export type AuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  // Extra facts kept with the event (old and new values, who it was about) so the log still
  // reads well after the record itself is changed or deleted.
  metadata?: AuditMetadata | null;
};

export type AuditMetadata = Record<string, string | number | null>;

export type AppSnapshot = {
  profiles: UserProfile[];
  balances: Record<string, PtoBalance>;
  requests: TimeOffRequest[];
  auditEvents: AuditEvent[];
};

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

type ParsedMakeupEntry = {
  date: string;
  startTime: string;
  endTime: string;
  plannedHours: number;
};

export type RequestPayload = {
  requestType: RequestType;
  reason: string;
  segmentDate: string;
  segmentStart: string;
  segmentEnd: string;
  requestedHours: number;
  makeupEntries: ParsedMakeupEntry[];
};

export type CreateRequestResult = {
  status: "created" | "duplicate";
};

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) }) : null;

type EmailNotificationStatus = "Sending" | "Sent" | "Failed";

const memoryEmailNotifications = new Set<string>();

const memory: AppSnapshot = {
  profiles: [
    {
      id: "owner",
      authUserId: "owner",
      email: "admin@leaveflow.local",
      fullName: "LeaveFlow Admin",
      role: "Admin",
      status: "Active",
      protectedOwner: true
    }
  ],
  balances: {},
  requests: [],
  auditEvents: []
};

function notificationKey(notificationType: string, eventKey: string, recipientEmail: string) {
  return `${notificationType}:${eventKey}:${recipientEmail.toLowerCase()}`;
}

function uuid() {
  return crypto.randomUUID();
}

function mapProfile(row: Record<string, any>): UserProfile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    protectedOwner: row.protected_owner
  };
}

function formatDateValue(value: unknown) {
  if (value instanceof Date) return formatCivilDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  return String(value || "");
}

function mapBalance(row: Record<string, any>): PtoBalance {
  return {
    employeeId: row.employee_id,
    calendarYear: row.calendar_year,
    annualAllowanceHours: Number(row.annual_allowance_hours),
    usedHours: Number(row.used_hours),
    remainingHours: Number(row.remaining_hours),
    expiresOn: formatDateValue(row.expires_on)
  };
}

function mapSegment(row: Record<string, any>): TimeOffSegment {
  return {
    id: row.id,
    requestId: row.request_id,
    date: formatDateValue(row.request_date),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    requestedHours: Number(row.requested_hours),
    note: row.note
  };
}

function mapMakeupEntry(row: Record<string, any>): MakeupEntry {
  return {
    id: row.id,
    requestId: row.request_id,
    date: formatDateValue(row.makeup_date),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    plannedHours: Number(row.planned_hours),
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at?.toISOString?.() || row.verified_at
  };
}

function mapRequest(row: Record<string, any>, segments: TimeOffSegment[], makeupEntries: MakeupEntry[]): TimeOffRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    requestType: row.request_type,
    reason: row.reason || "",
    totalRequestedHours: Number(row.total_requested_hours),
    totalMakeupHours: Number(row.total_makeup_hours),
    isLateNotice: row.is_late_notice,
    requiresMakeupPlan: row.requires_makeup_plan,
    status: row.status,
    approverEmail: row.approver_email,
    approverComment: row.approver_comment,
    approvedAt: row.approved_at?.toISOString?.() || row.approved_at,
    editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
    cancelledAt: row.cancelled_at?.toISOString?.() || row.cancelled_at || null,
    submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at,
    segments,
    makeupEntries
  };
}

function groupByRequestId<T extends { requestId: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    groups[item.requestId] ||= [];
    groups[item.requestId].push(item);
    return groups;
  }, {});
}

function mapRequestRows(
  requestRows: Record<string, any>[],
  segmentRows: Record<string, any>[],
  makeupRows: Record<string, any>[]
) {
  const segmentsByRequestId = groupByRequestId(segmentRows.map(mapSegment));
  const makeupByRequestId = groupByRequestId(makeupRows.map(mapMakeupEntry));

  return requestRows.map((row) => mapRequest(
    row,
    segmentsByRequestId[row.id] || [],
    makeupByRequestId[row.id] || []
  ));
}

function cloneMemorySnapshot(filter?: { employeeId?: string; includeAudit?: boolean }): AppSnapshot {
  const snapshot = structuredClone(memory);
  if (!filter?.employeeId) {
    if (filter?.includeAudit === false) snapshot.auditEvents = [];
    return snapshot;
  }

  return {
    profiles: snapshot.profiles.filter((profile) => profile.id === filter.employeeId),
    balances: snapshot.balances[filter.employeeId] ? { [filter.employeeId]: snapshot.balances[filter.employeeId] } : {},
    requests: snapshot.requests.filter((request) => request.employeeId === filter.employeeId),
    auditEvents: filter.includeAudit ? snapshot.auditEvents : []
  };
}

async function audit(actorEmail: string, action: string, targetType: string, targetId: string | null, metadata?: AuditMetadata | null) {
  const details = metadata && Object.keys(metadata).length ? metadata : null;
  if (!pool) {
    memory.auditEvents.unshift({ id: uuid(), actorEmail, action, targetType, targetId, createdAt: new Date().toISOString(), metadata: details });
    return;
  }
  await pool.query(
    // metadata is NOT NULL in the schema (default '{}'), so events without details store an empty object.
    "insert into audit_events (actor_email, action, target_type, target_id, metadata) values ($1, $2, $3, $4, $5::jsonb)",
    [actorEmail, action, targetType, targetId, JSON.stringify(details ?? {})]
  );
}

function mapAuditEvent(row: Record<string, any>): AuditEvent {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    metadata: row.metadata ?? null
  };
}

// Every audit event whose time falls in the given Pacific month (YYYY-MM), newest first.
export async function getAuditEventsForMonth(month: string, limit = 1000): Promise<AuditEvent[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  if (!pool) {
    return memory.auditEvents
      .filter((event) => losAngelesDate(new Date(event.createdAt)).startsWith(month))
      .slice(0, limit)
      .map((event) => structuredClone(event));
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  const result = await pool.query(
    `select * from audit_events
     where created_at >= ($1::timestamp at time zone 'America/Los_Angeles')
       and created_at < ($2::timestamp at time zone 'America/Los_Angeles')
     order by created_at desc
     limit $3`,
    [`${month}-01 00:00:00`, `${next}-01 00:00:00`, limit]
  );
  return result.rows.map(mapAuditEvent);
}

// "Thu, Nov 12" (or "Thu, Nov 12 + 1 more") and the person, for audit details.
function requestAuditSubject(request: Pick<TimeOffRequest, "segments">, employeeName?: string): AuditMetadata {
  const dates = request.segments.map((segment) => segment.date).sort();
  return {
    employee: employeeName ?? null,
    date: dates[0] ?? null,
    extraDays: dates.length > 1 ? dates.length - 1 : null,
  };
}

function scheduleText(request: Pick<TimeOffRequest, "segments">) {
  return request.segments
    .map((segment) => `${segment.date} ${segment.startTime}-${segment.endTime}`)
    .join(", ");
}

export async function ensureProfile(user: AuthUser): Promise<UserProfile> {
  const email = user.email.toLowerCase();
  const bootstrap = roleForEmail(email);

  if (!pool) {
    let profile = memory.profiles.find((item) => item.email.toLowerCase() === email || item.authUserId === user.id);
    if (!profile) {
      profile = {
        id: uuid(),
        authUserId: user.id,
        email,
        fullName: user.name || email,
        role: bootstrap.role,
        status: bootstrap.status,
        protectedOwner: bootstrap.protectedOwner
      };
      memory.profiles.push(profile);
      await audit(email, "user.profile_created", "user_profile", profile.id);
    }
    if (email === ORIGINAL_ADMIN_EMAIL && profile.protectedOwner) {
      profile.role = "Employee";
      profile.status = "Pending";
      profile.protectedOwner = false;
    }
    return profile;
  }

  const result = await pool.query(
    `insert into user_profiles (auth_user_id, email, full_name, role, status, protected_owner, role_assigned_at)
     values ($1, $2, $3, $4, $5, $6, case when $6 then now() else null end)
     on conflict (email) do update
       set auth_user_id = excluded.auth_user_id,
           role = case when excluded.email = $7 and user_profiles.protected_owner then 'Employee' else user_profiles.role end,
           status = case when excluded.email = $7 and user_profiles.protected_owner then 'Pending' else user_profiles.status end,
           protected_owner = case when excluded.email = $7 then false else user_profiles.protected_owner or excluded.protected_owner end,
           updated_at = now()
     returning *`,
    [user.id, email, user.name || email, bootstrap.role, bootstrap.status, bootstrap.protectedOwner, ORIGINAL_ADMIN_EMAIL]
  );
  const profile = mapProfile(result.rows[0]);

  if (roleTracksPto(profile.role)) {
    await ensureBalanceRow(pool, profile.id, currentBalanceYear());
  }
  return profile;
}

export async function getSnapshot(): Promise<AppSnapshot> {
  if (!pool) return cloneMemorySnapshot();

  const [profiles, balances, requests, segments, makeupEntries, auditEvents] = await Promise.all([
    pool.query("select * from user_profiles order by protected_owner desc, full_name asc"),
    pool.query("select *, (annual_allowance_hours - used_hours) as remaining_hours from pto_balances where calendar_year = $1", [currentBalanceYear()]),
    pool.query("select * from time_off_requests order by submitted_at desc"),
    pool.query("select * from time_off_request_segments order by request_date asc, start_time asc"),
    pool.query("select * from makeup_plan_entries order by makeup_date asc, start_time asc"),
    pool.query("select * from audit_events order by created_at desc limit 100")
  ]);

  const balanceMap: Record<string, PtoBalance> = {};
  balances.rows.forEach((row) => {
    balanceMap[row.employee_id] = mapBalance(row);
  });

  return {
    profiles: profiles.rows.map(mapProfile),
    balances: balanceMap,
    requests: mapRequestRows(requests.rows, segments.rows, makeupEntries.rows),
    auditEvents: auditEvents.rows.map(mapAuditEvent)
  };
}

export async function getEmployeeSnapshot(employeeId: string): Promise<AppSnapshot> {
  if (!pool) return cloneMemorySnapshot({ employeeId, includeAudit: false });

  const [profile, balance, requests, segments, makeupEntries] = await Promise.all([
    pool.query("select * from user_profiles where id = $1", [employeeId]),
    pool.query("select *, (annual_allowance_hours - used_hours) as remaining_hours from pto_balances where employee_id = $1 and calendar_year = $2", [employeeId, currentBalanceYear()]),
    pool.query("select * from time_off_requests where employee_id = $1 order by submitted_at desc", [employeeId]),
    pool.query(
      `select s.*
       from time_off_request_segments s
       join time_off_requests r on r.id = s.request_id
       where r.employee_id = $1
       order by s.request_date asc, s.start_time asc`,
      [employeeId]
    ),
    pool.query(
      `select m.*
       from makeup_plan_entries m
       join time_off_requests r on r.id = m.request_id
       where r.employee_id = $1
       order by m.makeup_date asc, m.start_time asc`,
      [employeeId]
    )
  ]);

  const balances: Record<string, PtoBalance> = {};
  balance.rows.forEach((row) => {
    balances[row.employee_id] = mapBalance(row);
  });

  return {
    profiles: profile.rows.map(mapProfile),
    balances,
    requests: mapRequestRows(requests.rows, segments.rows, makeupEntries.rows),
    auditEvents: []
  };
}

export async function getAdminSnapshot() {
  if (!pool) {
    const snapshot = cloneMemorySnapshot({ includeAudit: false });
    snapshot.auditEvents = [];
    return snapshot;
  }

  const [profiles, balances, requests, segments, makeupEntries] = await Promise.all([
    pool.query("select * from user_profiles order by protected_owner desc, full_name asc"),
    pool.query("select *, (annual_allowance_hours - used_hours) as remaining_hours from pto_balances where calendar_year = $1", [currentBalanceYear()]),
    pool.query("select * from time_off_requests order by submitted_at desc"),
    pool.query("select * from time_off_request_segments order by request_date asc, start_time asc"),
    pool.query("select * from makeup_plan_entries order by makeup_date asc, start_time asc")
  ]);

  const balanceMap: Record<string, PtoBalance> = {};
  balances.rows.forEach((row) => {
    balanceMap[row.employee_id] = mapBalance(row);
  });

  return {
    profiles: profiles.rows.map(mapProfile),
    balances: balanceMap,
    requests: mapRequestRows(requests.rows, segments.rows, makeupEntries.rows),
    auditEvents: []
  };
}

export async function getReportsSnapshot() {
  return getSnapshot();
}

export function isAdmin(profile: UserProfile) {
  return roleHasAdminAccess(profile.role) && profile.status === "Active";
}

export type RequestDetails = {
  request: TimeOffRequest;
  employee: UserProfile;
};

export async function getActiveAdminProfiles() {
  if (!pool) return memory.profiles.filter(isAdmin);

  const result = await pool.query(
    "select * from user_profiles where role in ('Admin', 'Manager') and status = 'Active' order by protected_owner desc, full_name asc"
  );
  return result.rows.map(mapProfile);
}

export async function getRequestDetails(requestId: string): Promise<RequestDetails | null> {
  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId);
    if (!request) return null;
    const employee = memory.profiles.find((profile) => profile.id === request.employeeId);
    return employee ? { request: structuredClone(request), employee: structuredClone(employee) } : null;
  }

  const [request, segments, makeupEntries] = await Promise.all([
    pool.query("select * from time_off_requests where id = $1", [requestId]),
    pool.query("select * from time_off_request_segments where request_id = $1 order by request_date asc, start_time asc", [requestId]),
    pool.query("select * from makeup_plan_entries where request_id = $1 order by makeup_date asc, start_time asc", [requestId])
  ]);
  if (!request.rows[0]) return null;

  const employee = await pool.query("select * from user_profiles where id = $1", [request.rows[0].employee_id]);
  if (!employee.rows[0]) return null;

  return {
    request: mapRequest(request.rows[0], segments.rows.map(mapSegment), makeupEntries.rows.map(mapMakeupEntry)),
    employee: mapProfile(employee.rows[0])
  };
}

export async function getApprovedEventsForDate(date: string) {
  const snapshot = await getSnapshot();
  return buildReportCalendarEvents(snapshot).filter((event) => event.date === date);
}

export async function claimEmailNotification(notificationType: string, eventKey: string, recipientEmail: string) {
  if (!pool) {
    const key = notificationKey(notificationType, eventKey, recipientEmail);
    if (memoryEmailNotifications.has(key)) return false;
    memoryEmailNotifications.add(key);
    return true;
  }

  const result = await pool.query(
    `insert into email_notifications (event_key, notification_type, recipient_email, status)
     values ($1, $2, $3, 'Sending')
     on conflict (event_key, notification_type, recipient_email) do nothing
     returning id`,
    [eventKey, notificationType, recipientEmail.toLowerCase()]
  );
  return Boolean(result.rows[0]);
}

export async function markEmailNotification(
  notificationType: string,
  eventKey: string,
  recipientEmail: string,
  status: EmailNotificationStatus,
  errorMessage?: string
) {
  if (!pool) return;

  await pool.query(
    `update email_notifications
     set status = $1,
         sent_at = case when $1 = 'Sent' then now() else sent_at end,
         error_message = $2
     where event_key = $3 and notification_type = $4 and recipient_email = $5`,
    [status, errorMessage || null, eventKey, notificationType, recipientEmail.toLowerCase()]
  );
}

async function notifyAdminsOfSubmittedRequest(employee: UserProfile, requestId: string, kind: RequestEmailKind = "new") {
  try {
    const [admins, details] = await Promise.all([
      getActiveAdminProfiles(),
      getRequestDetails(requestId)
    ]);
    if (!details) return;
    // A Manager is both an admin and an employee; don't email them about their own request.
    const recipients = admins.filter((admin) => admin.id !== employee.id);
    if (recipients.length === 0) return;
    await sendNewRequestEmail(recipients, employee, details.request, kind);
  } catch (error) {
    console.error("Failed to send new request notification", error);
  }
}

async function notifyEmployeeOfRequestDecision(requestId: string, approverName?: string) {
  try {
    const details = await getRequestDetails(requestId);
    if (!details) return;
    await sendRequestDecisionEmail(details.employee, details.request, approverName);
  } catch (error) {
    console.error("Failed to send request decision notification", error);
  }
}

function formValues(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value || "").trim());
}

export function parseMakeupEntries(formData: FormData): ParsedMakeupEntry[] {
  const dates = formValues(formData, "makeupDate");
  const starts = formValues(formData, "makeupStart");
  const ends = formValues(formData, "makeupEnd");
  const rowCount = Math.max(dates.length, starts.length, ends.length);
  const entries: ParsedMakeupEntry[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const date = dates[index] || "";
    const startTime = starts[index] || "";
    const endTime = ends[index] || "";
    const hasAnyValue = Boolean(date || startTime || endTime);

    if (!hasAnyValue) continue;
    if (!date || !startTime || !endTime) {
      throw new Error("Each make-up row needs a date, start time, and end time.");
    }

    const plannedHours = calculateHours(startTime, endTime);
    if (!plannedHours) throw new Error("Make-up rows must have a valid start and end.");

    entries.push({ date, startTime, endTime, plannedHours });
  }

  return entries;
}

function normalizeReason(reason: string) {
  return reason.trim();
}

function sortedMakeupEntries(entries: ParsedMakeupEntry[]) {
  return [...entries].sort((left, right) => {
    return `${left.date}|${left.startTime}|${left.endTime}|${left.plannedHours}`.localeCompare(
      `${right.date}|${right.startTime}|${right.endTime}|${right.plannedHours}`
    );
  });
}

export function canonicalDuplicateKey(employeeId: string, payload: RequestPayload) {
  return JSON.stringify({
    employeeId,
    requestType: payload.requestType,
    reason: payload.reason,
    segmentDate: payload.segmentDate,
    segmentStart: payload.segmentStart,
    segmentEnd: payload.segmentEnd,
    requestedHours: payload.requestedHours,
    makeupEntries: sortedMakeupEntries(payload.makeupEntries)
  });
}

function advisoryLockKeys(key: string) {
  const digest = createHash("sha256").update(key).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)] as const;
}

function makeupEntriesMatch(left: ParsedMakeupEntry[], right: ParsedMakeupEntry[]) {
  const sortedLeft = sortedMakeupEntries(left);
  const sortedRight = sortedMakeupEntries(right);
  if (sortedLeft.length !== sortedRight.length) return false;

  return sortedLeft.every((entry, index) => {
    const other = sortedRight[index];
    return entry.date === other.date
      && entry.startTime === other.startTime
      && entry.endTime === other.endTime
      && entry.plannedHours === other.plannedHours;
  });
}

function memoryRequestMatchesPayload(request: TimeOffRequest, payload: RequestPayload) {
  const segment = request.segments[0];
  if (!segment || request.status === "Cancelled") return false;

  return request.requestType === payload.requestType
    && normalizeReason(request.reason) === payload.reason
    && segment.date === payload.segmentDate
    && segment.startTime === payload.segmentStart
    && segment.endTime === payload.segmentEnd
    && segment.requestedHours === payload.requestedHours
    && makeupEntriesMatch(request.makeupEntries.map((entry) => ({
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      plannedHours: entry.plannedHours
    })), payload.makeupEntries);
}

async function hasDuplicateRequest(client: Pick<Pool, "query">, employeeId: string, payload: RequestPayload, excludeRequestId?: string) {
  const candidates = await client.query(
    `select r.id
     from time_off_requests r
     join time_off_request_segments s on s.request_id = r.id
     where r.employee_id = $1
       and r.request_type = $2
       and coalesce(trim(r.reason), '') = $3
       and s.request_date = $4
       and s.start_time = $5
       and s.end_time = $6
       and s.requested_hours = $7
       and r.status <> 'Cancelled'
       and ($8::uuid is null or r.id <> $8::uuid)`,
    [employeeId, payload.requestType, payload.reason, payload.segmentDate, payload.segmentStart, payload.segmentEnd, payload.requestedHours, excludeRequestId ?? null]
  );

  for (const candidate of candidates.rows) {
    const makeupRows = await client.query(
      `select makeup_date, start_time, end_time, planned_hours
       from makeup_plan_entries
       where request_id = $1`,
      [candidate.id]
    );
    const existingMakeupEntries = makeupRows.rows.map((row) => ({
      date: formatDateValue(row.makeup_date),
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
      plannedHours: Number(row.planned_hours)
    }));

    if (makeupEntriesMatch(existingMakeupEntries, payload.makeupEntries)) return true;
  }

  return false;
}

async function lockDuplicatePayload(client: Pick<Pool, "query">, employeeId: string, payload: RequestPayload) {
  const [firstKey, secondKey] = advisoryLockKeys(canonicalDuplicateKey(employeeId, payload));
  await client.query("select pg_advisory_xact_lock($1::int, $2::int)", [firstKey, secondKey]);
}

const MAX_FULL_NAME_LENGTH = 100;

export function normalizeFullName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Name is required.");
  if (name.length > MAX_FULL_NAME_LENGTH) throw new Error(`Name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`);
  return name;
}

// Email is intentionally not editable here: it is the sign-in identity.
export async function updateProfile(actor: UserProfile, id: string, role: AppRole, status: ProfileStatus, fullName?: string) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  const name = fullName === undefined ? undefined : normalizeFullName(fullName);
  if (!pool) {
    const profile = memory.profiles.find((item) => item.id === id);
    if (!profile || profile.protectedOwner) return;
    profile.role = role;
    profile.status = status;
    if (name) profile.fullName = name;
    if (roleTracksPto(role) && !memory.balances[id]) {
      const calendarYear = currentBalanceYear();
      memory.balances[id] = {
        employeeId: id,
        calendarYear,
        annualAllowanceHours: PTO_ALLOWANCE_HOURS,
        usedHours: 0,
        remainingHours: PTO_ALLOWANCE_HOURS,
        expiresOn: yearEnd(calendarYear)
      };
    }
    await audit(actor.email, "admin.profile_updated", "user_profile", id, { name: profile.fullName, role, status });
    return;
  }
  await pool.query(
    `update user_profiles
     set role = $1, status = $2, role_assigned_by = $3, role_assigned_at = now(), updated_at = now(),
         full_name = coalesce($5, full_name)
     where id = $4 and protected_owner = false`,
    [role, status, actor.id, id, name ?? null]
  );
  // Ensure PTO-tracked roles (Employee, Manager) have a balance without waiting for re-login.
  if (roleTracksPto(role)) {
    await ensureBalanceRow(pool, id, currentBalanceYear());
  }
  await audit(actor.email, "admin.profile_updated", "user_profile", id, { name: name ?? null, role, status });
}

export async function deleteProfile(actor: UserProfile, id: string) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  if (actor.id === id) throw new Error("You cannot delete your own account.");

  if (!pool) {
    const profileIndex = memory.profiles.findIndex((item) => item.id === id);
    if (profileIndex === -1 || memory.profiles[profileIndex].protectedOwner) return;

    const [removed] = memory.profiles.splice(profileIndex, 1);
    delete memory.balances[id];
    memory.requests = memory.requests.filter((request) => request.employeeId !== id);

    await audit(actor.email, "admin.profile_deleted", "user_profile", id, { name: removed.fullName, email: removed.email });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await client.query(
      "select auth_user_id, full_name, email from user_profiles where id = $1 and protected_owner = false for update",
      [id]
    );
    if (target.rows.length === 0) {
      await client.query("commit");
      return;
    }

    const authUserId = target.rows[0].auth_user_id as string | null;

    // Clear the self-referential FK (role_assigned_by has no ON DELETE action).
    await client.query("update user_profiles set role_assigned_by = null where role_assigned_by = $1", [id]);
    // Cascades pto_balances, time_off_requests, segments and makeup entries.
    await client.query("delete from user_profiles where id = $1", [id]);
    // Remove the Better Auth login identity (cascades session and account rows).
    if (authUserId) {
      await client.query('delete from "user" where id = $1', [authUserId]);
    }

    await client.query("commit");
    await audit(actor.email, "admin.profile_deleted", "user_profile", id, { name: target.rows[0].full_name, email: target.rows[0].email });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  return email;
}

export type ChangeEmailResult = { oldEmail: string; newEmail: string; removedEmptyProfile: boolean };

// Moves a person's whole profile (requests, make-ups, PTO, history) to a new Google sign-in email.
// The old Google account is signed out and unlinked. If the person already signed in with the new
// email, the empty profile that created is removed; a profile with requests is never removed.
export async function changeProfileEmail(actor: UserProfile, id: string, newEmailInput: string): Promise<ChangeEmailResult> {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  if (actor.id === id) throw new Error("Another admin needs to change your own sign-in email.");
  const newEmail = normalizeEmail(newEmailInput);

  if (!pool) {
    const target = memory.profiles.find((item) => item.id === id);
    if (!target || target.protectedOwner) throw new Error("User not found.");
    const oldEmail = target.email;
    if (oldEmail.toLowerCase() === newEmail) throw new Error("That is already their sign-in email.");
    const other = memory.profiles.find((item) => item.id !== id && item.email.toLowerCase() === newEmail);
    if (other) assertRemovableDuplicate(other, actor, memory.requests.filter((request) => request.employeeId === other.id).length);
    if (other) {
      memory.profiles = memory.profiles.filter((item) => item.id !== other.id);
      delete memory.balances[other.id];
    }
    target.email = newEmail;
    target.authUserId = other?.authUserId ?? "";
    await audit(actor.email, "admin.profile_email_changed", "user_profile", id, { from: oldEmail, to: newEmail });
    await notifyOfEmailChange(id, oldEmail, newEmail, actor);
    return { oldEmail, newEmail, removedEmptyProfile: Boolean(other) };
  }

  const client = await pool.connect();
  let result: ChangeEmailResult;
  try {
    await client.query("begin");
    const targetRows = await client.query(
      "select id, email, auth_user_id, protected_owner from user_profiles where id = $1 for update",
      [id]
    );
    const target = targetRows.rows[0];
    if (!target || target.protected_owner) throw new Error("User not found.");
    const oldEmail = String(target.email);
    if (oldEmail.toLowerCase() === newEmail) throw new Error("That is already their sign-in email.");

    const otherRows = await client.query(
      `select p.*, (select count(*)::int from time_off_requests r where r.employee_id = p.id) as request_count
       from user_profiles p where lower(p.email) = $1 and p.id <> $2 for update`,
      [newEmail, id]
    );
    const other = otherRows.rows[0];
    let newAuthUserId: string | null = null;
    if (other) {
      assertRemovableDuplicate(mapProfile(other), actor, Number(other.request_count));
      // Keep the new Google login itself; only its empty profile goes. Their next page load lands on this profile.
      newAuthUserId = other.auth_user_id ?? null;
      await client.query("update user_profiles set role_assigned_by = null where role_assigned_by = $1", [other.id]);
      await client.query("delete from user_profiles where id = $1", [other.id]);
    }

    await client.query(
      "update user_profiles set email = $2, auth_user_id = $3, updated_at = now() where id = $1",
      [id, newEmail, newAuthUserId]
    );
    // Sign out and unlink the old Google account (cascades its sessions and linked account rows).
    if (target.auth_user_id) {
      await client.query('delete from "user" where id = $1', [target.auth_user_id]);
    }
    await client.query("commit");
    result = { oldEmail, newEmail, removedEmptyProfile: Boolean(other) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  await audit(actor.email, "admin.profile_email_changed", "user_profile", id, { from: result.oldEmail, to: result.newEmail });
  await notifyOfEmailChange(id, result.oldEmail, result.newEmail, actor);
  return result;
}

async function notifyOfEmailChange(id: string, oldEmail: string, newEmail: string, admin: UserProfile) {
  try {
    const profile = pool
      ? (await pool.query("select * from user_profiles where id = $1", [id])).rows.map(mapProfile)[0]
      : memory.profiles.find((item) => item.id === id);
    if (profile) await sendSignInEmailChangedEmail(profile, oldEmail, newEmail, admin);
  } catch (error) {
    console.error("Failed to send sign-in email change notification", error);
  }
}

function assertRemovableDuplicate(other: UserProfile, actor: UserProfile, requestCount: number) {
  if (other.protectedOwner || other.id === actor.id || requestCount > 0) {
    throw new Error(
      `${other.fullName} (${other.email}) already uses that email` +
      (requestCount > 0 ? ` and has ${requestCount} request${requestCount === 1 ? "" : "s"}.` : ".") +
      " Pick a different email, or delete that user first."
    );
  }
}

function normalizeAllowanceHours(value: string | number) {
  const allowance = Number(value);
  if (!Number.isFinite(allowance) || allowance < 0) {
    throw new Error("PTO allowance must be a valid non-negative number.");
  }
  return Number(allowance.toFixed(2));
}

function currentBalanceYear() {
  return losAngelesYear();
}

function yearEnd(year: number) {
  return `${year}-12-31`;
}

type Queryable = { query: Pool["query"] };

// Creates the employee's balance row for a year if missing, carrying forward their most
// recent earlier allowance (so custom allowances survive the new year) or the default.
async function ensureBalanceRow(db: Queryable, employeeId: string, year: number) {
  await db.query(
    `insert into pto_balances (employee_id, calendar_year, annual_allowance_hours, used_hours, expires_on)
     select $1, $2::int,
       coalesce((select annual_allowance_hours from pto_balances
                 where employee_id = $1 and calendar_year < $2::int
                 order by calendar_year desc limit 1), $3),
       0, make_date($2::int, 12, 31)
     on conflict (employee_id, calendar_year) do nothing`,
    [employeeId, year, PTO_ALLOWANCE_HOURS]
  );
}

// PTO counts against the year the time off is taken, not the year it was approved.
async function recalculatePtoUsed(db: Queryable, employeeId: string, year: number) {
  await db.query(
    `update pto_balances
     set used_hours = coalesce((
       select sum(s.requested_hours)
       from time_off_request_segments s
       join time_off_requests r on r.id = s.request_id
       where r.employee_id = $1 and r.request_type = 'PTO' and r.status = 'Approved'
         and extract(year from s.request_date)::int = $2::int
     ), 0)
     where employee_id = $1 and calendar_year = $2::int`,
    [employeeId, year]
  );
}

async function ptoHoursByYear(db: Queryable, requestId: string) {
  const result = await db.query(
    `select extract(year from request_date)::int as year, sum(requested_hours)::float as hours
     from time_off_request_segments where request_id = $1 group by 1`,
    [requestId]
  );
  return result.rows as Array<{ year: number; hours: number }>;
}

async function remainingPto(db: Queryable, employeeId: string, year: number) {
  await ensureBalanceRow(db, employeeId, year);
  const result = await db.query(
    "select annual_allowance_hours::float as allowance, used_hours::float as used from pto_balances where employee_id = $1 and calendar_year = $2",
    [employeeId, year]
  );
  const row = result.rows[0] || { allowance: PTO_ALLOWANCE_HOURS, used: 0 };
  return Number((row.allowance - row.used).toFixed(2));
}

function insufficientPtoMessage(needed: number, remaining: number, year: number) {
  return `This needs ${needed}h of PTO but only ${Math.max(remaining, 0)}h is left for ${year}.`;
}

// Makes sure every active PTO-tracked person has a balance row for the current year.
// Idempotent; run by the daily cron so January balances exist before anyone signs in.
export async function ensureCurrentYearBalances() {
  if (!pool) return;
  const year = currentBalanceYear();
  await pool.query(
    `insert into pto_balances (employee_id, calendar_year, annual_allowance_hours, used_hours, expires_on)
     select p.id, $1::int,
       coalesce((select b.annual_allowance_hours from pto_balances b
                 where b.employee_id = p.id and b.calendar_year < $1::int
                 order by b.calendar_year desc limit 1), $2),
       0, make_date($1::int, 12, 31)
     from user_profiles p
     where p.role in ('Employee', 'Manager') and p.status = 'Active'
     on conflict (employee_id, calendar_year) do nothing`,
    [year, PTO_ALLOWANCE_HOURS]
  );
}

export async function updatePtoAllowance(actor: UserProfile, employeeId: string, annualAllowanceHours: string | number) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");

  const allowance = normalizeAllowanceHours(annualAllowanceHours);
  const calendarYear = currentBalanceYear();

  if (!pool) {
    const profile = memory.profiles.find((item) => item.id === employeeId);
    if (!profile) throw new Error("Employee profile not found.");

    const previousAllowance = memory.balances[employeeId]?.annualAllowanceHours ?? null;
    const balance = memory.balances[employeeId] || {
      employeeId,
      calendarYear,
      annualAllowanceHours: allowance,
      usedHours: 0,
      remainingHours: allowance,
      expiresOn: yearEnd(calendarYear)
    };

    memory.balances[employeeId] = {
      ...balance,
      calendarYear,
      annualAllowanceHours: allowance,
      remainingHours: Number((allowance - balance.usedHours).toFixed(2)),
      expiresOn: balance.expiresOn || yearEnd(calendarYear)
    };
    recalculateMemoryPtoBalance(employeeId, calendarYear);

    await audit(actor.email, "admin.pto_allowance_updated", "pto_balance", employeeId, { from: previousAllowance, to: allowance, year: calendarYear });
    return;
  }

  const profile = await pool.query("select id from user_profiles where id = $1", [employeeId]);
  if (!profile.rows[0]) throw new Error("Employee profile not found.");
  const previous = await pool.query(
    "select annual_allowance_hours::float as allowance from pto_balances where employee_id = $1 and calendar_year = $2",
    [employeeId, calendarYear]
  );

  await pool.query(
    `insert into pto_balances (employee_id, calendar_year, annual_allowance_hours, used_hours, expires_on)
     values ($1, $2, $3, 0, $4)
     on conflict (employee_id, calendar_year) do update
       set annual_allowance_hours = excluded.annual_allowance_hours`,
    [employeeId, calendarYear, allowance, yearEnd(calendarYear)]
  );

  await audit(actor.email, "admin.pto_allowance_updated", "pto_balance", employeeId, {
    from: previous.rows[0]?.allowance ?? null, to: allowance, year: calendarYear
  });
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

// Shared by submit and edit so both enforce the same rules.
export function parseRequestPayload(formData: FormData): RequestPayload {
  const requestType = String(formData.get("requestType")) as RequestType;
  const reason = normalizeReason(String(formData.get("reason") || ""));
  const segmentDate = String(formData.get("segmentDate"));
  const segmentStart = String(formData.get("segmentStart"));
  const segmentEnd = String(formData.get("segmentEnd"));
  const makeupEntries = parseMakeupEntries(formData);
  const requestedHours = calculateHours(segmentStart, segmentEnd);
  const makeupHours = roundHours(makeupEntries.reduce((total, entry) => total + entry.plannedHours, 0));

  if (!requestedHours) throw new Error("Requested time must have a valid start and end.");
  if (requestType !== "PTO") {
    if (!makeupHours) throw new Error("Additional time off requires a make-up plan.");
    if (makeupHours < requestedHours) {
      throw new Error(
        `Your make-up plan covers ${makeupHours}h but you're taking ${requestedHours}h off. ` +
        `Add ${roundHours(requestedHours - makeupHours)}h more make-up time.`
      );
    }
  }
  return { requestType, reason, segmentDate, segmentStart, segmentEnd, requestedHours, makeupEntries };
}

function payloadMakeupHours(payload: RequestPayload) {
  return roundHours(payload.makeupEntries.reduce((total, entry) => total + entry.plannedHours, 0));
}

function payloadYear(payload: RequestPayload) {
  return Number(payload.segmentDate.slice(0, 4));
}

function buildMemoryChildren(requestId: string, payload: RequestPayload) {
  return {
    segments: [{
      id: uuid(), requestId, date: payload.segmentDate, startTime: payload.segmentStart,
      endTime: payload.segmentEnd, requestedHours: payload.requestedHours
    }],
    makeupEntries: payload.makeupEntries.map((entry) => ({ id: uuid(), requestId, ...entry, verificationStatus: "Pending" as MakeupStatus }))
  };
}

async function insertRequestChildren(client: Queryable, requestId: string, payload: RequestPayload) {
  await client.query(
    `insert into time_off_request_segments (request_id, request_date, start_time, end_time, requested_hours)
     values ($1, $2, $3, $4, $5)`,
    [requestId, payload.segmentDate, payload.segmentStart, payload.segmentEnd, payload.requestedHours]
  );
  for (const entry of payload.makeupEntries) {
    await client.query(
      `insert into makeup_plan_entries (request_id, makeup_date, start_time, end_time, planned_hours)
       values ($1, $2, $3, $4, $5)`,
      [requestId, entry.date, entry.startTime, entry.endTime, entry.plannedHours]
    );
  }
}

export async function createTimeOffRequest(actor: UserProfile, formData: FormData): Promise<CreateRequestResult> {
  if (actor.status !== "Active") throw new Error("Active profile required.");
  const payload = parseRequestPayload(formData);
  const { requestType, reason, segmentDate, requestedHours } = payload;
  const makeupHours = payloadMakeupHours(payload);
  const segmentYear = payloadYear(payload);

  if (!pool) {
    const duplicate = memory.requests.some((request) => request.employeeId === actor.id && memoryRequestMatchesPayload(request, payload));
    if (duplicate) return { status: "duplicate" };
    if (requestType === "PTO") {
      const remaining = memoryRemainingPto(actor.id, segmentYear);
      if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
    }

    const requestId = uuid();
    memory.requests.unshift({
      id: requestId,
      employeeId: actor.id,
      requestType,
      reason,
      totalRequestedHours: requestedHours,
      totalMakeupHours: makeupHours,
      isLateNotice: isLateNotice(losAngelesDate(), segmentDate),
      requiresMakeupPlan: requestType !== "PTO",
      status: "Pending",
      submittedAt: new Date().toISOString(),
      ...buildMemoryChildren(requestId, payload)
    });
    await audit(actor.email, "employee.request_submitted", "time_off_request", requestId);
    await notifyAdminsOfSubmittedRequest(actor, requestId);
    return { status: "created" };
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await lockDuplicatePayload(client, actor.id, payload);
    if (await hasDuplicateRequest(client, actor.id, payload)) {
      await client.query("commit");
      return { status: "duplicate" };
    }
    if (requestType === "PTO") {
      const remaining = await remainingPto(client, actor.id, segmentYear);
      if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
    }

    const request = await client.query(
      `insert into time_off_requests
       (employee_id, request_type, reason, total_requested_hours, total_makeup_hours, is_late_notice, requires_makeup_plan)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [actor.id, requestType, reason, requestedHours, makeupHours, isLateNotice(losAngelesDate(), segmentDate), requestType !== "PTO"]
    );
    const requestId = request.rows[0].id;
    await insertRequestChildren(client, requestId, payload);
    await client.query("commit");
    await audit(actor.email, "employee.request_submitted", "time_off_request", requestId);
    await notifyAdminsOfSubmittedRequest(actor, requestId);
    return { status: "created" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function assertOwnPendingRequest(actor: UserProfile, request: { employeeId: string; status: RequestStatus } | undefined, verb: string) {
  if (!request) throw new Error("Request not found.");
  if (request.employeeId !== actor.id) throw new Error(`You can only ${verb} your own requests.`);
  if (request.status !== "Pending") throw new Error(`Only pending requests can be ${verb === "edit" ? "edited" : "cancelled"}.`);
}

// Employees may cancel their own request while it is still pending. It is kept, marked Cancelled.
export async function cancelRequest(actor: UserProfile, requestId: string) {
  if (actor.status !== "Active") throw new Error("Active profile required.");

  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId);
    assertOwnPendingRequest(actor, request, "cancel");
    request!.status = "Cancelled";
    request!.cancelledAt = new Date().toISOString();
  } else {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query("select employee_id, status from time_off_requests where id = $1 for update", [requestId]);
      const row = result.rows[0];
      assertOwnPendingRequest(actor, row && { employeeId: row.employee_id, status: row.status }, "cancel");
      await client.query("update time_off_requests set status = 'Cancelled', cancelled_at = now() where id = $1", [requestId]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  await audit(actor.email, "employee.request_cancelled", "time_off_request", requestId);
  await notifyAdminsOfSubmittedRequest(actor, requestId, "cancelled");
}

export type UpdateRequestResult = { status: "updated" | "duplicate" };

// Employees may change their own pending request; it is re-validated and stays pending.
export async function updatePendingRequest(actor: UserProfile, requestId: string, formData: FormData): Promise<UpdateRequestResult> {
  if (actor.status !== "Active") throw new Error("Active profile required.");
  const payload = parseRequestPayload(formData);
  const { requestType, reason, segmentDate, requestedHours } = payload;
  const makeupHours = payloadMakeupHours(payload);
  const segmentYear = payloadYear(payload);

  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId);
    assertOwnPendingRequest(actor, request, "edit");
    const duplicate = memory.requests.some((item) =>
      item.id !== requestId && item.employeeId === actor.id && memoryRequestMatchesPayload(item, payload)
    );
    if (duplicate) return { status: "duplicate" };
    if (requestType === "PTO") {
      const remaining = memoryRemainingPto(actor.id, segmentYear);
      if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
    }
    Object.assign(request!, {
      requestType,
      reason,
      totalRequestedHours: requestedHours,
      totalMakeupHours: makeupHours,
      isLateNotice: isLateNotice(losAngelesDate(), segmentDate),
      requiresMakeupPlan: requestType !== "PTO",
      editedAt: new Date().toISOString(),
      ...buildMemoryChildren(requestId, payload)
    });
  } else {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query("select employee_id, status from time_off_requests where id = $1 for update", [requestId]);
      const row = result.rows[0];
      assertOwnPendingRequest(actor, row && { employeeId: row.employee_id, status: row.status }, "edit");
      await lockDuplicatePayload(client, actor.id, payload);
      if (await hasDuplicateRequest(client, actor.id, payload, requestId)) {
        await client.query("commit");
        return { status: "duplicate" };
      }
      if (requestType === "PTO") {
        const remaining = await remainingPto(client, actor.id, segmentYear);
        if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
      }
      await client.query(
        `update time_off_requests
         set request_type = $2, reason = $3, total_requested_hours = $4, total_makeup_hours = $5,
             is_late_notice = $6, requires_makeup_plan = $7, edited_at = now()
         where id = $1`,
        [requestId, requestType, reason, requestedHours, makeupHours, isLateNotice(losAngelesDate(), segmentDate), requestType !== "PTO"]
      );
      await client.query("delete from time_off_request_segments where request_id = $1", [requestId]);
      await client.query("delete from makeup_plan_entries where request_id = $1", [requestId]);
      await insertRequestChildren(client, requestId, payload);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  await audit(actor.email, "employee.request_updated", "time_off_request", requestId);
  await notifyAdminsOfSubmittedRequest(actor, requestId, "updated");
  return { status: "updated" };
}

export type AdminUpdateRequestResult = { status: "updated" | "duplicate"; notified: "employee" | "admins" | "none" };

const makeupKey = (entry: { date: string; startTime: string; endTime: string }) => `${entry.date} ${entry.startTime} ${entry.endTime}`;

// Admins and Managers can fix a pending or approved request in place. The status stays the same,
// make-up shifts that didn't change keep their Worked / Not worked marks, and PTO balances follow.
export async function adminUpdateRequest(actor: UserProfile, requestId: string, formData: FormData): Promise<AdminUpdateRequestResult> {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  const payload = parseRequestPayload(formData);
  const note = normalizeDecisionNote("Approved", String(formData.get("note") ?? ""));
  const { requestType, reason, requestedHours } = payload;
  const makeupHours = payloadMakeupHours(payload);
  const segmentYear = payloadYear(payload);

  const before = await getRequestDetails(requestId);
  if (!before) throw new Error("Request not found.");
  assertEditableByAdmin(before.request.status);
  const employeeId = before.request.employeeId;
  const lateNotice = isLateNotice(losAngelesDate(new Date(before.request.submittedAt)), payload.segmentDate);

  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId)!;
    assertEditableByAdmin(request.status);
    const duplicate = memory.requests.some((item) =>
      item.id !== requestId && item.employeeId === employeeId && memoryRequestMatchesPayload(item, payload)
    );
    if (duplicate) return { status: "duplicate", notified: "none" };
    const wasApprovedPto = request.status === "Approved" && request.requestType === "PTO";
    const oldYears = [...memoryPtoHoursByYear(request).keys()];
    if (requestType === "PTO") {
      const ownHours = wasApprovedPto ? memoryPtoHoursByYear(request).get(segmentYear) || 0 : 0;
      const remaining = roundHours(memoryRemainingPto(employeeId, segmentYear) + ownHours);
      if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
    }
    const kept = new Map(request.makeupEntries.map((entry) => [makeupKey(entry), entry]));
    const children = buildMemoryChildren(requestId, payload);
    children.makeupEntries = children.makeupEntries.map((entry) => kept.get(makeupKey(entry)) ?? entry);
    Object.assign(request, {
      requestType,
      reason,
      totalRequestedHours: requestedHours,
      totalMakeupHours: makeupHours,
      isLateNotice: lateNotice,
      requiresMakeupPlan: requestType !== "PTO",
      editedAt: new Date().toISOString(),
      ...children
    });
    if (request.status === "Approved") {
      for (const year of new Set([...oldYears, segmentYear])) recalculateMemoryPtoBalance(employeeId, year);
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query("select employee_id, status, request_type from time_off_requests where id = $1 for update", [requestId]);
      const row = result.rows[0];
      if (!row) throw new Error("Request not found.");
      assertEditableByAdmin(row.status);
      await lockDuplicatePayload(client, employeeId, payload);
      if (await hasDuplicateRequest(client, employeeId, payload, requestId)) {
        await client.query("commit");
        return { status: "duplicate", notified: "none" };
      }
      const isApproved = row.status === "Approved";
      const oldYears = await ptoHoursByYear(client, requestId);
      if (requestType === "PTO") {
        const ownHours = isApproved && row.request_type === "PTO"
          ? oldYears.find((item) => Number(item.year) === segmentYear)?.hours || 0
          : 0;
        const remaining = roundHours(await remainingPto(client, employeeId, segmentYear) + ownHours);
        if (requestedHours > remaining) throw new Error(insufficientPtoMessage(requestedHours, remaining, segmentYear));
      }
      await client.query(
        `update time_off_requests
         set request_type = $2, reason = $3, total_requested_hours = $4, total_makeup_hours = $5,
             is_late_notice = $6, requires_makeup_plan = $7, edited_at = now()
         where id = $1`,
        [requestId, requestType, reason, requestedHours, makeupHours, lateNotice, requestType !== "PTO"]
      );
      await client.query("delete from time_off_request_segments where request_id = $1", [requestId]);
      await client.query(
        `insert into time_off_request_segments (request_id, request_date, start_time, end_time, requested_hours)
         values ($1, $2, $3, $4, $5)`,
        [requestId, payload.segmentDate, payload.segmentStart, payload.segmentEnd, payload.requestedHours]
      );
      // Keep make-up shifts that didn't change (and their verification); replace the rest.
      const wanted = new Set(payload.makeupEntries.map(makeupKey));
      const existing = new Set<string>();
      for (const entry of before.request.makeupEntries) {
        if (wanted.has(makeupKey(entry)) && !existing.has(makeupKey(entry))) existing.add(makeupKey(entry));
        else await client.query("delete from makeup_plan_entries where id = $1", [entry.id]);
      }
      for (const entry of payload.makeupEntries) {
        if (existing.delete(makeupKey(entry))) continue;
        await client.query(
          `insert into makeup_plan_entries (request_id, makeup_date, start_time, end_time, planned_hours)
           values ($1, $2, $3, $4, $5)`,
          [requestId, entry.date, entry.startTime, entry.endTime, entry.plannedHours]
        );
      }
      if (isApproved) {
        const years = new Set([...oldYears.map((item) => Number(item.year)), segmentYear]);
        for (const year of years) {
          await ensureBalanceRow(client, employeeId, year);
          await recalculatePtoUsed(client, employeeId, year);
        }
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  const newSchedule = `${payload.segmentDate} ${payload.segmentStart}-${payload.segmentEnd}`;
  const oldSchedule = scheduleText(before.request);
  await audit(actor.email, "admin.request_updated", "time_off_request", requestId, {
    ...requestAuditSubject(before.request, before.employee.fullName),
    from: oldSchedule !== newSchedule ? oldSchedule : null,
    to: oldSchedule !== newSchedule ? newSchedule : null,
    note,
  });
  const notified = await notifyOfAdminEdit(actor, before.request, requestId, note);
  return { status: "updated", notified };
}

function assertEditableByAdmin(status: RequestStatus) {
  if (status !== "Pending" && status !== "Approved") throw new Error("Only pending or approved requests can be edited.");
}

// The employee hears about the change; if a Manager edited their own request, the other admins do.
async function notifyOfAdminEdit(actor: UserProfile, before: TimeOffRequest, requestId: string, note: string | null) {
  try {
    const after = await getRequestDetails(requestId);
    if (!after) return "none" as const;
    if (after.employee.id !== actor.id) {
      await sendRequestChangedEmail([after.employee], { employee: after.employee, before, after: after.request, editor: actor, note, audience: "employee" });
      return "employee" as const;
    }
    const admins = (await getActiveAdminProfiles()).filter((admin) => admin.id !== actor.id);
    if (!admins.length) return "none" as const;
    await sendRequestChangedEmail(admins, { employee: after.employee, before, after: after.request, editor: actor, note, audience: "admins" });
    return "admins" as const;
  } catch (error) {
    console.error("Failed to send request change notification", error);
    return "none" as const;
  }
}

const MAX_DECISION_NOTE_LENGTH = 500;

// The note an admin attaches to a decision. Required when rejecting, optional when approving.
export function normalizeDecisionNote(status: "Approved" | "Rejected", value: string | null | undefined) {
  const note = (value ?? "").replace(/\s+/g, " ").trim();
  if (status === "Rejected" && !note) throw new Error("Please add a short reason for the rejection.");
  if (note.length > MAX_DECISION_NOTE_LENGTH) throw new Error(`Notes must be ${MAX_DECISION_NOTE_LENGTH} characters or fewer.`);
  return note || null;
}

export async function setRequestStatus(
  actor: UserProfile,
  requestId: string,
  status: Extract<RequestStatus, "Approved" | "Rejected">,
  note?: string | null
) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  const decisionNote = normalizeDecisionNote(status, note);
  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId);
    if (!request) return;
    if (request.employeeId === actor.id) throw new Error("You cannot approve your own request.");
    if (request.status !== "Pending") throw new Error("This request has already been decided.");
    const isPtoApproval = status === "Approved" && request.requestType === "PTO";
    const hoursByYear = isPtoApproval ? memoryPtoHoursByYear(request) : new Map<number, number>();
    for (const [year, hours] of hoursByYear) {
      const remaining = memoryRemainingPto(request.employeeId, year);
      if (hours > remaining) throw new Error(insufficientPtoMessage(hours, remaining, year));
    }
    request.status = status;
    request.approverEmail = actor.email;
    request.approverComment = decisionNote;
    request.approvedAt = new Date().toISOString();
    for (const year of hoursByYear.keys()) {
      memory.balances[request.employeeId] ||= {
        employeeId: request.employeeId,
        calendarYear: year,
        annualAllowanceHours: PTO_ALLOWANCE_HOURS,
        usedHours: 0,
        remainingHours: PTO_ALLOWANCE_HOURS,
        expiresOn: yearEnd(year)
      };
      recalculateMemoryPtoBalance(request.employeeId, year);
    }
    await audit(actor.email, `admin.request_${status.toLowerCase()}`, "time_off_request", requestId, { note: decisionNote ?? null });
    await notifyEmployeeOfRequestDecision(requestId, actor.fullName);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await client.query("select * from time_off_requests where id = $1 for update", [requestId]);
    if (!request.rows[0]) {
      await client.query("commit");
      return;
    }
    if (request.rows[0].employee_id === actor.id) {
      await client.query("rollback");
      throw new Error("You cannot approve your own request.");
    }
    if (request.rows[0].status !== "Pending") {
      await client.query("rollback");
      throw new Error("This request has already been decided.");
    }
    const employeeId = request.rows[0].employee_id;
    const isPtoApproval = status === "Approved" && request.rows[0].request_type === "PTO";
    const hoursByYear = isPtoApproval ? await ptoHoursByYear(client, requestId) : [];
    for (const { year, hours } of hoursByYear) {
      const remaining = await remainingPto(client, employeeId, year);
      if (hours > remaining) {
        await client.query("rollback");
        throw new Error(insufficientPtoMessage(hours, remaining, year));
      }
    }
    await client.query(
      "update time_off_requests set status = $1, approver_email = $2, approver_comment = $4, approved_at = now() where id = $3",
      [status, actor.email, requestId, decisionNote]
    );
    for (const { year } of hoursByYear) {
      await recalculatePtoUsed(client, employeeId, year);
    }
    await client.query("commit");
    await audit(actor.email, `admin.request_${status.toLowerCase()}`, "time_off_request", requestId, { note: decisionNote ?? null });
    await notifyEmployeeOfRequestDecision(requestId, actor.fullName);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function memoryPtoHoursByYear(request: TimeOffRequest) {
  const hoursByYear = new Map<number, number>();
  for (const segment of request.segments) {
    const year = Number(segment.date.slice(0, 4));
    hoursByYear.set(year, (hoursByYear.get(year) || 0) + segment.requestedHours);
  }
  return hoursByYear;
}

function memoryApprovedPtoUsed(employeeId: string, year: number) {
  return Number(memory.requests
    .filter((request) => request.employeeId === employeeId && request.requestType === "PTO" && request.status === "Approved")
    .reduce((total, request) => total + (memoryPtoHoursByYear(request).get(year) || 0), 0)
    .toFixed(2));
}

function memoryRemainingPto(employeeId: string, year: number) {
  const allowance = memory.balances[employeeId]?.annualAllowanceHours ?? PTO_ALLOWANCE_HOURS;
  return Number((allowance - memoryApprovedPtoUsed(employeeId, year)).toFixed(2));
}

function recalculateMemoryPtoBalance(employeeId: string, calendarYear: number) {
  const balance = memory.balances[employeeId];
  // The in-memory store keeps one balance per employee; only touch the matching year.
  if (!balance || balance.calendarYear !== calendarYear) return;

  const usedHours = memoryApprovedPtoUsed(employeeId, calendarYear);
  balance.usedHours = usedHours;
  balance.remainingHours = Number((balance.annualAllowanceHours - usedHours).toFixed(2));
}

export async function deleteRequest(actor: UserProfile, requestId: string) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  // Remember who and when, so the activity log can still say what was deleted.
  const details = await getRequestDetails(requestId);
  const deletedMeta: AuditMetadata | null = details
    ? { ...requestAuditSubject(details.request, details.employee.fullName), status: details.request.status }
    : null;

  if (!pool) {
    const requestIndex = memory.requests.findIndex((request) => request.id === requestId);
    if (requestIndex === -1) return;

    const [request] = memory.requests.splice(requestIndex, 1);
    if (request.requestType === "PTO" && request.status === "Approved") {
      for (const year of memoryPtoHoursByYear(request).keys()) recalculateMemoryPtoBalance(request.employeeId, year);
    }

    await audit(actor.email, "admin.request_deleted", "time_off_request", requestId, deletedMeta);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await client.query("select * from time_off_requests where id = $1 for update", [requestId]);
    const deletedRequest = request.rows[0];
    if (!deletedRequest) {
      await client.query("commit");
      return;
    }

    const affectedYears = deletedRequest.request_type === "PTO" && deletedRequest.status === "Approved"
      ? (await ptoHoursByYear(client, requestId)).map(({ year }) => year)
      : [];

    await client.query("delete from time_off_requests where id = $1", [requestId]);

    for (const year of affectedYears) {
      await recalculatePtoUsed(client, deletedRequest.employee_id, year);
    }

    await client.query("commit");
    await audit(actor.email, "admin.request_deleted", "time_off_request", requestId, deletedMeta);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyMakeup(actor: UserProfile, entryId: string, status: MakeupStatus) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  if (!pool) {
    if (!memory.requests.some((request) => request.makeupEntries.some((item) => item.id === entryId))) {
      throw new Error("That make-up shift no longer exists.");
    }
    for (const request of memory.requests) {
      const entry = request.makeupEntries.find((item) => item.id === entryId);
      if (entry) {
        if (request.employeeId === actor.id) throw new Error("You cannot verify your own make-up hours.");
        entry.verificationStatus = status;
        entry.verifiedBy = actor.email;
        entry.verifiedAt = new Date().toISOString();
      }
    }
    await audit(actor.email, `admin.makeup_${status.toLowerCase().replace(" ", "_")}`, "makeup_plan_entry", entryId);
    return;
  }
  const owner = await pool.query(
    `select r.employee_id
     from makeup_plan_entries e
     join time_off_requests r on r.id = e.request_id
     where e.id = $1`,
    [entryId]
  );
  if (!owner.rows[0]) throw new Error("That make-up shift no longer exists.");
  if (owner.rows[0].employee_id === actor.id) {
    throw new Error("You cannot verify your own make-up hours.");
  }
  await pool.query(
    "update makeup_plan_entries set verification_status = $1, verified_by = $2, verified_at = now() where id = $3",
    [status, actor.email, entryId]
  );
  await audit(actor.email, `admin.makeup_${status.toLowerCase().replace(" ", "_")}`, "makeup_plan_entry", entryId);
}
