// Zeichnet die Instagram-Vorlagen auf ein Canvas. Breite immer 1080 px, Höhe je nach Format.
export const W = 1080;

// T/B = Sicherheitsabstand oben/unten (Story: dort liegen Profilbild und Antwortleiste)
export const FORMATS = {
  '4:5': { h: 1350, t: 0, b: 0, name: 'Beitrag 4:5 (1080 × 1350)' },
  '3:4': { h: 1440, t: 0, b: 0, name: 'Beitrag 3:4 (1080 × 1440)' },
  '1:1': { h: 1080, t: 0, b: 0, name: 'Quadrat 1:1 (1080 × 1080)' },
  '9:16': { h: 1920, t: 200, b: 250, name: 'Story 9:16 (1080 × 1920)' },
};
export let H = 1350;
let T = 0;
let B = 0;
export function setFormat(key) {
  const f = FORMATS[key] || FORMATS['4:5'];
  H = f.h;
  T = f.t;
  B = f.b;
}

export const C = {
  navy: '#0a1a3a',
  navy2: '#102a5c',
  blue: '#1f5bd8',
  sky: '#6cc4ff',
  white: '#ffffff',
  muted: 'rgba(255,255,255,0.72)',
  win: '#2ecc71',
  loss: '#e74c3c',
  draw: '#f1c40f',
};

const FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const font = (size, weight = 800, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;

// Schriftgröße so weit verkleinern, bis der Text in maxWidth passt
function fit(ctx, text, maxWidth, size, weight = 800, italic = false, min = 18) {
  let s = size;
  ctx.font = font(s, weight, italic);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(s, weight, italic);
  }
  return s;
}

function spaced(ctx, text, x, y, spacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = spacing + 'px';
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
  } else ctx.fillText(text, x, y);
}

