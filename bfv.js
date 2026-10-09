// Gemeinsame BFV-Logik für Browser (app.js) und GitHub Action (scripts/update.mjs).
// Quelle: das öffentliche BFV-Widget-API, das auch die Vereins-Widgets auf bfv.de nutzt.

export const BFV_API = 'https://widget-prod.bfv.de/api/service/widget/v1';

// Junioren-Klasse -> Altersklasse
const JUGEND = { A: 'U19', B: 'U17', C: 'U15', D: 'U13', E: 'U11', F: 'U9', G: 'U7' };

export function ageLabel(...texts) {
  for (const t of texts) {
    if (!t) continue;
    const u = String(t).match(/\bU\s?(\d{1,2})\b/i);
    if (u) return 'U' + u[1];
    const j = String(t).match(/\b([A-G])[- ]?(Junior|Jugend)/i);
    if (j) return JUGEND[j[1].toUpperCase()];
  }
  return '';
}

// "U13" + "JFG Rothsee Süd II" -> "U13 II" (damit mehrere Mannschaften einer Altersklasse unterscheidbar sind)
function withSuffix(label, name) {
  if (!label) return '';
  const m = String(name || '').match(/\s(II|III|IV|2|3|4)\b/);
  return m ? `${label} ${m[1]}` : label;
}

// "05.10.2026" oder "2026-10-05" -> "2026-10-05"
export function isoDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

export function cleanTime(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

// Nur echte Ergebnisse wie "3:1" durchlassen (keine Platzhalter wie "-:-" oder "Absetzung")
export function cleanResult(r) {
  const m = String(r || '').match(/(\d+)\s*:\s*(\d+)/);
  return m ? `${m[1]}:${m[2]}` : '';
}

export function isOwnTeam(name) {
  return /rothsee\s*s(ü|ue|u)d/i.test(name || '');
}

// Antwort von /team/{id}/matches in unser eigenes, flaches Format umwandeln
export function normalizeTeamMatches(json, teamId, override = {}) {
  const data = json?.data ?? json ?? {};
  const t = data.team ?? {};
  const team = {
    id: teamId,
    name: t.name || override.name || 'JFG Rothsee Süd',
    typeName: t.typeName || '',
    competition: t.competitionName || '',
    label: override.label || withSuffix(ageLabel(t.typeName, t.competitionName, t.name), t.name),
    clubId: t.clubId || '',
  };
  const matches = (data.matches ?? []).map((m) => {
    const home = m.homeTeamName || '';
    const guest = m.guestTeamName || '';
    const isHome = m.homeTeamPermanentId ? m.homeTeamPermanentId === teamId : isOwnTeam(home);
    return {
      id: m.matchId || `${teamId}-${m.kickoffDate}-${home}-${guest}`,
      teamId,
      label: team.label || ageLabel(m.teamType, m.competitionName),
      date: isoDate(m.kickoffDate),
      time: cleanTime(m.kickoffTime),
      home,
      guest,
      homeClubId: m.homeClubId || '',
      guestClubId: m.guestClubId || '',
      isHome,
      opponent: isHome ? guest : home,
      result: cleanResult(m.result),
      competition: m.competitionName || team.competition,
      competitionType: m.competitionType || '',
    };
  });
  return { team, matches };
}

// Aus Sicht der JFG: "S" Sieg, "N" Niederlage, "U" Unentschieden
export function outcome(match) {
  if (!match.result) return '';
  const [h, g] = match.result.split(':').map(Number);
  const own = match.isHome ? h : g;
  const opp = match.isHome ? g : h;
  return own > opp ? 'S' : own < opp ? 'N' : 'U';
}
