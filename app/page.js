import LeagueOverview from "@/components/LeagueOverview";
import { getOrganisationTeams } from "@/lib/rankedin";

export const revalidate = 300;

const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen";

function timeZoneOffsetMs(date, timeZone = COPENHAGEN_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function dateInCopenhagen(year, month, day, hour = 0, minute = 0, second = 0) {
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  let candidate = new Date(wallClockAsUtc);
  let offset = timeZoneOffsetMs(candidate);
  candidate = new Date(wallClockAsUtc - offset);

  const correctedOffset = timeZoneOffsetMs(candidate);
  if (correctedOffset !== offset) {
    candidate = new Date(wallClockAsUtc - correctedOffset);
  }

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();

  // RankedIn can return European dates without a timezone.
  // They represent Danish local time and must not be interpreted as UTC by Vercel.
  const eu = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (eu) {
    const [, d, m, y, h = "0", min = "0", sec = "0"] = eu;
    return dateInCopenhagen(y, m, d, h, min, sec);
  }

  // RankedIn also returns ISO-looking timestamps without Z / timezone offset.
  // Treat those as Copenhagen wall-clock time as well.
  const localIso = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
  );

  if (localIso) {
    const [, y, m, d, h = "0", min = "0", sec = "0"] = localIso;
    return dateInCopenhagen(y, m, d, h, min, sec);
  }

  // Explicit timezone values (Z / +01:00 / +02:00 etc.) can be parsed natively.
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasTime(value) {
  const raw = String(value || "").trim();
  const eu = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (eu) return Boolean(eu[4]) && !(+eu[4] === 0 && +eu[5] === 0);
  const iso = raw.match(/[T ](\d{1,2}):(\d{2})/);
  return Boolean(iso) && !(+iso[1] === 0 && +iso[2] === 0);
}

function same(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function leagueType(league) {
  const s = String(league || "").toLowerCase();
  if (s.includes("4p")) return { label: "4P", cls: "fourp" };
  if (s.includes("forenings")) return { label: "Foreningsligaen", cls: "forening" };
  if (s.includes("lunar")) return { label: "Lunar Ligaen", cls: "lunar" };
  return { label: league || "Liga", cls: "other" };
}

function buildMatches(teams) {
  const all = [];
  for (const team of teams) {
    const candidates = [team.nextMatch, ...(team.upcomingHomeMatches || [])].filter(Boolean);
    for (const match of candidates) {
      const date = parseDate(match.date);
      if (!date || date.getTime() < Date.now() || match.showResults) continue;
      const isHome = same(match.home, team.name);
      const isAway = same(match.away, team.name);
      if (!isHome && !isAway) continue;
      all.push({
        id: match.id,
        teamId: team.id,
        teamName: team.name,
        opponent: isHome ? match.away : match.home,
        isHome,
        date,
        hasTime: hasTime(match.date),
        location: match.location || (isHome ? team.homeCourt : "") || "Spillested ikke angivet",
        division: team.division || "",
        type: leagueType(team.league),
      });
    }
  }
  const unique = new Map();
  all.forEach((m) => {
    const key = String(m.id || `${m.teamId}-${m.date.getTime()}-${m.opponent}`);
    if (!unique.has(key)) unique.set(key, m);
  });
  return [...unique.values()].sort((a, b) => a.date - b.date).slice(0, 5);
}

const dateText = (date) => new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen", weekday: "short", day: "numeric", month: "short"
}).format(date);

const timeText = (date) => new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit"
}).format(date);

