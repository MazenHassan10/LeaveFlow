import { formatTimeRange12Hour, formatWeekdayDateLabel } from "./app-time";
import type { ReportCalendarEvent } from "./report-calendar";
import type { TimeOffRequest, UserProfile } from "./app-data";

type EmailMessage = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

type TableColumn<T> = {
  label: string;
  value: (item: T) => string | number;
  align?: "left" | "right";
  width?: string;
  nowrap?: boolean;
};

function columnStyle<T>(column: TableColumn<T>) {
  return `${column.width ? `width:${column.width};` : ""}${column.nowrap ? "white-space:nowrap;" : ""}`;
}

type SummaryMetric = {
  label: string;
  value: string | number;
};

function configuredSender() {
  return process.env.GMAIL_FROM_EMAIL?.trim() || "";
}

function isLocalhostUrl(url: string) {
  return /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
}

// Public production deployment. Emailed links are opened on phones and other
// machines, so they must never point at localhost; local dev shares the
// production database, so linking to production is correct from there too.
export const PRODUCTION_APP_URL = "https://leave-flow-seven.vercel.app";

export function resolveBaseUrl(env: Record<string, string | undefined> = process.env) {
  const vercelProd = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidates = [
    env.NEXT_PUBLIC_APP_URL,
    vercelProd ? `https://${vercelProd}` : undefined,
    env.BETTER_AUTH_URL,
  ];

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (url && !isLocalhostUrl(url)) return url;
  }
  return PRODUCTION_APP_URL;
}

