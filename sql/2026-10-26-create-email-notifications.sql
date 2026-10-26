-- Creates the email_notifications table the day-before reminder cron depends on.
-- It exists in sql/schema.sql but was never created in production. Idempotent.

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

create index if not exists idx_email_notifications_event on email_notifications(notification_type, event_key);
