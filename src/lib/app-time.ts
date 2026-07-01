export const APP_TIME_ZONE = "America/Los_Angeles";

const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function partsForDate(date: Date) {
  const parts = datePartsFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatCivilDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function losAngelesDate(date = new Date()) {
  const parts = partsForDate(date);
  return formatCivilDate(parts.year, parts.month, parts.day);
}

export function losAngelesMonth(date = new Date()) {
  const parts = partsForDate(date);
  return `${parts.year}-${pad(parts.month)}`;
}

export function losAngelesYear(date = new Date()) {
  return partsForDate(date).year;
}

export function losAngelesHour(date = new Date()) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(date);
  return Number(value);
}

export function yearInLosAngeles(value: string | Date | null | undefined) {
  if (!value) return losAngelesYear();
  return losAngelesYear(value instanceof Date ? value : new Date(value));
}

export function addCivilDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return formatCivilDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

export function tomorrowInLosAngeles(date = new Date()) {
  return addCivilDays(losAngelesDate(date), 1);
}

export function formatTimestampInLosAngeles(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

export function formatDateLabelInLosAngeles(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatTime12Hour(time: string) {
  const [hourValue, minuteValue] = time.split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return time;

  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function formatTimeRange12Hour(startTime: string, endTime: string) {
  return `${formatTime12Hour(startTime)}-${formatTime12Hour(endTime)}`;
}
