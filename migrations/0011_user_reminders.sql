-- Simple recurring personal reminders a user schedules via chat with Finn (daily /
-- weekly-on-a-weekday / monthly-on-a-day-of-month at a fixed Asia/Singapore time —
-- deliberately not raw cron/rrule, to avoid an LLM emitting an invalid/unintended
-- schedule that silently misfires). Polled every few minutes by
-- scheduler/user_reminders.py rather than scheduled as individual dynamic APScheduler
-- jobs (this codebase has no dynamic add_job/remove_job today) — restart-safe by design.

create table if not exists user_reminders (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users(id) on delete cascade,
    message       text not null,
    frequency     text not null,                 -- 'daily' | 'weekly' | 'monthly'
    day_of_week   int,                            -- 0=Mon..6=Sun (Python datetime.weekday()); required iff frequency='weekly'
    day_of_month  int,                            -- 1-31; required iff frequency='monthly'; clamped to the month's last day if that month is shorter
    time_of_day   time not null,                  -- Asia/Singapore local time-of-day, no seconds needed
    channel       text not null default 'both',   -- 'telegram' | 'email' | 'both'
    active        boolean not null default true,
    last_sent_at  timestamptz,                    -- guards against double-send within one poll window; also self-heals a missed send (no separate retry queue)
    created_at    timestamptz not null default now(),
    constraint user_reminders_frequency_check check (frequency in ('daily','weekly','monthly')),
    constraint user_reminders_channel_check check (channel in ('telegram','email','both')),
    constraint user_reminders_day_of_week_check check (day_of_week is null or day_of_week between 0 and 6),
    constraint user_reminders_day_of_month_check check (day_of_month is null or day_of_month between 1 and 31)
);
create index if not exists idx_user_reminders_user_id on user_reminders(user_id);
create index if not exists idx_user_reminders_active on user_reminders(active) where active;

insert into schema_migrations (version) values ('0011_user_reminders') on conflict do nothing;
