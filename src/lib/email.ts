import { formatDateLabelInLosAngeles, formatTimeRange12Hour } from "./app-time";
import type { ReportCalendarEvent } from "./report-calendar";
import type { TimeOffRequest, UserProfile } from "./app-data";

type EmailMessage = {
  to: string[];
  subject: string;
  text: string;
};

function configuredSender() {
  return process.env.GMAIL_FROM_EMAIL?.trim() || "";
}

function appUrl(path: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}${path}`;
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

  return {
    to,
    subject: `New LeaveFlow request from ${employee.fullName}`,
    text: [
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
      `Review it here: ${appUrl("/admin")}`
    ].join("\n")
  };
}

export function buildRequestDecisionEmail(employee: UserProfile, request: TimeOffRequest): EmailMessage {
  const status = request.status.toLowerCase();

  return {
    to: [employee.email],
    subject: `Your LeaveFlow request was ${status}`,
    text: [
      `Your LeaveFlow request was ${status}.`,
      "",
      `Request type: ${request.requestType}`,
      `Requested time:`,
      requestTimeSummary(request),
      `Requested hours: ${request.totalRequestedHours}`,
      request.approverEmail ? `Approver: ${request.approverEmail}` : "Approver: Not recorded",
      "",
      `View your requests here: ${appUrl("/employee")}`
    ].join("\n")
  };
}

export function buildDayBeforeReminderEmail(admin: UserProfile, date: string, events: ReportCalendarEvent[]): EmailMessage {
  const eventLines = events.map((event) => {
    const label = event.type === "off" ? "Off" : "Make-up";
    return `- ${label}: ${event.employeeName} (${event.employeeEmail}), ${formatTimeRange12Hour(event.startTime, event.endTime)} (${event.hours}h)`;
  });

  return {
    to: [admin.email],
    subject: "LeaveFlow reminder: tomorrow's time off and make-up plans",
    text: [
      `Hi ${admin.fullName},`,
      "",
      `Tomorrow (${formatDateLabelInLosAngeles(date)}) has approved LeaveFlow events:`,
      "",
      ...eventLines,
      "",
      `Open reports: ${appUrl("/reports")}`
    ].join("\n")
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
  return [
    `From: ${configuredSender()}`,
    `To: ${message.to.join(", ")}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    message.text
  ].join("\r\n");
}

export async function sendEmail(message: EmailMessage) {
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
