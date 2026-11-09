// Data layer: every call to Supabase lives here. The screens only call these functions.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

function check({ data, error }) {
  if (error) throw new Error(friendly(error.message || String(error)));
  return data;
}

function friendly(msg) {
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match.';
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.';
  if (/User already registered/i.test(msg)) return 'There’s already an account with that email. Sign in instead.';
  if (/Password should be at least/i.test(msg)) return 'Use a password with at least 6 characters.';
  if (/duplicate key value.*recipes_unique_name/i.test(msg)) return 'You already have a recipe with that name.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Couldn’t reach the server. Check your connection and try again.';
  return msg;
}

export async function createApi() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('This copy of the app isn’t connected to a database yet (web/config.js is empty).');
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  return {
    // ---------- account ----------
    async session() { return check(await sb.auth.getSession()).session; },
    onAuthChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(session, event)); },
    async signIn(email, password) { return check(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password) {
      return check(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
    },
    async resetPassword(email) {
      return check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async updatePassword(password) { return check(await sb.auth.updateUser({ password })); },
    async signOut() { await sb.auth.signOut(); },

    // ---------- household ----------
    async myHousehold() {
      const rows = check(await sb.from('households').select('*').limit(1));
      return rows[0] || null;
    },
    async createHousehold(name) { return check(await sb.rpc('create_household', { p_name: name })); },
    async joinHousehold(code) { return check(await sb.rpc('join_household', { p_code: code })); },
    async updateHousehold(id, patch) { return check(await sb.from('households').update(patch).eq('id', id).select().single()); },
    async newInviteCode() { return check(await sb.rpc('new_household_invite_code')); },
    async newCalendarToken() { return check(await sb.rpc('new_calendar_token')); },
    async memberCount(hid) {
      const { count, error } = await sb.from('household_members').select('user_id', { count: 'exact', head: true }).eq('household_id', hid);
      if (error) return null;
      return count;
    },
    calendarUrl(token) { return `${SUPABASE_URL}/functions/v1/calendar?token=${token}`; },

    // ---------- everything the screens need ----------
    async loadAll(hid) {
      const [recipes, plan, rules, hidden, admin] = await Promise.all([
        sb.from('recipes').select('*, recipe_ingredients(*)').order('name'),
        sb.from('plan_days').select('*').eq('household_id', hid),
        sb.from('day_rules').select('*').eq('household_id', hid),
        sb.from('hidden_recipes').select('recipe_id').eq('household_id', hid),
        sb.from('app_admins').select('user_id'),
      ]);
      return {
        recipes: check(recipes).map(normalizeRecipe),
        plan: check(plan),
        rules: check(rules),
        hidden: check(hidden).map((r) => r.recipe_id),
        isAdmin: (admin.data || []).length > 0,
      };
    },

    // ---------- plan ----------
    async saveDays(hid, rows) {
      if (!rows.length) return [];
      const payload = rows.map((r) => ({
        household_id: hid, day: r.day, kind: r.kind, recipe_id: r.kind === 'recipe' ? r.recipe_id : null,
        label: r.label || null, note: r.note || null,
      }));
      return check(await sb.from('plan_days').upsert(payload, { onConflict: 'household_id,day' }).select());
    },
    async clearDays(hid, days) {
      if (!days.length) return;
      check(await sb.from('plan_days').delete().eq('household_id', hid).in('day', days));
    },

    // ---------- recipes ----------
    async saveRecipe(hid, recipe, ingredients, { library = false } = {}) {
      const row = {
        name: recipe.name, cuisine: recipe.cuisine || null, protein: recipe.protein || null, meal_type: recipe.meal_type || null,
        healthy: recipe.healthy == null ? null : !!recipe.healthy, link: recipe.link || null, notes: recipe.notes || null,
        servings: recipe.servings || null, image_url: recipe.image_url || null,
      };
      let saved;
      if (recipe.id) {
        saved = check(await sb.from('recipes').update(row).eq('id', recipe.id).select().single());
        check(await sb.from('recipe_ingredients').delete().eq('recipe_id', recipe.id));
      } else {
        saved = check(await sb.from('recipes').insert({ ...row, household_id: library ? null : hid }).select().single());
      }
      if (ingredients.length) {
        check(await sb.from('recipe_ingredients').insert(ingredients.map((g, i) => ({
          recipe_id: saved.id, position: i, quantity: g.quantity, unit: g.unit, item: g.item, note: g.note, aisle: g.aisle, raw: g.raw,
        }))));
      }
      const full = check(await sb.from('recipes').select('*, recipe_ingredients(*)').eq('id', saved.id).single());
      return normalizeRecipe(full);
    },
    async deleteRecipe(id) { check(await sb.from('recipes').delete().eq('id', id)); },
    async setHidden(hid, recipeId, hide) {
      if (hide) check(await sb.from('hidden_recipes').upsert({ household_id: hid, recipe_id: recipeId }));
      else check(await sb.from('hidden_recipes').delete().eq('household_id', hid).eq('recipe_id', recipeId));
    },
    async importRecipe(url) {
      const { data, error } = await sb.functions.invoke('import-recipe', { body: { url } });
      if (error) {
        let msg = 'Couldn’t read that page.';
        try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (_) { /* keep default */ }
        throw new Error(msg);
      }
      return data;
    },

    // ---------- rules ----------
    async saveRule(hid, rule) {
      return check(await sb.from('day_rules').upsert({
        household_id: hid, weekday: rule.weekday, action: rule.action,
        cuisines: rule.cuisines || [], proteins: rule.proteins || [], meal_types: rule.meal_types || [], healthy_only: !!rule.healthy_only,
      }, { onConflict: 'household_id,weekday' }).select().single());
    },
    async deleteRule(hid, weekday) { check(await sb.from('day_rules').delete().eq('household_id', hid).eq('weekday', weekday)); },

    // ---------- shopping ----------
    async loadShopping(hid, weekStart) {
      const [checks, extras] = await Promise.all([
        sb.from('shopping_checks').select('item_key').eq('household_id', hid).eq('week_start', weekStart),
        sb.from('shopping_extras').select('*').eq('household_id', hid).eq('week_start', weekStart).order('created_at'),
      ]);
      return { checks: check(checks).map((c) => c.item_key), extras: check(extras) };
    },
    async setCheck(hid, weekStart, key, on) {
      if (on) check(await sb.from('shopping_checks').upsert({ household_id: hid, week_start: weekStart, item_key: key }));
      else check(await sb.from('shopping_checks').delete().eq('household_id', hid).eq('week_start', weekStart).eq('item_key', key));
    },
    async addExtra(hid, weekStart, text) {
      return check(await sb.from('shopping_extras').insert({ household_id: hid, week_start: weekStart, text }).select().single());
    },
    async setExtraChecked(id, checked) { check(await sb.from('shopping_extras').update({ checked }).eq('id', id)); },
    async deleteExtra(id) { check(await sb.from('shopping_extras').delete().eq('id', id)); },
  };
}

function normalizeRecipe(r) {
  const ingredients = (r.recipe_ingredients || []).slice().sort((a, b) => a.position - b.position)
    .map((g) => ({ quantity: g.quantity == null ? null : Number(g.quantity), unit: g.unit, item: g.item, note: g.note, aisle: g.aisle, raw: g.raw }));
  const { recipe_ingredients, ...rest } = r;
  return { ...rest, library: r.household_id == null, ingredients };
}
