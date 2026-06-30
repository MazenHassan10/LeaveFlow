import assert from "node:assert/strict";
import type { AppSnapshot } from "../src/lib/app-data";
import { addMonths, buildMonthDays, buildReportCalendarEvents, groupEventsByDate, monthLabel, parseMonthParam } from "../src/lib/report-calendar";

const snapshot: AppSnapshot = {
  profiles: [
    {
      id: "employee-1",
      authUserId: "employee-1",
      email: "one@example.com",
      fullName: "Employee One",
      role: "Employee",
      status: "Active",
      protectedOwner: false
    }
  ],
  balances: {},
  auditEvents: [],
  requests: [
    {
      id: "approved-request",
      employeeId: "employee-1",
      requestType: "PTO",
      reason: "",
      totalRequestedHours: 4,
      totalMakeupHours: 2,
      isLateNotice: false,
      requiresMakeupPlan: false,
      status: "Approved",
      submittedAt: "2026-07-01T00:00:00.000Z",
      segments: [
        { id: "segment-1", requestId: "approved-request", date: "2026-07-14", startTime: "09:00", endTime: "13:00", requestedHours: 4 }
      ],
      makeupEntries: [
        { id: "makeup-1", requestId: "approved-request", date: "2026-07-18", startTime: "13:00", endTime: "15:00", plannedHours: 2, verificationStatus: "Pending" }
      ]
    },
    {
      id: "pending-request",
      employeeId: "employee-1",
      requestType: "PTO",
      reason: "",
      totalRequestedHours: 2,
      totalMakeupHours: 0,
      isLateNotice: false,
      requiresMakeupPlan: false,
      status: "Pending",
      submittedAt: "2026-07-01T00:00:00.000Z",
      segments: [
        { id: "segment-2", requestId: "pending-request", date: "2026-07-15", startTime: "09:00", endTime: "11:00", requestedHours: 2 }
      ],
      makeupEntries: [
        { id: "makeup-2", requestId: "pending-request", date: "2026-07-19", startTime: "13:00", endTime: "15:00", plannedHours: 2, verificationStatus: "Pending" }
      ]
    }
  ]
};

const events = buildReportCalendarEvents(snapshot);
assert.equal(events.length, 2);
assert.equal(events.some((event) => event.type === "off" && event.date === "2026-07-14"), true);
assert.equal(events.some((event) => event.type === "makeup" && event.date === "2026-07-18"), true);
assert.equal(events.some((event) => event.date === "2026-07-15"), false);
assert.equal(events.some((event) => event.date === "2026-07-19"), false);

const grouped = groupEventsByDate(events);
assert.equal(grouped["2026-07-14"].length, 1);
assert.equal(grouped["2026-07-18"].length, 1);
assert.equal(parseMonthParam("2026-07"), "2026-07");
assert.equal(parseMonthParam("bad-month", new Date("2026-06-30T00:00:00.000Z")), "2026-06");
assert.equal(parseMonthParam(undefined, new Date("2026-07-01T06:30:00.000Z")), "2026-06");
assert.equal(addMonths("2026-12", 1), "2027-01");
assert.equal(addMonths("2026-01", -1), "2025-12");
assert.equal(monthLabel("2026-07"), "July 2026");

const julyDays = buildMonthDays("2026-07");
assert.equal(julyDays[0], "2026-06-28");
assert.equal(julyDays.includes("2026-07-01"), true);
assert.equal(julyDays.includes("2026-07-31"), true);
assert.equal(julyDays[julyDays.length - 1], "2026-08-01");

console.log("Report calendar tests passed.");
