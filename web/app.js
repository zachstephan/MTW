// Meal Tracker Week: screens and interactions. Data calls go through api.js, rules and math through logic.js.
import * as L from './logic.js';
import { createApi } from './api.js';

// ---------- icons ----------
const DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="#22301E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.3" fill="#22301E"/><circle cx="15" cy="15" r="1.3" fill="#22301E"/><circle cx="12" cy="12" r="1.3" fill="#22301E"/></svg>';
const LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ---------- state ----------
const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');
const S = {
  api: null, session: null, household: null,
  recipes: [], plan: new Map(), rules: new Map(), hidden: new Set(), isAdmin: false, stats: {},
  today: L.localToday(), tab: 'week', weekStart: null,
  f: { dice: L.blankFilter(), surprise: L.blankFilter(), recipes: L.blankFilter(), rule: L.blankFilter() },
  showRecipeFilters: false, showHidden: false, pick: null, query: '',
  shop: { weekStart: null, checks: new Set(), extras: [], loadedFor: null },
  ruleDraft: null, authMode: 'signin', authMsg: null,
};

// ---------- small helpers ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const k = (s) => String(s || '').trim().toLowerCase();
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
const byId = (id) => S.recipes.find((r) => r.id === id) || null;
const startDay = () => (S.household ? S.household.week_start_day : 0);
const dayName = (iso) => L.DAYS[L.dow(iso)];
const weekDays = (start) => Array.from({ length: 7 }, (_, i) => L.addDays(start, i));
function visibleRecipes(includeHidden = false) {
  return S.recipes.filter((r) => includeHidden || !(r.library && S.hidden.has(r.id)));
}
function recalc() { S.stats = L.recipeStats([...S.plan.values()], S.today); }
function lastMade() { const o = {}; for (const [id, s] of Object.entries(S.stats)) o[id] = s.last; return o; }
function tagLine(r) {
  if (!r) return '';
  const bits = [r.cuisine, r.protein && r.protein !== 'Varies' ? r.protein : '', r.meal_type].filter(Boolean);
  if (r.healthy === true) bits.push('Healthy');
  return bits.join(', ');
}
function uniq(field) {
  const set = new Set();
  for (const r of visibleRecipes()) if (r[field]) set.add(r[field]);
  return [...set].sort();
}
function dayEntry(iso) {
  const p = S.plan.get(iso);
  if (!p) return { kind: null };
  const r = p.recipe_id ? byId(p.recipe_id) : null;
  return { ...p, recipe: r, name: r ? r.name : p.label };
}

// ---------- boot ----------
async function boot() {
  try {
    S.api = window.__MTW_API__ || (await createApi());
  } catch (e) {
    app.innerHTML = `<div class="loading">${esc(e.message)}</div>`;
    return;
  }
  S.api.onAuthChange((session, event) => {
    if (event === 'INITIAL_SESSION') return; // boot() handles the first load
    const was = S.session;
    S.session = session;
    if (event === 'PASSWORD_RECOVERY') { if (!S.household) loadHousehold().then(newPasswordSheet); else newPasswordSheet(); return; }
    if (!was && session) loadHousehold();
    if (was && !session) { S.household = null; renderAuth(); }
  });
  try {
    S.session = await S.api.session();
  } catch (e) { S.session = null; }
  if (S.session) await loadHousehold(); else renderAuth();
}

async function loadHousehold() {
  app.innerHTML = '<div class="loading">Opening your kitchen…</div>';
  try {
    S.household = await S.api.myHousehold();
    if (!S.household) { tabsEl.classList.add('hidden'); renderOnboarding(); return; }
    await loadData();
    S.weekStart = L.weekOf(S.today, startDay());
    tabsEl.classList.remove('hidden');
    render();
  } catch (e) {
    app.innerHTML = `<div class="loading">${esc(e.message)}<br><br><button class="btn soft" data-act="retry">Try again</button></div>`;
  }
}

async function loadData() {
  const d = await S.api.loadAll(S.household.id);
  S.recipes = d.recipes;
  S.plan = new Map(d.plan.map((p) => [p.day, p]));
  S.rules = new Map(d.rules.map((r) => [r.weekday, r]));
  S.hidden = new Set(d.hidden);
  S.isAdmin = d.isAdmin;
  recalc();
}

// ---------- sign in ----------
function renderAuth() {
  tabsEl.classList.add('hidden');
  const m = S.authMode;
  const title = m === 'signup' ? 'Create your account' : m === 'reset' ? 'Reset your password' : 'Sign in';
  app.innerHTML = `<div class="welcome"><h1>What’s for dinner?</h1>
    <p class="lead">Plan the week in a few taps, roll the dice when you’re stuck, and get the shopping list made for you.</p>
    <form class="card" id="authForm" novalidate>
      <h2>${title}</h2>
      ${S.authMsg ? `<p class="${S.authMsg.ok ? 'ok' : 'err'}">${esc(S.authMsg.text)}</p>` : ''}
      <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" inputmode="email" required></div>
      ${m !== 'reset' ? `<div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required>${m === 'signup' ? '<div class="help" style="margin-top:6px">At least 6 characters.</div>' : ''}</div>` : ''}
      <button class="btn primary wide" type="submit">${m === 'signup' ? 'Create account' : m === 'reset' ? 'Email me a reset link' : 'Sign in'}</button>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:6px">
        ${m !== 'signin' ? '<button type="button" class="textlink" data-act="authmode" data-m="signin">I have an account</button>' : '<button type="button" class="textlink" data-act="authmode" data-m="signup">Create an account</button>'}
        ${m === 'signin' ? '<button type="button" class="textlink" data-act="authmode" data-m="reset">Forgot password?</button>' : ''}
      </div>
    </form></div>`;
  const form = document.getElementById('authForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#email').value.trim();
    const pw = form.querySelector('#pw') ? form.querySelector('#pw').value : '';
    const btn = form.querySelector('button[type=submit]');
    if (!email) { S.authMsg = { text: 'Enter your email.' }; return renderAuth(); }
    btn.disabled = true; btn.textContent = 'One moment…';
    try {
      if (m === 'signin') { await S.api.signIn(email, pw); S.authMsg = null; return; }
      if (m === 'signup') {
        const res = await S.api.signUp(email, pw);
        if (res && res.session) { S.authMsg = null; return; }
        S.authMode = 'signin'; S.authMsg = { ok: true, text: 'Check your email and tap the link to confirm your account. Then sign in here.' };
      } else {
        await S.api.resetPassword(email);
        S.authMode = 'signin'; S.authMsg = { ok: true, text: 'If that email has an account, a reset link is on its way.' };
      }
    } catch (err) { S.authMsg = { text: err.message }; }
    renderAuth();
  });
}

function newPasswordSheet() {
  openSheet(`<h2>Choose a new password</h2><p class="err hidden" id="npErr"></p>
    <div class="field"><label for="np">New password</label><input id="np" type="password" autocomplete="new-password" minlength="6"></div>
    <button class="btn primary wide" id="npSave">Save password</button>`, (s) => {
    s.querySelector('#npSave').addEventListener('click', async () => {
      const v = s.querySelector('#np').value, err = s.querySelector('#npErr');
      try { await S.api.updatePassword(v); closeSheet(); toast('Password saved'); } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    });
  });
}

