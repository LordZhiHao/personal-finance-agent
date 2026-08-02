-- Durable, freeform notes about a user (preferences, goals, ideas) that the finance
-- Q&A agent ("Finn") saves silently mid-conversation via the remember_preference tool,
-- or the user adds directly from the Settings page / onboarding wizard. Injected into
-- the agent's system prompt on every call (see bot/finance_agent.py) so context is
-- shared across both the Telegram bot and the web dashboard chat, keyed by user_id
-- rather than the per-channel chat_history.

create table if not exists user_memories (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    content    text not null,
    source     text not null default 'agent',  -- 'agent' | 'manual'
    created_at timestamptz not null default now()
);
create index if not exists idx_user_memories_user_id on user_memories(user_id);

insert into schema_migrations (version) values ('0010_user_memories') on conflict do nothing;
