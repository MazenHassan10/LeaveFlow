import { formatDateLabelInLosAngeles, formatTimeRange12Hour } from "./app-time";
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
};

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
            <th align="${column.align || "left"}" style="padding:12px 14px;background:#11131a;color:#ffffff;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(column.label)}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, rowIndex) => `
          <tr>
            ${columns.map((column) => `
              <td align="${column.align || "left"}" style="padding:13px 14px;border-top:${rowIndex ? "1px solid #eef3f7" : "0"};font-size:14px;line-height:1.45;color:#11131a;font-weight:600;">${escapeHtml(column.value(row))}</td>
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
  body,
}: {
  eyebrow: string;
  title: string;
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
                  <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#3d4653;">${escapeHtml(intro)}</p>
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
    date: formatDateLabelInLosAngeles(segment.date),
    time: formatTimeRange12Hour(segment.startTime, segment.endTime),
    hours: segment.requestedHours,
  }));
}

function makeupRows(request: TimeOffRequest) {
  return request.makeupEntries.map((entry) => ({
    date: formatDateLabelInLosAngeles(entry.date),
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
      return `${formatDateLabelInLosAngeles(segment.date)}, ${formatTimeRange12Hour(segment.startTime, segment.endTime)} (${segment.requestedHours}h)`;
    })
    .join("\n");
}

function makeupSummary(request: TimeOffRequest) {
  if (!request.makeupEntries.length) return "None";
  return request.makeupEntries
    .map((entry) => {
      return `${formatDateLabelInLosAngeles(entry.date)}, ${formatTimeRange12Hour(entry.startTime, entry.endTime)} (${entry.plannedHours}h)`;
    })
    .join("\n");
}

export function buildNewRequestEmail(admins: UserProfile[], employee: UserProfile, request: TimeOffRequest): EmailMessage | null {
  const to = admins.map((admin) => admin.email).filter(Boolean);
  if (!to.length) return null;
  const reviewUrl = appUrl("/admin");
  const text = [
    `A new LeaveFlow request was submitted by ${employee.fullName} (${employee.email}).`,
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
    eyebrow: "Admin review",
    title: "New request submitted",
    intro: `${employee.fullName} submitted a ${request.requestType} request for review.`,
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
      renderCta("Review in admin dashboard", reviewUrl),
    ].join(""),
  });

  return {
    to,
    subject: `New LeaveFlow request from ${employee.fullName}`,
    text,
    html
  };
}

export function buildRequestDecisionEmail(employee: UserProfile, request: TimeOffRequest): EmailMessage {
  const status = request.status.toLowerCase();
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
    request.approverEmail ? `Approver: ${request.approverEmail}` : "Approver: Not recorded",
    "",
    `View your requests here: ${employeeUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: "Request update",
    title,
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
        ["Approver", request.approverEmail || "Not recorded"],
      ])),
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

export function buildDayBeforeReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[]): EmailMessage {
  const eventLines = events.map((event) => {
    const label = event.type === "off" ? "Off" : "Make-up";
    return `- ${label}: ${event.employeeName} (${event.employeeEmail}), ${formatTimeRange12Hour(event.startTime, event.endTime)} (${event.hours}h)`;
  });
  const reportsUrl = appUrl("/reports");
  const text = [
    `Hi ${admin.fullName},`,
    "",
    `Tomorrow (${formatDateLabelInLosAngeles(date)}) has approved LeaveFlow events:`,
    "",
    ...eventLines,
    "",
    `Open reports: ${reportsUrl}`
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: "Tomorrow's schedule",
    title: "Approved events reminder",
    intro: `${formatDateLabelInLosAngeles(date)} has approved time off or make-up work scheduled.`,
    badge: `${events.length} event${events.length === 1 ? "" : "s"}`,
    body: [
      renderSection("Events", renderDataTable(
        [
          { label: "Type", value: (event) => event.type === "off" ? "Off" : "Make-up" },
          { label: "Employee", value: (event) => `${event.employeeName} (${event.employeeEmail})` },
          { label: "Time", value: (event) => formatTimeRange12Hour(event.startTime, event.endTime) },
          { label: "Hours", value: (event) => `${event.hours}h`, align: "right" },
        ],
        events,
        "No events scheduled."
      )),
      renderCta("Open reports", reportsUrl),
    ].join(""),
  });

  return {
    to: [admin.email],
    subject: "LeaveFlow reminder: tomorrow's time off and make-up plans",
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

export async function sendEmail(message: EmailMessage) {
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

export async function sendNewRequestEmail(admins: UserProfile[], employee: UserProfile, request: TimeOffRequest) {
  const message = buildNewRequestEmail(admins, employee, request);
  if (!message) return { sent: false, skipped: true, reason: "no-admin-recipients" };
  return sendEmail(message);
}

export async function sendRequestDecisionEmail(employee: UserProfile, request: TimeOffRequest) {
  return sendEmail(buildRequestDecisionEmail(employee, request));
}

export async function sendDayBeforeReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[]) {
  return sendEmail(buildDayBeforeReminderEmail(admin, date, events));
}