// ---------- first-time setup ----------
function renderOnboarding() {
  app.innerHTML = `<div class="welcome"><h1>Set up your kitchen</h1>
    <p class="lead">Everyone in a household shares the same recipes, week plan and shopping list.</p>
    <div class="card"><h2>Start a new household</h2><p class="err hidden" id="cErr"></p>
      <div class="field"><label for="hname">Household name</label><input id="hname" placeholder="The Stephans" autocomplete="off"></div>
      <button class="btn primary wide" id="createH">Start household</button></div>
    <div class="card"><h2>Join your partner’s</h2><p class="err hidden" id="jErr"></p>
      <div class="field"><label for="hcode">Invite code</label><div class="help">They’ll find it in Settings, under “Share with your household”.</div><input id="hcode" placeholder="6 letters" autocomplete="off" autocapitalize="characters" maxlength="6" style="text-transform:uppercase;letter-spacing:.15em"></div>
      <button class="btn soft wide" id="joinH">Join household</button></div>
    <button class="textlink" data-act="signout">Sign out</button></div>`;
  const run = async (btn, errEl, fn) => {
    btn.disabled = true;
    try { await fn(); await loadHousehold(); } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); btn.disabled = false; }
  };
  document.getElementById('createH').addEventListener('click', (e) => run(e.currentTarget, document.getElementById('cErr'), () => S.api.createHousehold(document.getElementById('hname').value)));
  document.getElementById('joinH').addEventListener('click', (e) => run(e.currentTarget, document.getElementById('jErr'), () => S.api.joinHousehold(document.getElementById('hcode').value)));
}

// ---------- main render ----------
function render(opts = {}) {
  tabsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === S.tab ? 'true' : 'false'));
  if (S.tab === 'week') renderWeek(opts.swapped);
  else if (S.tab === 'surprise') renderSurprise();
  else if (S.tab === 'recipes') renderRecipes();
  else renderShopping();
}

// ---------- Week ----------
function weekLabel(start) {
  const thisWeek = L.weekOf(S.today, startDay());
  if (start === thisWeek) return 'This week';
  if (start === L.addDays(thisWeek, 7)) return 'Next week';
  if (start === L.addDays(thisWeek, -7)) return 'Last week';
  return 'Week of ' + L.nice(start);
}

function renderWeek(swapped) {
  const days = weekDays(S.weekStart);
  const empty = days.filter((d) => !S.plan.has(d)).length;
  const cooking = days.filter((d) => !L.isOffKind((S.plan.get(d) || {}).kind)).length;
  const diceOn = L.activeCount(S.f.dice);
  let html = `<div class="top"><div><h1>${weekLabel(S.weekStart)}</h1><div class="sub">${L.nice(days[0])} to ${L.nice(days[6])}</div></div>
    <div class="weeknav"><button class="round" data-act="prev" aria-label="Previous week">${LEFT}</button><button class="round" data-act="next" aria-label="Next week">${RIGHT}</button><button class="round" data-act="settings" aria-label="Settings">${GEAR}</button></div></div>
    <button class="pickfrom${diceOn ? ' on' : ''}" data-act="dicefilter"><span style="min-width:0"><span class="lbl">Dice picks from</span><span class="val">${esc(filterSummary(S.f.dice))}</span></span><span class="chev">${diceOn ? 'Change' : 'Filter'}</span></button>
    <div class="days">`;
  for (const d of days) {
    const e = dayEntry(d), off = L.isOffKind(e.kind), rule = S.rules.get(L.dow(d));
    const cls = ['day', e.kind ? '' : 'empty', off ? 'off' : '', d === S.today ? 'today' : '', swapped === d ? 'swapped' : ''].filter(Boolean).join(' ');
    let body;
    if (off) body = `<span class="name">${L.OFF_KINDS[e.kind].label}</span><span class="tags">${esc(e.note || L.OFF_KINDS[e.kind].hint)}</span>`;
    else if (e.kind) body = `<span class="name">${esc(e.name || 'Dinner')}</span><span class="tags">${esc(tagLine(e.recipe))}</span>`;
    else body = `<span class="hint">Tap to choose</span>${rule ? `<span class="rulehint">${esc(dayName(d))}s: ${esc(L.ruleSummary(rule))}</span>` : ''}`;
    html += `<div class="${cls}"><div class="date"><span class="dow">${dayName(d).slice(0, 3)}</span><span class="num">${Number(d.slice(8))}</span></div>
      <button class="what" data-act="day" data-d="${d}">${body}</button>
      <button class="dice" data-act="roll" data-d="${d}" aria-label="Pick a random dinner for ${dayName(d)}">${DICE}</button></div>`;
  }
  html += `</div><div class="actions">${empty
    ? `<button class="btn primary" data-act="fill">Fill ${empty === 7 ? 'the week' : empty === 1 ? 'the empty day' : `the ${empty} empty days`}</button>`
    : '<button class="btn soft" data-act="clearall">Clear the week</button>'}
    <button class="btn soft" data-act="shuffle"${cooking ? '' : ' disabled'}>Shuffle</button></div>`;
  app.innerHTML = html;
}

function usedIdsInWeek(exceptDay) {
  return weekDays(S.weekStart).filter((d) => d !== exceptDay).map((d) => (S.plan.get(d) || {}).recipe_id).filter(Boolean);
}

function pickFor(day, extraUsed = []) {
  return L.pickRecipe({
    recipes: visibleRecipes(), usedIds: usedIdsInWeek(day).concat(extraUsed), diceFilter: S.f.dice,
    rule: S.rules.get(L.dow(day)), lastMade: lastMade(), refDay: S.weekStart,
  });
}

// Apply changes locally, show them, then save. On failure, reload from the server.
async function changeDays(changes, swappedDay) {
  for (const c of changes) {
    if (c.clear) S.plan.delete(c.day);
    else S.plan.set(c.day, { ...(S.plan.get(c.day) || {}), ...c, household_id: S.household.id });
  }
  recalc();
  render({ swapped: swappedDay });
  try {
    const saves = changes.filter((c) => !c.clear), clears = changes.filter((c) => c.clear).map((c) => c.day);
    const saved = await S.api.saveDays(S.household.id, saves);
    for (const row of saved || []) S.plan.set(row.day, row);
    await S.api.clearDays(S.household.id, clears);
  } catch (e) {
    toast(e.message || 'Couldn’t save. Check your connection.');
    try { await loadData(); render(); } catch (_) { /* leave as is */ }
  }
}
const recipeChange = (day, r) => ({ day, kind: 'recipe', recipe_id: r.id, label: r.name, note: null });

