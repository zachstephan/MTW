-- Limit invite-code guessing: 10 wrong codes per account per hour.
create table if not exists private.join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists join_attempts_user_at_idx on private.join_attempts(user_id, at);

create or replace function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = '' as $$
declare h public.households;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'You''re already in a household.';
  end if;
  if (select count(*) from private.join_attempts where user_id = (select auth.uid()) and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes. Wait an hour and try again.';
  end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then
    -- Recorded and returned as empty (not raised) so the attempt isn't rolled back.
    insert into private.join_attempts(user_id) values ((select auth.uid()));
    delete from private.join_attempts where at < now() - interval '1 day';
    return null;
  end if;
  insert into public.household_members(household_id, user_id, role)
  values (h.id, (select auth.uid()), case when exists (select 1 from public.household_members where household_id = h.id) then 'member' else 'owner' end);
  return h;
end; $$;
