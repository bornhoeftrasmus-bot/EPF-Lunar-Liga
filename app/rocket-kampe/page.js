import styles from "./page.module.css";

export const revalidate = 300;

export const metadata = {
  title: "Rocket Padel Esbjerg – kommende kampe",
  description:
    "Automatisk oversigt over kommende hjemmekampe i Rocket Padel Esbjerg.",
};

const API = "https://api.rankedin.com/v1";
const ORGANISATION_ID = 9002;
const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen";

async function rankedInFetch(url, revalidate = 300) {
  const response = await fetch(url, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
      "User-Agent": "EPF-Rocket-Kampe/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Rankedin returned ${response.status} for ${url}`);
  }

  return response.json();
}

function get(obj, ...paths) {
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

function extractTeamsFromOrganisationPayload(data) {
  const found = new Map();

  function addTeam(item, leagueName = "") {
    if (!item || typeof item !== "object") return;

    const teamId = Number(get(item, "teamId", "TeamId", "id", "Id"));
    const teamName = String(
      get(item, "teamName", "TeamName", "name", "Name") || ""
    ).trim();

    if (!Number.isFinite(teamId) || !teamName) return;

    if (!found.has(String(teamId))) {
      found.set(String(teamId), {
        id: teamId,
        name: teamName,
        league:
          get(
            item,
            "teamLeagueName",
            "TeamLeagueName",
            "leagueName",
            "LeagueName"
          ) ||
          leagueName ||
          "",
      });
    }
  }

  function walk(value, leagueName = "", parentKey = "") {
    if (!value) return;

    if (Array.isArray(value)) {
      if (/teams|participants|teamleagueteams/i.test(parentKey)) {
        value.forEach((item) => addTeam(item, leagueName));
      }

      value.forEach((item) => walk(item, leagueName, parentKey));
      return;
    }

    if (typeof value !== "object") return;

    const currentLeague =
      get(
        value,
        "teamLeagueName",
        "TeamLeagueName",
        "leagueName",
        "LeagueName"
      ) ||
      (/league/i.test(parentKey) ? get(value, "name", "Name") : "") ||
      leagueName;

    const nestedTeam = value.team || value.Team;
    if (nestedTeam && typeof nestedTeam === "object") {
      addTeam(nestedTeam, currentLeague);
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        Array.isArray(child) &&
        /teams|participants|teamleagueteams/i.test(key)
      ) {
        child.forEach((item) => addTeam(item, currentLeague));
      }

      walk(child, currentLeague, key);
    }
  }

  walk(data);
  return [...found.values()];
}

async function getAllOrganisationCandidates() {
  const TAKE = 100;
  const MAX_PAGES = 25;
  const unique = new Map();
  let emptyPages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * TAKE;

    const payload = await rankedInFetch(
      `${API}/Organization/GetOrganisationTeamLeaguesAsync?organisationId=${ORGANISATION_ID}&isFinished=false&skip=${skip}&take=${TAKE}&language=en`,
      300
    );

    const candidates = extractTeamsFromOrganisationPayload(payload);

    if (candidates.length === 0) {
      emptyPages += 1;
    } else {
      emptyPages = 0;
    }

    for (const team of candidates) {
      unique.set(String(team.id), team);
    }

    if (emptyPages >= 2) break;
  }

  return [...unique.values()];
}

async function getTeamHomepage(teamId) {
  return rankedInFetch(
    `${API}/TeamLeague/GetTeamLeagueTeamHomepageAsync?teamId=${encodeURIComponent(teamId)}&language=en`,
    300
  );
}

async function getTeamMatchesRaw(teamId) {
  return rankedInFetch(
    `${API}/teamleague/GetTeamMatchesAsync?teamid=${encodeURIComponent(teamId)}&language=en`,
    60
  );
}

function extractMatchRows(data) {
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.Matches)) return data.Matches;

  const candidates = [];

  function walk(value, depth = 0) {
    if (depth > 7 || !value) return;

    if (Array.isArray(value)) {
      const looksLikeMatches = value.some(
        (item) =>
          item &&
          typeof item === "object" &&
          (get(item, "team1.name", "Team1.Name") ||
            get(item, "team2.name", "Team2.Name"))
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

function normalizeVenue(value) {
  return String(value || "")
    .toLocaleLowerCase("da")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9æøå\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRocketPadelEsbjerg(value) {
  const venue = normalizeVenue(value);

  return (
    venue.includes("rocket padel esbjerg") ||
    (venue.includes("rocket") &&
      venue.includes("padel") &&
      venue.includes("esbjerg"))
  );
}

function sameName(a, b) {
  return (
    String(a || "").trim().toLocaleLowerCase("da") ===
    String(b || "").trim().toLocaleLowerCase("da")
  );
}

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

function parseRankedinDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();

  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (european) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = european;
    return dateInCopenhagen(year, month, day, hour, minute, second);
  }

  const localIso = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
  );

  if (localIso) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = localIso;
    return dateInCopenhagen(year, month, day, hour, minute, second);
  }

  const native = new Date(raw);
  return Number.isNaN(native.getTime()) ? null : native;
}

function hasTime(value) {
  const raw = String(value || "").trim();

  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
  );

  if (european) {
    return (
      Boolean(european[4]) &&
      !(Number(european[4]) === 0 && Number(european[5]) === 0)
    );
  }

  const iso = raw.match(/[T ](\d{1,2}):(\d{2})/);
  return Boolean(iso) && !(Number(iso[1]) === 0 && Number(iso[2]) === 0);
}

