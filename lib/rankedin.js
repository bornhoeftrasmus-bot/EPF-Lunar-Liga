const API = "https://api.rankedin.com/v1";
const ORGANISATION_ID = 9002;
const HOME_CLUB = "Esbjerg Padel Forening";

async function rankedInFetch(url, revalidate = 60) {
  const res = await fetch(url, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
      "User-Agent": "EPF-Hold-Ligaer/13.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Rankedin returned ${res.status} for ${url}`);
  }

  return res.json();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeName(player) {
  const direct = get(player, "name", "Name");
  if (direct) return String(direct).trim();

  return [
    get(player, "firstName", "FirstName"),
    get(player, "middleName", "MiddleName"),
    get(player, "lastName", "LastName")
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || "Ukendt spiller";
}

function normalizePlayer(player) {
  const rankedInId = get(player, "rankedinId", "RankedinId");
  const explicitUrl = get(player, "playerUrl", "PlayerUrl");

  let url = "";

  if (explicitUrl) {
    url = String(explicitUrl).startsWith("http")
      ? String(explicitUrl)
      : `https://www.rankedin.com${explicitUrl}`;
  } else if (rankedInId) {
    url = `https://www.rankedin.com/en/player/${rankedInId}`;
  }

  return {
    id: get(player, "id", "Id") || normalizeName(player),
    name: normalizeName(player),
    role: get(
      player,
      "teamParticipantType",
      "TeamParticipantType",
      "role",
      "Role"
    ),
    rating: get(
      player,
      "ratingBegin",
      "RatingBegin",
      "rating",
      "Rating",
      "skillIndex",
      "SkillIndex"
    ),
    url
  };
}

function parseTeamIdFromParticipantUrl(url) {
  if (!url) return null;

  const match = String(url).match(/\/team\/homepage\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function absoluteRankedInUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return "";

  const value = String(relativeOrAbsolute);
  return value.startsWith("http")
    ? value
    : `https://www.rankedin.com${value}`;
}

/* -------------------------------------------------------------------------- */
/* ORGANISATION / ALL ACTIVE EPF TEAMS                                        */
/* -------------------------------------------------------------------------- */

function extractTeamsFromOrganisationPayload(data) {
  const found = new Map();

  function addTeam(item, leagueName = "") {
    if (!item || typeof item !== "object") return;

    const teamId = Number(
      get(item, "teamId", "TeamId", "id", "Id")
    );

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
          ""
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
      (
        /league/i.test(parentKey)
          ? get(value, "name", "Name")
          : ""
      ) ||
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
  /*
    We deliberately paginate until two consecutive empty pages.
    That prevents a sparse/empty page from making active teams disappear.
  */
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
      emptyPages++;
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

export async function getTeamHomepage(teamId) {
  return rankedInFetch(
    `${API}/TeamLeague/GetTeamLeagueTeamHomepageAsync?teamId=${encodeURIComponent(teamId)}&language=en`,
    60
  );
}

async function getTeamHomepageWithRetry(teamId, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getTeamHomepage(teamId);
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * attempt)
        );
      }
    }
  }

  throw lastError;
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
      const looksLikeMatches = value.some((item) =>
        item &&
        typeof item === "object" &&
        (
          get(item, "team1.name", "Team1.Name") ||
          get(item, "team2.name", "Team2.Name")
        )
      );

      if (looksLikeMatches) candidates.push(value);

      value.forEach((item) => walk(item, depth + 1));
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach((child) =>
        walk(child, depth + 1)
      );
    }
  }

  walk(data);
  return candidates[0] || [];
}

