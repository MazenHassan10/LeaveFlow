-- Tracks when an employee edits or cancels their own pending request. Idempotent.
alter table time_off_requests add column if not exists edited_at timestamptz;
alter table time_off_requests add column if not exists cancelled_at timestamptz;
