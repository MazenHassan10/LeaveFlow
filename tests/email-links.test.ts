import assert from "node:assert/strict";
import { PRODUCTION_APP_URL, buildNewRequestEmail, resolveBaseUrl } from "../src/lib/email";
import type { TimeOffRequest, UserProfile } from "../src/lib/app-data";

// Localhost values are never used for emailed links.
assert.equal(resolveBaseUrl({ BETTER_AUTH_URL: "http://localhost:3000" }), PRODUCTION_APP_URL);
assert.equal(resolveBaseUrl({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), PRODUCTION_APP_URL);
assert.equal(resolveBaseUrl({ NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000/" }), PRODUCTION_APP_URL);
assert.equal(resolveBaseUrl({}), PRODUCTION_APP_URL);

// Public values win in priority order.
assert.equal(
  resolveBaseUrl({ NEXT_PUBLIC_APP_URL: "https://leave.example.com", BETTER_AUTH_URL: "https://auth.example.com" }),
  "https://leave.example.com"
);
assert.equal(
  resolveBaseUrl({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", VERCEL_PROJECT_PRODUCTION_URL: "leave-flow-seven.vercel.app" }),
  "https://leave-flow-seven.vercel.app"
);
assert.equal(resolveBaseUrl({ BETTER_AUTH_URL: "https://auth.example.com" }), "https://auth.example.com");

// A generated notification email links to production even with local env values.
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.GMAIL_FROM_EMAIL = "sender@example.com";

const admin: UserProfile = {
  id: "admin", authUserId: "admin", email: "admin@example.com", fullName: "Admin",
  role: "Admin", status: "Active", protectedOwner: false
};
const employee: UserProfile = {
  id: "emp", authUserId: "emp", email: "emp@example.com", fullName: "Employee",
  role: "Employee", status: "Active", protectedOwner: false
};
const request = {
  id: "req", employeeId: "emp", requestType: "PTO", status: "Pending", reason: "Test",
  totalRequestedHours: 8, totalMakeupHours: 0, isLateNotice: false,
  segments: [{ id: "s", date: "2026-11-02", startTime: "09:00", endTime: "17:00", requestedHours: 8 }],
  makeupEntries: [], createdAt: new Date().toISOString()
} as unknown as TimeOffRequest;

const email = buildNewRequestEmail([admin], employee, request);
assert.ok(email);
assert.doesNotMatch(email.html, /localhost/);
assert.doesNotMatch(email.text, /localhost/);
assert.match(email.html, /https:\/\/leave-flow-seven\.vercel\.app\/admin/);

console.log("Email link tests passed.");