function normalizeMatch(match, index) {
  const date = get(
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

  const home = get(
    match,
    "team1.name",
    "Team1.Name",
    "homeTeam.name",
    "HomeTeam.Name",
    "homeTeamName",
    "HomeTeamName",
    "team1Name",
    "Team1Name"
  ) || "Ukendt hjemmehold";

  const away = get(
    match,
    "team2.name",
    "Team2.Name",
    "awayTeam.name",
    "AwayTeam.Name",
    "awayTeamName",
    "AwayTeamName",
    "team2Name",
    "Team2Name"
  ) || "Ukendt udehold";

  const homeScoreRaw = get(
    match,
    "team1.result",
    "Team1.Result",
    "homeScore",
    "HomeScore"
  );

  const awayScoreRaw = get(
    match,
    "team2.result",
    "Team2.Result",
    "awayScore",
    "AwayScore"
  );

  const homeScore =
    homeScoreRaw === "" ? "" : Number(homeScoreRaw);

  const awayScore =
    awayScoreRaw === "" ? "" : Number(awayScoreRaw);

  const meaningfulScore =
    Number.isFinite(homeScore) &&
    Number.isFinite(awayScore) &&
    (homeScore + awayScore > 0);

  const explicitShowResults =
    get(match, "showResults", "ShowResults") === true;

  const parsedDate = date ? new Date(date) : null;
  const isFuture =
    parsedDate &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.getTime() > Date.now();

  let status = "Afventer resultat";

  if (explicitShowResults && meaningfulScore) {
    status = "Spillet";
  } else if (isFuture) {
    status = "Kommende";
  }

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
      ) ||
      index,

    homeId:
      Number(
        get(
          match,
          "team1.id",
          "Team1.Id",
          "homeTeam.id",
          "HomeTeam.Id",
          "homeTeamId",
          "HomeTeamId",
          "team1Id",
          "Team1Id"
        )
      ) || null,

    awayId:
      Number(
        get(
          match,
          "team2.id",
          "Team2.Id",
          "awayTeam.id",
          "AwayTeam.Id",
          "awayTeamId",
          "AwayTeamId",
          "team2Id",
          "Team2Id"
        )
      ) || null,

    round: get(
      match,
      "details.round",
      "Details.Round",
      "round",
      "Round"
    ),

    date,
    home,
    away,

    location: get(
      match,
      "details.locationName",
      "Details.LocationName",
      "locationName",
      "LocationName",
      "venueName",
      "VenueName"
    ),

    address: get(
      match,
      "details.address",
      "Details.Address",
      "address",
      "Address"
    ),

    homeScore: meaningfulScore ? homeScore : "",
    awayScore: meaningfulScore ? awayScore : "",
    showResults:
      explicitShowResults && meaningfulScore,
    status
  };
}

function upcomingMatches(matches) {
  const now = Date.now();

  return matches
    .filter((match) => {
      if (!match.date) return false;

      const parsed = new Date(match.date);
      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.getTime() >= now
      );
    })
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );
}

export async function getOrganisationTeams() {
  const candidates = await getAllOrganisationCandidates();
  const teams = [];

  /*
    IMPORTANT:
    The organisation list is the master list.
    A failure in homepage data or match data must NEVER silently remove
    a team from the overview.

    Homepage and matches are therefore fetched independently.
  */
  const BATCH_SIZE = 5;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const enriched = await Promise.all(
      batch.map(async (candidate) => {
        const [homepageResult, matchesResult] = await Promise.allSettled([
          getTeamHomepageWithRetry(candidate.id),
          getTeamMatchesRaw(candidate.id)
        ]);

        const homepage =
          homepageResult.status === "fulfilled"
            ? homepageResult.value
            : null;

        const matchesRaw =
          matchesResult.status === "fulfilled"
            ? matchesResult.value
            : null;

        return {
          candidate,
          homepage,
          matchesRaw
        };
      })
    );

    for (const item of enriched) {
      const {
        candidate,
        homepage,
        matchesRaw
      } = item;

      const team =
        homepage?.team ||
        homepage?.Team ||
        {};

      const homeClub = String(
        get(
          team,
          "homeClub.name",
          "HomeClub.Name",
          "homeClubName",
          "HomeClubName"
        ) || ""
      ).trim();

      /*
        If homepage data is available, respect the Home Club rule.
        If RankedIn temporarily fails to return the homepage, keep the team
        because it came directly from EPF's organisation team overview.
        This prevents temporary API errors from making teams disappear.
      */
      if (
        homepage &&
        homeClub &&
        homeClub.toLowerCase() !== HOME_CLUB.toLowerCase()
      ) {
        continue;
      }

      const name =
        get(team, "name", "Name") ||
        candidate.name;

      const league =
        get(
          homepage || {},
          "teamLeagueName",
          "TeamLeagueName"
        ) ||
        candidate.league ||
        "";

      const matches =
        matchesRaw
          ? extractMatchRows(matchesRaw).map(normalizeMatch)
          : [];

      const upcoming =
        upcomingMatches(matches);

      const nextMatch =
        upcoming[0] || null;

      const nextHomeMatch =
        upcoming.find(
          (match) =>
            String(match.home)
              .trim()
              .toLowerCase() ===
            String(name)
              .trim()
              .toLowerCase()
        ) || null;

      teams.push({
        id:
          Number(get(team, "id", "Id")) ||
          candidate.id,

        name,
        league,

        division: get(
          team,
          "divisionName",
          "DivisionName",
          "division",
          "Division"
        ),

        region: get(
          team,
          "regionName",
          "RegionName",
          "region",
          "Region"
        ),

        poolId: get(
          homepage || {},
          "poolId",
          "PoolId"
        ),

        homeClub:
          homeClub || HOME_CLUB,

        homeCourt: get(
          team,
          "homeCourtOrganisation.name",
          "HomeCourtOrganisation.Name",
          "homeCourt.name",
          "HomeCourt.Name"
        ),

        nextMatch,
        nextHomeMatch,

        players:
          asArray(team.players || team.Players)
            .map(normalizePlayer)
            .sort((a, b) =>
              a.name.localeCompare(
                b.name,
                "da",
                { sensitivity: "base" }
              )
            ),

        /*
          Helpful internally: partial tells us enrichment failed,
          but the team remains visible.
        */
        partial:
          !homepage || !matchesRaw
      });
    }
  }

  const unique = new Map();

  for (const team of teams) {
    unique.set(String(team.id), team);
  }

  return [...unique.values()].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      "da",
      { numeric: true }
    )
  );
}

