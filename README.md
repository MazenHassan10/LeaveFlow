# Time-Off Tracker

Hour-based PTO and make-up approval platform for Preet Patel MD, A PMC.

## What is implemented

- Real Google OAuth route using Better Auth.
- First-admin bootstrap for `apatel@scopeshealthcare.com`.
- Pending access state for unknown Google users.
- Admin and Employee roles.
- Hour-based PTO balance with 48 annual hours.
- Time-off requests with dated from/to time blocks.
- Additional time off make-up plans with dated from/to time blocks.
- Admin approval/rejection flow.
- Admin make-up verification: Worked or Not Worked.
- Admin reports for make-up work and audit events.
- Gmail API notifications for submitted, approved, and rejected requests.
- Vercel Cron reminders for tomorrow's approved days off and make-up plans.
- PostgreSQL schema for Better Auth and PTO data in `sql/schema.sql`.

## Local demo

Run:

```bash
bun install
bun run dev
```

Then open:

```text
http://localhost:3000/
```

Google login requires Better Auth environment variables and a PostgreSQL database.

## Google OAuth setup

1. Copy `.env.example` to `.env.local`.
2. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `DATABASE_URL`.
3. In Google Cloud Console, add this local redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

4. Run `sql/schema.sql` against the PostgreSQL database.
5. Start the app with `./dev.sh`.

The first login from `apatel@scopeshealthcare.com` becomes the protected Admin. Other Google accounts start as Pending until an admin activates them.

## Gmail notifications and reminders

LeaveFlow sends email through the Gmail API. Configure these server-side environment variables:

```text
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
```

Use a Google Cloud OAuth client with the Gmail API enabled and a refresh token created with offline access and the Gmail send scope. The app sends from `GMAIL_FROM_EMAIL`.

Request notifications:

- New non-duplicate requests email all Active Admins.
- Approved or rejected requests email the employee who submitted the request.

Reminder notifications:

- `vercel.json` calls `/api/cron/day-before-reminders` at 15:00 and 16:00 UTC.
- The route only sends when the Los Angeles local hour is 8 AM, which handles Pacific daylight saving time.
- The route uses `CRON_SECRET` for authorization and records sends in `email_notifications` to avoid duplicate reminder emails.

## Tests

Run:

```bash
bun run test
```

The test suite checks PTO hour math, first-admin role assignment, pending users, approval balance deduction, late notice detection, and make-up verification.
