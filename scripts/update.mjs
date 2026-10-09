// Holt alle Spiele der JFG-Mannschaften vom BFV und schreibt data/spiele.json.
// Läuft per GitHub Action (siehe .github/workflows/update.yml), lokal: node scripts/update.mjs
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { BFV_API, normalizeTeamMatches } from '../bfv.js';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('teams.json', root), 'utf8'));

async function getJson(path) {
  const res = await fetch(BFV_API + path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} für ${path}`);
  return res.json();
}

// Weitere Mannschaften des Vereins finden, falls die Vereins-Info eine Teamliste enthält.
async function discoverTeams() {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      const id = node.teamPermanentId || node.permanentId;
      if (typeof id === 'string' && id.length === 32) found.push(id);
      Object.values(node).forEach(walk);
    }
  };
  try {
    walk(await getJson(`/club/${config.club.bfvClubId}/info`));
  } catch (e) {
    console.warn('Vereins-Info nicht abrufbar:', e.message);
  }
  // Vereinsseite auf bfv.de: dort sind alle aktuellen Mannschaften verlinkt
  try {
    const res = await fetch(`https://www.bfv.de/vereine/jfg-rothsee-sued/${config.club.bfvClubId}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (JFG Rothsee Süd Insta-Studio)' },
    });
    const html = await res.text();
    for (const m of html.matchAll(/\/mannschaften\/[^/"']+\/([0-9A-Z]{32})/g)) found.push(m[1]);
  } catch (e) {
    console.warn('Vereinsseite nicht abrufbar:', e.message);
  }
  return found;
}

const teamIds = [...new Set([...config.teams.map((t) => t.id), ...(await discoverTeams())])];
const teams = [];
const matches = new Map();

for (const id of teamIds) {
  const override = config.teams.find((t) => t.id === id) ?? {};
  try {
    const json = await getJson(`/team/${id}/matches`);
    const { team, matches: list } = normalizeTeamMatches(json, id, override);
    // Nur eigene Mannschaften übernehmen (Vereinsinfo kann auch Gegner enthalten)
    if (!/rothsee/i.test(team.name)) continue;
    teams.push(team);
    for (const m of list) matches.set(m.id + '|' + id, m);
    console.log(`✓ ${team.label || '?'} ${team.name}: ${list.length} Spiele (${team.competition})`);
  } catch (e) {
    console.warn(`✗ Mannschaft ${id}: ${e.message}`);
  }
}

// Alte Mannschaften (frühere Spielzeiten, die der BFV noch führt) aussortieren:
// behalten wird nur, wer in den letzten 60 Tagen gespielt hat oder noch Spiele vor sich hat.
const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
const active = new Set(
  [...matches.values()].filter((m) => m.date >= cutoff).map((m) => m.teamId),
);
for (const t of [...teams]) {
  if (active.has(t.id)) continue;
  console.log(`– ${t.label} ${t.name} ausgeblendet (keine aktuellen Spiele: ${t.competition})`);
  teams.splice(teams.indexOf(t), 1);
  for (const [k, m] of matches) if (m.teamId === t.id) matches.delete(k);
}
// Gibt es pro Altersklasse nur noch eine Mannschaft, braucht das Kürzel kein "II"/"III"
for (const t of teams) {
  if (config.teams.find((c) => c.id === t.id)?.label) continue;
  const base = t.label.split(' ')[0];
  if (teams.filter((x) => x.label.split(' ')[0] === base).length === 1 && base !== t.label) {
    t.label = base;
    for (const m of matches.values()) if (m.teamId === t.id) m.label = base;
  }
}

if (!teams.length) {
  console.error('Keine Mannschaft geladen – data/spiele.json bleibt unverändert.');
  process.exit(1);
}

// Vereinslogos lokal ablegen, damit die Seite sie ins Bild zeichnen darf (gleiche Herkunft)
// Gleiche Adressen wie auf bfv.de (format 7 = groß, 5 = klein)
const LOGO_URLS = (id) => [7, 5].map(
  (f) => `https://app.bfv.de/export.media/-/action/getLogo/format/${f}/id/${id}/verband/00ES8GNCQK000000VV0AG08LVUPGND5I/strat_code/bfv`,
);
const logos = {};
await mkdir(new URL('logos/', root), { recursive: true });
const clubIds = new Set();
for (const m of matches.values()) [m.homeClubId, m.guestClubId].forEach((c) => c && clubIds.add(c));
for (const t of teams) if (t.clubId) clubIds.add(t.clubId);
for (const id of clubIds) {
  const file = new URL(`logos/${id}.png`, root);
  try {
    await access(file);
    logos[id] = `logos/${id}.png`;
    continue;
  } catch {}
  for (const url of LOGO_URLS(id)) {
    try {
      const res = await fetch(url);
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue;
      await writeFile(file, buf);
      logos[id] = `logos/${id}.png`;
      break;
    } catch {}
  }
}
console.log(`Logos: ${Object.keys(logos).length}/${clubIds.size}`);

const ownClubId = teams.find((t) => t.clubId)?.clubId || '';
const out = {
  updated: new Date().toISOString(),
  club: { ...config.club, clubId: ownClubId },
  teams,
  matches: [...matches.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  logos,
};
await writeFile(new URL('data/spiele.json', root), JSON.stringify(out, null, 1) + '\n');
console.log(`data/spiele.json: ${out.matches.length} Spiele, ${teams.length} Mannschaften`);
