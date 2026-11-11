-- A locked week is read-only in the app: tapping a dinner opens its recipe instead of the
-- change menu, and nothing can swap, shuffle or clear its days until someone unlocks it.
-- Shared by the household, keyed by the week's first day.
create table public.week_locks (
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  locked_at timestamptz not null default now(),
  primary key (household_id, week_start)
);

alter table public.week_locks enable row level security;

create policy "household week locks" on public.week_locks for all to authenticated
  using (private.is_member(household_id)) with check (private.is_member(household_id));
