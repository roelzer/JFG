import { W, H, drawCover, drawMatchday } from './render.js';
import { BFV_API, normalizeTeamMatches, outcome } from './bfv.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const store = {
  get(k, d) { try { return localStorage.getItem('rs.' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rs.' + k, v); } catch {} },
};

const state = {
  tab: 'cover',
  data: { teams: [], matches: [], logos: {}, club: {} },
  photo: null,
  pan: { x: 0, y: 0, zoom: 1 },
  cover: { matchId: '' },
  md: { weekStart: mondayOf(new Date()), mode: 'vorschau', rows: [], subtitleDirty: false },
  ownLogo: null,
};

/* ---------- Hilfen ---------- */
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayIso = iso(new Date());
const fmt = (isoStr, opts) => new Date(isoStr + 'T12:00:00').toLocaleDateString('de-DE', opts);

const imgCache = new Map();
function loadImg(src) {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    }));
  }
  return imgCache.get(src);
}
const logoSrc = (clubId) => (clubId && state.data.logos?.[clubId]) || null;

function setStatus(msg) { $('status').textContent = msg; }

/* ---------- Daten ---------- */
async function loadData() {
  try {
    const res = await fetch('data/spiele.json', { cache: 'no-cache' });
    if (res.ok) state.data = await res.json();
  } catch {}
  const n = state.data.matches?.length || 0;
  setStatus(state.data.updated
    ? `${n} Spiele vom BFV · Stand ${new Date(state.data.updated).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Noch keine BFV-Daten – Felder einfach von Hand ausfüllen.');
}

// Direkt beim BFV nachladen (klappt nur, wenn der BFV den Abruf aus dem Browser erlaubt)
async function refreshLive() {
  const teams = state.data.teams || [];
  if (!teams.length) return setStatus('Keine Mannschaften bekannt – die GitHub Action hat noch nicht gelaufen.');
  setStatus('Lade vom BFV …');
  try {
    const all = [];
    for (const t of teams) {
      const json = await (await fetch(`${BFV_API}/team/${t.id}/matches`)).json();
      all.push(...normalizeTeamMatches(json, t.id, { label: t.label, name: t.name }).matches);
    }
    state.data.matches = all.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    state.data.updated = new Date().toISOString();
    fillMatchSelect();
    buildRows();
    setStatus(`${all.length} Spiele live vom BFV geladen.`);
  } catch {
    setStatus('Live-Abruf vom BFV hat nicht geklappt. Die Daten werden trotzdem alle paar Stunden automatisch aktualisiert.');
  }
}

/* ---------- Deckblatt ---------- */
const coverFields = ['kicker', 'label', 'result', 'home', 'guest', 'date', 'time', 'competition'];

function matchText(m) {
  const d = fmt(m.date, { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${d} · ${m.label || '?'} · ${m.isHome ? 'vs' : '@'} ${m.opponent}${m.result ? ' · ' + m.result : ''}`;
}

function fillMatchSelect() {
  const sel = $('matchSelect');
  const ms = state.data.matches || [];
  sel.innerHTML = '';
  sel.append(new Option('– von Hand ausfüllen –', ''));
  const past = ms.filter((m) => m.date < todayIso || m.result).reverse();
  const next = ms.filter((m) => m.date >= todayIso && !m.result);
  for (const [title, list] of [['Gespielt', past], ['Demnächst', next]]) {
    if (!list.length) continue;
    const g = document.createElement('optgroup');
    g.label = title;
    list.slice(0, 40).forEach((m) => g.append(new Option(matchText(m), m.id + '|' + m.teamId)));
    sel.append(g);
  }
  // Standard: das zuletzt gespielte Spiel
  if (!state.cover.matchId && past[0]) state.cover.matchId = past[0].id + '|' + past[0].teamId;
  sel.value = state.cover.matchId;
  if (state.cover.matchId) applyMatch(state.cover.matchId);
}

function applyMatch(key) {
  state.cover.matchId = key;
  const m = (state.data.matches || []).find((x) => x.id + '|' + x.teamId === key);
  if (!m) return;
  $('label').value = m.label || '';
  $('home').value = m.home;
  $('guest').value = m.guest;
  $('result').value = m.result || '';
  $('date').value = m.date;
  $('time').value = m.time;
  $('competition').value = m.competition || '';
  $('isHome').checked = m.isHome;
  $('kicker').value = m.result ? 'Spielbericht' : 'Spielvorschau';
  state.cover.homeClubId = m.homeClubId;
  state.cover.guestClubId = m.guestClubId;
}

/* ---------- Spieltag ---------- */
function weekMatches() {
  const from = iso(state.md.weekStart);
  const to = iso(addDays(state.md.weekStart, 6));
  return (state.data.matches || []).filter((m) => m.date >= from && m.date <= to);
}

function buildRows() {
  state.md.rows = weekMatches().map((m) => ({
    label: m.label || '',
    opponent: m.opponent,
    isHome: m.isHome,
    date: m.date,
    time: m.time,
    result: m.result,
    clubId: m.isHome ? m.guestClubId : m.homeClubId,
  }));
  if (!state.md.subtitleDirty) $('mdSubtitle').value = autoSubtitle();
  renderRowEditor();
  draw();
}

function autoSubtitle() {
  const dates = state.md.rows.map((r) => r.date).filter(Boolean).sort();
  const a = dates[0] || iso(addDays(state.md.weekStart, 5));
  const b = dates[dates.length - 1] || iso(addDays(state.md.weekStart, 6));
  if (a === b) return fmt(a, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return `${fmt(a, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })}. – ${fmt(b, { day: 'numeric', month: 'long', year: 'numeric' })}`
    .replace('.. ', '. ');
}

function weekLabel() {
  const a = state.md.weekStart;
  const b = addDays(a, 6);
  return `${a.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${b.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function renderRowEditor() {
  $('weekLabel').textContent = weekLabel();
  const ol = $('rows');
  ol.innerHTML = '';
  state.md.rows.forEach((r, i) => {
    const li = document.createElement('li');
    const input = (key, attrs = {}) => {
      const el = Object.assign(document.createElement('input'), { value: r[key] ?? '', ...attrs });
      el.addEventListener('input', () => { r[key] = el.value; draw(); });
      return el;
    };
    const ha = document.createElement('select');
    ha.append(new Option('Heim', '1'), new Option('Auswärts', '0'));
    ha.value = r.isHome ? '1' : '0';
    ha.addEventListener('change', () => { r.isHome = ha.value === '1'; draw(); });
    const x = Object.assign(document.createElement('button'), { className: 'ghost x', textContent: '✕', title: 'Entfernen' });
    x.setAttribute('aria-label', 'Spiel entfernen');
    x.addEventListener('click', () => { state.md.rows.splice(i, 1); renderRowEditor(); draw(); });
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.append(ha, input('date', { type: 'date', ariaLabel: 'Datum' }), input('time', { type: 'time', ariaLabel: 'Uhrzeit' }), input('result', { placeholder: '3:1', ariaLabel: 'Ergebnis (Heim:Gast)' }));
    li.append(input('label', { placeholder: 'U15', ariaLabel: 'Altersklasse' }), input('opponent', { placeholder: 'Gegner', ariaLabel: 'Gegner' }), x, meta);
    ol.append(li);
  });
}

/* ---------- Zeichnen ---------- */
let drawQueued = false;
function draw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(async () => {
    drawQueued = false;
    const common = { handle: $('handle').value, subline: $('subline').value, pan: state.pan };
    const assets = { photo: state.photo, ownLogo: state.ownLogo };
    if (state.tab === 'cover') {
      const s = { ...common, isHome: $('isHome').checked };
      coverFields.forEach((f) => (s[f] = $(f).value.trim()));
      s.result = s.result.replace(/[-–]/, ':');
      const [homeLogo, guestLogo] = await Promise.all([
        loadImg(logoSrc(state.cover.homeClubId)),
        loadImg(logoSrc(state.cover.guestClubId)),
      ]);
      // Eigenes Logo statt BFV-Logo verwenden, falls hochgeladen
      drawCover(ctx, s, {
        ...assets,
        homeLogo: s.isHome ? state.ownLogo || homeLogo : homeLogo,
        guestLogo: !s.isHome ? state.ownLogo || guestLogo : guestLogo,
      });
    } else {
      const results = state.md.mode === 'ergebnisse';
      const rows = await Promise.all(state.md.rows.map(async (r) => ({
        ...r,
        logo: await loadImg(logoSrc(r.clubId)),
        day: r.date ? fmt(r.date, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '').toUpperCase() : '',
        result: (r.result || '').replace(/[-–]/, ':'),
        outcome: outcome({ result: (r.result || '').replace(/[-–]/, ':'), isHome: r.isHome }),
      })));
      drawMatchday(ctx, {
        ...common,
        mode: state.md.mode,
        title: $('mdTitle').value,
        subtitle: $('mdSubtitle').value,
        rows,
        footer: results ? 'ERGEBNISSE AUS SICHT DER JFG' : 'KOMMT VORBEI UND FEUERT UNS AN!',
      }, assets);
    }
  });
}

/* ---------- Export ---------- */
function fileName() {
  const base = state.tab === 'cover'
    ? `${$('date').value || todayIso}_${$('label').value || 'spiel'}_deckblatt`
    : `${iso(state.md.weekStart)}_spieltag_${state.md.mode}`;
  return base.replace(/[^\w.-]+/g, '-') + '.png';
}
const toBlob = () => new Promise((res) => canvas.toBlob(res, 'image/png'));

$('downloadBtn').addEventListener('click', async () => {
  const blob = await toBlob();
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName() });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('shareBtn').addEventListener('click', async () => {
  const blob = await toBlob();
  const file = new File([blob], fileName(), { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {}
  } else {
    $('downloadBtn').click();
    setStatus('Teilen geht in diesem Browser nicht – Bild wurde heruntergeladen.');
  }
});

/* ---------- Foto ---------- */
function readImage(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => loadImg(r.result).then(res, rej);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

$('photoInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.photo = await readImage(f);
  state.pan = { x: 0, y: 0, zoom: 1 };
  $('zoom').value = 1;
  $('zoomRow').hidden = false;
  $('panHint').hidden = false;
  setTimeout(() => ($('panHint').hidden = true), 2500);
  draw();
});
$('zoom').addEventListener('input', (e) => { state.pan.zoom = +e.target.value; draw(); });
$('removePhoto').addEventListener('click', () => {
  state.photo = null;
  $('photoInput').value = '';
  $('zoomRow').hidden = true;
  draw();
});

// Foto per Ziehen verschieben
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!state.photo) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, pan: { ...state.pan } };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const k = W / rect.width;
  const img = state.photo;
  const boxH = state.tab === 'cover' ? H : 560;
  const scale = Math.max(W / img.width, boxH / img.height) * state.pan.zoom;
  const spareX = (img.width * scale - W) / 2 || 1;
  const spareY = (img.height * scale - boxH) / 2 || 1;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  state.pan.x = clamp(drag.pan.x + ((e.clientX - drag.x) * k) / spareX);
  state.pan.y = clamp(drag.pan.y + ((e.clientY - drag.y) * k) / spareY);
  draw();
});
['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, () => (drag = null)));

/* ---------- Bedienelemente ---------- */
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  state.tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== state.tab));
  state.pan = { ...state.pan, x: 0, y: 0 };
  draw();
}));

$('matchSelect').addEventListener('change', (e) => { applyMatch(e.target.value); draw(); });
[...coverFields, 'isHome', 'handle', 'subline', 'mdTitle'].forEach((id) => $(id).addEventListener('input', draw));
$('mdSubtitle').addEventListener('input', () => { state.md.subtitleDirty = true; draw(); });
['handle', 'subline'].forEach((id) => {
  $(id).value = store.get(id, $(id).value);
  $(id).addEventListener('change', () => store.set(id, $(id).value));
});

$('prevWeek').addEventListener('click', () => { state.md.weekStart = addDays(state.md.weekStart, -7); state.md.subtitleDirty = false; buildRows(); });
$('nextWeek').addEventListener('click', () => { state.md.weekStart = addDays(state.md.weekStart, 7); state.md.subtitleDirty = false; buildRows(); });
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
  state.md.mode = r.value;
  $('mdTitle').value = r.value === 'ergebnisse' ? 'Ergebnisse' : 'Spieltag';
  draw();
}));
$('addRow').addEventListener('click', () => {
  state.md.rows.push({ label: '', opponent: '', isHome: true, date: iso(addDays(state.md.weekStart, 5)), time: '', result: '' });
  renderRowEditor();
  draw();
});

$('logoInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = await readImage(f);
  state.ownLogo = img;
  store.set('logo', img.src);
  draw();
});
$('refreshBtn').addEventListener('click', refreshLive);

/* ---------- Start ---------- */
(async () => {
  await Promise.all(['800', 'italic 800', '700', 'italic 700', '600'].map((w) =>
    document.fonts.load(`${w} 40px "Barlow Condensed"`).catch(() => {})));
  await loadData();
  if (!$('handle').value) $('handle').value = state.data.club?.instagram || '@rothseekicker';
  state.ownLogo = (await loadImg(store.get('logo', null)))
    || (await loadImg(logoSrc(state.data.club?.clubId)))
    || (await loadImg('assets/logo.png'));
  fillMatchSelect();
  // Spieltag: Woche mit dem nächsten anstehenden Spiel, sonst aktuelle Woche
  const next = (state.data.matches || []).find((m) => m.date >= todayIso);
  if (next) state.md.weekStart = mondayOf(new Date(next.date + 'T12:00:00'));
  buildRows();
  draw();
})();
