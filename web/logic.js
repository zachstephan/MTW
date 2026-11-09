// Pure logic shared by the app and the tests. No DOM, no network.

// ---------- dates (yyyy-mm-dd strings, math in UTC so time zones never shift a day) ----------
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => (n < 10 ? '0' : '') + n;
export function toUTC(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
export function toISO(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export function addDays(iso, n) { return toISO(toUTC(iso) + n * 86400000); }
export function dow(iso) { return new Date(toUTC(iso)).getUTCDay(); }
export function weekOf(iso, startDay = 0) { return addDays(iso, -((dow(iso) - startDay + 7) % 7)); }
export function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
export function nice(iso) { const d = new Date(toUTC(iso)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; }
export function localToday() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// ---------- day kinds ----------
export const OFF_KINDS = {
  eating_out: { label: 'Eating out', hint: 'Not cooking tonight' },
  leftovers: { label: 'Leftovers', hint: 'Use up what’s in the fridge' },
  no_cooking: { label: 'No cooking', hint: 'Everyone fends for themselves' },
};
export const isOffKind = (kind) => Object.prototype.hasOwnProperty.call(OFF_KINDS, kind);

// ---------- ingredient parsing ----------
const UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅙': 1 / 6 };
const UNIT_ALIASES = {
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'T'],
  cup: ['cup', 'cups', 'c'],
  oz: ['oz', 'ounce', 'ounces'],
  'fl oz': ['fl oz', 'fluid ounce', 'fluid ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  g: ['g', 'gram', 'grams'],
  kg: ['kg', 'kilogram', 'kilograms'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans'],
  jar: ['jar', 'jars'],
  package: ['package', 'packages', 'pkg', 'pkgs', 'packet', 'packets'],
  bunch: ['bunch', 'bunches'],
  head: ['head', 'heads'],
  slice: ['slice', 'slices'],
  stalk: ['stalk', 'stalks'],
  sprig: ['sprig', 'sprigs'],
  bag: ['bag', 'bags'],
  box: ['box', 'boxes'],
  stick: ['stick', 'sticks'],
  pint: ['pint', 'pints', 'pt'],
  quart: ['quart', 'quarts', 'qt'],
};
const UNIT_LOOKUP = {};
for (const [unit, names] of Object.entries(UNIT_ALIASES)) for (const n of names) UNIT_LOOKUP[n] = unit;

function parseNumberToken(tok) {
  if (tok == null) return null;
  let t = tok.trim();
  if (!t) return null;
  // "1½" or "1 ½" handled by caller combining; here handle pure forms
  if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];
  const mixedUni = t.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞⅕⅙])$/);
  if (mixedUni) return Number(mixedUni[1]) + UNICODE_FRACTIONS[mixedUni[2]];
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) return Number(t);
  return null;
}

// Reads the amount at the start of a line: "1 1/2", "1½", "2-3" (takes the high end), "0.5".
function readQuantity(s) {
  const re = /^\s*(\d+\s+\d+\/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅙]|[¼½¾⅓⅔⅛⅜⅝⅞⅕⅙]|\d+\/\d+|\d*\.\d+|\d+)(\s*(?:-|–|to)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+))?/i;
  const m = s.match(re);
  if (!m) return { quantity: null, rest: s.trim() };
  const parseOne = (tok) => {
    const t = tok.replace(/\s+/g, ' ').trim();
    const mixed = t.match(/^(\d+)\s+(\d+\/\d+)$/);
    if (mixed) return Number(mixed[1]) + parseNumberToken(mixed[2]);
    const mixedU = t.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕⅙])$/);
    if (mixedU) return Number(mixedU[1]) + UNICODE_FRACTIONS[mixedU[2]];
    return parseNumberToken(t);
  };
  const low = parseOne(m[1]);
  const high = m[3] ? parseOne(m[3]) : null;
  return { quantity: high != null ? high : low, rest: s.slice(m[0].length).trim() };
}

