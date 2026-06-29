export const ORIGINAL_ADMIN_EMAIL = "apatel@scopeshealthcare.com";
export const PTO_ALLOWANCE_HOURS = 48;
export const ADVANCE_NOTICE_DAYS = 14;

export function calculateHours(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(2));
}

export function sumHours(entries, startKey = "startTime", endKey = "endTime") {
  return entries.reduce((total, entry) => {
    return total + calculateHours(entry[startKey], entry[endKey]);
  }, 0);
}

export function daysBetween(todayISO, targetISO) {
  const today = new Date(`${todayISO}T00:00:00`);
  const target = new Date(`${targetISO}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export function isLateNotice(todayISO, segments) {
  const firstDate = segments.map((segment) => segment.date).sort()[0];
  return daysBetween(todayISO, firstDate) < ADVANCE_NOTICE_DAYS;
}

export function getRoleForLogin(email, existingProfile) {
  if (email.toLowerCase() === ORIGINAL_ADMIN_EMAIL) {
    return { role: "Admin", status: "Active", protectedOwner: true };
  }
  if (existingProfile) return existingProfile;
  return { role: "Employee", status: "Pending", protectedOwner: false };
}

export function canAccessAdmin(profile) {
  return profile?.role === "Admin" && profile?.status === "Active";
}

export function canAccessEmployee(profile) {
  return profile?.status === "Active";
}

export function buildRequest({ employeeId, type, reason, segments, makeupEntries, todayISO }) {
  const requestedHours = Number(sumHours(segments).toFixed(2));
  const makeupHours = Number(sumHours(makeupEntries).toFixed(2));
  const requiresMakeupPlan = type !== "PTO";
  return {
    id: crypto.randomUUID(),
    employeeId,
    type,
    reason,
    segments: segments.map((segment) => ({
      ...segment,
      requestedHours: calculateHours(segment.startTime, segment.endTime)
    })),
    makeupEntries: makeupEntries.map((entry) => ({
      ...entry,
      plannedHours: calculateHours(entry.startTime, entry.endTime),
      verificationStatus: "Pending"
    })),
    totalRequestedHours: requestedHours,
    totalMakeupHours: makeupHours,
    requiresMakeupPlan,
    isLateNotice: isLateNotice(todayISO, segments),
    status: "Pending",
    submittedAt: new Date().toISOString(),
    approverComment: ""
  };
}

export function approveRequest(request, balance, approverEmail) {
  const nextBalance = { ...balance };
  if (request.type === "PTO") {
    nextBalance.usedHours = Number((nextBalance.usedHours + request.totalRequestedHours).toFixed(2));
    nextBalance.remainingHours = Number((nextBalance.annualAllowanceHours - nextBalance.usedHours).toFixed(2));
  }
  return {
    request: {
      ...request,
      status: "Approved",
      approverEmail,
      approvedAt: new Date().toISOString()
    },
    balance: nextBalance
  };
}

export function verifyMakeupEntry(entry, status, adminEmail, comment = "") {
  return {
    ...entry,
    verificationStatus: status,
    verifiedBy: adminEmail,
    verifiedAt: new Date().toISOString(),
    adminComment: comment
  };
}
