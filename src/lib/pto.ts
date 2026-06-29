export const ORIGINAL_ADMIN_EMAIL = "apatel@scopeshealthcare.com";
export const PTO_ALLOWANCE_HOURS = 48;
export const ADVANCE_NOTICE_DAYS = 14;

export type AppRole = "Admin" | "Employee";
export type ProfileStatus = "Pending" | "Active" | "Disabled";
export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type RequestType = "PTO" | "Additional Time Off" | "Emergency/Exception";
export type MakeupStatus = "Pending" | "Worked" | "Not Worked";

export function calculateHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(2));
}

export function daysBetween(todayISO: string, targetISO: string) {
  const today = new Date(`${todayISO}T00:00:00`);
  const target = new Date(`${targetISO}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function isLateNotice(todayISO: string, firstDate: string) {
  return daysBetween(todayISO, firstDate) < ADVANCE_NOTICE_DAYS;
}

export function roleForEmail(email: string) {
  return email.toLowerCase() === ORIGINAL_ADMIN_EMAIL
    ? { role: "Admin" as AppRole, status: "Active" as ProfileStatus, protectedOwner: true }
    : { role: "Employee" as AppRole, status: "Pending" as ProfileStatus, protectedOwner: false };
}