export function parseIngredient(line) {
  const raw = String(line || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  let s = raw.replace(/^[-•*▢☐]\s*/, '');
  const { quantity, rest } = readQuantity(s);
  s = rest;
  // "(14 oz) can tomatoes" or "(14-ounce) can": keep the size as a note
  let sizeNote = '';
  const paren = s.match(/^\(([^)]*)\)\s*/);
  if (paren && quantity != null) { sizeNote = paren[1]; s = s.slice(paren[0].length); }
  let unit = null;
  const words = s.split(' ');
  for (const take of [2, 1]) {
    if (words.length < take) continue;
    const cand = words.slice(0, take).join(' ').replace(/\.$/, '');
    const hit = UNIT_LOOKUP[cand] || UNIT_LOOKUP[cand.toLowerCase()];
    // single letters only count right after a number ("2 T butter")
    if (hit && (cand.length > 1 || quantity != null) && words.length > take) {
      unit = hit; s = words.slice(take).join(' '); break;
    }
  }
  s = s.replace(/^of\s+/i, '');
  let item = s, note = '';
  const comma = s.indexOf(',');
  if (comma > 0) { item = s.slice(0, comma); note = s.slice(comma + 1).trim(); }
  const trailingParen = item.match(/\s*\(([^)]*)\)\s*$/);
  if (trailingParen) { note = [trailingParen[1], note].filter(Boolean).join(', '); item = item.slice(0, trailingParen.index); }
  if (sizeNote) note = [sizeNote, note].filter(Boolean).join(', ');
  item = item.trim();
  if (!item) { item = raw; }
  return { quantity, unit, item, note: note || null, raw, aisle: guessAisle(item) };
}

// ---------- item keys and aisles ----------
const KEEP_S = new Set(['asparagus', 'hummus', 'couscous', 'swiss', 'molasses', 'grits', 'oats', 'brussels sprouts', 'chickpeas', 'lentils', 'peas', 'greens', 'noodles']);
export function itemKey(item) {
  let k = String(item || '').toLowerCase()
    .replace(/\b(fresh|large|small|medium|extra[- ]virgin|boneless|skinless|chopped|diced|minced|sliced|shredded|grated|ground black|freshly|finely|roughly|thinly|optional|to taste|about|organic)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!k) k = String(item || '').toLowerCase().trim();
  if (KEEP_S.has(k)) return k;
  if (k.endsWith('ies') && k.length > 4) return k.slice(0, -3) + 'y';
  if (k.endsWith('oes')) return k.slice(0, -2);
  if (k.endsWith('s') && !k.endsWith('ss') && k.length > 3) return k.slice(0, -1);
  return k;
}