function appUrl(path: string) {
  const baseUrl = resolveBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMetricCards(metrics: SummaryMetric[]) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 0;">
      <tr>
        ${metrics.map((metric) => `
          <td style="width:${Math.floor(100 / metrics.length)}%;padding:0 6px 12px 0;vertical-align:top;">
            <div style="border:1px solid #e6edf2;border-radius:12px;background:#ffffff;padding:14px 16px;">
              <div style="font-size:22px;line-height:1.1;font-weight:800;color:#11131a;">${escapeHtml(metric.value)}</div>
              <div style="margin-top:5px;font-size:12px;line-height:1.4;font-weight:700;color:#697386;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(metric.label)}</div>
            </div>
          </td>
        `).join("")}
      </tr>
    </table>
  `;
}

function renderDetailsTable(rows: Array<[string, string | number]>) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e6edf2;border-radius:12px;overflow:hidden;background:#ffffff;">
      <tbody>
        ${rows.map(([label, value], index) => `
          <tr>
            <th align="left" style="width:38%;padding:13px 16px;border-top:${index ? "1px solid #eef3f7" : "0"};font-size:13px;line-height:1.4;color:#697386;background:#f8fbfc;font-weight:700;">${escapeHtml(label)}</th>
            <td style="padding:13px 16px;border-top:${index ? "1px solid #eef3f7" : "0"};font-size:14px;line-height:1.4;color:#11131a;font-weight:700;">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDataTable<T>(columns: TableColumn<T>[], rows: T[], empty: string) {
  if (!rows.length) {
    return `<div style="padding:14px 16px;border:1px solid #e6edf2;border-radius:12px;background:#ffffff;color:#697386;font-size:14px;line-height:1.5;">${escapeHtml(empty)}</div>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e6edf2;border-radius:12px;overflow:hidden;background:#ffffff;">
      <thead>
        <tr>
          ${columns.map((column) => `
            <th align="${column.align || "left"}" style="${columnStyle(column)}padding:12px 14px;background:#11131a;color:#ffffff;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(column.label)}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, rowIndex) => `
          <tr>
            ${columns.map((column) => `
              <td align="${column.align || "left"}" style="${columnStyle(column)}padding:13px 14px;border-top:${rowIndex ? "1px solid #eef3f7" : "0"};font-size:14px;line-height:1.45;color:#11131a;font-weight:600;">${escapeHtml(column.value(row))}</td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderSection(title: string, content: string) {
  return `
    <div style="margin-top:22px;">
      <h2 style="margin:0 0 10px;font-size:15px;line-height:1.35;color:#11131a;font-weight:800;">${escapeHtml(title)}</h2>
      ${content}
    </div>
  `;
}

function renderCta(label: string, href: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td style="border-radius:999px;background:#00c2ff;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:linear-gradient(135deg,#00c2ff,#b6ff4d);color:#11131a;font-size:14px;font-weight:800;text-decoration:none;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>
  `;
}

function renderReason(reason: string | null | undefined) {
  return `
    <div style="padding:15px 16px;border:1px solid #e6edf2;border-radius:12px;background:#ffffff;color:#11131a;font-size:14px;line-height:1.55;font-weight:600;">
      ${escapeHtml(reason || "None provided")}
    </div>
  `;
}

function renderEmailLayout({
  eyebrow,
  title,
  intro,
  badge,
  badgeTone = "info",
  greeting,
  body,
}: {
  eyebrow: string;
  title: string;
  greeting?: string;
  intro: string;
  badge?: string;
  badgeTone?: "info" | "success" | "danger";
  body: string;
}) {
  const badgeStyles = {
    info: "background:#e8f8ff;color:#007fb0;border-color:#b8ecff;",
    success: "background:#ecffde;color:#4c8f00;border-color:#c9f7a6;",
    danger: "background:#fff0f3;color:#c6233d;border-color:#ffc9d2;",
  }[badgeTone];

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f7f8;font-family:Arial,Helvetica,sans-serif;color:#11131a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3f7f8;padding:0;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;border-collapse:collapse;">
            <tr>
              <td style="border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 18px 48px rgba(17,19,26,.12);">
                <div style="height:6px;background:linear-gradient(90deg,#00c2ff,#b6ff4d,#6d4cff);"></div>
                <div style="padding:28px 28px 30px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:top;">
                        <div style="font-size:12px;line-height:1.2;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5b2bd6;">${escapeHtml(eyebrow)}</div>
                        <h1 style="margin:8px 0 0;font-size:28px;line-height:1.15;font-weight:900;color:#11131a;">${escapeHtml(title)}</h1>
                      </td>
                      ${badge ? `<td align="right" style="vertical-align:top;padding-left:12px;"><span style="display:inline-block;border:1px solid;border-radius:999px;padding:7px 11px;font-size:12px;line-height:1;font-weight:800;${badgeStyles}">${escapeHtml(badge)}</span></td>` : ""}
                    </tr>
                  </table>
                  ${greeting ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.5;font-weight:700;color:#11131a;">${escapeHtml(greeting)}</p>` : ""}
                  <p style="margin:${greeting ? "6px" : "16px"} 0 0;font-size:15px;line-height:1.55;color:#3d4653;">${escapeHtml(intro)}</p>
                  ${body}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 10px 0;color:#697386;font-size:12px;line-height:1.5;">
                LeaveFlow keeps PTO, approvals, and make-up work in one place.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function requestedTimeRows(request: TimeOffRequest) {
  return request.segments.map((segment) => ({
    date: formatWeekdayDateLabel(segment.date),
    time: formatTimeRange12Hour(segment.startTime, segment.endTime),
    hours: segment.requestedHours,
  }));
}

function makeupRows(request: TimeOffRequest) {
  return request.makeupEntries.map((entry) => ({
    date: formatWeekdayDateLabel(entry.date),
    time: formatTimeRange12Hour(entry.startTime, entry.endTime),
    hours: entry.plannedHours,
    status: entry.verificationStatus,
  }));
}

function requestedTimeTable(request: TimeOffRequest) {
  return renderDataTable(
    [
      { label: "Date", value: (row) => row.date },
      { label: "Time", value: (row) => row.time },
      { label: "Hours", value: (row) => `${row.hours}h`, align: "right" },
    ],
    requestedTimeRows(request),
    "No requested time recorded."
  );
}

function makeupPlanTable(request: TimeOffRequest) {
  return renderDataTable(
    [
      { label: "Date", value: (row) => row.date },
      { label: "Time", value: (row) => row.time },
      { label: "Hours", value: (row) => `${row.hours}h`, align: "right" },
      { label: "Status", value: (row) => row.status },
    ],
    makeupRows(request),
    "No make-up plan provided."
  );
}

function requestTimeSummary(request: TimeOffRequest) {
  return request.segments
    .map((segment) => {
      return `${formatWeekdayDateLabel(segment.date)}, ${formatTimeRange12Hour(segment.startTime, segment.endTime)} (${segment.requestedHours}h)`;
    })
    .join("\n");
}

function makeupSummary(request: TimeOffRequest) {
  if (!request.makeupEntries.length) return "None";
  return request.makeupEntries
    .map((entry) => {
      return `${formatWeekdayDateLabel(entry.date)}, ${formatTimeRange12Hour(entry.startTime, entry.endTime)} (${entry.plannedHours}h)`;
    })
    .join("\n");
}

export type RequestEmailKind = "new" | "updated" | "cancelled";

const REQUEST_EMAIL_COPY: Record<RequestEmailKind, {
  title: string;
  subject: (name: string) => string;
  lead: (name: string, email: string) => string;
  intro: (name: string, type: string) => string;
  cta: string;
}> = {
  new: {
    title: "New request submitted",
    subject: (name) => `New LeaveFlow request from ${name}`,
    lead: (name, email) => `A new LeaveFlow request was submitted by ${name} (${email}).`,
    intro: (name, type) => `${name} submitted a ${type} request for review.`,
    cta: "Review in admin dashboard",
  },
  updated: {
    title: "Request updated",
    subject: (name) => `Updated LeaveFlow request from ${name}`,
    lead: (name, email) => `${name} (${email}) updated a pending LeaveFlow request. Please review the new details.`,
    intro: (name, type) => `${name} changed their pending ${type} request. These are the new details.`,
    cta: "Review in admin dashboard",
  },
  cancelled: {
    title: "Request cancelled",
    subject: (name) => `${name} cancelled a LeaveFlow request`,
    lead: (name, email) => `${name} (${email}) cancelled a pending LeaveFlow request. No action is needed.`,
    intro: (name, type) => `${name} cancelled this pending ${type} request. No action is needed.`,
    cta: "Open admin dashboard",
  },
};

export function buildNewRequestEmail(
  admins: UserProfile[],
  employee: UserProfile,
  request: TimeOffRequest,
  kind: RequestEmailKind = "new"
): EmailMessage | null {
  const to = admins.map((admin) => admin.email).filter(Boolean);
  if (!to.length) return null;
  const copy = REQUEST_EMAIL_COPY[kind];
  const reviewUrl = appUrl("/admin");
  const text = [
    copy.lead(employee.fullName, employee.email),
    "",
    `Request type: ${request.requestType}`,
    `Requested time:`,
    requestTimeSummary(request),
    `Requested hours: ${request.totalRequestedHours}`,
    `Make-up hours: ${request.totalMakeupHours}`,
    `Make-up plan:`,
    makeupSummary(request),
    request.reason ? `Reason: ${request.reason}` : "Reason: None provided",
    "",
    `Review it here: ${reviewUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: kind === "cancelled" ? "For your records" : "Admin review",
    title: copy.title,
    intro: copy.intro(employee.fullName, request.requestType),
    badge: request.requestType,
    body: [
      renderMetricCards([
        { label: "Requested", value: `${request.totalRequestedHours}h` },
        { label: "Make-up", value: `${request.totalMakeupHours}h` },
        { label: "Segments", value: request.segments.length },
      ]),
      renderSection("Employee", renderDetailsTable([
        ["Name", employee.fullName],
        ["Email", employee.email],
        ["Role", employee.role],
      ])),
      renderSection("Request details", renderDetailsTable([
        ["Request type", request.requestType],
        ["Requested hours", `${request.totalRequestedHours}h`],
        ["Make-up hours", `${request.totalMakeupHours}h`],
        ["Late notice", request.isLateNotice ? "Yes" : "No"],
      ])),
      renderSection("Requested time", requestedTimeTable(request)),
      renderSection("Make-up plan", makeupPlanTable(request)),
      renderSection("Reason", renderReason(request.reason)),
      renderCta(copy.cta, reviewUrl),
    ].join(""),
  });

  return {
    to,
    subject: copy.subject(employee.fullName),
    text,
    html
  };
}

export function buildRequestDecisionEmail(employee: UserProfile, request: TimeOffRequest, approverName?: string): EmailMessage {
  const status = request.status.toLowerCase();
  const decidedBy = approverName || request.approverEmail || "Not recorded";
  const note = request.approverComment?.trim();
  const noteHeading = `Note from ${approverName || "your admin"}`;
  const employeeUrl = appUrl("/employee");
  const approved = request.status === "Approved";
  const title = approved ? "Request approved" : request.status === "Rejected" ? "Request rejected" : `Request ${status}`;
  const text = [
    `Your LeaveFlow request was ${status}.`,
    "",
    `Request type: ${request.requestType}`,
    `Requested time:`,
    requestTimeSummary(request),
    `Requested hours: ${request.totalRequestedHours}`,
    `Decided by: ${decidedBy}`,
    ...(note ? ["", `${noteHeading}:`, note] : []),
    "",
    `View your requests here: ${employeeUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: "Request update",
    title,
    greeting: `Hi ${employee.fullName},`,
    intro: approved
      ? `Your ${request.requestType} request has been approved.`
      : `Your ${request.requestType} request has been ${status}.`,
    badge: request.status,
    badgeTone: approved ? "success" : request.status === "Rejected" ? "danger" : "info",
    body: [
      renderMetricCards([
        { label: "Requested", value: `${request.totalRequestedHours}h` },
        { label: "Make-up", value: `${request.totalMakeupHours}h` },
        { label: "Status", value: request.status },
      ]),
      renderSection("Request summary", renderDetailsTable([
        ["Request type", request.requestType],
        ["Requested hours", `${request.totalRequestedHours}h`],
        ["Make-up hours", `${request.totalMakeupHours}h`],
        ["Decided by", decidedBy],
      ])),
      note ? renderSection(noteHeading, renderReason(note)) : "",
      renderSection("Requested time", requestedTimeTable(request)),
      request.makeupEntries.length ? renderSection("Make-up plan", makeupPlanTable(request)) : "",
      renderCta("View my requests", employeeUrl),
    ].join(""),
  });

  return {
    to: [employee.email],
    subject: `Your LeaveFlow request was ${status}`,
    text,
    html
  };
}

function reminderWhen(date: string, daysAhead: number) {
  const label = formatWeekdayDateLabel(date);
  return daysAhead === 1 ? `tomorrow (${label})` : `in ${daysAhead} days (${label})`;
}

function eventTypeLabel(event: ReportCalendarEvent) {
  return event.type === "off" ? "Off" : "Make-up";
}

export function buildAdminReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[], daysAhead = 1): EmailMessage {
  const when = reminderWhen(date, daysAhead);
  const eventLines = events.map((event) =>
    `- ${eventTypeLabel(event)}: ${event.employeeName} (${event.employeeEmail}), ${formatTimeRange12Hour(event.startTime, event.endTime)} (${event.hours}h)`
  );
  const reportsUrl = appUrl("/reports");
  const text = [
    `Hi ${admin.fullName},`,
    "",
    `Approved LeaveFlow events ${when}:`,
    "",
    ...eventLines,
    "",
    `Open reports: ${reportsUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: daysAhead === 1 ? "Tomorrow's schedule" : `Coming up in ${daysAhead} days`,
    title: "Approved events reminder",
    greeting: `Hi ${admin.fullName},`,
    intro: `${formatWeekdayDateLabel(date)} has approved time off or make-up work scheduled.`,
    badge: `${events.length} event${events.length === 1 ? "" : "s"}`,
    body: [
      renderSection("Events", renderDataTable(
        [
          { label: "Type", value: (event) => eventTypeLabel(event), width: "92px", nowrap: true },
          { label: "Employee", value: (event) => `${event.employeeName} (${event.employeeEmail})` },
          { label: "Time (PT)", value: (event) => formatTimeRange12Hour(event.startTime, event.endTime), nowrap: true },
          { label: "Hours", value: (event) => `${event.hours}h`, align: "right", nowrap: true },
        ],
        events,
        "No events scheduled."
      )),
      renderCta("Open reports", reportsUrl),
    ].join(""),
  });

  return {
    to: [admin.email],
    subject: daysAhead === 1
      ? "LeaveFlow reminder: tomorrow's time off and make-up plans"
      : `LeaveFlow reminder: time off and make-up plans in ${daysAhead} days`,
    text,
    html
  };
}

// Kept for existing callers: the day-before admin digest.
export function buildDayBeforeReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[]): EmailMessage {
  return buildAdminReminderEmail(admin, date, events, 1);
}

export function buildEmployeeReminderEmail(
  employee: { name: string; email: string },
  date: string,
  events: ReportCalendarEvent[],
  daysAhead = 1
): EmailMessage {
  const when = reminderWhen(date, daysAhead);
  const hasMakeup = events.some((event) => event.type === "makeup");
  const hasOff = events.some((event) => event.type === "off");
  const what = hasMakeup && hasOff ? "time off and make-up work" : hasMakeup ? "make-up work" : "time off";
  const employeeUrl = appUrl("/employee");
  const eventLines = events.map((event) =>
    `- ${eventTypeLabel(event)}: ${formatTimeRange12Hour(event.startTime, event.endTime)} PT (${event.hours}h)`
  );
  const text = [
    `Hi ${employee.name},`,
    "",
    `Reminder: you have approved ${what} ${when}:`,
    "",
    ...eventLines,
    "",
    `View your requests: ${employeeUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: daysAhead === 1 ? "Tomorrow" : `In ${daysAhead} days`,
    title: hasMakeup ? "Make-up shift reminder" : "Time off reminder",
    greeting: `Hi ${employee.name},`,
    intro: `You have approved ${what} on ${formatWeekdayDateLabel(date)}. Times are Pacific Time.`,
    badge: `${events.length} item${events.length === 1 ? "" : "s"}`,
    body: [
      renderSection("Your schedule", renderDataTable(
        [
          { label: "Type", value: (event) => eventTypeLabel(event), width: "92px", nowrap: true },
          { label: "Time (PT)", value: (event) => formatTimeRange12Hour(event.startTime, event.endTime), nowrap: true },
          { label: "Hours", value: (event) => `${event.hours}h`, align: "right", nowrap: true },
        ],
        events,
        "Nothing scheduled."
      )),
      renderCta("View your requests", employeeUrl),
    ].join(""),
  });

  return {
    to: [employee.email],
    subject: `LeaveFlow reminder: your ${what} ${daysAhead === 1 ? "tomorrow" : `in ${daysAhead} days`}`,
    text,
    html
  };
}

function missingGmailConfig() {
  return [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GMAIL_FROM_EMAIL"
  ].filter((key) => !process.env[key]);
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function mimeMessage(message: EmailMessage) {
  const boundary = `leaveflow-${Date.now().toString(36)}`;

  return [
    `From: ${configuredSender()}`,
    `To: ${message.to.join(", ")}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    message.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    message.html,
    "",
    `--${boundary}--`
  ].join("\r\n");
}

export type EmailSendResult = { sent: boolean; skipped: boolean; reason?: string };

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (process.env.DATABASE_URL === "") {
    return { sent: false, skipped: true, reason: "in-memory-data-store" };
  }

  const missing = missingGmailConfig();
  if (missing.length) {
    console.warn(`Skipping email send because Gmail is not configured: ${missing.join(", ")}`);
    return { sent: false, skipped: true, reason: "gmail-not-configured" };
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeBase64Url(mimeMessage(message))
    }
  });

  return { sent: true, skipped: false };
}

export async function sendNewRequestEmail(
  admins: UserProfile[],
  employee: UserProfile,
  request: TimeOffRequest,
  kind: RequestEmailKind = "new"
) {
  const message = buildNewRequestEmail(admins, employee, request, kind);
  if (!message) return { sent: false, skipped: true, reason: "no-admin-recipients" };
  return sendEmail(message);
}

export async function sendRequestDecisionEmail(employee: UserProfile, request: TimeOffRequest, approverName?: string) {
  return sendEmail(buildRequestDecisionEmail(employee, request, approverName));
}

export async function sendDayBeforeReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[]) {
  return sendEmail(buildDayBeforeReminderEmail(admin, date, events));
}

export async function sendAdminReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[], daysAhead: number) {
  return sendEmail(buildAdminReminderEmail(admin, date, events, daysAhead));
}

export async function sendEmployeeReminderEmail(
  employee: { name: string; email: string },
  date: string,
  events: ReportCalendarEvent[],
  daysAhead: number
) {
  return sendEmail(buildEmployeeReminderEmail(employee, date, events, daysAhead));
}