function startOfTodayInCopenhagen() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COPENHAGEN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return dateInCopenhagen(values.year, values.month, values.day, 0, 0, 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: COPENHAGEN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: COPENHAGEN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeMatch(match, index) {
  return {
    id:
      get(
        match,
        "id",
        "Id",
        "teamMatchId",
        "TeamMatchId",
        "matchId",
        "MatchId"
      ) || index,
    date: get(
      match,
      "details.time",
      "Details.Time",
      "details.date",
      "Details.Date",
      "startDate",
      "StartDate",
      "matchDate",
      "MatchDate"
    ),
    home:
      get(
        match,
        "team1.name",
        "Team1.Name",
        "homeTeam.name",
        "HomeTeam.Name",
        "homeTeamName",
        "HomeTeamName",
        "team1Name",
        "Team1Name"
      ) || "Ukendt hjemmehold",
    away:
      get(
        match,
        "team2.name",
        "Team2.Name",
        "awayTeam.name",
        "AwayTeam.Name",
        "awayTeamName",
        "AwayTeamName",
        "team2Name",
        "Team2Name"
      ) || "Ukendt udehold",
    location: get(
      match,
      "details.locationName",
      "Details.LocationName",
      "locationName",
      "LocationName",
      "venueName",
      "VenueName"
    ),
  };
}

async function getRocketTeams() {
  const candidates = await getAllOrganisationCandidates();
  const rocketTeams = [];
  const BATCH_SIZE = 8;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (candidate) => {
        const homepage = await getTeamHomepage(candidate.id);
        const team = homepage?.team || homepage?.Team || {};

        const homeCourt = get(
          team,
          "homeCourtOrganisation.name",
          "HomeCourtOrganisation.Name",
          "homeCourt.name",
          "HomeCourt.Name"
        );

        if (!isRocketPadelEsbjerg(homeCourt)) return null;

        const name = get(team, "name", "Name") || candidate.name;
        const league =
          get(homepage, "teamLeagueName", "TeamLeagueName") ||
          candidate.league ||
          "–";

        return {
          id: Number(get(team, "id", "Id")) || candidate.id,
          name,
          league,
          division:
            get(
              team,
              "divisionName",
              "DivisionName",
              "division",
              "Division"
            ) ||
            get(team, "regionName", "RegionName", "region", "Region") ||
            "–",
          homeCourt,
        };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        rocketTeams.push(result.value);
      }
    }
  }

  return rocketTeams;
}

async function buildRocketMatches() {
  const teams = await getRocketTeams();
  const today = startOfTodayInCopenhagen();
  const unique = new Map();
  const BATCH_SIZE = 6;

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (team) => {
        const raw = await getTeamMatchesRaw(team.id);
        const matches = extractMatchRows(raw).map(normalizeMatch);

        return matches
          .filter((match) => sameName(match.home, team.name))
          .map((match) => ({ ...match, team }));
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;

      for (const { team, ...match } of result.value) {
        const date = parseRankedinDate(match.date);
        if (!date || (today && date.getTime() < today.getTime())) continue;

        // Hvis kampen har et konkret spillested, er det dét der gælder.
        // Ellers bruger vi holdets registrerede hjemmebane.
        const venue = match.location || team.homeCourt || "";
        if (!isRocketPadelEsbjerg(venue)) continue;

        const key = String(
          match.id || `${team.id}-${match.date}-${match.home}-${match.away}`
        );

        if (!unique.has(key)) {
          unique.set(key, {
            id: key,
            date,
            hasTime: hasTime(match.date),
            home: match.home,
            away: match.away,
            league: team.league,
            division: team.division,
          });
        }
      }
    }
  }

  return [...unique.values()].sort((a, b) => a.date - b.date);
}

export default async function RocketKampePage() {
  const matches = await buildRocketMatches();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>ROCKET PADEL ESBJERG</div>
        <h1>Kommende kampe</h1>
        <p>
          En enkel oversigt over kommende hjemmekampe for hold, der har
          Rocket Padel Esbjerg registreret som hjemmebane i Rankedin.
          Kampene står automatisk i datoorden.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTop}>
          <div>
            <span className={styles.smallLabel}>KAMPOVERSIGT</span>
            <h2>Rocket Padel Esbjerg</h2>
          </div>

          <div className={styles.count}>
            <strong>{matches.length}</strong>
            <span>{matches.length === 1 ? "kommende kamp" : "kommende kampe"}</span>
          </div>
        </div>

        {matches.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Tid</th>
                  <th>Hjemmehold</th>
                  <th>Udehold</th>
                  <th>Liga</th>
                  <th>Række</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td data-label="Dato">
                      <strong>{formatDate(match.date)}</strong>
                    </td>
                    <td data-label="Tid">
                      {match.hasTime ? formatTime(match.date) : "Afventer"}
                    </td>
                    <td data-label="Hjemmehold">
                      <strong>{match.home}</strong>
                    </td>
                    <td data-label="Udehold">{match.away}</td>
                    <td data-label="Liga">{match.league}</td>
                    <td data-label="Række">{match.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            Der er ingen kommende kampe registreret i Rocket Padel Esbjerg lige nu.
          </div>
        )}

        <div className={styles.footerNote}>
          Data hentes automatisk fra Rankedin og opdateres løbende.
        </div>
      </section>
    </main>
  );
}
