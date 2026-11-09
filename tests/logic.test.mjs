// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIngredient, itemKey, guessAisle, formatQty, buildShoppingList, shoppingText,
  weekOf, addDays, dow, pickRecipe, passes, blankFilter, recipeStats, agoText, ruleSummary,
} from '../web/logic.js';

test('parses common ingredient lines', () => {
  const cases = [
    ['2 cups all-purpose flour', 2, 'cup', 'all-purpose flour'],
    ['1 1/2 lb ground turkey', 1.5, 'lb', 'ground turkey'],
    ['1½ tsp salt', 1.5, 'tsp', 'salt'],
    ['½ cup sour cream', 0.5, 'cup', 'sour cream'],
    ['3 cloves garlic, minced', 3, 'clove', 'garlic'],
    ['1 (14.5 oz) can diced tomatoes', 1, 'can', 'diced tomatoes'],
    ['2-3 tablespoons olive oil', 3, 'tbsp', 'olive oil'],
    ['1 onion, diced', 1, null, 'onion'],
    ['Salt and pepper to taste', null, null, 'Salt and pepper to taste'],
    ['2 T butter', 2, 'tbsp', 'butter'],
    ['8 ounces shredded cheddar cheese', 8, 'oz', 'shredded cheddar cheese'],
    ['1 pound boneless skinless chicken thighs (about 6)', 1, 'lb', 'boneless skinless chicken thighs'],
  ];
  for (const [line, q, u, item] of cases) {
    const p = parseIngredient(line);
    assert.equal(p.quantity, q, line);
    assert.equal(p.unit, u, line);
    assert.equal(p.item, item, line);
  }
  assert.equal(parseIngredient('1 (14.5 oz) can diced tomatoes').note, '14.5 oz');
  assert.equal(parseIngredient('3 cloves garlic, minced').note, 'minced');
  assert.equal(parseIngredient(''), null);
});

test('item keys merge plurals and prep words', () => {
  assert.equal(itemKey('Onions'), itemKey('onion'));
  assert.equal(itemKey('diced onion'), 'onion');
  assert.equal(itemKey('Tomatoes'), 'tomato');
  assert.equal(itemKey('cherries'), 'cherry');
  assert.equal(itemKey('Brussels sprouts'), 'brussels sprouts');
});

test('aisle guesses', () => {
  assert.equal(guessAisle('yellow onion'), 'Produce');
  assert.equal(guessAisle('chicken thighs'), 'Meat & seafood');
  assert.equal(guessAisle('shredded cheddar cheese'), 'Dairy & eggs');
  assert.equal(guessAisle('flour tortillas'), 'Bakery');
  assert.equal(guessAisle('long-grain rice'), 'Pantry');
  assert.equal(guessAisle('chicken broth'), 'Canned & jarred');
  assert.equal(guessAisle('green beans'), 'Produce');
  assert.equal(guessAisle('ground cumin'), 'Spices & oils');
});

test('formats quantities as friendly fractions', () => {
  assert.equal(formatQty(1.5), '1 ½');
  assert.equal(formatQty(0.25), '¼');
  assert.equal(formatQty(2), '2');
  assert.equal(formatQty(0.333), '⅓');
  assert.equal(formatQty(1.99), '2');
});

test('shopping list merges across recipes and converts units', () => {
  const groups = buildShoppingList([
    { recipeName: 'Tacos', ingredients: [parseIngredient('1 lb ground turkey'), parseIngredient('1 onion, diced'), parseIngredient('1 tbsp chili powder')] },
    { recipeName: 'Chili', ingredients: [parseIngredient('8 oz ground turkey'), parseIngredient('2 onions'), parseIngredient('1 tsp chili powder')] },
  ]);
  const flat = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.key, i])));
  assert.equal(flat['ground turkey'].amount, '1 ½ lb');
  assert.equal(flat['onion'].amount, '3');
  assert.deepEqual(flat['onion'].recipes, ['Tacos', 'Chili']);
  assert.equal(flat['chili powder'].amount, '1 ⅓ tbsp');
  assert.equal(groups[0].aisle, 'Produce');
  const txt = shoppingText(groups, [{ text: 'paper towels', checked: false }], new Set(['onion']));
  assert.ok(txt.includes('- 1 ½ lb ground turkey'));
  assert.ok(!txt.includes('onion'));
  assert.ok(txt.includes('- paper towels'));
});

