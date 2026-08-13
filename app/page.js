import LeagueOverview from "@/components/LeagueOverview";
import { getOrganisationTeams } from "@/lib/rankedin";

export const revalidate = 300;

const RANKEDIN_API = "https://api.rankedin.com/v1";

function getValue(obj, ...paths) {
  for (const path of paths) {
    let current = obj;

    for (const key of path.split(".")) {
      if (current == null) {
        current = undefined;
        break;
      }
      current = current[key];
    }

    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }

  return "";
}

function parseMatchDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
  );

  if (european) {
    const [, day, month, year, hour = "0", minute = "0"] = european;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameTeam(a, b) {
  return String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase();
}

function extractMatchRows(data) {
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.Matches)) return data.Matches;

  const candidates = [];

  function walk(value, depth = 0) {
    if (depth > 7 || !value) return;

    if (Array.isArray(value)) {
      const looksLikeMatches = value.some((item) =>
        item &&
        typeof item === "object" &&
        (
          getValue(item, "team1.name", "Team1.Name") ||
          getValue(item, "team2.name", "Team2.Name")
        )
      );

      if (looksLikeMatches) candidates.push(value);
      value.forEach((item) => walk(item, depth + 1));
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach((child) => walk(child, depth + 1));
    }
  }

  walk(data);
  return candidates[0] || [];
}

async function fetchTeamMatches(teamId) {
  const response = await fetch(
    `${RANKEDIN_API}/teamleague/GetTeamMatchesAsync?teamid=${encodeURIComponent(teamId)}&language=en`,
    {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
        "User-Agent": "EPF-Hold-Ligaer/13.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Rankedin returned ${response.status}`);
  }

  return response.json();
}

function normalizeWidgetMatch(match, team, index) {
  const rawDate = getValue(
    match,
    "details.time",
    "Details.Time",
    "details.date",
    "Details.Date",
    "startDate",
    "StartDate",
    "matchDate",
    "MatchDate"
  );

  const date = parseMatchDate(rawDate);

  const home = getValue(
    match,
    "team1.name",
    "Team1.Name",
    "homeTeam.name",
    "HomeTeam.Name",
    "homeTeamName",
    "HomeTeamName",
    "team1Name",
    "Team1Name"
  );

  const away = getValue(
    match,
    "team2.name",
    "Team2.Name",
    "awayTeam.name",
    "AwayTeam.Name",
    "awayTeamName",
    "AwayTeamName",
    "team2Name",
    "Team2Name"
  );

  const isHome = sameTeam(home, team.name);
  const isAway = sameTeam(away, team.name);

  if (!date || (!isHome && !isAway)) return null;

  const showResults = getValue(match, "showResults", "ShowResults") === true;

  const matchId = getValue(
    match,
    "id",
    "Id",
    "teamMatchId",
    "TeamMatchId",
    "matchId",
    "MatchId"
  ) || `${team.id}-${index}`;

  return {
    matchId,
    teamId: team.id,
    teamName: team.name,
    opponent: isHome ? away : home,
    isHome,
    date,
    showResults,
    location:
      getValue(
        match,
        "details.locationName",
        "Details.LocationName",
        "locationName",
        "LocationName",
        "venueName",
        "VenueName"
      ) ||
      (isHome ? team.homeCourt : "") ||
      "Spillested ikke angivet",
    league: team.league || "",
    division: team.division || "",
  };
}

async function getUpcomingEPFMatches(teams) {
  const collected = [];
  const BATCH_SIZE = 6;

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (team) => ({
        team,
        raw: await fetchTeamMatches(team.id),
      }))
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;

      const { team, raw } = result.value;
      const rows = extractMatchRows(raw);

      rows.forEach((row, index) => {
        const match = normalizeWidgetMatch(row, team, index);
        if (!match) return;
        if (match.date.getTime() < Date.now()) return;
        if (match.showResults) return;
        collected.push(match);
      });
    }
  }

  const unique = new Map();

  for (const match of collected) {
    const key = String(match.matchId);
    if (!unique.has(key)) unique.set(key, match);
  }

  return [...unique.values()]
    .sort((a, b) => a.date - b.date)
    .slice(0, 5);
}