function dayMenu(day) {
  const e = dayEntry(day);
  openSheet(`<h2>${dayName(day)}, ${L.nice(day)}</h2><div class="meta">${e.kind ? esc(L.isOffKind(e.kind) ? L.OFF_KINDS[e.kind].label : e.name) : 'Nothing planned yet'}</div>
    <div class="menu">
      <button class="btn primary" data-act="choose" data-d="${day}">Choose from our recipes</button>
      <button class="btn soft" data-act="rollclose" data-d="${day}">Pick one at random</button>
      ${e.recipe ? `<button class="btn soft" data-act="details" data-id="${e.recipe.id}">See recipe</button>` : ''}
      <h3>Not cooking?</h3><div class="offgrid">
      ${Object.entries(L.OFF_KINDS).map(([kind, o]) => `<button class="btn" data-act="${kind === 'eating_out' ? 'eatout' : 'setoff'}" data-d="${day}" data-kind="${kind}" aria-pressed="${e.kind === kind}">${o.label}</button>`).join('')}
      </div>
      ${e.kind ? `<button class="btn soft" data-act="clearday" data-d="${day}" style="margin-top:6px">Clear this day</button>` : ''}
    </div>`);
}

function eatOutSheet(day) {
  const e = dayEntry(day);
  openSheet(`<h2>Eating out</h2><div class="meta">${dayName(day)}, ${L.nice(day)}</div>
    <div class="field"><label for="where">Where? (optional)</label><input id="where" value="${esc(e.kind === 'eating_out' ? e.note || '' : '')}" placeholder="Restaurant, a friend’s house…" autocomplete="off"></div>
    <button class="btn primary wide" data-act="seteatout" data-d="${day}">Set ${dayName(day)} as eating out</button>`, (s) => {
    s.querySelector('#where').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') s.querySelector('[data-act=seteatout]').click(); });
  });
}

function chooser(day) {
  openSheet(`<h2>${dayName(day)}</h2><div class="meta">Type to search, or add something new.</div>
    <div class="field"><input type="search" id="pq" placeholder="Search recipes" aria-label="Search recipes"></div><div class="pick-list" id="pl"></div>`, (s) => {
    const input = s.querySelector('#pq'), pl = s.querySelector('#pl');
    const draw = () => {
      const q = k(input.value);
      const list = visibleRecipes().slice().sort((a, b) => a.name.localeCompare(b.name)).filter((r) => !q || k(r.name).includes(q)).slice(0, 80);
      const exact = list.some((r) => k(r.name) === q);
      let out = list.map((r) => `<button class="item" data-act="setday" data-d="${day}" data-id="${r.id}"><span><span class="name">${esc(r.name)}${r.library ? '<span class="badge">Starter</span>' : ''}</span><span class="tags">${esc(L.agoText((S.stats[r.id] || {}).last, S.today))}</span></span></button>`).join('');
      if (q && !exact) out += `<button class="item" data-act="newforday" data-d="${day}" data-name="${esc(input.value.trim())}"><span><span class="name">Add “${esc(input.value.trim())}” as a new recipe</span><span class="tags">You can fill in the details now or later</span></span></button>`;
      pl.innerHTML = out || '<div class="item">No recipes yet. Type a name to add one.</div>';
    };
    input.addEventListener('input', draw); draw();
  });
}

// ---------- filters ----------
function filterSummary(f) {
  const parts = [].concat(f.cuisine, f.protein, f.meal_type);
  if (f.healthy) parts.push('Healthy only');
  return parts.length ? parts.join(', ') : 'All recipes';
}
function chipRow(ctx, title, field, values) {
  const cur = S.f[ctx][field];
  return `<div class="fgroup"><h3>${title}</h3><div class="chips" data-row="${field}">
    <button class="chip" data-act="filter" data-ctx="${ctx}" data-f="${field}" data-v="" aria-pressed="${!cur.length}">Any</button>
    ${values.map((v) => `<button class="chip" data-act="filter" data-ctx="${ctx}" data-f="${field}" data-v="${esc(v)}" aria-pressed="${cur.includes(v)}">${esc(v)}</button>`).join('')}</div></div>`;
}
function filterPanel(ctx, cls = '') {
  return `<div class="filters ${cls}" id="fp-${ctx}">${chipRow(ctx, 'Cuisine', 'cuisine', uniq('cuisine'))}${chipRow(ctx, 'Protein', 'protein', uniq('protein'))}${chipRow(ctx, 'Kind of meal', 'meal_type', uniq('meal_type'))}
    <div class="toggle-row"><span>Healthy only</span><button class="switch" role="switch" data-act="healthy" data-ctx="${ctx}" aria-checked="${S.f[ctx].healthy}" aria-label="Healthy only"></button></div></div>`;
}
function toggleFilter(ctx, field, v) {
  const list = S.f[ctx][field];
  if (!v) { S.f[ctx][field] = []; return; }
  const at = list.indexOf(v);
  if (at > -1) list.splice(at, 1); else list.push(v);
}
function keepChipScroll(fn) {
  const pos = {};
  document.querySelectorAll('.chips[data-row]').forEach((c) => { pos[c.closest('.filters').id + c.dataset.row] = c.scrollLeft; });
  const sheet = document.querySelector('.sheet'), top = sheet ? sheet.scrollTop : 0;
  fn();
  const sheet2 = document.querySelector('.sheet');
  if (sheet2) { sheet2.style.animation = 'none'; sheet2.scrollTop = top; }
  document.querySelectorAll('.chips[data-row]').forEach((c) => { const v = pos[c.closest('.filters').id + c.dataset.row]; if (v) c.scrollLeft = v; });
}
function diceFilterSheet() {
  const n = visibleRecipes().filter((r) => L.passes(r, S.f.dice) && (r.meal_type !== 'Breakfast' || S.f.dice.meal_type.includes('Breakfast'))).length;
  openSheet(`<h2>What should the dice pick from?</h2><div class="meta">${n} ${n === 1 ? 'recipe matches' : 'recipes match'}. Day rules in Settings still apply. Breakfast is left out unless you choose it.</div>
    ${filterPanel('dice', 'flat')}
    <div class="menu"><button class="btn primary" data-act="closesheet">Done</button>${L.activeCount(S.f.dice) ? '<button class="btn soft" data-act="clearfilters" data-ctx="dice">Pick from all recipes</button>' : ''}</div>`);
}

// ---------- Surprise ----------
function surpriseMatches() { return visibleRecipes().filter((r) => L.passes(r, S.f.surprise)); }
function renderSurprise() {
  const m = surpriseMatches();
  let html = `<div class="top"><div><h1>Surprise me</h1><div class="sub">Tap what you’re in the mood for. You can pick more than one in each row.</div></div></div>
    ${filterPanel('surprise')}
    <div class="count">${m.length ? `${m.length} ${m.length === 1 ? 'recipe matches' : 'recipes match'}` : 'Nothing matches. Try setting one of these back to Any.'}</div>
    <button class="btn primary wide" data-act="surprise"${m.length ? '' : ' disabled'}>${S.pick ? 'Try another' : 'Surprise me'}</button>`;
  const r = S.pick ? byId(S.pick) : null;
  if (r) {
    const st = S.stats[r.id] || {};
    html += `<div class="result">${safeUrl(r.image_url) ? `<img class="hero" src="${esc(safeUrl(r.image_url))}" alt="" loading="lazy">` : ''}
      <h2 class="rname">${esc(r.name)}</h2><div class="meta">${esc(tagLine(r) || 'No details yet')}<br>${L.agoText(st.last, S.today)}${st.times ? `, ${st.times} ${st.times === 1 ? 'time' : 'times'} so far` : ''}</div>
      ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ''}
      ${safeUrl(r.link) ? `<a class="linkbtn" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Open the recipe</a>` : ''}
      <div class="row2"><button class="btn primary" data-act="addto" data-id="${r.id}">Add to a day</button><button class="btn soft" data-act="details" data-id="${r.id}">Details</button></div></div>`;
  }
  app.innerHTML = html;
}

