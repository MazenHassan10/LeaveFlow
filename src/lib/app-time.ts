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

  // Normalize so an end-of-day marker like "24:00" reads as midnight, not noon.
  const normalizedHour = ((hourValue % 24) + 24) % 24;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  const hour = normalizedHour % 12 || 12;
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function formatTimeRange12Hour(startTime: string, endTime: string) {
  return `${formatTime12Hour(startTime)}-${formatTime12Hour(endTime)}`;
}

// Many employees work from Egypt, so request times (always Pacific) are also shown in Cairo time.
export const SECONDARY_TIME_ZONE = "Africa/Cairo";
export const SECONDARY_TIME_ZONE_LABEL = "Cairo";

export function formatWeekdayDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function wallClockParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

// The UTC instant at which `timeZone` shows the given wall-clock date and time (DST-aware).
function zonedWallTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = wallClockParts(new Date(guess), timeZone);
    guess += target - Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
  }
  return new Date(guess);
}

function convertPacificTime(date: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const local = wallClockParts(zonedWallTimeToUtc(date, time, APP_TIME_ZONE), timeZone);
  const [year, month, day] = date.split("-").map(Number);
  return {
    time: formatTime12Hour(`${pad(local.hour)}:${pad(local.minute)}`),
    dayOffset: Math.round((Date.UTC(local.year, local.month - 1, local.day) - Date.UTC(year, month - 1, day)) / 86400000)
  };
}

function dayOffsetSuffix(offset: number) {
  if (!offset) return "";
  return ` (${offset > 0 ? "+" : ""}${offset} day${Math.abs(offset) === 1 ? "" : "s"})`;
}

// A Pacific time on a Pacific date shown in another zone, e.g. "3:00 AM Cairo (+1 day)". DST-aware.
export function formatPacificTimeIn(date: string, time: string, timeZone = SECONDARY_TIME_ZONE, label = SECONDARY_TIME_ZONE_LABEL) {
  const converted = convertPacificTime(date, time, timeZone);
  if (!converted) return "";
  return `${converted.time} ${label}${dayOffsetSuffix(converted.dayOffset)}`;
}

// A Pacific time range shown in another zone, e.g. "7:00 PM – 3:00 AM Cairo (+1 day)".
export function formatPacificRangeIn(date: string, startTime: string, endTime: string, timeZone = SECONDARY_TIME_ZONE, label = SECONDARY_TIME_ZONE_LABEL) {
  const start = convertPacificTime(date, startTime, timeZone);
  const end = convertPacificTime(date, endTime, timeZone);
  if (!start || !end) return "";
  return `${start.time}${dayOffsetSuffix(start.dayOffset)} – ${end.time} ${label}${dayOffsetSuffix(end.dayOffset)}`;
}
