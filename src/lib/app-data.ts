import { createHash } from "crypto";
import { Pool } from "pg";
import { normalizeDatabaseUrl } from "./database";
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
  roleForEmail
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
};

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

const memory: AppSnapshot = {
  profiles: [
    {
      id: "owner",
      authUserId: "owner",
      email: ORIGINAL_ADMIN_EMAIL,
      fullName: "Anusha Patel",
      role: "Admin",
      status: "Active",
      protectedOwner: true
    }
  ],
  balances: {},
  requests: [],
  auditEvents: []
};

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
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "");
}

async function audit(actorEmail: string, action: string, targetType: string, targetId: string | null) {
  if (!pool) {
    memory.auditEvents.unshift({ id: uuid(), actorEmail, action, targetType, targetId, createdAt: new Date().toISOString() });
    return;
  }
  await pool.query(
    "insert into audit_events (actor_email, action, target_type, target_id) values ($1, $2, $3, $4)",
    [actorEmail, action, targetType, targetId]
  );
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
    if (email === ORIGINAL_ADMIN_EMAIL) {
      profile.role = "Admin";
      profile.status = "Active";
      profile.protectedOwner = true;
    }
    return profile;
  }

  const result = await pool.query(
    `insert into user_profiles (auth_user_id, email, full_name, role, status, protected_owner, role_assigned_at)
     values ($1, $2, $3, $4, $5, $6, case when $6 then now() else null end)
     on conflict (email) do update
       set auth_user_id = excluded.auth_user_id,
           role = case when excluded.email = $7 then 'Admin' else user_profiles.role end,
           status = case when excluded.email = $7 then 'Active' else user_profiles.status end,
           protected_owner = user_profiles.protected_owner or excluded.protected_owner,
           updated_at = now()
     returning *`,
    [user.id, email, user.name || email, bootstrap.role, bootstrap.status, bootstrap.protectedOwner, ORIGINAL_ADMIN_EMAIL]
  );
  const profile = mapProfile(result.rows[0]);

  if (profile.role === "Employee") {
    await pool.query(
      `insert into pto_balances (employee_id, calendar_year, annual_allowance_hours, used_hours, expires_on)
       values ($1, extract(year from now())::int, $2, 0, make_date(extract(year from now())::int, 12, 31))
       on conflict (employee_id, calendar_year) do nothing`,
      [profile.id, PTO_ALLOWANCE_HOURS]
    );
  }
  return profile;
}

export async function getSnapshot(): Promise<AppSnapshot> {
  if (!pool) return structuredClone(memory);

  const [profiles, balances, requests, segments, makeupEntries, auditEvents] = await Promise.all([
    pool.query("select * from user_profiles order by protected_owner desc, full_name asc"),
    pool.query("select *, (annual_allowance_hours - used_hours) as remaining_hours from pto_balances"),
    pool.query("select * from time_off_requests order by submitted_at desc"),
    pool.query("select * from time_off_request_segments order by request_date asc, start_time asc"),
    pool.query("select * from makeup_plan_entries order by makeup_date asc, start_time asc"),
    pool.query("select * from audit_events order by created_at desc limit 100")
  ]);

  const balanceMap: Record<string, PtoBalance> = {};
  balances.rows.forEach((row) => {
    balanceMap[row.employee_id] = {
      employeeId: row.employee_id,
      calendarYear: row.calendar_year,
      annualAllowanceHours: Number(row.annual_allowance_hours),
      usedHours: Number(row.used_hours),
      remainingHours: Number(row.remaining_hours),
      expiresOn: row.expires_on
    };
  });

  return {
    profiles: profiles.rows.map(mapProfile),
    balances: balanceMap,
    requests: requests.rows.map((row) => ({
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
      submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at,
      segments: segments.rows.filter((segment) => segment.request_id === row.id).map((segment) => ({
        id: segment.id,
        requestId: segment.request_id,
        date: formatDateValue(segment.request_date),
        startTime: String(segment.start_time).slice(0, 5),
        endTime: String(segment.end_time).slice(0, 5),
        requestedHours: Number(segment.requested_hours),
        note: segment.note
      })),
      makeupEntries: makeupEntries.rows.filter((entry) => entry.request_id === row.id).map((entry) => ({
        id: entry.id,
        requestId: entry.request_id,
        date: formatDateValue(entry.makeup_date),
        startTime: String(entry.start_time).slice(0, 5),
        endTime: String(entry.end_time).slice(0, 5),
        plannedHours: Number(entry.planned_hours),
        verificationStatus: entry.verification_status,
        verifiedBy: entry.verified_by,
        verifiedAt: entry.verified_at?.toISOString?.() || entry.verified_at
      }))
    })),
    auditEvents: auditEvents.rows.map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at
    }))
  };
}