function addToDaySheet(id) {
  const r = byId(id);
  if (!r) return;
  const days = weekDays(S.weekStart);
  openSheet(`<h2>Add to which day?</h2><div class="meta">${esc(r.name)}, ${weekLabel(S.weekStart).toLowerCase()}</div><div class="menu">
    ${days.map((d) => { const e = dayEntry(d); const cur = e.kind ? (L.isOffKind(e.kind) ? L.OFF_KINDS[e.kind].label.toLowerCase() : e.name) : ''; return `<button class="btn soft" data-act="setday" data-d="${d}" data-id="${r.id}" data-go="week">${dayName(d)}${cur ? ` (replaces ${esc(cur)})` : ''}</button>`; }).join('')}
    </div>`);
}

// ---------- Recipes ----------
function renderRecipes() {
  const q = k(S.query), rf = S.f.recipes, nOn = L.activeCount(rf);
  const all = visibleRecipes(S.showHidden).slice().sort((a, b) => a.name.localeCompare(b.name));
  const list = all.filter((r) => (!q || k(r.name).includes(q) || k(tagLine(r)).includes(q)) && L.passes(r, rf));
  const hiddenCount = S.recipes.filter((r) => r.library && S.hidden.has(r.id)).length;
  let html = `<div class="top"><div><h1>Recipes</h1><div class="sub">${nOn || q ? `${list.length} of ${all.length} shown` : `${all.length} in your box`}</div></div>
      <button class="btn primary small" data-act="new">Add</button></div>
    <div class="search"><input type="search" id="q" placeholder="Search recipes" value="${esc(S.query)}" aria-label="Search recipes">
      <button class="btn soft filterbtn${nOn || S.showRecipeFilters ? ' on' : ''}" data-act="togglefilters" aria-expanded="${S.showRecipeFilters}">${nOn ? `Filters (${nOn})` : 'Filter'}</button></div>
    ${S.showRecipeFilters ? filterPanel('recipes', 'inpage') + (nOn ? '<button class="btn soft wide" data-act="clearfilters" data-ctx="recipes" style="margin:-4px 0 14px">Clear filters</button>' : '') : ''}`;
  if (!list.length) {
    html += nOn && !q
      ? '<div class="list"><div class="item" style="display:block">No recipes match these filters.<div style="margin-top:12px"><button class="btn soft" data-act="clearfilters" data-ctx="recipes">Clear filters</button></div></div></div>'
      : `<div class="list"><div class="item" style="display:block">${q ? `No recipe called “${esc(S.query)}” yet.` : 'No recipes yet.'}<div style="margin-top:12px"><button class="btn primary" data-act="new">Add ${q ? 'it' : 'one'}</button></div></div></div>`;
  } else {
    html += '<div class="list">';
    let letter = '';
    for (const r of list) {
      const L1 = r.name.charAt(0).toUpperCase();
      if (!q && !nOn && L1 !== letter) { letter = L1; html += `<div class="letter" aria-hidden="true">${esc(L1)}</div>`; }
      const st = S.stats[r.id], needs = !r.cuisine || !r.meal_type, isHidden = r.library && S.hidden.has(r.id);
      html += `<button class="item" data-act="details" data-id="${r.id}"><span><span class="name">${esc(r.name)}${r.library ? '<span class="badge">Starter</span>' : ''}</span>
        <span class="tags">${isHidden ? 'Hidden from the dice' : needs ? '<span class="needs">Needs details</span>' : esc(tagLine(r))}</span></span>
        <span class="times">${st && st.times ? st.times + '×' : 'New'}${r.ingredients.length ? '' : '<br><span style="font-size:12px">no ingredients</span>'}</span></button>`;
    }
    html += '</div>';
  }
  if (hiddenCount) html += `<button class="textlink" data-act="togglehidden">${S.showHidden ? 'Hide' : 'Show'} ${hiddenCount} hidden starter ${hiddenCount === 1 ? 'recipe' : 'recipes'}</button>`;
  app.innerHTML = html;
  const input = document.getElementById('q');
  input.addEventListener('input', () => {
    S.query = input.value; const pos = input.selectionStart; renderRecipes();
    const again = document.getElementById('q'); again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
  });
}

function canEdit(r) { return r && (!r.library || S.isAdmin); }

function ingredientLine(g) {
  const amt = [g.quantity != null ? L.formatQty(g.quantity) : '', g.unit || ''].filter(Boolean).join(' ');
  return { amt, text: g.item + (g.note ? `, ${g.note}` : '') };
}

function details(id) {
  const r = byId(id);
  if (!r) return;
  const st = S.stats[r.id] || {}, isHidden = r.library && S.hidden.has(r.id);
  openSheet(`${safeUrl(r.image_url) ? `<img class="hero" src="${esc(safeUrl(r.image_url))}" alt="" loading="lazy">` : ''}
    <h2>${esc(r.name)}${r.library ? '<span class="badge">Starter</span>' : ''}</h2>
    <div class="meta">${esc(tagLine(r) || 'No details yet')}<br>${L.agoText(st.last, S.today)}${st.times ? `, ${st.times} ${st.times === 1 ? 'time' : 'times'} so far` : ''}${r.servings ? `. Serves ${r.servings}` : ''}</div>
    ${r.notes ? `<p style="margin:0 0 12px">${esc(r.notes)}</p>` : ''}
    ${r.ingredients.length ? `<ul class="inglist">${r.ingredients.map((g) => { const l = ingredientLine(g); return `<li>${l.amt ? `<span class="q">${esc(l.amt)}</span> ` : ''}${esc(l.text)}</li>`; }).join('')}</ul>` : ''}
    ${safeUrl(r.link) ? `<a class="linkbtn" style="margin:0 0 6px" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Open the recipe</a>` : ''}
    <div class="menu">
      <button class="btn primary" data-act="addto" data-id="${r.id}">Add to a day</button>
      ${canEdit(r) ? `<button class="btn soft" data-act="edit" data-id="${r.id}">Edit${r.ingredients.length ? '' : ' and add ingredients'}</button>` : ''}
      ${r.library ? `<button class="btn soft" data-act="copy" data-id="${r.id}">Copy to our recipes so we can change it</button>
        <button class="btn soft" data-act="${isHidden ? 'unhide' : 'hide'}" data-id="${r.id}">${isHidden ? 'Let the dice pick it again' : 'Don’t suggest this one'}</button>` : ''}
      ${canEdit(r) ? `<button class="btn danger" data-act="delete" data-id="${r.id}">Delete recipe</button>` : ''}
    </div>`);
}

