-- Adds the "Manager" role (admin privileges + tracked as an employee for PTO).
-- Run once against the existing PostgreSQL database. Idempotent.

alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles
  add constraint user_profiles_role_check check (role in ('Admin', 'Manager', 'Employee'));
