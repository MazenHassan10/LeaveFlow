create type public.app_role as enum ('Admin', 'Employee');
create type public.user_status as enum ('Pending', 'Active', 'Disabled');
create type public.request_type as enum ('PTO', 'Additional Time Off', 'Emergency/Exception');
create type public.request_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');
create type public.makeup_verification_status as enum ('Pending', 'Worked', 'Not Worked');
create type public.notification_status as enum ('Scheduled', 'Sent', 'Failed', 'Cancelled');

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'Employee',
  status public.user_status not null default 'Pending',
  protected_owner boolean not null default false,
  created_by uuid references public.user_profiles(id),
  role_assigned_by uuid references public.user_profiles(id),
  role_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid unique not null references public.user_profiles(id) on delete cascade,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.policy_settings (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null default date '2026-05-20',
  annual_pto_hours numeric(6,2) not null default 48,
  advance_notice_days integer not null default 14,
  rollover_allowed boolean not null default false,
  default_approver_name text not null default 'Anusha Patel',
  default_approver_email_primary text not null default 'admin@gramercycenter.com',
  default_approver_email_secondary text not null default 'apatel@scopeshealthcare.com',
  created_at timestamptz not null default now()
);

create table public.pto_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  calendar_year integer not null,
  annual_allowance_hours numeric(6,2) not null default 48,
  used_hours numeric(6,2) not null default 0,
  remaining_hours numeric(6,2) generated always as (annual_allowance_hours - used_hours) stored,
  expires_on date not null,
  unique (employee_id, calendar_year)
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type public.request_type not null,
  reason text,
  total_requested_hours numeric(6,2) not null default 0,
  total_makeup_hours numeric(6,2) not null default 0,
  is_late_notice boolean not null default false,
  requires_makeup_plan boolean not null default false,
  status public.request_status not null default 'Pending',
  approver_profile_id uuid references public.user_profiles(id),
  approver_comment text,
  approved_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.time_off_request_segments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.time_off_requests(id) on delete cascade,
  request_date date not null,
  start_time time not null,
  end_time time not null,
  requested_hours numeric(6,2) not null,
  note text,
  check (end_time > start_time),
  check (requested_hours > 0)
);

create table public.makeup_plan_entries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.time_off_requests(id) on delete cascade,
  makeup_date date not null,
  start_time time not null,
  end_time time not null,
  planned_hours numeric(6,2) not null,
  verification_status public.makeup_verification_status not null default 'Pending',
  verified_by uuid references public.user_profiles(id),
  verified_at timestamptz,
  admin_comment text,
  note text,
  check (end_time > start_time),
  check (planned_hours > 0)
);

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  makeup_plan_entry_id uuid references public.makeup_plan_entries(id) on delete cascade,
  notification_type text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status public.notification_status not null default 'Scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.email_notifications (
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

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.policy_settings default values;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and role = 'Admin'
      and status = 'Active'
  );
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.user_profiles where auth_user_id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(new.email);
  is_owner boolean := normalized_email = 'apatel@scopeshealthcare.com';
begin
  insert into public.user_profiles (
    auth_user_id,
    email,
    full_name,
    role,
    status,
    protected_owner,
    role_assigned_at
  )
  values (
    new.id,
    normalized_email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', normalized_email),
    case when is_owner then 'Admin'::public.app_role else 'Employee'::public.app_role end,
    case when is_owner then 'Active'::public.user_status else 'Pending'::public.user_status end,
    is_owner,
    case when is_owner then now() else null end
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        role = case when is_owner then 'Admin'::public.app_role else public.user_profiles.role end,
        status = case when is_owner then 'Active'::public.user_status else public.user_profiles.status end,
        protected_owner = public.user_profiles.protected_owner or is_owner;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.user_profiles enable row level security;
alter table public.employees enable row level security;
alter table public.policy_settings enable row level security;
alter table public.pto_balances enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.time_off_request_segments enable row level security;
alter table public.makeup_plan_entries enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.email_notifications enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles own or admin read" on public.user_profiles
for select using (public.is_admin() or auth_user_id = auth.uid());

create policy "admins update non-owner profiles" on public.user_profiles
for update using (public.is_admin() and protected_owner = false)
with check (public.is_admin() and protected_owner = false);

create policy "employees own or admin read" on public.employees
for select using (
  public.is_admin()
  or user_profile_id = public.current_profile_id()
);

create policy "admins manage employees" on public.employees
for all using (public.is_admin())
with check (public.is_admin());

create policy "active users read policy" on public.policy_settings
for select using (
  public.is_admin()
  or exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid() and status = 'Active'
  )
);

create policy "balances own or admin read" on public.pto_balances
for select using (
  public.is_admin()
  or employee_id in (
    select id from public.employees where user_profile_id = public.current_profile_id()
  )
);

create policy "admins manage balances" on public.pto_balances
for all using (public.is_admin())
with check (public.is_admin());

create policy "requests own or admin read" on public.time_off_requests
for select using (
  public.is_admin()
  or employee_id in (
    select id from public.employees where user_profile_id = public.current_profile_id()
  )
);

create policy "employees create own requests" on public.time_off_requests
for insert with check (
  employee_id in (
    select id from public.employees where user_profile_id = public.current_profile_id()
  )
);

create policy "admins update requests" on public.time_off_requests
for update using (public.is_admin())
with check (public.is_admin());

create policy "segments visible with request" on public.time_off_request_segments
for select using (
  exists (
    select 1 from public.time_off_requests r
    where r.id = request_id
      and (public.is_admin() or r.employee_id in (
        select id from public.employees where user_profile_id = public.current_profile_id()
      ))
  )
);

create policy "employees create own segments" on public.time_off_request_segments
for insert with check (
  exists (
    select 1 from public.time_off_requests r
    where r.id = request_id
      and r.employee_id in (
        select id from public.employees where user_profile_id = public.current_profile_id()
      )
  )
);

create policy "makeup visible with request" on public.makeup_plan_entries
for select using (
  exists (
    select 1 from public.time_off_requests r
    where r.id = request_id
      and (public.is_admin() or r.employee_id in (
        select id from public.employees where user_profile_id = public.current_profile_id()
      ))
  )
);

create policy "employees create own makeup" on public.makeup_plan_entries
for insert with check (
  exists (
    select 1 from public.time_off_requests r
    where r.id = request_id
      and r.employee_id in (
        select id from public.employees where user_profile_id = public.current_profile_id()
      )
  )
);

create policy "admins verify makeup" on public.makeup_plan_entries
for update using (public.is_admin())
with check (public.is_admin());

create policy "admins manage notifications" on public.admin_notifications
for all using (public.is_admin())
with check (public.is_admin());

create policy "admins manage email notifications" on public.email_notifications
for all using (public.is_admin())
with check (public.is_admin());

create policy "admins read audit" on public.audit_events
for select using (public.is_admin());

create policy "admins create audit" on public.audit_events
for insert with check (public.is_admin());
