-- The starter library now holds only recipes that link to a real source page.
-- Remove the earlier starters that had no link (the 10 seeded in 20261109000300 and the
-- 47 written for the app). Plans that used one keep the day; only the recipe link clears.
delete from public.recipes where household_id is null and link is null;