function formatWidgetDate(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatWidgetTime(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MatchesWidget({ matches, error }) {
  return (
    <main className="epfMatchesFrame">
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          background-image: none !important;
        }

        .epfMatchesFrame {
          --navy: #0A1F3C;
          --light-blue: #AFC4D6;
          --muted: #66788A;
          --line: rgba(175, 196, 214, .62);
          width: 100%;
          margin: 0;
          padding: 0;
          background: transparent;
          color: var(--navy);
          font-family: Arial, Helvetica, sans-serif;
          box-sizing: border-box;
        }

        .epfMatchesFrame * {
          box-sizing: border-box;
        }

        .epfMatchesWidget {
          overflow: hidden;
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 12px 34px rgba(10, 31, 60, .08);
        }

        .epfMatchesHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 20px;
          border-bottom: 1px solid var(--line);
          background: #fff;
        }

        .epfMatchesEyebrow {
          display: block;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .13em;
          color: var(--navy);
        }

        .epfMatchesHeader h1 {
          margin: 0;
          font-size: 19px;
          line-height: 1.15;
          color: var(--navy);
        }

        .epfMatchesHeader > a {
          flex: 0 0 auto;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(175, 196, 214, .28);
          color: var(--navy);
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
        }

        .epfMatchesList {
          background: #fff;
        }

        .epfMatchRow {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr) 24px;
          gap: 16px;
          align-items: center;
          min-height: 78px;
          padding: 13px 18px;
          border-top: 1px solid var(--line);
          background: #fff;
          color: inherit;
          text-decoration: none;
          transition: background .18s ease;
        }

        .epfMatchRow:first-child {
          border-top: 0;
        }

        .epfMatchRow:hover {
          background: rgba(175, 196, 214, .10);
        }

        .epfMatchRowPrimary {
          border-left: 4px solid var(--navy);
          padding-left: 14px;
        }

        .epfMatchDate strong,
        .epfMatchDate span {
          display: block;
        }

        .epfMatchDate strong {
          font-size: 13px;
          text-transform: capitalize;
          color: var(--navy);
        }

        .epfMatchDate span {
          margin-top: 4px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .epfMatchTopline {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
        }

        .epfMatchBadge {
          display: inline-flex;
          align-items: center;
          min-height: 20px;
          padding: 0 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .epfMatchBadge.home {
          background: var(--navy);
          color: #fff;
        }

        .epfMatchBadge.away {
          background: rgba(175, 196, 214, .34);
          color: var(--navy);
        }

        .epfMatchLeague {
          overflow: hidden;
          color: var(--muted);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .epfMatchTitle {
          display: block;
          overflow: hidden;
          font-size: 14px;
          line-height: 1.28;
          color: var(--navy);
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .epfMatchTitle span {
          color: var(--muted);
          font-weight: 500;
        }

        .epfMatchLocation {
          overflow: hidden;
          margin-top: 4px;
          color: var(--muted);
          font-size: 11px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .epfMatchArrow {
          color: var(--navy);
          font-size: 18px;
          font-weight: 800;
          text-align: right;
        }

        .epfMatchesFooter {
          padding: 11px 18px;
          border-top: 1px solid var(--line);
          color: #7C8D9C;
          background: #fff;
          font-size: 10px;
          text-align: center;
        }

        .epfMatchesEmpty {
          padding: 28px 20px;
          color: var(--muted);
          background: #fff;
          font-size: 13px;
          text-align: center;
        }

        @media (max-width: 600px) {
          .epfMatchesWidget {
            border-radius: 16px;
            box-shadow: 0 7px 20px rgba(10, 31, 60, .07);
          }

          .epfMatchesHeader {
            padding: 12px 13px;
          }

          .epfMatchesEyebrow {
            font-size: 8px;
          }

          .epfMatchesHeader h1 {
            font-size: 15px;
          }

          .epfMatchesHeader > a {
            padding: 7px 9px;
            font-size: 10px;
          }

          .epfMatchRow {
            grid-template-columns: 62px minmax(0, 1fr) 14px;
            gap: 10px;
            min-height: 72px;
            padding: 10px 12px;
          }

          .epfMatchRowPrimary {
            padding-left: 8px;
          }

          .epfMatchDate strong {
            font-size: 10.5px;
          }

          .epfMatchDate span {
            margin-top: 3px;
            font-size: 10px;
          }

          .epfMatchTopline {
            gap: 5px;
            margin-bottom: 4px;
          }

          .epfMatchBadge {
            min-height: 18px;
            padding-inline: 6px;
            font-size: 7px;
          }

          .epfMatchLeague {
            font-size: 8.5px;
          }

          .epfMatchTitle {
            font-size: 11.5px;
          }

          .epfMatchLocation {
            margin-top: 3px;
            font-size: 9.5px;
          }

          .epfMatchArrow {
            font-size: 14px;
          }

          .epfMatchesFooter {
            padding: 9px 12px;
            font-size: 9px;
          }
        }
      `}</style>

      <section className="epfMatchesWidget">
        <header className="epfMatchesHeader">
          <div>
            <span className="epfMatchesEyebrow">ESBJERG PADEL FORENING</span>
            <h1>Næste EPF-kampe</h1>
          </div>
          <a href="https://epf-lunar-liga.vercel.app/" target="_blank" rel="noreferrer">
            Alle hold →
          </a>
        </header>

        {error ? (
          <div className="epfMatchesEmpty">{error}</div>
        ) : matches.length ? (
          <div className="epfMatchesList">
            {matches.map((match, index) => {
              const href = `/team/${match.teamId}${
                match.matchId ? `?focusMatch=${encodeURIComponent(match.matchId)}` : ""
              }`;

              return (
                <a
                  className={`epfMatchRow ${index === 0 ? "epfMatchRowPrimary" : ""}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  key={`${match.matchId}-${match.teamId}`}
                >
                  <div className="epfMatchDate">
                    <strong>{formatWidgetDate(match.date)}</strong>
                    <span>{formatWidgetTime(match.date)}</span>
                  </div>

                  <div className="epfMatchMain">
                    <div className="epfMatchTopline">
                      <span className={`epfMatchBadge ${match.isHome ? "home" : "away"}`}>
                        {match.isHome ? "HJEMME" : "UDE"}
                      </span>
                      {(match.division || match.league) && (
                        <span className="epfMatchLeague">
                          {match.division || match.league}
                        </span>
                      )}
                    </div>

                    <strong className="epfMatchTitle">
                      {match.teamName} <span>vs.</span> {match.opponent}
                    </strong>

                    <div className="epfMatchLocation">{match.location}</div>
                  </div>

                  <div className="epfMatchArrow">→</div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="epfMatchesEmpty">Ingen kommende EPF-kampe fundet.</div>
        )}

        <footer className="epfMatchesFooter">
          Opdateres automatisk fra Rankedin
        </footer>
      </section>
    </main>
  );
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const isMatchesEmbed = params?.embed === "matches";

  let teams = [];
  let error = "";

  try {
    teams = await getOrganisationTeams();
  } catch (e) {
    console.error(e);
    error = "Holdene kunne ikke hentes fra Rankedin lige nu.";
  }

  if (isMatchesEmbed) {
    let matches = [];
    let matchesError = error;

    if (!matchesError) {
      try {
        matches = await getUpcomingEPFMatches(teams);
      } catch (e) {
        console.error(e);
        matchesError = "Kampene kunne ikke hentes fra Rankedin lige nu.";
      }
    }

    return <MatchesWidget matches={matches} error={matchesError} />;
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Esbjerg Padel Forening</div>
        <h1>EPF hold & ligaer</h1>
        <p>
          Følg foreningens aktive hold på tværs af ligaer. Søg efter spillere,
          hold, rækker eller ligaer, og se kampe, kampdetaljer og stillinger
          samlet ét sted.
        </p>
      </section>

      {error ? (
        <div className="notice error">{error}</div>
      ) : (
        <LeagueOverview teams={teams} />
      )}

      <footer className="footer">
        Data hentes automatisk fra Rankedin. Kun hold med Home Club
        “Esbjerg Padel Forening” vises.
        <div className="version-tag">EPF Liga v26</div>
      </footer>
    </main>
  );
}
