-- Freeform per-account usage notes (e.g. "for US stock trades", "daily groceries card"),
-- surfaced in the Settings page and used by bot/account_matcher.py to infer which account
-- an auto-committed extraction belongs to when a user has more than one account.

alter table accounts add column if not exists comments text;

insert into schema_migrations (version) values ('0006_account_comments') on conflict do nothing;