/* -------------------------------------------------------------------------- */
/* STANDINGS                                                                  */
/* -------------------------------------------------------------------------- */

function standingsRows(data) {
  if (Array.isArray(data?.scoresViewModels)) {
    return data.scoresViewModels;
  }

  if (Array.isArray(data?.ScoresViewModels)) {
    return data.ScoresViewModels;
  }

  return [];
}

/*
  This mapping is based on the actual JSON from:
  GetTeamStandingsAsync

  IMPORTANT:
  gamesWon / gamesLost            = Matches
  teamGamesWon / teamGamesLost    = Sets
  scoredPoints / concededPoints   = Games
*/
function normalizeStanding(row, index) {
  const participantUrl =
    get(row, "participantUrl", "ParticipantUrl") || "";

  const teamId =
    parseTeamIdFromParticipantUrl(participantUrl);

  const matchWins =
    Number(get(row, "gamesWon", "GamesWon"));
  const matchLosses =
    Number(get(row, "gamesLost", "GamesLost"));
  const matchDiff =
    Number(get(row, "gamesDifference", "GamesDifference"));

  const setWins =
    Number(get(row, "teamGamesWon", "TeamGamesWon"));
  const setLosses =
    Number(get(row, "teamGamesLost", "TeamGamesLost"));
  const setDiff =
    Number(get(row, "teamGamesDifference", "TeamGamesDifference"));

  const gameWins =
    Number(get(row, "scoredPoints", "ScoredPoints"));
  const gameLosses =
    Number(get(row, "concededPoints", "ConcededPoints"));
  const gameDiff =
    Number(get(row, "pointsDifference", "PointsDifference"));

  function scoreLine(won, lost, diff) {
    if (!Number.isFinite(won) || !Number.isFinite(lost)) return "";
    const actualDiff = Number.isFinite(diff) ? diff : won - lost;
    return `${won} - ${lost} (${actualDiff})`;
  }

  return {
    teamId,

    participantUrl,

    rankedInUrl:
      participantUrl
        ? absoluteRankedInUrl(participantUrl)
        : "",

    position:
      Number(get(row, "standing", "Standing")) || index + 1,

    name:
      get(row, "participantName", "ParticipantName") ||
      "Ukendt hold",

    maxTeamPowerRating:
      get(row, "maxTeamPowerRating", "MaxTeamPowerRating"),

    matchPoints:
      get(row, "matchPoints", "MatchPoints"),

    played:
      get(row, "played", "Played"),

    won:
      get(row, "wins", "Wins"),

    lost:
      get(row, "losses", "Losses"),

    draws:
      get(row, "draws", "Draws"),

    matches:
      scoreLine(matchWins, matchLosses, matchDiff),

    sets:
      scoreLine(setWins, setLosses, setDiff),

    games:
      scoreLine(gameWins, gameLosses, gameDiff)
  };
}

