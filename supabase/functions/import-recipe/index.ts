// import-recipe: given a recipe page URL, return the recipe details the page publishes.
// Most recipe sites embed schema.org "Recipe" data (JSON-LD) for search engines; we read that.
// Requires a signed-in user (verify_jwt on). The app parses ingredient lines itself.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Refuse obvious internal addresses so the function can't be used to probe private networks.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return h.includes(':'); // any IPv6 literal
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function text(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o.name ?? o.text ?? o['@value'] ?? o.url ?? '');
  }
  return decodeEntities(String(v)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function isRecipe(node: Record<string, unknown>): boolean {
  const t = node['@type'];
  return Array.isArray(t) ? t.some((x) => String(x).toLowerCase() === 'recipe') : String(t ?? '').toLowerCase() === 'recipe';
}

function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r; }
    return null;
  }
  const o = node as Record<string, unknown>;
  if (isRecipe(o)) return o;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(o[key], depth + 1);
    if (r) return r;
  }
  return null;
}

function servingsOf(v: unknown): number | null {
  const m = text(v).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return n >= 1 && n <= 50 ? n : null;
}

function metaContent(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return decodeEntities((html.match(re) || html.match(re2) || [])[1] || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let url: URL;
  try {
    const body = await req.json();
    url = new URL(String(body?.url ?? '').trim());
  } catch {
    return json({ error: 'That doesn’t look like a web address.' }, 400);
  }
  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
    return json({ error: 'That doesn’t look like a recipe web address.' }, 400);
  }

  let html = '';
  try {
    const res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MealTrackerWeek/1.0; recipe import)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return json({ error: `The site answered with an error (${res.status}). Try another link.` }, 502);
    const reader = res.body?.getReader();
    if (!reader) return json({ error: 'The page came back empty.' }, 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 3_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
    }
    reader.cancel().catch(() => {});
    const all = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    html = new TextDecoder().decode(all);
  } catch {
    return json({ error: 'Couldn’t open that page. Check the link and try again.' }, 502);
  }

  let recipe: Record<string, unknown> | null = null;
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    try {
      recipe = findRecipe(JSON.parse(m[1].trim()));
      if (recipe) break;
    } catch { /* ignore broken blocks */ }
  }

  if (!recipe) {
    const title = metaContent(html, 'og:title') || text((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    return json({
      found: false,
      name: title.slice(0, 140),
      link: url.toString(),
      image: metaContent(html, 'og:image') || null,
      ingredients: [],
      servings: null,
    });
  }

  const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .map((x: unknown) => text(x)).filter(Boolean).slice(0, 80);
  const image = text(recipe.image) || metaContent(html, 'og:image') || null;

  return json({
    found: true,
    name: text(recipe.name).slice(0, 140),
    link: url.toString(),
    image,
    ingredients,
    servings: servingsOf(recipe.recipeYield),
    cuisine: text(recipe.recipeCuisine) || null,
    category: text(recipe.recipeCategory) || null,
  });
});
