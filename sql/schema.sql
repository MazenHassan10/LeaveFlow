create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"(id) on delete cascade
);

create table if not exists account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique references "user"(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('Admin', 'Employee')) default 'Employee',
  status text not null check (status in ('Pending', 'Active', 'Disabled')) default 'Pending',
  protected_owner boolean not null default false,
  role_assigned_by uuid references user_profiles(id),
  role_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pto_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references user_profiles(id) on delete cascade,
  calendar_year integer not null,
  annual_allowance_hours numeric(6,2) not null default 48,
  used_hours numeric(6,2) not null default 0,
  expires_on date not null,
  unique (employee_id, calendar_year)
);

create table if not exists time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references user_profiles(id) on delete cascade,
  request_type text not null check (request_type in ('PTO', 'Additional Time Off', 'Emergency/Exception')),
  reason text,
  total_requested_hours numeric(6,2) not null default 0,
  total_makeup_hours numeric(6,2) not null default 0,
  is_late_notice boolean not null default false,
  requires_makeup_plan boolean not null default false,
  status text not null check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')) default 'Pending',
  approver_email text,
  approver_comment text,
  approved_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists time_off_request_segments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references time_off_requests(id) on delete cascade,
  request_date date not null,
  start_time time not null,
  end_time time not null,
  requested_hours numeric(6,2) not null,
  note text,
  check (end_time > start_time),
  check (requested_hours > 0)
);

create table if not exists makeup_plan_entries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references time_off_requests(id) on delete cascade,
  makeup_date date not null,
  start_time time not null,
  end_time time not null,
  planned_hours numeric(6,2) not null,
  verification_status text not null check (verification_status in ('Pending', 'Worked', 'Not Worked')) default 'Pending',
  verified_by text,
  verified_at timestamptz,
  admin_comment text,
  note text,
  check (end_time > start_time),
  check (planned_hours > 0)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  notification_type text not null,
  recipient_email text not null,
  status text not null check (status in ('Sending', 'Sent', 'Failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (event_key, notification_type, recipient_email)
);

create index if not exists idx_user_profiles_auth_user_id on user_profiles(auth_user_id);
create index if not exists idx_time_off_requests_employee_status on time_off_requests(employee_id, status);
create index if not exists idx_makeup_plan_entries_status on makeup_plan_entries(verification_status);
create index if not exists idx_email_notifications_event on email_notifications(notification_type, event_key);