/* -------------------------------------------------------------------------- */
/* PUBLIC TEAM INFO FOR "SE HOLD"                                             */
/* -------------------------------------------------------------------------- */

export async function getPublicTeamInfo(teamId) {
  const homepage =
    await getTeamHomepage(teamId);

  const team =
    homepage.team ||
    homepage.Team ||
    {};

  return {
    id:
      Number(get(team, "id", "Id")) ||
      Number(teamId),

    name:
      get(team, "name", "Name") ||
      "Hold",

    league:
      get(
        homepage,
        "teamLeagueName",
        "TeamLeagueName"
      ) ||
      "Liga",

    division: get(
      team,
      "divisionName",
      "DivisionName",
      "division",
      "Division"
    ),

    region: get(
      team,
      "regionName",
      "RegionName",
      "region",
      "Region"
    ),

    homeClub: get(
      team,
      "homeClub.name",
      "HomeClub.Name",
      "homeClubName",
      "HomeClubName"
    ),

    homeCourt: get(
      team,
      "homeCourtOrganisation.name",
      "HomeCourtOrganisation.Name",
      "homeCourt.name",
      "HomeCourt.Name"
    ),

    players:
      asArray(team.players || team.Players)
        .map(normalizePlayer)
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            "da",
            { sensitivity: "base" }
          )
        ),

    rankedInUrl:
      `https://www.rankedin.com/en/team/homepage/${encodeURIComponent(teamId)}`
  };
}

/* -------------------------------------------------------------------------- */
/* TEAM MATCH DETAILS                                                         */
/* -------------------------------------------------------------------------- */

function normalizeIndividualMatch(match, index) {
  const challenger =
    match.challenger ||
    match.Challenger ||
    {};

  const challenged =
    match.challenged ||
    match.Challenged ||
    {};

  const result =
    match.matchResult ||
    match.MatchResult ||
    {};

  const score =
    result.score ||
    result.Score ||
    null;

  const detailedScoring =
    score?.detailedScoring ||
    score?.DetailedScoring ||
    [];

  const sets =
    asArray(detailedScoring)
      .map((set) => ({
        first:
          set.firstParticipantScore ??
          set.FirstParticipantScore ??
          "",
        second:
          set.secondParticipantScore ??
          set.SecondParticipantScore ??
          ""
      }));

  const hasScore =
    Boolean(
      result.hasScore ??
      result.HasScore
    );

  return {
    id:
      match.id ||
      match.Id ||
      index,

    firstPair: {
      player1:
        challenger.name ||
        challenger.Name ||
        "Pending",

      player2:
        challenger.player2Name ||
        challenger.Player2Name ||
        "Pending",

      player1Url:
        challenger.player1Url ||
        challenger.Player1Url ||
        "",

      player2Url:
        challenger.player2Url ||
        challenger.Player2Url ||
        ""
    },

    secondPair: {
      player1:
        challenged.name ||
        challenged.Name ||
        "Pending",

      player2:
        challenged.player2Name ||
        challenged.Player2Name ||
        "Pending",

      player1Url:
        challenged.player1Url ||
        challenged.Player1Url ||
        "",

      player2Url:
        challenged.player2Url ||
        challenged.Player2Url ||
        ""
    },

    firstScore:
      hasScore
        ? (
          score?.firstParticipantScore ??
          score?.FirstParticipantScore ??
          ""
        )
        : "",

    secondScore:
      hasScore
        ? (
          score?.secondParticipantScore ??
          score?.SecondParticipantScore ??
          ""
        )
        : "",

    sets,

    played:
      hasScore &&
      Boolean(
        result.isPlayed ??
        result.IsPlayed
      ),

    notPlayed:
      !hasScore
  };
}

