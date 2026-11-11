-- Extra recipes in a week's plan, beyond the one dinner per day:
-- a side or dessert on a given day (day set), or something for the week as a whole,
-- like a recipe to try, something to bake or lunches (day null). They go on the
-- shopping list. label keeps the name if the recipe is later deleted.
create table public.plan_extras (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  day date,
  recipe_id uuid references public.recipes(id) on delete set null,
  label text not null check (char_length(label) between 1 and 140),
  created_at timestamptz not null default now()
);

create index plan_extras_household_week_idx on public.plan_extras(household_id, week_start);
create index plan_extras_recipe_idx on public.plan_extras(recipe_id);

alter table public.plan_extras enable row level security;

create policy "household plan extras" on public.plan_extras for all to authenticated
  using (private.is_member(household_id)) with check (private.is_member(household_id));
