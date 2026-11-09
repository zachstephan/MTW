-- Meal Tracker Week: initial schema.
-- A household (e.g. a couple) shares recipes, a week plan, rules and shopping lists.
-- Recipes with household_id = null form the shared starter library everyone can see.

-- ---------- helpers ----------
create or replace function public.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  -- 6 characters, no look-alikes (0/O, 1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

-- ---------- tables ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  week_start_day smallint not null default 0 check (week_start_day between 0 and 6),
  invite_code text not null unique default public.new_invite_code(),
  calendar_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

-- People allowed to edit the shared starter library.
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade, -- null = starter library
  name text not null check (char_length(name) between 1 and 140),
  cuisine text,
  protein text,
  meal_type text,
  healthy boolean,
  link text,
  notes text,
  servings smallint check (servings is null or servings between 1 and 50),
  image_url text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipes_unique_name on public.recipes
  (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index recipes_household_idx on public.recipes(household_id);
create index recipes_created_by_idx on public.recipes(created_by);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position smallint not null default 0,
  quantity numeric,
  unit text,
  item text not null,
  note text,
  aisle text,
  raw text
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, position);

-- One dinner slot per household per day. Past days double as history.
create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  day date not null,
  kind text not null default 'recipe' check (kind in ('recipe', 'eating_out', 'leftovers', 'no_cooking')),
  recipe_id uuid references public.recipes(id) on delete set null,
  label text,  -- recipe name at the time, so history survives a deleted recipe
  note text,   -- e.g. where you're eating out
  updated_at timestamptz not null default now(),
  unique (household_id, day)
);
create index plan_days_recipe_idx on public.plan_days(recipe_id);

-- "Tuesday picks Mexican", "Friday is eating out".
create table public.day_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  action text not null default 'filter' check (action in ('filter', 'eating_out', 'leftovers', 'no_cooking')),
  cuisines text[] not null default '{}',
  proteins text[] not null default '{}',
  meal_types text[] not null default '{}',
  healthy_only boolean not null default false,
  unique (household_id, weekday)
);

-- Starter-library recipes a household doesn't want the dice to pick.
create table public.hidden_recipes (
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  primary key (household_id, recipe_id)
);
create index hidden_recipes_recipe_idx on public.hidden_recipes(recipe_id);

-- Ticked-off shopping items for a week (key = normalized item name).
create table public.shopping_checks (
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  item_key text not null,
  primary key (household_id, week_start, item_key)
);

-- Things added to a week's list by hand ("paper towels").
create table public.shopping_extras (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  text text not null check (char_length(text) between 1 and 140),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index shopping_extras_week_idx on public.shopping_extras(household_id, week_start);

-- ---------- access helpers (security definer so policies don't recurse) ----------
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m where m.household_id = h and m.user_id = (select auth.uid()));
$$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

create or replace function public.can_read_recipe(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes x
    where x.id = r and (x.household_id is null or public.is_member(x.household_id))
  );
$$;

create or replace function public.can_write_recipe(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes x
    where x.id = r and ((x.household_id is null and public.is_app_admin()) or (x.household_id is not null and public.is_member(x.household_id)))
  );
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger recipes_touch before update on public.recipes for each row execute function public.touch_updated_at();
create trigger plan_days_touch before update on public.plan_days for each row execute function public.touch_updated_at();

-- ---------- row level security ----------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.app_admins enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.plan_days enable row level security;
alter table public.day_rules enable row level security;
alter table public.hidden_recipes enable row level security;
alter table public.shopping_checks enable row level security;
alter table public.shopping_extras enable row level security;

create policy "members read household" on public.households for select to authenticated using (public.is_member(id));
create policy "members update household" on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "members see each other" on public.household_members for select to authenticated using (public.is_member(household_id));
create policy "leave household" on public.household_members for delete to authenticated using (user_id = (select auth.uid()));

create policy "see own admin row" on public.app_admins for select to authenticated using (user_id = (select auth.uid()));

create policy "read library and own recipes" on public.recipes for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy "add recipes" on public.recipes for insert to authenticated
  with check ((household_id is not null and public.is_member(household_id)) or (household_id is null and public.is_app_admin()));
create policy "edit recipes" on public.recipes for update to authenticated
  using ((household_id is not null and public.is_member(household_id)) or (household_id is null and public.is_app_admin()))
  with check ((household_id is not null and public.is_member(household_id)) or (household_id is null and public.is_app_admin()));
create policy "delete recipes" on public.recipes for delete to authenticated
  using ((household_id is not null and public.is_member(household_id)) or (household_id is null and public.is_app_admin()));

create policy "read ingredients" on public.recipe_ingredients for select to authenticated using (public.can_read_recipe(recipe_id));
create policy "add ingredients" on public.recipe_ingredients for insert to authenticated with check (public.can_write_recipe(recipe_id));
create policy "edit ingredients" on public.recipe_ingredients for update to authenticated using (public.can_write_recipe(recipe_id)) with check (public.can_write_recipe(recipe_id));
create policy "delete ingredients" on public.recipe_ingredients for delete to authenticated using (public.can_write_recipe(recipe_id));

create policy "household plan" on public.plan_days for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household rules" on public.day_rules for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household hidden" on public.hidden_recipes for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household checks" on public.shopping_checks for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "household extras" on public.shopping_extras for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------- household setup (the only way rows get into households / household_members) ----------
create or replace function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = '' as $$
declare h public.households;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'You''re already in a household.';
  end if;
  insert into public.households(name) values (coalesce(nullif(trim(p_name), ''), 'Our kitchen')) returning * into h;
  insert into public.household_members(household_id, user_id, role) values (h.id, (select auth.uid()), 'owner');
  return h;
end; $$;

create or replace function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = '' as $$
declare h public.households;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'You''re already in a household.';
  end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'That code didn''t match a household. Check it and try again.'; end if;
  insert into public.household_members(household_id, user_id, role)
  values (h.id, (select auth.uid()), case when exists (select 1 from public.household_members where household_id = h.id) then 'member' else 'owner' end);
  return h;
end; $$;

create or replace function public.new_household_invite_code() returns text
language plpgsql security definer set search_path = '' as $$
declare h uuid; c text;
begin
  select household_id into h from public.household_members where user_id = (select auth.uid()) limit 1;
  if h is null then raise exception 'You''re not in a household.'; end if;
  c := public.new_invite_code();
  update public.households set invite_code = c where id = h;
  return c;
end; $$;

create or replace function public.new_calendar_token() returns uuid
language plpgsql security definer set search_path = '' as $$
declare h uuid; t uuid := gen_random_uuid();
begin
  select household_id into h from public.household_members where user_id = (select auth.uid()) limit 1;
  if h is null then raise exception 'You''re not in a household.'; end if;
  update public.households set calendar_token = t where id = h;
  return t;
end; $$;

revoke execute on function public.create_household(text), public.join_household(text),
  public.new_household_invite_code(), public.new_calendar_token() from public, anon;
grant execute on function public.create_household(text), public.join_household(text),
  public.new_household_invite_code(), public.new_calendar_token() to authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