test('weeks start on the chosen day', () => {
  assert.equal(weekOf('2026-11-09', 0), '2026-11-08'); // Monday -> Sunday start
  assert.equal(weekOf('2026-11-09', 1), '2026-11-09'); // Monday start
  assert.equal(weekOf('2026-11-08', 1), '2026-11-02'); // Sunday belongs to previous Monday week
  assert.equal(weekOf('2026-12-25', 1), '2026-12-21');
  assert.equal(dow(addDays('2026-11-08', 2)), 2);
});

const R = [
  { id: 'a', name: 'Taco Bowl', cuisine: 'Mexican', protein: 'Ground Turkey', meal_type: 'Bowl', healthy: true },
  { id: 'b', name: 'Enchiladas', cuisine: 'Mexican', protein: 'Chicken', meal_type: 'Casserole', healthy: false },
  { id: 'c', name: 'Pizza', cuisine: 'Italian', protein: 'Varies', meal_type: 'Pizza', healthy: false },
  { id: 'd', name: 'Migas', cuisine: 'Mexican', protein: 'Vegetarian', meal_type: 'Breakfast', healthy: true },
];

test('picks respect day rules, dice filter, recency and skip breakfast', () => {
  const rule = { action: 'filter', cuisines: ['Mexican'], proteins: [], meal_types: [], healthy_only: false };
  for (let i = 0; i < 30; i++) {
    const r = pickRecipe({ recipes: R, rule });
    assert.ok(['a', 'b'].includes(r.id));
  }
  const healthy = { ...blankFilter(), healthy: true };
  for (let i = 0; i < 20; i++) assert.equal(pickRecipe({ recipes: R, rule, diceFilter: healthy }).id, 'a');
  // recently made is avoided while something else fits
  for (let i = 0; i < 20; i++) assert.equal(pickRecipe({ recipes: R, rule, lastMade: { a: '2026-11-05' }, refDay: '2026-11-09' }).id, 'b');
  // already used this week is skipped; when the rule can't be met, it falls back rather than failing
  const r = pickRecipe({ recipes: R, rule, usedIds: ['a', 'b'] });
  assert.equal(r.id, 'c');
  // breakfast only when asked for
  const bf = { ...blankFilter(), meal_type: ['Breakfast'] };
  assert.equal(pickRecipe({ recipes: R, diceFilter: bf }).id, 'd');
  assert.equal(pickRecipe({ recipes: R, usedIds: ['a', 'b', 'c'] }), null);
});

test('filters and stats', () => {
  assert.ok(passes(R[0], { ...blankFilter(), cuisine: ['Mexican', 'Asian'] }));
  assert.ok(!passes(R[2], { ...blankFilter(), cuisine: ['Mexican'] }));
  const stats = recipeStats([
    { day: '2026-11-01', kind: 'recipe', recipe_id: 'a' },
    { day: '2026-11-04', kind: 'recipe', recipe_id: 'a' },
    { day: '2026-11-20', kind: 'recipe', recipe_id: 'a' }, // future: planned, not made
    { day: '2026-11-03', kind: 'eating_out', recipe_id: null },
  ], '2026-11-09');
  assert.deepEqual(stats.a, { times: 2, last: '2026-11-04' });
  assert.equal(agoText('2026-11-04', '2026-11-09'), 'Made 5 days ago');
  assert.equal(ruleSummary({ action: 'eating_out' }), 'Eating out');
  assert.equal(ruleSummary({ action: 'filter', cuisines: ['Mexican'], proteins: [], meal_types: ['Bowl'] }), 'Mexican, Bowl');
});
