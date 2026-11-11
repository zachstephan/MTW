-- Steps and attribution on recipes.
alter table public.recipes add column if not exists directions text[] not null default '{}';
alter table public.recipes add column if not exists source text;
