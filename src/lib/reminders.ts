import { losAngelesHour, tomorrowInLosAngeles } from "./app-time";
import {
  claimEmailNotification,
  getActiveAdminProfiles,
  getApprovedEventsForDate,
  markEmailNotification
} from "./app-data";
import { sendDayBeforeReminderEmail } from "./email";

const REMINDER_NOTIFICATION_TYPE = "admin_day_before_reminder";
const REMINDER_SEND_HOUR = 8;

export function shouldSendDayBeforeReminders(now = new Date()) {
  return losAngelesHour(now) === REMINDER_SEND_HOUR;
}

export async function sendDayBeforeAdminReminders(now = new Date()) {
  if (!shouldSendDayBeforeReminders(now)) {
    return {
      sent: 0,
      skipped: true,
      reason: "outside-los-angeles-send-hour"
    };
  }

  const date = tomorrowInLosAngeles(now);
  const [admins, events] = await Promise.all([
    getActiveAdminProfiles(),
    getApprovedEventsForDate(date)
  ]);

  if (!events.length) {
    return { sent: 0, skipped: true, reason: "no-events", date };
  }

  let sent = 0;
  const eventKey = `day-before:${date}`;

  for (const admin of admins) {
    const claimed = await claimEmailNotification(REMINDER_NOTIFICATION_TYPE, eventKey, admin.email);
    if (!claimed) continue;

    try {
      const result = await sendDayBeforeReminderEmail(admin, date, events);
      await markEmailNotification(
        REMINDER_NOTIFICATION_TYPE,
        eventKey,
        admin.email,
        result.sent ? "Sent" : "Failed",
        result.reason
      );
      if (result.sent) sent += 1;
    } catch (error) {
      await markEmailNotification(
        REMINDER_NOTIFICATION_TYPE,
        eventKey,
        admin.email,
        "Failed",
        error instanceof Error ? error.message : "Unknown email error"
      );
      console.error("Failed to send day-before admin reminder", error);
    }
  }

  return { sent, skipped: false, date, events: events.length };
}