function selectField(id, label, field, value) {
  const opts = uniq(field);
  if (value && !opts.includes(value)) opts.push(value);
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">Choose one</option>
    ${opts.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}
    <option value="__new">Something else…</option></select><input id="${id}New" class="hidden" style="margin-top:8px" placeholder="Type it here"></div>`;
}

function ingredientsText(list) {
  return list.map((g) => g.raw || [g.quantity != null ? L.formatQty(g.quantity) : '', g.unit || '', g.item + (g.note ? `, ${g.note}` : '')].filter(Boolean).join(' ')).join('\n');
}

// opts: { forDay } to put the new recipe on a day after saving; { prefill } from a link import or a copied starter recipe
function editor(id, opts = {}) {
  const r = id ? byId(id) : { name: opts.name || '', cuisine: '', protein: '', meal_type: '', healthy: null, link: '', notes: '', servings: null, image_url: '', ingredients: [], ...(opts.prefill || {}) };
  const isNew = !id;
  openSheet(`<h2>${isNew ? 'Add a recipe' : 'Edit recipe'}</h2><div class="meta">Only the name is required.</div>
    ${isNew ? `<div class="importbox"><div class="field" style="margin:0"><label for="fUrl">Have a link? Paste it and we’ll fill in what we can.</label>
      <div class="gorow"><input id="fUrl" type="url" inputmode="url" placeholder="https://…" autocomplete="off"><button class="btn primary" id="fImport" type="button">Fill in</button></div>
      <p class="err hidden" id="impErr" style="margin:8px 0 0"></p><p class="ok hidden" id="impOk" style="margin:8px 0 0"></p></div></div>` : ''}
    <p class="err hidden" id="err"></p>
    <div class="field"><label for="fName">Name</label><input id="fName" value="${esc(r.name)}" autocomplete="off"></div>
    ${selectField('fCuisine', 'Cuisine', 'cuisine', r.cuisine)}${selectField('fProtein', 'Protein', 'protein', r.protein)}${selectField('fType', 'Kind of meal', 'meal_type', r.meal_type)}
    <div class="field"><label>Healthy?</label><div class="seg" id="fHealthy"><button type="button" data-v="yes" aria-pressed="${r.healthy === true}">Yes</button><button type="button" data-v="no" aria-pressed="${r.healthy === false}">No</button></div></div>
    <div class="field"><label for="fIng">Ingredients</label><div class="help">One per line, like “1 lb ground turkey”. These build your shopping list.</div><textarea id="fIng" class="tall" placeholder="1 lb ground turkey&#10;1 onion, diced&#10;2 cups rice">${esc(ingredientsText(r.ingredients))}</textarea></div>
    <div class="field"><label for="fServ">Serves</label><input id="fServ" type="number" inputmode="numeric" min="1" max="50" value="${r.servings || ''}" placeholder="4"></div>
    <div class="field"><label for="fLink">Recipe link</label><input id="fLink" type="url" inputmode="url" placeholder="Paste a link (optional)" value="${esc(r.link)}"></div>
    <div class="field"><label for="fNotes">Notes</label><textarea id="fNotes" placeholder="Sides, tweaks, who loved it">${esc(r.notes)}</textarea></div>
    <input type="hidden" id="fImg" value="${esc(r.image_url || '')}">
    <button class="btn primary wide" id="fSave">${isNew ? 'Add recipe' : 'Save changes'}</button>`, (s) => {
    for (const fid of ['fCuisine', 'fProtein', 'fType']) {
      const sel = s.querySelector('#' + fid), extra = s.querySelector('#' + fid + 'New');
      sel.addEventListener('change', () => { extra.classList.toggle('hidden', sel.value !== '__new'); if (sel.value === '__new') extra.focus(); });
    }
    const seg = s.querySelector('#fHealthy');
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', String(on));
    });
    const val = (fid) => { const sel = s.querySelector('#' + fid); return sel.value === '__new' ? s.querySelector('#' + fid + 'New').value.trim() : sel.value; };
    const setSelect = (fid, v) => {
      if (!v) return;
      const sel = s.querySelector('#' + fid);
      const match = [...sel.options].find((o) => k(o.value) === k(v));
      if (match) sel.value = match.value; else { sel.value = '__new'; const x = s.querySelector('#' + fid + 'New'); x.classList.remove('hidden'); x.value = v; }
    };
    const imp = s.querySelector('#fImport');
    if (imp) imp.addEventListener('click', async () => {
      const url = s.querySelector('#fUrl').value.trim(), err = s.querySelector('#impErr'), ok = s.querySelector('#impOk');
      err.classList.add('hidden'); ok.classList.add('hidden');
      if (!safeUrl(url)) { err.textContent = 'Paste a full link that starts with https://'; err.classList.remove('hidden'); return; }
      imp.disabled = true; imp.textContent = 'Reading…';
      try {
        const d = await S.api.importRecipe(url);
        if (d.name && !s.querySelector('#fName').value.trim()) s.querySelector('#fName').value = d.name;
        s.querySelector('#fLink').value = d.link || url;
        if (d.servings) s.querySelector('#fServ').value = d.servings;
        if (d.image) s.querySelector('#fImg').value = d.image;
        if (d.ingredients && d.ingredients.length) s.querySelector('#fIng').value = d.ingredients.join('\n');
        if (d.cuisine) setSelect('fCuisine', d.cuisine.split(',')[0].trim());
        ok.textContent = d.found
          ? `Filled in ${d.ingredients.length} ingredient${d.ingredients.length === 1 ? '' : 's'}. Check them, then pick a cuisine and kind of meal.`
          : 'That page didn’t list its ingredients in a way we can read. The name and link are filled in; add ingredients by hand.';
        ok.classList.remove('hidden');
      } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      imp.disabled = false; imp.textContent = 'Fill in';
    });
    s.querySelector('#fSave').addEventListener('click', async function () {
      const btn = this, err = s.querySelector('#err');
      const pressed = seg.querySelector('[aria-pressed="true"]');
      const rec = {
        id: isNew ? undefined : r.id, name: s.querySelector('#fName').value.replace(/\s+/g, ' ').trim(),
        cuisine: val('fCuisine'), protein: val('fProtein'), meal_type: val('fType'),
        healthy: pressed ? pressed.dataset.v === 'yes' : null, link: s.querySelector('#fLink').value.trim(),
        notes: s.querySelector('#fNotes').value.trim(), servings: parseInt(s.querySelector('#fServ').value, 10) || null,
        image_url: s.querySelector('#fImg').value.trim(),
      };
      const ingredients = s.querySelector('#fIng').value.split('\n').map(L.parseIngredient).filter(Boolean);
      if (!rec.name) { err.textContent = 'Give the recipe a name.'; err.classList.remove('hidden'); s.querySelector('.sheet').scrollTop = 0; return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const saved = await S.api.saveRecipe(S.household.id, rec, ingredients, { library: !isNew && r.library });
        const at = S.recipes.findIndex((x) => x.id === saved.id);
        if (at > -1) S.recipes[at] = saved; else S.recipes.push(saved);
        if (opts.copiedFrom) { S.hidden.add(opts.copiedFrom); S.api.setHidden(S.household.id, opts.copiedFrom, true).catch(() => {}); }
        S.query = '';
        closeSheet();
        if (opts.forDay) { S.tab = 'week'; await changeDays([recipeChange(opts.forDay, saved)], opts.forDay); }
        else render();
        toast(isNew ? (opts.copiedFrom ? 'Copied to your recipes' : 'Recipe added') : 'Changes saved');
      } catch (e) {
        btn.disabled = false; btn.textContent = isNew ? 'Add recipe' : 'Save changes';
        err.textContent = e.message; err.classList.remove('hidden');
        s.querySelector('.sheet').scrollTop = 0;
      }
    });
  });
}

// ---------- Shopping ----------
async function ensureShopping() {
  if (!S.shop.weekStart) S.shop.weekStart = S.weekStart;
  if (S.shop.loadedFor === S.shop.weekStart) return;
  const ws = S.shop.weekStart;
  try {
    const d = await S.api.loadShopping(S.household.id, ws);
    if (S.shop.weekStart !== ws) return;
    S.shop.checks = new Set(d.checks); S.shop.extras = d.extras; S.shop.loadedFor = ws;
  } catch (e) { toast(e.message); }
}

function shoppingData() {
  const days = weekDays(S.shop.weekStart);
  const entries = [], missing = [];
  for (const d of days) {
    const e = dayEntry(d);
    if (e.kind !== 'recipe') continue;
    if (e.recipe && e.recipe.ingredients.length) entries.push({ recipeName: e.recipe.name, ingredients: e.recipe.ingredients });
    else if (e.recipe || e.name) missing.push(e.recipe || { name: e.name });
  }
  return { days, entries, missing, groups: L.buildShoppingList(entries) };
}

function renderShopping() {
  if (!S.shop.weekStart) S.shop.weekStart = S.weekStart;
  if (S.shop.loadedFor !== S.shop.weekStart) {
    app.innerHTML = '<div class="loading">Making your list…</div>';
    ensureShopping().then(() => { if (S.tab === 'shopping') renderShopping(); });
    return;
  }
  const { days, entries, missing, groups } = shoppingData();
  const total = groups.reduce((n, g) => n + g.items.length, 0) + S.shop.extras.length;
  const done = groups.reduce((n, g) => n + g.items.filter((i) => S.shop.checks.has(i.key)).length, 0) + S.shop.extras.filter((x) => x.checked).length;
  let html = `<div class="top"><div><h1>Shopping</h1><div class="sub">${weekLabel(S.shop.weekStart)}, ${L.nice(days[0])} to ${L.nice(days[6])}</div></div>
    <div class="weeknav"><button class="round" data-act="shopprev" aria-label="Previous week">${LEFT}</button><button class="round" data-act="shopnext" aria-label="Next week">${RIGHT}</button></div></div>`;
  if (missing.length) {
    html += `<div class="notice">${missing.length === 1 ? 'One dinner has' : `${missing.length} dinners have`} no ingredients yet, so ${missing.length === 1 ? 'it isn’t' : 'they aren’t'} on this list: ${missing.map((m) => m.id ? `<button data-act="edit" data-id="${m.id}">${esc(m.name)}</button>` : esc(m.name)).join(', ')}.</div>`;
  }
  if (!entries.length && !S.shop.extras.length) {
    html += `<div class="card"><h2>Nothing to buy yet</h2><p style="margin:0 0 14px;color:var(--muted)">Plan some dinners for this week and their ingredients show up here, grouped by aisle.</p><button class="btn primary" data-act="tab" data-tab="week">Go to the week</button></div>`;
  } else {
    html += `<div class="actions" style="margin:0 0 4px"><button class="btn primary" data-act="sharelist">Share list</button><button class="btn soft" data-act="copylist">Copy</button></div>
      <div class="count">${done} of ${total} ticked off</div>`;
  }
  for (const g of groups) {
    html += `<h2 class="aisle">${esc(g.aisle)}</h2><div class="list">`;
    for (const i of g.items) {
      const on = S.shop.checks.has(i.key);
      html += `<button class="check" role="checkbox" aria-checked="${on}" data-act="tick" data-key="${esc(i.key)}"><span class="box">${TICK}</span>
        <span><span class="iname">${i.amount ? `<span class="iamt">${esc(i.amount)}</span> ` : ''}${esc(i.name)}</span><span class="ifor">${esc(i.recipes.join(', '))}</span></span></button>`;
    }
    html += '</div>';
  }
  html += `<h2 class="aisle">Extras</h2>${S.shop.extras.length ? '<div class="list">' + S.shop.extras.map((x) => `<div class="check" role="checkbox" aria-checked="${x.checked}"><button class="box" data-act="tickextra" data-id="${x.id}" aria-label="Tick ${esc(x.text)}" style="padding:0">${TICK}</button>
      <span class="iname" data-act="tickextra" data-id="${x.id}" style="flex:1">${esc(x.text)}</span><button class="del" data-act="delextra" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">×</button></div>`).join('') + '</div>' : ''}
    <form class="addrow" id="extraForm"><input id="extraIn" placeholder="Add something else, like paper towels" autocomplete="off" aria-label="Add an item"><button class="btn soft" type="submit">Add</button></form>`;
  app.innerHTML = html;
  document.getElementById('extraForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = document.getElementById('extraIn'), text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    try { const row = await S.api.addExtra(S.household.id, S.shop.weekStart, text); S.shop.extras.push(row); renderShopping(); document.getElementById('extraIn').focus(); }
    catch (err) { toast(err.message); }
  });
}

function listText() {
  const { days, groups } = shoppingData();
  return L.shoppingText(groups, S.shop.extras, S.shop.checks, `Shopping list, ${L.nice(days[0])} to ${L.nice(days[6])}`);
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (_) {
    openSheet(`<h2>Copy this list</h2><div class="meta">Press and hold, then choose Copy.</div><div class="field"><textarea class="tall" readonly>${esc(text)}</textarea></div>`);
  }
}

// ---------- Settings ----------
function settingsSheet() {
  const h = S.household, cur = startDay();
  const order = Array.from({ length: 7 }, (_, i) => (cur + i) % 7);
  openSheet(`<h2>Settings</h2><div class="meta">These apply to everyone in ${esc(h.name)}.</div>
    <div class="setting"><h3>Weeks start on</h3><p>The first day shown at the top of each week.</p><div class="daygrid">
      ${L.DAYS.map((d, i) => `<button data-act="setstart" data-w="${i}" aria-pressed="${i === cur}" aria-label="${d}">${d.slice(0, 3)}</button>`).join('')}</div></div>
    <div class="setting"><h3>Day rules</h3><p>Steer what the dice picks on certain days, or mark a regular night off.</p><div class="rulelist">
      ${order.map((w) => { const r = S.rules.get(w); return `<button class="item" data-act="rule" data-w="${w}"><span class="name">${L.DAYS[w]}</span><span class="times" style="color:${r ? 'var(--plum)' : 'var(--muted)'};font-weight:${r ? 650 : 400}">${esc(L.ruleSummary(r))}</span></button>`; }).join('')}</div></div>
    <div class="setting"><h3>Jump to a week</h3><div class="gorow"><input type="date" id="goDate" value="${S.weekStart}" aria-label="Date"><button class="btn primary" data-act="godate">Go</button></div>
      <button class="textlink" data-act="gotoday">Back to this week</button></div>
    <div class="setting"><h3>Share with your household</h3><p>Your partner signs up, chooses “Join your partner’s”, and enters this code.</p>
      <div class="copyrow"><span class="code" id="invite">${esc(h.invite_code)}</span><button class="btn soft small" data-act="copycode">Copy</button><button class="btn soft small" data-act="newcode">New code</button></div></div>
    <div class="setting"><h3>Dinners in your calendar</h3><p>Subscribe once and the week’s dinners show up in your phone’s calendar, updated automatically.</p>
      <div class="copyrow"><input readonly value="${esc(S.api.calendarUrl(h.calendar_token))}" aria-label="Calendar link"><button class="btn primary small" data-act="copycal">Copy</button></div>
      <p style="margin-top:10px">iPhone: Settings › Calendar › Accounts › Add Account › Other › Add Subscribed Calendar, then paste.<br>Google Calendar (on a computer): Other calendars › + › From URL, then paste.</p>
      <button class="textlink" data-act="newcal">Make a new link (stops the old one working)</button></div>
    <div class="setting"><h3>Account</h3><p>Signed in as ${esc((S.session && S.session.user && S.session.user.email) || '')}.</p><button class="btn soft wide" data-act="signout">Sign out</button></div>`);
}

function ruleSheet(w) {
  const r = S.rules.get(w);
  S.ruleDraft = { weekday: w, action: r ? r.action : 'none' };
  S.f.rule = r && r.action === 'filter' ? { cuisine: [...r.cuisines], protein: [...r.proteins], meal_type: [...r.meal_types], healthy: !!r.healthy_only } : L.blankFilter();
  drawRuleSheet();
}
function drawRuleSheet() {
  const d = S.ruleDraft;
  const opt = (action, label) => `<button class="btn ${d.action === action ? 'primary' : 'soft'}" data-act="ruleaction" data-a="${action}" aria-pressed="${d.action === action}">${label}</button>`;
  openSheet(`<h2>${L.DAYS[d.weekday]}s</h2><div class="meta">What should ${L.DAYS[d.weekday]} be when you tap Fill or Shuffle?</div>
    <div class="menu" style="margin-top:0">${opt('none', 'Anything (no rule)')}${opt('filter', 'Pick from certain recipes')}</div>
    ${d.action === 'filter' ? `<div style="margin-top:14px">${filterPanel('rule', 'flat')}</div>` : ''}
    <div class="menu"><h3>Or a regular night off</h3><div class="offgrid">${Object.entries(L.OFF_KINDS).map(([kind, o]) => `<button class="btn" data-act="ruleaction" data-a="${kind}" aria-pressed="${d.action === kind}">${o.label}</button>`).join('')}</div>
      <button class="btn primary" data-act="saverule" style="margin-top:10px">Save</button><button class="btn soft" data-act="settings">Back to settings</button></div>`);
}

// ---------- sheets, prompts, toasts ----------
function openSheet(html, after) {
  closeSheet();
  const s = document.createElement('div');
  s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.addEventListener('click', (e) => { if (e.target === s) closeSheet(); });
  document.body.appendChild(s);
  if (after) after(s);
}
function closeSheet() { const s = document.getElementById('scrim'); if (s) s.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function ask(title, body, yes, onYes, danger = false) {
  openSheet(`<h2>${title}</h2><div class="meta">${body}</div><div class="menu"><button class="btn ${danger ? 'danger' : 'primary'}" id="askYes">${yes}</button><button class="btn soft" id="askNo">Never mind</button></div>`, (s) => {
    s.querySelector('#askYes').addEventListener('click', () => { closeSheet(); onYes(); });
    s.querySelector('#askNo').addEventListener('click', closeSheet);
  });
}

let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ---------- one click handler for everything ----------
document.addEventListener('click', async (e) => {
  const tab = e.target.closest('nav.tabs button');
  if (tab) { S.tab = tab.dataset.tab; closeSheet(); render(); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, day = b.dataset.d, id = b.dataset.id;
  switch (act) {
    case 'retry': loadHousehold(); break;
    case 'authmode': S.authMode = b.dataset.m; S.authMsg = null; renderAuth(); break;
    case 'signout': closeSheet(); await S.api.signOut(); S.household = null; S.session = null; renderAuth(); break;
    case 'tab': S.tab = b.dataset.tab; render(); break;

    // week
    case 'prev': case 'next': S.weekStart = L.addDays(S.weekStart, act === 'prev' ? -7 : 7); render(); break;
    case 'settings': settingsSheet(); break;
    case 'dicefilter': diceFilterSheet(); break;
    case 'closesheet': closeSheet(); break;
    case 'day': dayMenu(day); break;
    case 'choose': chooser(day); break;
    case 'roll': case 'rollclose': {
      if (act === 'rollclose') closeSheet();
      const cur = (S.plan.get(day) || {}).recipe_id;
      const r = pickFor(day, cur ? [cur] : []) || pickFor(day);
      if (!r) { toast(S.recipes.length ? 'Nothing else matches your filters' : 'Add some recipes first'); return; }
      changeDays([recipeChange(day, r)], day);
      break;
    }
    case 'setday': {
      const r = byId(id); if (!r) return;
      closeSheet();
      if (b.dataset.go) { S.tab = 'week'; toast(`${r.name} added to ${dayName(day)}`); }
      changeDays([recipeChange(day, r)], day);
      break;
    }
    case 'newforday': closeSheet(); editor(null, { name: b.dataset.name, forDay: day }); break;
    case 'setoff': closeSheet(); changeDays([{ day, kind: b.dataset.kind, recipe_id: null, label: null, note: null }], day); break;
    case 'eatout': eatOutSheet(day); break;
    case 'seteatout': { const note = document.getElementById('where').value.trim(); closeSheet(); changeDays([{ day, kind: 'eating_out', recipe_id: null, label: null, note }], day); break; }
    case 'clearday': closeSheet(); changeDays([{ day, clear: true }]); break;
    case 'fill': {
      const changes = [], used = [];
      let short = false;
      for (const d of weekDays(S.weekStart)) {
        if (S.plan.has(d)) continue;
        const rule = S.rules.get(L.dow(d));
        if (rule && L.isOffKind(rule.action)) { changes.push({ day: d, kind: rule.action, recipe_id: null, label: null, note: null }); continue; }
        const r = pickFor(d, used);
        if (r) { used.push(r.id); changes.push(recipeChange(d, r)); } else short = true;
      }
      if (changes.length) changeDays(changes);
      if (short) toast(S.recipes.length ? 'Not enough recipes match to fill every day' : 'Add some recipes first');
      break;
    }
    case 'shuffle': {
      const doIt = () => {
        const days = weekDays(S.weekStart).filter((d) => !L.isOffKind((S.plan.get(d) || {}).kind));
        for (const d of days) S.plan.delete(d); // so picks don't avoid the old choices for this week
        const changes = [], used = [];
        for (const d of days) {
          const rule = S.rules.get(L.dow(d));
          if (rule && L.isOffKind(rule.action)) { changes.push({ day: d, kind: rule.action, recipe_id: null, label: null, note: null }); continue; }
          const r = pickFor(d, used);
          if (r) { used.push(r.id); changes.push(recipeChange(d, r)); } else changes.push({ day: d, clear: true });
        }
        changeDays(changes);
      };
      const planned = weekDays(S.weekStart).some((d) => S.plan.get(d) && S.plan.get(d).kind === 'recipe');
      const offs = weekDays(S.weekStart).some((d) => L.isOffKind((S.plan.get(d) || {}).kind));
      if (planned) ask('Shuffle the week?', 'Every cooking day gets a new random dinner.' + (offs ? ' Eating out, leftovers and no-cooking days stay put.' : ''), 'Shuffle', doIt); else doIt();
      break;
    }
    case 'clearall':
      ask('Clear the week?', 'All 7 days go back to empty.', 'Clear the week', () => changeDays(weekDays(S.weekStart).map((d) => ({ day: d, clear: true }))));
      break;

    // filters
    case 'filter': case 'healthy': case 'clearfilters': {
      const ctx = b.dataset.ctx;
      if (act === 'filter') toggleFilter(ctx, b.dataset.f, b.dataset.v);
      else if (act === 'healthy') S.f[ctx].healthy = !S.f[ctx].healthy;
      else S.f[ctx] = L.blankFilter();
      if (ctx === 'surprise') S.pick = null;
      keepChipScroll(() => {
        if (ctx === 'dice') { render(); if (act === 'clearfilters') closeSheet(); else diceFilterSheet(); }
        else if (ctx === 'rule') drawRuleSheet();
        else render();
      });
      break;
    }
    case 'togglefilters': S.showRecipeFilters = !S.showRecipeFilters; render(); break;
    case 'togglehidden': S.showHidden = !S.showHidden; render(); break;

    // surprise and recipes
    case 'surprise': {
      const m = surpriseMatches(); if (!m.length) return;
      const others = m.filter((r) => r.id !== S.pick);
      const pool = others.length ? others : m;
      S.pick = pool[Math.floor(Math.random() * pool.length)].id; render(); break;
    }
    case 'addto': addToDaySheet(id); break;
    case 'details': details(id); break;
    case 'edit': editor(id); break;
    case 'new': editor(null, { name: S.query }); break;
    case 'copy': {
      const r = byId(id); if (!r) return;
      editor(null, { prefill: { ...r, id: undefined, library: false }, copiedFrom: r.id });
      break;
    }
    case 'hide': case 'unhide': {
      const hide = act === 'hide';
      if (hide) S.hidden.add(id); else S.hidden.delete(id);
      closeSheet(); render(); toast(hide ? 'The dice won’t pick that one' : 'Back in the mix');
      S.api.setHidden(S.household.id, id, hide).catch((err) => toast(err.message));
      break;
    }
    case 'delete': {
      const r = byId(id); if (!r) return;
      ask(`Delete ${esc(r.name)}?`, 'It’s removed from your recipes. Past weeks keep the name.', 'Delete recipe', async () => {
        try {
          await S.api.deleteRecipe(id);
          S.recipes = S.recipes.filter((x) => x.id !== id);
          for (const p of S.plan.values()) if (p.recipe_id === id) { p.recipe_id = null; p.label = p.label || r.name; }
          render(); toast('Recipe deleted');
        } catch (err) { toast(err.message); }
      }, true);
      break;
    }

    // shopping
    case 'shopprev': case 'shopnext': S.shop.weekStart = L.addDays(S.shop.weekStart, act === 'shopprev' ? -7 : 7); render(); break;
    case 'tick': {
      const key = b.dataset.key, on = !S.shop.checks.has(key);
      if (on) S.shop.checks.add(key); else S.shop.checks.delete(key);
      const y = window.scrollY; renderShopping(); window.scrollTo(0, y);
      S.api.setCheck(S.household.id, S.shop.weekStart, key, on).catch((err) => toast(err.message));
      break;
    }
    case 'tickextra': {
      const x = S.shop.extras.find((v) => v.id === id); if (!x) return;
      x.checked = !x.checked;
      const y = window.scrollY; renderShopping(); window.scrollTo(0, y);
      S.api.setExtraChecked(id, x.checked).catch((err) => toast(err.message));
      break;
    }
    case 'delextra':
      S.shop.extras = S.shop.extras.filter((v) => v.id !== id); renderShopping();
      S.api.deleteExtra(id).catch((err) => toast(err.message));
      break;
    case 'sharelist': {
      const text = listText();
      if (navigator.share) { try { await navigator.share({ title: 'Shopping list', text }); } catch (_) { /* cancelled */ } }
      else copyText(text, 'List copied. Paste it into Notes or a message.');
      break;
    }
    case 'copylist': copyText(listText(), 'List copied. Paste it into Notes or a message.'); break;

    // settings
    case 'setstart': {
      const w = Number(b.dataset.w); if (w === startDay()) return;
      S.household.week_start_day = w; S.weekStart = L.weekOf(S.today, w); S.shop.weekStart = null; S.shop.loadedFor = null;
      settingsSheet(); render(); toast(`Weeks now start on ${L.DAYS[w]}`);
      S.api.updateHousehold(S.household.id, { week_start_day: w }).catch((err) => toast(err.message));
      break;
    }
    case 'rule': ruleSheet(Number(b.dataset.w)); break;
    case 'ruleaction': S.ruleDraft.action = b.dataset.a; drawRuleSheet(); break;
    case 'saverule': {
      const d = S.ruleDraft, f = S.f.rule;
      const none = d.action === 'none' || (d.action === 'filter' && !L.activeCount(f));
      try {
        if (none) { await S.api.deleteRule(S.household.id, d.weekday); S.rules.delete(d.weekday); }
        else {
          const saved = await S.api.saveRule(S.household.id, { weekday: d.weekday, action: d.action, cuisines: f.cuisine, proteins: f.protein, meal_types: f.meal_type, healthy_only: f.healthy });
          S.rules.set(d.weekday, saved);
        }
        settingsSheet(); render(); toast(none ? `No rule for ${L.DAYS[d.weekday]}s` : `${L.DAYS[d.weekday]}s: ${L.ruleSummary(S.rules.get(d.weekday))}`);
      } catch (err) { toast(err.message); }
      break;
    }
    case 'godate': { const v = document.getElementById('goDate').value; if (v) { S.weekStart = L.weekOf(v, startDay()); closeSheet(); render(); } break; }
    case 'gotoday': S.weekStart = L.weekOf(S.today, startDay()); closeSheet(); render(); break;
    case 'copycode': copyText(S.household.invite_code, 'Code copied'); break;
    case 'newcode':
      try { S.household.invite_code = await S.api.newInviteCode(); document.getElementById('invite').textContent = S.household.invite_code; toast('New code made. The old one no longer works.'); }
      catch (err) { toast(err.message); }
      break;
    case 'copycal': copyText(S.api.calendarUrl(S.household.calendar_token), 'Calendar link copied'); break;
    case 'newcal':
      ask('Make a new calendar link?', 'Calendars subscribed with the old link stop updating. You’ll need to subscribe again with the new one.', 'Make a new link', async () => {
        try { S.household.calendar_token = await S.api.newCalendarToken(); settingsSheet(); toast('New calendar link ready'); } catch (err) { toast(err.message); }
      });
      break;
  }
});

// Refresh "today" when the app comes back to the foreground on a new day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S.household) return;
  const t = L.localToday();
  if (t !== S.today) { S.today = t; recalc(); render(); }
});

boot();
