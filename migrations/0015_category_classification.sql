-- Lets a custom category be marked as something other than a plain spending
-- expense (income / transfer / investment), mirroring the fixed classification
-- built-in categories get in code (utils/constants.py::BUILTIN_CATEGORY_CLASSIFICATIONS).
-- Existing rows default to 'expense' — no behavior change for categories that
-- were already being treated as generic spending.

alter table custom_categories add column if not exists classification text not null default 'expense';

alter table custom_categories drop constraint if exists custom_categories_classification_check;
alter table custom_categories add constraint custom_categories_classification_check
    check (classification in ('expense', 'income', 'transfer', 'investment'));

insert into schema_migrations (version) values ('0015_category_classification') on conflict do nothing;