export const AISLES = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Bakery', 'Pantry', 'Canned & jarred', 'Spices & oils', 'Frozen', 'Other'];
const AISLE_WORDS = [
  ['Canned & jarred', ['broth', 'stock', 'bouillon']],
  ['Spices & oils', ['salt', 'pepper flakes', 'black pepper', 'cumin', 'paprika', 'oregano', 'chili powder', 'cinnamon', 'garlic powder', 'onion powder', 'thyme', 'basil leaves dried', 'bay leaf', 'bay leaves', 'curry powder', 'garam masala', 'turmeric', 'cayenne', 'nutmeg', 'italian seasoning', 'seasoning', 'olive oil', 'vegetable oil', 'canola oil', 'sesame oil', 'oil', 'vinegar', 'cooking spray', 'vanilla']],
  ['Meat & seafood', ['chicken', 'beef', 'pork', 'turkey', 'sausage', 'bacon', 'ham', 'steak', 'salmon', 'shrimp', 'fish', 'tuna steak', 'cod', 'tilapia', 'lamb', 'brisket', 'ribs', 'chorizo', 'andouille', 'meatball', 'prosciutto', 'salami', 'pepperoni']],
  ['Dairy & eggs', ['milk', 'cream', 'butter', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'yogurt', 'sour cream', 'egg', 'half and half', 'ricotta', 'cottage', 'oaxaca', 'colby', 'monterey']],
  ['Produce', ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery', 'pepper', 'jalapeño', 'jalapeno', 'lettuce', 'romaine', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'zucchini', 'squash', 'cucumber', 'avocado', 'lime', 'lemon', 'cilantro', 'parsley', 'basil', 'mint', 'ginger', 'scallion', 'green onion', 'shallot', 'mushroom', 'corn on the cob', 'apple', 'banana', 'berries', 'strawberr', 'okra', 'green bean', 'asparagus', 'brussels', 'sweet potato', 'beet', 'arugula', 'jicama', 'herbs']],
  ['Bakery', ['bread', 'bun', 'tortilla', 'pita', 'naan', 'roll', 'baguette', 'bagel', 'croissant']],
  ['Frozen', ['frozen', 'ice cream']],
  ['Canned & jarred', ['canned', 'can ', 'broth', 'stock', 'tomato sauce', 'tomato paste', 'diced tomatoes', 'crushed tomatoes', 'beans', 'chickpeas', 'salsa', 'enchilada sauce', 'coconut milk', 'olives', 'pickles', 'soup', 'artichoke', 'roasted red pepper', 'marinara', 'pesto', 'ro*tel', 'rotel']],
  ['Pantry', ['rice', 'pasta', 'spaghetti', 'noodle', 'flour', 'sugar', 'brown sugar', 'honey', 'maple', 'soy sauce', 'teriyaki', 'hoisin', 'sriracha', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'breadcrumbs', 'panko', 'oats', 'quinoa', 'lentils', 'peanut butter', 'cornstarch', 'baking', 'chips', 'crackers', 'orzo', 'couscous', 'grits', 'sauce', 'dressing', 'cornmeal', 'yeast']],
];
export function guessAisle(item) {
  const s = ' ' + String(item || '').toLowerCase() + ' ';
  for (const [aisle, words] of AISLE_WORDS) for (const w of words) if (s.includes(w)) return aisle;
  return 'Other';
}

// ---------- quantities ----------
const NICE_FRACTIONS = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞']];
export function formatQty(n) {
  if (n == null || isNaN(n)) return '';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.06) return String(whole);
  if (frac > 0.94) return String(whole + 1);
  let best = NICE_FRACTIONS[0];
  for (const f of NICE_FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (Math.abs(best[0] - frac) < 0.04) return (whole ? whole + ' ' : '') + best[1];
  return String(Math.round(n * 100) / 100);
}

// Small conversions so "1 tbsp" + "1 tsp" or "8 oz" + "1 lb" combine.
const TO_BASE = { tsp: ['vol', 1], tbsp: ['vol', 3], cup: ['vol', 48], 'fl oz': ['vol', 6], pint: ['vol', 96], quart: ['vol', 192], ml: ['vol', 0.2029], l: ['vol', 202.9], oz: ['wt', 1], lb: ['wt', 16], g: ['wt', 0.03527], kg: ['wt', 35.27] };
function combineAmounts(amounts) {
  // amounts: [{quantity, unit}] -> merged list
  const byUnit = new Map();
  let countless = 0;
  for (const a of amounts) {
    if (a.quantity == null) { countless++; continue; }
    const base = TO_BASE[a.unit || ''];
    const key = base ? base[0] + ':' + (a.unit === 'g' || a.unit === 'kg' ? 'metric' : a.unit === 'ml' || a.unit === 'l' ? 'metric' : 'us') : 'u:' + (a.unit || '');
    const cur = byUnit.get(key) || { total: 0, units: new Set(), base };
    cur.total += base ? a.quantity * base[1] : a.quantity;
    cur.units.add(a.unit || '');
    byUnit.set(key, cur);
  }
  const out = [];
  for (const [key, v] of byUnit) {
    if (!v.base || v.units.size === 1) {
      const unit = [...v.units][0] || null;
      out.push({ quantity: v.base ? v.total / TO_BASE[unit][1] : v.total, unit });
    } else {
      // pick the largest unit that keeps the number >= 1
      const kind = key.split(':')[0];
      const candidates = [...v.units].sort((a, b) => TO_BASE[b][1] - TO_BASE[a][1]);
      const unit = candidates.find((u) => v.total / TO_BASE[u][1] >= 1) || candidates[candidates.length - 1];
      out.push({ quantity: v.total / TO_BASE[unit][1], unit, kind });
    }
  }
  return { amounts: out, countless };
}

function amountText(a) {
  const q = formatQty(a.quantity);
  if (!a.unit) return q;
  const plural = a.quantity > 1 && ['cup', 'can', 'jar', 'package', 'bunch', 'head', 'slice', 'stalk', 'sprig', 'bag', 'box', 'stick', 'clove', 'pint', 'quart', 'pinch', 'dash'].includes(a.unit);
  const u = plural ? (a.unit === 'box' || a.unit === 'bunch' || a.unit === 'pinch' || a.unit === 'dash' ? a.unit + 'es' : a.unit + 's') : a.unit;
  return `${q} ${u}`;
}

// entries: [{ recipeName, ingredients: [{quantity, unit, item, aisle}] }]
// returns [{ aisle, items: [{ key, name, amount, recipes }] }] in store order
export function buildShoppingList(entries) {
  const map = new Map();
  for (const e of entries) {
    for (const ing of e.ingredients || []) {
      if (!ing || !ing.item) continue;
      const key = itemKey(ing.item);
      const cur = map.get(key) || { key, name: ing.item.trim(), aisle: ing.aisle || guessAisle(ing.item), amounts: [], recipes: [] };
      cur.amounts.push({ quantity: ing.quantity == null ? null : Number(ing.quantity), unit: ing.unit || null });
      if (!cur.recipes.includes(e.recipeName)) cur.recipes.push(e.recipeName);
      if (ing.item.trim().length < cur.name.length) cur.name = ing.item.trim();
      map.set(key, cur);
    }
  }
  const groups = new Map(AISLES.map((a) => [a, []]));
  for (const it of map.values()) {
    const { amounts } = combineAmounts(it.amounts);
    const amount = amounts.map(amountText).filter(Boolean).join(' + ');
    const aisle = groups.has(it.aisle) ? it.aisle : 'Other';
    groups.get(aisle).push({ key: it.key, name: it.name, amount, recipes: it.recipes });
  }
  return [...groups].filter(([, items]) => items.length)
    .map(([aisle, items]) => ({ aisle, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export function shoppingText(groups, extras = [], checkedKeys = new Set(), title = 'Shopping list') {
  const lines = [title, ''];
  for (const g of groups) {
    const open = g.items.filter((i) => !checkedKeys.has(i.key));
    if (!open.length) continue;
    lines.push(g.aisle);
    for (const i of open) lines.push(`- ${i.amount ? i.amount + ' ' : ''}${i.name}`);
    lines.push('');
  }
  const ex = extras.filter((e) => !e.checked);
  if (ex.length) { lines.push('Extras'); for (const e of ex) lines.push(`- ${e.text}`); lines.push(''); }
  return lines.join('\n').trim() + '\n';
}

// ---------- filters, rules and random picks ----------
export function blankFilter() { return { cuisine: [], protein: [], meal_type: [], healthy: false }; }
export function activeCount(f) { return f.cuisine.length + f.protein.length + f.meal_type.length + (f.healthy ? 1 : 0); }
export function passes(r, f) {
  if (!f) return true;
  return (!f.cuisine.length || f.cuisine.includes(r.cuisine)) && (!f.protein.length || f.protein.includes(r.protein)) &&
    (!f.meal_type.length || f.meal_type.includes(r.meal_type)) && (!f.healthy || r.healthy === true);
}
export function ruleToFilter(rule) {
  if (!rule || rule.action !== 'filter') return null;
  return { cuisine: rule.cuisines || [], protein: rule.proteins || [], meal_type: rule.meal_types || [], healthy: !!rule.healthy_only };
}
export function ruleSummary(rule) {
  if (!rule) return 'Anything';
  if (isOffKind(rule.action)) return OFF_KINDS[rule.action].label;
  const parts = [].concat(rule.cuisines || [], rule.proteins || [], rule.meal_types || []);
  if (rule.healthy_only) parts.push('Healthy');
  return parts.length ? parts.join(', ') : 'Anything';
}

// Pick a dinner for one day.
// Layers, strictest first: day rule + dice filter + not made recently; relax recency, then the dice filter,
// then the rule, so the dice always lands on something when anything is possible.
export function pickRecipe({ recipes, usedIds = [], diceFilter, rule, lastMade = {}, refDay, skipDays = 14, rng = Math.random }) {
  const used = new Set(usedIds);
  const ruleF = ruleToFilter(rule);
  const wantsBreakfast = (f) => f && f.meal_type.includes('Breakfast');
  const base = recipes.filter((r) => !used.has(r.id));
  const okType = (r, f1, f2) => r.meal_type !== 'Breakfast' || wantsBreakfast(f1) || wantsBreakfast(f2);
  const fresh = (r) => { const l = lastMade[r.id]; return !l || !refDay || daysBetween(l, refDay) > skipDays; };
  const layers = [
    (r) => okType(r, ruleF, diceFilter) && passes(r, ruleF) && passes(r, diceFilter) && fresh(r),
    (r) => okType(r, ruleF, diceFilter) && passes(r, ruleF) && passes(r, diceFilter),
    (r) => okType(r, ruleF) && passes(r, ruleF) && fresh(r),
    (r) => okType(r, ruleF) && passes(r, ruleF),
    (r) => okType(r, diceFilter) && passes(r, diceFilter),
    (r) => okType(r),
  ];
  for (const test of layers) {
    const pool = base.filter(test);
    if (pool.length) return pool[Math.floor(rng() * pool.length)];
  }
  return null;
}

// Times made and last-made date per recipe, from plan days up to today.
export function recipeStats(planDays, today) {
  const stats = {};
  for (const d of planDays) {
    if (d.kind !== 'recipe' || !d.recipe_id || d.day > today) continue;
    const s = stats[d.recipe_id] || (stats[d.recipe_id] = { times: 0, last: null });
    s.times++;
    if (!s.last || d.day > s.last) s.last = d.day;
  }
  return stats;
}

export function agoText(last, today) {
  if (!last) return 'Not made yet';
  const n = daysBetween(last, today);
  if (n < 0) return 'Planned for ' + nice(last);
  if (n === 0) return 'Made today';
  if (n === 1) return 'Made yesterday';
  if (n < 14) return `Made ${n} days ago`;
  if (n < 60) return `Made ${Math.round(n / 7)} weeks ago`;
  return 'Last made ' + nice(last) + (last.slice(0, 4) !== today.slice(0, 4) ? ', ' + last.slice(0, 4) : '');
}