// Parallelogramm (sportlicher Schrägschnitt)
function slant(ctx, x, y, w, h, skew = 18) {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawPhoto(ctx, img, box, pan = { x: 0, y: 0, zoom: 1 }) {
  const { x, y, w, h } = box;
  const scale = Math.max(w / img.width, h / img.height) * (pan.zoom || 1);
  const dw = img.width * scale;
  const dh = img.height * scale;
  // pan.x / pan.y laufen von -1 bis 1 über den verschiebbaren Bereich
  const dx = x + (w - dw) / 2 + ((dw - w) / 2) * (pan.x || 0);
  const dy = y + (h - dh) / 2 + ((dh - h) / 2) * (pan.y || 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function stripes(ctx, alpha = 0.05) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 26;
  for (let i = -H; i < W + H; i += 90) {
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + H * 0.6, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function logo(ctx, img, cx, cy, size, fallbackText = '') {
  if (img) {
    // Weiße Kachel, damit Logos mit und ohne Hintergrund gleich aussehen
    ctx.save();
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.18);
    ctx.fill();
    ctx.restore();
    const inner = size * 0.84;
    const s = Math.min(inner / img.width, inner / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    return;
  }
  // Ersatz: Kreis mit Initialen
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = fallbackText
    .replace(/[^A-Za-zÄÖÜäöü0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(I|II|III|IV|e\.?V|o\.?W)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
  ctx.font = font(size * 0.36);
  ctx.fillText(initials, cx, cy + 2);
  ctx.restore();
}

function header(ctx, s, a) {
  ctx.save();
  ctx.translate(0, T);
  logo(ctx, a.ownLogo, 112, 112, 116, 'JFG Rothsee Süd');
  ctx.fillStyle = C.white;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(46, 800, true);
  spaced(ctx, 'JFG ROTHSEE SÜD', 190, 112, 1);
  ctx.font = font(28, 600);
  ctx.fillStyle = C.sky;
  spaced(ctx, (s.subline || 'JUGENDFUSSBALL').toUpperCase(), 192, 148, 3);
  ctx.restore();
}

function footer(ctx, left, right) {
  ctx.save();
  // Balken reicht bis zum unteren Rand, Text bleibt im sicheren Bereich
  ctx.fillStyle = C.blue;
  ctx.fillRect(0, H - 96 - B, W, 96 + B);
  ctx.translate(0, -B);
  ctx.fillStyle = C.sky;
  ctx.fillRect(0, H - 100, W, 4);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.white;
  ctx.textAlign = 'left';
  fit(ctx, left, W - 420, 34, 700);
  spaced(ctx, left, 56, H - 48, 1);
  ctx.textAlign = 'right';
  ctx.font = font(34, 700);
  ctx.fillText(right, W - 56, H - 48);
  ctx.restore();
}

export function formatDateLong(iso, time) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const wd = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase();
  const dm = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${wd} ${dm}${time ? ' · ' + time + ' UHR' : ''}`;
}

/* ---------------- Deckblatt ---------------- */
export function drawCover(ctx, s, a) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  if (a.photo) drawPhoto(ctx, a.photo, { x: 0, y: 0, w: W, h: H }, s.pan);
  else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.navy2);
    g.addColorStop(1, C.navy);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    stripes(ctx, 0.06);
  }

  // Abdunkeln oben und unten, damit Text lesbar bleibt
  let g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, 'rgba(6,16,38,0.75)');
  g.addColorStop(1, 'rgba(6,16,38,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 300);
  const fadeY = H - B - 710;
  g = ctx.createLinearGradient(0, fadeY, 0, H);
  g.addColorStop(0, 'rgba(10,26,58,0)');
  g.addColorStop(0.45, 'rgba(10,26,58,0.88)');
  g.addColorStop(1, 'rgba(10,26,58,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, fadeY, W, H - fadeY);

  header(ctx, s, a);

  // Altersklasse oben rechts
  if (s.label) {
    ctx.font = font(64, 800, true);
    const w = Math.max(150, ctx.measureText(s.label).width + 70);
    ctx.fillStyle = C.blue;
    slant(ctx, W - 56 - w, 66 + T, w, 92, 22);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, W - 56 - w / 2, 115 + T);
  }

  // Überschrift
  const top = H - B - 530;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.sky;
  ctx.font = font(52, 800, true);
  spaced(ctx, (s.kicker || '').toUpperCase(), 56, top, 4);
  ctx.fillStyle = C.sky;
  ctx.fillRect(56, top + 18, 120, 6);

  // Anzeigetafel: zwei Zeilen Heim / Gast
  const res = (s.result || '').split(':');
  const hasResult = res.length === 2 && res[0] !== '' && res[1] !== '';
  const rows = [
    { name: s.home, logo: a.homeLogo, score: res[0], own: s.isHome },
    { name: s.guest, logo: a.guestLogo, score: res[1], own: !s.isHome },
  ];
  const rowH = 128;
  const y0 = top + 56;
  const scoreW = hasResult ? 150 : 0;
  rows.forEach((r, i) => {
    const y = y0 + i * (rowH + 14);
    ctx.fillStyle = r.own ? 'rgba(31,91,216,0.92)' : 'rgba(255,255,255,0.10)';
    slant(ctx, 40, y, W - 80 - scoreW - (hasResult ? 14 : 0), rowH, 22);
    ctx.fill();
    logo(ctx, r.logo, 40 + 22 + 62, y + rowH / 2, 92, r.name || '');
    ctx.fillStyle = C.white;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxW = W - 80 - scoreW - 200;
    fit(ctx, (r.name || '').toUpperCase(), maxW, 62, 800, true, 30);
    ctx.fillText((r.name || '').toUpperCase(), 40 + 150, y + rowH / 2 + 3);
    if (hasResult) {
      const x = W - 40 - scoreW;
      ctx.fillStyle = r.own ? C.white : 'rgba(255,255,255,0.18)';
      slant(ctx, x, y, scoreW, rowH, 22);
      ctx.fill();
      ctx.fillStyle = r.own ? C.navy : C.white;
      ctx.textAlign = 'center';
      ctx.font = font(96, 800, true);
      ctx.fillText(r.score, x + scoreW / 2, y + rowH / 2 + 5);
    }
  });

  footer(ctx, [formatDateLong(s.date, hasResult ? '' : s.time), s.competition].filter(Boolean).join('  ·  ').toUpperCase(), s.handle || '');
}

/* ---------------- Spieltag-Übersicht ---------------- */
// Höhe des Fotostreifens oben in der Spieltag-Vorlage
export const photoHeight = () => T + 560;

export function drawMatchday(ctx, s, a) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.navy2);
  g.addColorStop(1, C.navy);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (a.photo) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawPhoto(ctx, a.photo, { x: 0, y: 0, w: W, h: photoHeight() }, s.pan);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 120, 0, photoHeight());
    fade.addColorStop(0, 'rgba(12,32,72,0.2)');
    fade.addColorStop(1, 'rgba(12,32,72,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, photoHeight());
  }
  stripes(ctx, 0.035);

  header(ctx, s, a);

  // Im Quadrat ist weniger Platz: Überschrift kleiner, Liste rückt nach oben
  const compact = H - T - B < 1200;
  const titleY = T + (compact ? 300 : 360);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.white;
  fit(ctx, (s.title || '').toUpperCase(), W - 112, compact ? 120 : 168, 800, true);
  ctx.fillText((s.title || '').toUpperCase(), 50, titleY);
  ctx.fillStyle = C.sky;
  ctx.font = font(compact ? 38 : 46, 700, true);
  spaced(ctx, (s.subtitle || '').toUpperCase(), 56, titleY + (compact ? 52 : 62), 3);

  const rows = s.rows || [];
  const listTop = titleY + (compact ? 92 : 110);
  const bottom = H - B - 130;
  const gap = compact ? 8 : 12;
  const rowH = rows.length ? Math.min(118, (bottom - listTop - gap * (rows.length - 1)) / rows.length) : 0;
  // Bei wenigen Spielen den Block im freien Bereich mittig setzen
  const blockH = rows.length * rowH + Math.max(0, rows.length - 1) * gap;
  const top = listTop + Math.max(0, (bottom - listTop - blockH) / 2 - 40);
  const results = s.mode === 'ergebnisse';

  rows.forEach((r, i) => {
    const y = top + i * (rowH + gap);
    // Altersklasse
    ctx.fillStyle = C.blue;
    slant(ctx, 40, y, 170, rowH, 18);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fit(ctx, r.label || '', 130, Math.min(58, rowH * 0.55), 800, true);
    ctx.fillText(r.label || '', 40 + 85, y + rowH / 2 + 2);

    // Spielpaarung
    const rightW = results ? 170 : 230;
    const midX = 40 + 170 + 10;
    const midW = W - 40 - midX - rightW - 10;
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    slant(ctx, midX, y, midW, rowH, 18);
    ctx.fill();
    const ls = rowH * 0.62;
    logo(ctx, r.logo || null, midX + 26 + ls / 2, y + rowH / 2, ls, r.opponent || '');
    const tx = midX + 26 + ls + 20;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.sky;
    ctx.font = font(Math.min(26, rowH * 0.24), 700);
    spaced(ctx, r.isHome ? 'HEIM GEGEN' : 'AUSWÄRTS BEI', tx, y + rowH * 0.3, 2);
    ctx.fillStyle = C.white;
    fit(ctx, (r.opponent || '').toUpperCase(), midW - (tx - midX) - 30, Math.min(48, rowH * 0.42), 800, true, 20);
    ctx.fillText((r.opponent || '').toUpperCase(), tx, y + rowH * 0.66);

    // Rechts: Termin oder Ergebnis
    const rx = W - 40 - rightW;
    if (r.cancelled) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      slant(ctx, rx, y, rightW, rowH, 18);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textAlign = 'center';
      fit(ctx, 'ABGESAGT', rightW - 44, Math.min(44, rowH * 0.4), 800, true);
      ctx.fillText('ABGESAGT', rx + rightW / 2, y + rowH / 2 + 3);
    } else if (results && r.result) {
      const o = r.outcome;
      ctx.fillStyle = o === 'S' ? C.win : o === 'N' ? C.loss : o === 'U' ? C.draw : C.white;
      slant(ctx, rx, y, rightW, rowH, 18);
      ctx.fill();
      ctx.fillStyle = o === 'U' || !o ? C.navy : C.white;
      ctx.textAlign = 'center';
      // Ergebnis immer aus JFG-Sicht (eigene Tore zuerst)
      const [h, gst] = r.result.split(':');
      fit(ctx, r.isHome ? `${h}:${gst}` : `${gst}:${h}`, rightW - 40, Math.min(66, rowH * 0.6), 800, true);
      ctx.fillText(r.isHome ? `${h}:${gst}` : `${gst}:${h}`, rx + rightW / 2, y + rowH / 2 + 3);
    } else {
      ctx.fillStyle = C.white;
      slant(ctx, rx, y, rightW, rowH, 18);
      ctx.fill();
      ctx.fillStyle = C.navy;
      ctx.textAlign = 'center';
      ctx.font = font(Math.min(26, rowH * 0.24), 700);
      ctx.fillText(r.day || '', rx + rightW / 2, y + rowH * 0.32);
      ctx.font = font(Math.min(50, rowH * 0.42), 800, true);
      ctx.fillText(results ? (r.result ? r.result : '–:–') : r.time ? r.time : 'TBA', rx + rightW / 2, y + rowH * 0.66);
    }
  });

  if (!rows.length) {
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.font = font(44, 600);
    ctx.fillText('Keine Spiele in diesem Zeitraum', W / 2, (listTop + bottom) / 2);
  }

  footer(ctx, s.footer || 'ALLE SPIELE AUF BFV.DE', s.handle || '');
}
