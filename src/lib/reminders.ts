import { addCivilDays, losAngelesDate, losAngelesHour } from "./app-time";
import {
  claimEmailNotification,
  getActiveAdminProfiles,
  getApprovedEventsForDate,
  markEmailNotification
} from "./app-data";
import { sendAdminReminderEmail, sendEmployeeReminderEmail, type EmailSendResult } from "./email";
import type { ReportCalendarEvent } from "./report-calendar";

// Approved days off and make-up shifts are reminded 4 days ahead and again 1 day ahead,
// to every active admin (one digest per date) and to the employee involved.
export const REMINDER_LEAD_DAYS = [4, 1] as const;
const REMINDER_SEND_HOUR = 8;
const ADMIN_NOTIFICATION_TYPE = "admin_reminder";
const EMPLOYEE_NOTIFICATION_TYPE = "employee_reminder";

export function shouldSendReminders(now = new Date()) {
  return losAngelesHour(now) === REMINDER_SEND_HOUR;
}

// Kept for existing callers.
export const shouldSendDayBeforeReminders = shouldSendReminders;

type LeadResult = { daysAhead: number; date: string; events: number; sent: number; failed: number };

// Claims the (type, key, recipient) slot so a reminder is sent at most once, then sends
// and records the outcome. A failure for one recipient never stops the others.
async function sendOnce(
  notificationType: string,
  eventKey: string,
  recipientEmail: string,
  send: () => Promise<EmailSendResult>
): Promise<"sent" | "skipped" | "failed"> {
  try {
    const claimed = await claimEmailNotification(notificationType, eventKey, recipientEmail);
    if (!claimed) return "skipped";
  } catch (error) {
    console.error(`Could not claim ${notificationType} for ${recipientEmail}`, error);
    return "failed";
  }

  try {
    const result = await send();
    await markEmailNotification(notificationType, eventKey, recipientEmail, result.sent ? "Sent" : "Failed", result.reason);
    return result.sent ? "sent" : "failed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await markEmailNotification(notificationType, eventKey, recipientEmail, "Failed", message).catch(() => {});
    console.error(`Failed to send ${notificationType} to ${recipientEmail}`, error);
    return "failed";
  }
}

function groupByEmployee(events: ReportCalendarEvent[]) {
  const groups = new Map<string, { name: string; email: string; events: ReportCalendarEvent[] }>();
  for (const event of events) {
    if (!event.employeeEmail) continue;
    const key = event.employeeEmail.toLowerCase();
    const group = groups.get(key) || { name: event.employeeName, email: event.employeeEmail, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function sendScheduledReminders(now = new Date()) {
  if (!shouldSendReminders(now)) {
    return { sent: 0, failed: 0, skipped: true, reason: "outside-los-angeles-send-hour", leads: [] as LeadResult[] };
  }

  const today = losAngelesDate(now);
  const admins = await getActiveAdminProfiles();
  const leads: LeadResult[] = [];

  for (const daysAhead of REMINDER_LEAD_DAYS) {
    const date = addCivilDays(today, daysAhead);
    const events = await getApprovedEventsForDate(date);
    const lead: LeadResult = { daysAhead, date, events: events.length, sent: 0, failed: 0 };
    leads.push(lead);
    if (!events.length) continue;

    const eventKey = `${daysAhead}d:${date}`;
    const tally = (outcome: "sent" | "skipped" | "failed") => {
      if (outcome === "sent") lead.sent += 1;
      if (outcome === "failed") lead.failed += 1;
    };

    for (const admin of admins) {
      tally(await sendOnce(ADMIN_NOTIFICATION_TYPE, eventKey, admin.email, () =>
        sendAdminReminderEmail(admin, date, events, daysAhead)
      ));
    }

    for (const employee of groupByEmployee(events)) {
      tally(await sendOnce(EMPLOYEE_NOTIFICATION_TYPE, eventKey, employee.email, () =>
        sendEmployeeReminderEmail(employee, date, employee.events, daysAhead)
      ));
    }
  }

  return {
    sent: leads.reduce((total, lead) => total + lead.sent, 0),
    failed: leads.reduce((total, lead) => total + lead.failed, 0),
    skipped: false,
    leads
  };
}