export function isAdmin(profile: UserProfile) {
  return profile.role === "Admin" && profile.status === "Active";
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
  if (!segment) return false;

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

async function hasDuplicateRequest(client: Pick<Pool, "query">, actor: UserProfile, payload: RequestPayload) {
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
       and s.requested_hours = $7`,
    [actor.id, payload.requestType, payload.reason, payload.segmentDate, payload.segmentStart, payload.segmentEnd, payload.requestedHours]
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

async function lockDuplicatePayload(client: Pick<Pool, "query">, actor: UserProfile, payload: RequestPayload) {
  const [firstKey, secondKey] = advisoryLockKeys(canonicalDuplicateKey(actor.id, payload));
  await client.query("select pg_advisory_xact_lock($1::int, $2::int)", [firstKey, secondKey]);
}

export async function updateProfile(actor: UserProfile, id: string, role: AppRole, status: ProfileStatus) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  if (!pool) {
    const profile = memory.profiles.find((item) => item.id === id);
    if (!profile || profile.protectedOwner) return;
    profile.role = role;
    profile.status = status;
    await audit(actor.email, "admin.profile_updated", "user_profile", id);
    return;
  }
  await pool.query(
    `update user_profiles
     set role = $1, status = $2, role_assigned_by = $3, role_assigned_at = now(), updated_at = now()
     where id = $4 and protected_owner = false`,
    [role, status, actor.id, id]
  );
  await audit(actor.email, "admin.profile_updated", "user_profile", id);
}

export async function createTimeOffRequest(actor: UserProfile, formData: FormData): Promise<CreateRequestResult> {
  if (actor.status !== "Active") throw new Error("Active profile required.");
  const requestType = String(formData.get("requestType")) as RequestType;
  const reason = normalizeReason(String(formData.get("reason") || ""));
  const segmentDate = String(formData.get("segmentDate"));
  const segmentStart = String(formData.get("segmentStart"));
  const segmentEnd = String(formData.get("segmentEnd"));
  const makeupEntries = parseMakeupEntries(formData);
  const requestedHours = calculateHours(segmentStart, segmentEnd);
  const makeupHours = Number(makeupEntries.reduce((total, entry) => total + entry.plannedHours, 0).toFixed(2));
  if (!requestedHours) throw new Error("Requested time must have a valid start and end.");
  if (requestType !== "PTO" && !makeupHours) throw new Error("Additional time off requires a make-up plan.");
  const payload: RequestPayload = { requestType, reason, segmentDate, segmentStart, segmentEnd, requestedHours, makeupEntries };

  if (!pool) {
    const duplicate = memory.requests.some((request) => request.employeeId === actor.id && memoryRequestMatchesPayload(request, payload));
    if (duplicate) return { status: "duplicate" };

    const requestId = uuid();
    memory.requests.unshift({
      id: requestId,
      employeeId: actor.id,
      requestType,
      reason,
      totalRequestedHours: requestedHours,
      totalMakeupHours: makeupHours,
      isLateNotice: isLateNotice(new Date().toISOString().slice(0, 10), segmentDate),
      requiresMakeupPlan: requestType !== "PTO",
      status: "Pending",
      submittedAt: new Date().toISOString(),
      segments: [{ id: uuid(), requestId, date: segmentDate, startTime: segmentStart, endTime: segmentEnd, requestedHours }],
      makeupEntries: makeupEntries.map((entry) => ({ id: uuid(), requestId, ...entry, verificationStatus: "Pending" }))
    });
    await audit(actor.email, "employee.request_submitted", "time_off_request", requestId);
    return { status: "created" };
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await lockDuplicatePayload(client, actor, payload);
    if (await hasDuplicateRequest(client, actor, payload)) {
      await client.query("commit");
      return { status: "duplicate" };
    }

    const request = await client.query(
      `insert into time_off_requests
       (employee_id, request_type, reason, total_requested_hours, total_makeup_hours, is_late_notice, requires_makeup_plan)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [actor.id, requestType, reason, requestedHours, makeupHours, isLateNotice(new Date().toISOString().slice(0, 10), segmentDate), requestType !== "PTO"]
    );
    const requestId = request.rows[0].id;
    await client.query(
      `insert into time_off_request_segments (request_id, request_date, start_time, end_time, requested_hours)
       values ($1, $2, $3, $4, $5)`,
      [requestId, segmentDate, segmentStart, segmentEnd, requestedHours]
    );
    for (const entry of makeupEntries) {
      await client.query(
        `insert into makeup_plan_entries (request_id, makeup_date, start_time, end_time, planned_hours)
         values ($1, $2, $3, $4, $5)`,
        [requestId, entry.date, entry.startTime, entry.endTime, entry.plannedHours]
      );
    }
    await client.query("commit");
    await audit(actor.email, "employee.request_submitted", "time_off_request", requestId);
    return { status: "created" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setRequestStatus(actor: UserProfile, requestId: string, status: Extract<RequestStatus, "Approved" | "Rejected">) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");
  if (!pool) {
    const request = memory.requests.find((item) => item.id === requestId);
    if (!request) return;
    request.status = status;
    request.approverEmail = actor.email;
    request.approvedAt = new Date().toISOString();
    if (status === "Approved" && request.requestType === "PTO") {
      const balance = memory.balances[request.employeeId] || {
        employeeId: request.employeeId,
        calendarYear: new Date().getFullYear(),
        annualAllowanceHours: PTO_ALLOWANCE_HOURS,
        usedHours: 0,
        remainingHours: PTO_ALLOWANCE_HOURS,
        expiresOn: `${new Date().getFullYear()}-12-31`
      };
      balance.usedHours += request.totalRequestedHours;
      balance.remainingHours = balance.annualAllowanceHours - balance.usedHours;
      memory.balances[request.employeeId] = balance;
    }
    await audit(actor.email, `admin.request_${status.toLowerCase()}`, "time_off_request", requestId);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await client.query("select * from time_off_requests where id = $1 for update", [requestId]);
    if (!request.rows[0]) return;
    await client.query(
      "update time_off_requests set status = $1, approver_email = $2, approved_at = now() where id = $3",
      [status, actor.email, requestId]
    );
    if (status === "Approved" && request.rows[0].request_type === "PTO") {
      await client.query(
        "update pto_balances set used_hours = used_hours + $1 where employee_id = $2 and calendar_year = extract(year from now())::int",
        [request.rows[0].total_requested_hours, request.rows[0].employee_id]
      );
    }
    await client.query("commit");
    await audit(actor.email, `admin.request_${status.toLowerCase()}`, "time_off_request", requestId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function yearFromDate(value: string | Date | null | undefined) {
  if (!value) return new Date().getFullYear();
  return new Date(value).getFullYear();
}

function recalculateMemoryPtoBalance(employeeId: string, calendarYear: number) {
  const balance = memory.balances[employeeId];
  if (!balance) return;

  const usedHours = Number(memory.requests
    .filter((request) => {
      return request.employeeId === employeeId
        && request.requestType === "PTO"
        && request.status === "Approved"
        && yearFromDate(request.approvedAt) === calendarYear;
    })
    .reduce((total, request) => total + request.totalRequestedHours, 0)
    .toFixed(2));

  balance.usedHours = usedHours;
  balance.remainingHours = Number((balance.annualAllowanceHours - usedHours).toFixed(2));
}

export async function deleteRequest(actor: UserProfile, requestId: string) {
  if (!isAdmin(actor)) throw new Error("Admin access required.");

  if (!pool) {
    const requestIndex = memory.requests.findIndex((request) => request.id === requestId);
    if (requestIndex === -1) return;

    const [request] = memory.requests.splice(requestIndex, 1);
    if (request.requestType === "PTO" && request.status === "Approved") {
      recalculateMemoryPtoBalance(request.employeeId, yearFromDate(request.approvedAt));
    }

    await audit(actor.email, "admin.request_deleted", "time_off_request", requestId);
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

    await client.query("delete from time_off_requests where id = $1", [requestId]);

    if (deletedRequest.request_type === "PTO" && deletedRequest.status === "Approved") {
      const calendarYear = yearFromDate(deletedRequest.approved_at);
      await client.query(
        `update pto_balances
         set used_hours = coalesce((
           select sum(total_requested_hours)
           from time_off_requests
           where employee_id = $1
             and request_type = 'PTO'
             and status = 'Approved'
             and extract(year from approved_at)::int = $2
         ), 0)
         where employee_id = $1
           and calendar_year = $2`,
        [deletedRequest.employee_id, calendarYear]
      );
    }

    await client.query("commit");
    await audit(actor.email, "admin.request_deleted", "time_off_request", requestId);
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
    for (const request of memory.requests) {
      const entry = request.makeupEntries.find((item) => item.id === entryId);
      if (entry) {
        entry.verificationStatus = status;
        entry.verifiedBy = actor.email;
        entry.verifiedAt = new Date().toISOString();
      }
    }
    await audit(actor.email, `admin.makeup_${status.toLowerCase().replace(" ", "_")}`, "makeup_plan_entry", entryId);
    return;
  }
  await pool.query(
    "update makeup_plan_entries set verification_status = $1, verified_by = $2, verified_at = now() where id = $3",
    [status, actor.email, entryId]
  );
  await audit(actor.email, `admin.makeup_${status.toLowerCase().replace(" ", "_")}`, "makeup_plan_entry", entryId);
}
