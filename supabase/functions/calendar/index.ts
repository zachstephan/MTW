// calendar: an .ics feed of a household's dinners, for subscribing in Google or Apple Calendar.
// Public URL (verify_jwt off); access is by the household's secret calendar_token, which members can reset.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function rest(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`db ${res.status}`);
  return res.json();
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// ICS lines must be folded at 75 octets.
function fold(line: string) {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const KIND_TITLE: Record<string, string> = { eating_out: 'Eating out', leftovers: 'Leftovers', no_cooking: 'No cooking' };

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Not found', { status: 404 });

  try {
    const hh = await rest(`households?select=id,name&calendar_token=eq.${token}&limit=1`);
    if (!hh.length) return new Response('Not found', { status: 404 });
    const h = hh[0];

    const from = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
    const days = await rest(
      `plan_days?select=id,day,kind,label,note,updated_at,recipes(name,link)&household_id=eq.${h.id}&day=gte.${from}&day=lte.${to}&order=day`,
    );
    // Extra recipes on a day (sides, desserts) join that day's event. Week-level extras have no day and stay off the calendar.
    const extras = await rest(
      `plan_extras?select=day,label,recipes(name,link)&household_id=eq.${h.id}&day=gte.${from}&day=lte.${to}&order=created_at`,
    ).catch(() => []);
    const extrasByDay = new Map();
    for (const x of extras) {
      const list = extrasByDay.get(x.day) || [];
      list.push({ name: x.recipes?.name || x.label, link: x.recipes?.link || '' });
      extrasByDay.set(x.day, list);
    }
    const planned = new Set(days.map((d) => d.day));
    for (const day of extrasByDay.keys()) if (!planned.has(day)) days.push({ id: `extras-${day}`, day, kind: 'extras_only' });
    days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Meal Tracker Week//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc('Dinners · ' + h.name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    ];
    for (const d of days) {
      const start = new Date(d.day + 'T00:00:00Z');
      const end = new Date(start.getTime() + 86400000);
      const xs = extrasByDay.get(d.day) || [];
      const xNames = xs.map((x) => x.name).join(', ');
      let title;
      if (d.kind === 'extras_only') title = `Dinner: ${xNames}`;
      else {
        const name = d.kind === 'recipe' ? (d.recipes?.name || d.label || 'Dinner') : KIND_TITLE[d.kind] || 'Dinner';
        title = (d.kind === 'eating_out' && d.note ? `Eating out: ${d.note}` : `Dinner: ${name}`) + (xs.length ? ` + ${xNames}` : '');
      }
      const desc = [d.kind !== 'eating_out' ? d.note : '', d.recipes?.link || '', ...xs.map((x) => (x.link ? `${x.name}: ${x.link}` : ''))].filter(Boolean).join('\n');
      lines.push('BEGIN:VEVENT', `UID:${d.id}@mealtrackerweek`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${esc(title)}`, 'TRANSP:TRANSPARENT');
      if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
      if (d.recipes?.link) lines.push(`URL:${d.recipes.link}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return new Response(lines.map(fold).join('\r\n') + '\r\n', {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
    });
  } catch {
    return new Response('Calendar is unavailable right now.', { status: 503 });
  }
});