export async function getTeamMatchDetails(teamMatchId) {
  const [
    resultModel,
    matchesRaw,
    lineups
  ] = await Promise.all([
    rankedInFetch(
      `${API}/teamleague/GetTeamMatchResultModelAsync?matchId=${encodeURIComponent(teamMatchId)}`,
      60
    ),

    rankedInFetch(
      `${API}/teamleague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=${encodeURIComponent(teamMatchId)}&language=en`,
      60
    ),

    rankedInFetch(
      `${API}/teamleague/GetTeamsLineupsAsync?teamMatchId=${encodeURIComponent(teamMatchId)}&language=en`,
      60
    )
  ]);

  const groups =
    Array.isArray(matchesRaw)
      ? matchesRaw
      : [];

  const individualMatches =
    groups
      .flatMap((group) => {
        const rows =
          group?.matches?.matches ||
          group?.Matches?.Matches ||
          group?.matches ||
          group?.Matches ||
          [];

        return Array.isArray(rows)
          ? rows
          : [];
      })
      .map(normalizeIndividualMatch);

  return {
    id:
      Number(teamMatchId),

    date:
      resultModel
        ?.teamMatchResultsModel
        ?.matchDate ||
      resultModel
        ?.TeamMatchResultsModel
        ?.MatchDate ||
      "",

    division:
      resultModel
        ?.teamMatchResultsModel
        ?.pool
        ?.divisionName ||
      resultModel
        ?.TeamMatchResultsModel
        ?.Pool
        ?.DivisionName ||
      "",

    region:
      resultModel
        ?.teamMatchResultsModel
        ?.pool
        ?.regionName ||
      resultModel
        ?.TeamMatchResultsModel
        ?.Pool
        ?.RegionName ||
      "",

    firstTeam: {
      id:
        lineups?.firstTeam?.id ||
        lineups?.FirstTeam?.Id ||
        null,

      name:
        lineups?.firstTeam?.name ||
        lineups?.FirstTeam?.Name ||
        ""
    },

    secondTeam: {
      id:
        lineups?.secondTeam?.id ||
        lineups?.SecondTeam?.Id ||
        null,

      name:
        lineups?.secondTeam?.name ||
        lineups?.SecondTeam?.Name ||
        ""
    },

    individualMatches
  };
}

/* -------------------------------------------------------------------------- */
/* ONE EPF TEAM PAGE                                                          */
/* -------------------------------------------------------------------------- */

export async function getTeamDetails(teamId) {
  const homepage =
    await getTeamHomepage(teamId);

  const team =
    homepage.team ||
    homepage.Team ||
    {};

  const homeClub =
    String(
      get(
        team,
        "homeClub.name",
        "HomeClub.Name",
        "homeClubName",
        "HomeClubName"
      ) ||
      ""
    ).trim();

  if (
    homeClub.toLowerCase() !==
    HOME_CLUB.toLowerCase()
  ) {
    throw new Error(
      "Holdet tilhører ikke Esbjerg Padel Forening."
    );
  }

  const poolId =
    get(
      homepage,
      "poolId",
      "PoolId"
    );

  const [
    standingsRaw,
    matchesRaw
  ] = await Promise.all([
    poolId
      ? rankedInFetch(
          `${API}/TeamLeague/GetTeamStandingsAsync?poolId=${encodeURIComponent(poolId)}&language=en`,
          60
        )
      : Promise.resolve({
          scoresViewModels: []
        }),

    getTeamMatchesRaw(teamId)
  ]);

  const matches =
    extractMatchRows(matchesRaw)
      .map(normalizeMatch);

  const standings =
    standingsRows(standingsRaw)
      .map(normalizeStanding);

  return {
    team: {
      id:
        Number(
          get(
            team,
            "id",
            "Id"
          )
        ) ||
        Number(teamId),

      name:
        get(
          team,
          "name",
          "Name"
        ) ||
        "EPF-hold",

      league:
        get(
          homepage,
          "teamLeagueName",
          "TeamLeagueName"
        ) ||
        "Liga",

      division: get(
        team,
        "divisionName",
        "DivisionName",
        "division",
        "Division"
      ),

      region: get(
        team,
        "regionName",
        "RegionName",
        "region",
        "Region"
      ),

      poolId,
      homeClub,

      homeCourt: get(
        team,
        "homeCourtOrganisation.name",
        "HomeCourtOrganisation.Name",
        "homeCourt.name",
        "HomeCourt.Name"
      ),

      homeCourtAddress: get(
        team,
        "homeCourtOrganisation.address",
        "HomeCourtOrganisation.Address"
      ),

      players:
        asArray(team.players || team.Players)
          .map(normalizePlayer)
          .sort((a, b) =>
            a.name.localeCompare(
              b.name,
              "da",
              { sensitivity: "base" }
            )
          )
    },

    standings,
    matches
  };
}
