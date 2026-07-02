import type { TimeOffRequest } from "./app-data";

export type WorkedMakeupDate = {
  id: string;
  requestId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
};

export type EmployeeProfileMetrics = {
  approvedAdditionalTimeOffHours: number;
  approvedAdditionalTimeOffCount: number;
  pendingMakeupReviewCount: number;
  workedMakeupDates: WorkedMakeupDate[];
  extraWorkedMakeupDateCount: number;
};

export function buildEmployeeProfileMetrics(requests: TimeOffRequest[]): EmployeeProfileMetrics {
  const approvedAdditionalTimeOff = requests.filter((request) => {
    return request.requestType === "Additional Time Off" && request.status === "Approved";
  });

  const workedMakeupDates = requests
    .filter((request) => request.status === "Approved")
    .flatMap((request) => request.makeupEntries.map((entry) => ({ request, entry })))
    .filter(({ entry }) => entry.verificationStatus === "Worked")
    .map(({ request, entry }) => ({
      id: entry.id,
      requestId: request.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      hours: entry.plannedHours,
    }))
    .sort((left, right) => `${right.date}${right.startTime}`.localeCompare(`${left.date}${left.startTime}`));

  const pendingMakeupReviewCount = requests
    .flatMap((request) => request.makeupEntries)
    .filter((entry) => entry.verificationStatus === "Pending").length;

  return {
    approvedAdditionalTimeOffHours: Number(approvedAdditionalTimeOff
      .reduce((total, request) => total + request.totalRequestedHours, 0)
      .toFixed(2)),
    approvedAdditionalTimeOffCount: approvedAdditionalTimeOff.length,
    pendingMakeupReviewCount,
    workedMakeupDates: workedMakeupDates.slice(0, 3),
    extraWorkedMakeupDateCount: Math.max(workedMakeupDates.length - 3, 0),
  };
}