function MatchesWidget({ matches, error }) {
  return (
    <main className="epf-matches-frame">
      <style>{`
        html,body{margin:0!important;padding:0!important;background:transparent!important}.epf-matches-frame{--dark:#2C292A;--light:#98B4DF;--blue:#2A3E91;--cream:#F0ECE5;--sand:#D6CCBB;font-family:Arial,Helvetica,sans-serif;color:var(--dark);background:transparent}.epf-matches-frame *{box-sizing:border-box}.epf-matches{overflow:hidden;border:1px solid var(--sand);border-radius:22px;background:var(--cream);box-shadow:0 12px 34px rgba(44,41,42,.09)}.epf-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 20px;border-bottom:1px solid var(--sand)}.epf-eyebrow{display:block;margin-bottom:3px;color:var(--blue);font-size:10px;font-weight:900;letter-spacing:.13em}.epf-head h1{margin:0;color:var(--dark);font-size:19px}.epf-all{padding:8px 11px;border-radius:999px;background:var(--light);color:var(--dark);font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}.epf-match{display:grid;grid-template-columns:92px minmax(0,1fr) 22px;gap:16px;align-items:center;min-height:82px;padding:13px 18px;border-top:1px solid var(--sand);color:inherit;text-decoration:none}.epf-match:first-child{border-top:0;border-left:4px solid var(--blue);padding-left:14px}.epf-match:hover{background:var(--sand)}.epf-date strong,.epf-date span{display:block}.epf-date strong{color:var(--blue);font-size:13px;text-transform:capitalize}.epf-date span{margin-top:4px;font-size:12px;font-weight:700}.epf-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px}.epf-badge{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}.epf-home,.epf-lunar{background:var(--blue);color:var(--cream)}.epf-away{border:1px solid var(--blue);color:var(--blue)}.epf-forening{background:var(--light);color:var(--dark)}.epf-fourp{background:var(--sand);color:var(--dark)}.epf-other{border:1px solid var(--sand)}.epf-division{font-size:10px;font-weight:700;opacity:.68}.epf-title{display:block;overflow:hidden;color:var(--dark);font-size:14px;white-space:nowrap;text-overflow:ellipsis}.epf-title span{color:var(--blue);font-weight:500}.epf-location{overflow:hidden;margin-top:4px;font-size:11px;white-space:nowrap;text-overflow:ellipsis;opacity:.68}.epf-arrow{color:var(--blue);font-size:18px;font-weight:900;text-align:right}.epf-foot{padding:11px 18px;border-top:1px solid var(--sand);background:var(--sand);font-size:10px;text-align:center}.epf-empty{padding:28px 20px;text-align:center}@media(max-width:600px){.epf-matches{border-radius:16px}.epf-head{padding:12px 13px}.epf-eyebrow{font-size:8px}.epf-head h1{font-size:15px}.epf-all{padding:7px 9px;font-size:10px}.epf-match{grid-template-columns:62px minmax(0,1fr) 14px;gap:9px;min-height:80px;padding:10px 12px}.epf-match:first-child{padding-left:8px}.epf-date strong{font-size:10.5px}.epf-date span{font-size:10px}.epf-meta{gap:4px;margin-bottom:5px}.epf-badge{min-height:18px;padding:0 6px;font-size:6.8px}.epf-division{font-size:8.5px}.epf-title{font-size:11.5px}.epf-location{font-size:9.5px}.epf-arrow{font-size:14px}.epf-foot{padding:9px 12px;font-size:9px}}
      `}</style>
      <section className="epf-matches">
        <header className="epf-head">
          <div><span className="epf-eyebrow">ESBJERG PADEL FORENING</span><h1>Næste EPF-kampe</h1></div>
          <a className="epf-all" href="https://epf-lunar-liga.vercel.app/" target="_blank" rel="noreferrer">Alle hold →</a>
        </header>
        {error ? <div className="epf-empty">{error}</div> : matches.length ? matches.map((m) => (
          <a className="epf-match" href={`/team/${m.teamId}?focusMatch=${encodeURIComponent(m.id || "")}`} target="_blank" rel="noreferrer" key={`${m.id}-${m.teamId}`}>
            <div className="epf-date"><strong>{dateText(m.date)}</strong><span>{m.hasTime ? timeText(m.date) : "afventer"}</span></div>
            <div>
              <div className="epf-meta">
                <span className={`epf-badge ${m.isHome ? "epf-home" : "epf-away"}`}>{m.isHome ? "HJEMME" : "UDE"}</span>
                <span className={`epf-badge epf-${m.type.cls}`}>{m.type.label}</span>
                {m.division && <span className="epf-division">{m.division}</span>}
              </div>
              <strong className="epf-title">{m.teamName} <span>vs.</span> {m.opponent}</strong>
              <div className="epf-location">{m.location}</div>
            </div>
            <div className="epf-arrow">→</div>
          </a>
        )) : <div className="epf-empty">Ingen kommende EPF-kampe fundet.</div>}
        <footer className="epf-foot">Opdateres automatisk fra Rankedin</footer>
      </section>
    </main>
  );
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const embed = params?.embed === "matches";
  let teams = [];
  let error = "";
  try { teams = await getOrganisationTeams(); }
  catch (e) { console.error(e); error = "Holdene kunne ikke hentes fra Rankedin lige nu."; }

  if (embed) return <MatchesWidget matches={error ? [] : buildMatches(teams)} error={error} />;

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Esbjerg Padel Forening</div>
        <h1>EPF hold & ligaer</h1>
        <p>Følg foreningens aktive hold på tværs af ligaer. Søg efter spillere, hold, rækker eller ligaer, og se kampe, kampdetaljer og stillinger samlet ét sted.</p>
      </section>
      {error ? <div className="notice error">{error}</div> : <LeagueOverview teams={teams} />}
      <footer className="footer">Data hentes automatisk fra Rankedin. Kun hold med Home Club “Esbjerg Padel Forening” vises.<div className="version-tag">EPF Liga v26</div></footer>
    </main>
  );
}
