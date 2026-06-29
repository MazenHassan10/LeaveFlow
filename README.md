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

## Tests

Run:

```bash
bun run test
```

The test suite checks PTO hour math, first-admin role assignment, pending users, approval balance deduction, late notice detection, and make-up verification.
