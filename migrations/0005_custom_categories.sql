-- Per-user custom transaction categories, additive to the fixed CATEGORIES list in
-- utils/constants.py. A user's full category list is CATEGORIES + their own rows here
-- (see db/supabase.py::get_categories_for_user), used by manual entry, the extraction
-- prompts, and GET /api/meta.

create table if not exists custom_categories (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    name       text not null,
    created_at timestamptz not null default now(),
    unique (user_id, name)
);
create index if not exists idx_custom_categories_user_id on custom_categories(user_id);

insert into schema_migrations (version) values ('0005_custom_categories') on conflict do nothing;
