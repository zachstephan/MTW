# Meal Tracker Week

Plan the week's dinners in a few taps: roll the dice, set day rules ("Tuesdays pick Mexican", "Fridays we eat out"), add recipes from a link, and get a shopping list grouped by aisle. Lock a week once it's planned, and tapping a dinner opens its recipe. Add extra recipes to a day (a side or dessert) or to the week (something to try or bake); they go on the shopping list too. Households share one plan; each household's recipes ("My recipes") are private, and a shared Recipe Bank is visible to everyone.

## How it's built

- **web/**: the app. Plain HTML, CSS and JavaScript modules with no build step and no packages to update. Host the folder as static files anywhere.
  - `app.js`: screens and interactions
  - `api.js`: every database call
  - `logic.js`: ingredient parsing, shopping-list merging, day rules and random picks (pure functions, tested)
  - `config.js`: Supabase URL and publishable key
- **supabase/migrations/**: database schema with row-level security. Each household can only see its own rows, and only admins can edit the Recipe Bank.
- **supabase/functions/**
  - `import-recipe`: reads the recipe data most recipe sites publish (schema.org JSON-LD) from a link.
  - `calendar`: an `.ics` feed of a household's dinners, addressed by a secret token that members can reset.
- **tests/**: `npm test` (Node 18+, no installs) runs the logic tests.

Supabase project: `nrflpcnvbimunhmpxnsm` in the **Meal Tracker Week** organization. Nothing here is shared with any other project.

## One-time setup

1. **Host `web/`.** In Cloudflare Pages (or Vercel or Netlify), connect this GitHub repo. Leave the build command empty and set the output directory to `web`. Every push to `main` then redeploys by itself.
2. **Tell Supabase where the app lives.** In the Supabase dashboard, open Authentication › URL Configuration. Set **Site URL** to the hosted address (e.g. `https://mtw.pages.dev`) and add the same address under **Redirect URLs**. Sign-up confirmation and password-reset emails link there.
3. **Sign up in the app**, choose **Join your partner's**, and enter the household invite code (Settings › Share with your household). Your recipes and history are already loaded into "The Stephans".
4. **Optional: Recipe Bank editor.** To let an account add Recipe Bank recipes everyone sees, run in the SQL editor:
   `insert into public.app_admins (user_id) select id from auth.users where email = 'you@example.com';`

## Recipe Bank

`web/starter-recipes.json` holds the shared Recipe Bank (called the starter library in the code and database): 257 everyday family dinners, each linking to the full recipe on [Taste of Home](https://www.tasteofhome.com). The ingredient lists and short steps are written in our own words, and the link credits the source and gives the full recipe with photos. No text or photos are copied. Ingredient lists aren't copyrightable, but recipe writing and photos are, so keep to this pattern when adding more.

To add more, append to that file, push, then in the app open Settings › Recipe Bank › **Check for new Recipe Bank recipes** (only Recipe Bank editors see it). Recipes already in the app, matched by name, are skipped. That button only adds recipes. To remove Recipe Bank recipes, delete them in the app (Edit › Delete) or with SQL.

## Changing things later

- Database: add a new file in `supabase/migrations/` and apply it. Don't edit applied ones.
- Functions: redeploy the folder in `supabase/functions/`.
- App: edit `web/`, run `npm test`, push.
