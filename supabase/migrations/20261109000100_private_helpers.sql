-- Move policy helpers out of the API-exposed schema so they can't be called over REST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m where m.household_id = h and m.user_id = (select auth.uid()));
$$;

create or replace function private.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

create or replace function private.can_read_recipe(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipes x where x.id = r and (x.household_id is null or private.is_member(x.household_id)));
$$;

create or replace function private.can_write_recipe(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipes x where x.id = r
    and ((x.household_id is null and private.is_app_admin()) or (x.household_id is not null and private.is_member(x.household_id))));
$$;

revoke all on function private.is_member(uuid), private.is_app_admin(), private.can_read_recipe(uuid), private.can_write_recipe(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.is_app_admin(), private.can_read_recipe(uuid), private.can_write_recipe(uuid) to authenticated;

drop policy "members read household" on public.households;
drop policy "members update household" on public.households;
drop policy "members see each other" on public.household_members;
drop policy "read library and own recipes" on public.recipes;
drop policy "add recipes" on public.recipes;
drop policy "edit recipes" on public.recipes;
drop policy "delete recipes" on public.recipes;
drop policy "read ingredients" on public.recipe_ingredients;
drop policy "add ingredients" on public.recipe_ingredients;
drop policy "edit ingredients" on public.recipe_ingredients;
drop policy "delete ingredients" on public.recipe_ingredients;
drop policy "household plan" on public.plan_days;
drop policy "household rules" on public.day_rules;
drop policy "household hidden" on public.hidden_recipes;
drop policy "household checks" on public.shopping_checks;
drop policy "household extras" on public.shopping_extras;

create policy "members read household" on public.households for select to authenticated using (private.is_member(id));
create policy "members update household" on public.households for update to authenticated using (private.is_member(id)) with check (private.is_member(id));
create policy "members see each other" on public.household_members for select to authenticated using (private.is_member(household_id));

create policy "read library and own recipes" on public.recipes for select to authenticated
  using (household_id is null or private.is_member(household_id));
create policy "add recipes" on public.recipes for insert to authenticated
  with check ((household_id is not null and private.is_member(household_id)) or (household_id is null and private.is_app_admin()));
create policy "edit recipes" on public.recipes for update to authenticated
  using ((household_id is not null and private.is_member(household_id)) or (household_id is null and private.is_app_admin()))
  with check ((household_id is not null and private.is_member(household_id)) or (household_id is null and private.is_app_admin()));
create policy "delete recipes" on public.recipes for delete to authenticated
  using ((household_id is not null and private.is_member(household_id)) or (household_id is null and private.is_app_admin()));

create policy "read ingredients" on public.recipe_ingredients for select to authenticated using (private.can_read_recipe(recipe_id));
create policy "add ingredients" on public.recipe_ingredients for insert to authenticated with check (private.can_write_recipe(recipe_id));
create policy "edit ingredients" on public.recipe_ingredients for update to authenticated using (private.can_write_recipe(recipe_id)) with check (private.can_write_recipe(recipe_id));
create policy "delete ingredients" on public.recipe_ingredients for delete to authenticated using (private.can_write_recipe(recipe_id));

create policy "household plan" on public.plan_days for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy "household rules" on public.day_rules for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy "household hidden" on public.hidden_recipes for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy "household checks" on public.shopping_checks for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy "household extras" on public.shopping_extras for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));

drop function public.can_read_recipe(uuid);
drop function public.can_write_recipe(uuid);
drop function public.is_app_admin();
drop function public.is_member(uuid);

-- Supabase's template helper only needs to run from its event trigger, not from the API.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
