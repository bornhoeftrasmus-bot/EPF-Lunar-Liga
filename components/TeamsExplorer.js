"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function cleanDivision(value) {
  return (value || "").trim();
}

function logicalLeagueName(value) {
  const raw = (value || "").trim();

  if (/^Lunar Ligaen 4P\b/i.test(raw)) {
    return raw.replace(/^Lunar Ligaen 4P\b/i, "Lunar Ligaen");
  }

  return raw;
}

function teamCategory(team) {
  const league = String(team?.league || "").toLocaleLowerCase("da");

  if (
    league.includes("4p") ||
    league.includes("damer") ||
    league.includes("women") ||
    league.includes("ladies")
  ) {
    return "damer";
  }

  if (
    league.includes("lunar") ||
    league.includes("herrer") ||
    league.includes("men") ||
    league.includes("forenings")
  ) {
    return "herrer";
  }

  return "";
}

function categoriesForLeague(teams, league) {
  if (!league || league === "all") return [];

  return [
    ...new Set(
      teams
        .filter((team) => logicalLeagueName(team.league) === league)
        .map(teamCategory)
        .filter(Boolean)
    )
  ].sort((a, b) => {
    const order = { herrer: 1, damer: 2 };
    return (order[a] || 99) - (order[b] || 99);
  });
}

function categoryLabel(value) {
  if (value === "herrer") return "Herrer";
  if (value === "damer") return "Damer";
  return value;
}

function parseOverviewMatchDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      date: value,
      sortValue: value.getTime(),
      hasTime: !(value.getHours() === 0 && value.getMinutes() === 0),
      wallClock: false
    };
  }

  const raw = String(value).trim();

  // RankedIn uses Danish/European dates: DD/MM/YYYY HH:mm.
  // Parse these explicitly so 10/09/2026 is 10 September,
  // never October 9 in browsers that assume MM/DD/YYYY.
  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (european) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = european;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return null;

    return {
      date,
      sortValue: timestamp,
      hasTime:
        Boolean(european[4]) &&
        !(Number(hour) === 0 && Number(minute) === 0),
      wallClock: true
    };
  }

  // RankedIn can also return ISO-looking values without timezone information.
  // Treat them as local wall-clock values instead of allowing browser conversion.
  const localIso = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
  );

  if (localIso) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = localIso;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return null;

    return {
      date,
      sortValue: timestamp,
      hasTime:
        Boolean(localIso[4]) &&
        !(Number(hour) === 0 && Number(minute) === 0),
      wallClock: true
    };
  }

  // Values with an explicit timezone (Z, +01:00, +02:00, etc.)
  // are safe to parse natively and are displayed in Copenhagen time.
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const timeMatch = raw.match(/[T ](\d{1,2}):(\d{2})/);

  return {
    date,
    sortValue: date.getTime(),
    hasTime:
      Boolean(timeMatch) &&
      !(Number(timeMatch?.[1]) === 0 && Number(timeMatch?.[2]) === 0),
    wallClock: false
  };
}

function matchDateValue(match) {
  const parsed = parseOverviewMatchDate(match?.date);
  return parsed?.sortValue ?? Number.POSITIVE_INFINITY;
}

function formatNextMatchDate(value) {
  if (!value) return "Ingen planlagt kamp";

  const parsed = parseOverviewMatchDate(value);
  if (!parsed) return String(value);

  const timeZone = parsed.wallClock ? "UTC" : "Europe/Copenhagen";

  const dateText = new Intl.DateTimeFormat("da-DK", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed.date);

  if (!parsed.hasTime) return dateText;

  const timeText = new Intl.DateTimeFormat("da-DK", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed.date);

  return `${dateText}, ${timeText}`;
}

function NextMatch({ team }) {
  const match = team.nextMatch;

  if (!match) {
    return (
      <div className="next-match-box empty-next-match">
        <div className="next-match-label">Næste kamp</div>
        <strong>Ingen kommende kamp fundet</strong>
      </div>
    );
  }

  const isHome =
    String(match.home).trim().toLowerCase() ===
    String(team.name).trim().toLowerCase();

  const opponent = isHome ? match.away : match.home;

  return (
    <div className="next-match-box">
      <div className="next-match-topline">
        <span className="next-match-label">Næste kamp</span>
        <span className="home-away-badge">{isHome ? "Hjemme" : "Ude"}</span>
      </div>

      <strong>{opponent || "Modstander ikke angivet"}</strong>
      <span>{formatNextMatchDate(match.date)}</span>

      {match.location && <small>⌖ {match.location}</small>}
    </div>
  );
}

function PlayerChips({ players }) {
  if (!players?.length) {
    return <div className="muted">Ingen spillere fundet.</div>;
  }

  return (
    <div className="player-list">
      {players.map((player, index) =>
        player.url ? (
          <a
            key={`${player.id}-${player.name}`}
            className="player-chip"
            href={player.url}
            target="_blank"
            rel="noreferrer"
            title="Åbn spiller på Rankedin"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{index + 1}. {player.name}</span>
            {String(player.role).toLowerCase().includes("captain") && (
              <small>Anfører</small>
            )}
            <span className="external">↗</span>
          </a>
        ) : (
          <div key={`${player.id}-${player.name}`} className="player-chip">
            <span>{index + 1}. {player.name}</span>
          </div>
        )
      )}
    </div>
  );
}

export default function TeamsExplorer({ initialTeams }) {
  const [query, setQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("team");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = JSON.parse(
      localStorage.getItem("epfLeagueOverviewState") || "{}"
    );

    const rawLeague = params.get("league") ?? saved.leagueFilter ?? "all";
    const nextLeague =
      rawLeague === "all" ? "all" : logicalLeagueName(rawLeague);

    const availableCategories = categoriesForLeague(initialTeams, nextLeague);
    const requestedCategory =
      params.get("category") ?? saved.categoryFilter ?? "";

    let nextCategory = requestedCategory;

    if (!nextCategory || !availableCategories.includes(nextCategory)) {
      if (/4p/i.test(rawLeague) && availableCategories.includes("damer")) {
        nextCategory = "damer";
      } else if (
        availableCategories.length > 1 &&
        availableCategories.includes("herrer")
      ) {
        nextCategory = "herrer";
      } else {
        nextCategory = "all";
      }
    }

    setQuery(params.get("q") ?? saved.query ?? "");
    setDivisionFilter(
      params.get("division") ?? saved.divisionFilter ?? "all"
    );
    setLeagueFilter(nextLeague);
    setCategoryFilter(nextCategory);
    setSortBy(params.get("sort") ?? saved.sortBy ?? "team");
    setHydrated(true);

    const savedScroll = Number(
      sessionStorage.getItem("epfLeagueOverviewScroll") || 0
    );

    if (savedScroll > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScroll, behavior: "auto" });
      });
    }
  }, [initialTeams]);

  const leagues = useMemo(() => {
    return [
      ...new Set(
        initialTeams
          .map((team) => logicalLeagueName(team.league))
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [initialTeams]);

  const categoryOptions = useMemo(() => {
    return categoriesForLeague(initialTeams, leagueFilter);
  }, [initialTeams, leagueFilter]);

  const showCategoryFilter =
    leagueFilter !== "all" && categoryOptions.length > 1;

  const divisions = useMemo(() => {
    let relevantTeams = initialTeams;

    if (leagueFilter !== "all") {
      relevantTeams = relevantTeams.filter(
        (team) => logicalLeagueName(team.league) === leagueFilter
      );
    }

    if (showCategoryFilter && categoryFilter !== "all") {
      relevantTeams = relevantTeams.filter(
        (team) => teamCategory(team) === categoryFilter
      );
    }

    return [
      ...new Set(
        relevantTeams
          .map((team) => cleanDivision(team.division))
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [initialTeams, leagueFilter, categoryFilter, showCategoryFilter]);

  useEffect(() => {
    if (!hydrated || divisionFilter === "all") return;
    if (!divisions.includes(divisionFilter)) {
      setDivisionFilter("all");
    }
  }, [divisions, divisionFilter, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const params = new URLSearchParams();

    if (query.trim()) params.set("q", query.trim());
    if (divisionFilter !== "all") params.set("division", divisionFilter);
    if (leagueFilter !== "all") params.set("league", leagueFilter);
    if (showCategoryFilter && categoryFilter !== "all") {
      params.set("category", categoryFilter);
    }
    if (sortBy !== "team") params.set("sort", sortBy);

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState({}, "", nextUrl);

    localStorage.setItem(
      "epfLeagueOverviewState",
      JSON.stringify({
        query,
        divisionFilter,
        leagueFilter,
        categoryFilter,
        sortBy
      })
    );
  }, [
    query,
    divisionFilter,
    leagueFilter,
    categoryFilter,
    sortBy,
    showCategoryFilter,
    hydrated
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const onScroll = () => {
      sessionStorage.setItem(
        "epfLeagueOverviewScroll",
        String(window.scrollY)
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hydrated]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("da");

    let teams = initialTeams.filter((team) => {
      const matchesQuery =
        !q ||
        `${team.name} ${team.division} ${team.league} ${team.region}`
          .toLocaleLowerCase("da")
          .includes(q) ||
        team.players?.some((player) =>
          player.name.toLocaleLowerCase("da").includes(q)
        );

      const matchesDivision =
        divisionFilter === "all" ||
        cleanDivision(team.division) === divisionFilter;

      const matchesLeague =
        leagueFilter === "all" ||
        logicalLeagueName(team.league) === leagueFilter;

      const matchesCategory =
        !showCategoryFilter ||
        categoryFilter === "all" ||
        teamCategory(team) === categoryFilter;

      return (
        matchesQuery &&
        matchesDivision &&
        matchesLeague &&
        matchesCategory
      );
    });

    teams = [...teams].sort((a, b) => {
      if (sortBy === "nextMatch") {
        const diff = matchDateValue(a.nextMatch) - matchDateValue(b.nextMatch);
        if (diff !== 0) return diff;
      }

      if (sortBy === "nextHomeMatch") {
        const diff =
          matchDateValue(a.nextHomeMatch) - matchDateValue(b.nextHomeMatch);
        if (diff !== 0) return diff;
      }

      if (sortBy === "division") {
        const divisionCompare = cleanDivision(a.division).localeCompare(
          cleanDivision(b.division),
          "da",
          { numeric: true }
        );
        if (divisionCompare !== 0) return divisionCompare;
      }

      if (sortBy === "league") {
        const leagueCompare = logicalLeagueName(a.league).localeCompare(
          logicalLeagueName(b.league),
          "da",
          { numeric: true }
        );
        if (leagueCompare !== 0) return leagueCompare;
      }

      return a.name.localeCompare(b.name, "da", { numeric: true });
    });

    return teams;
  }, [
    query,
    divisionFilter,
    leagueFilter,
    categoryFilter,
    showCategoryFilter,
    sortBy,
    initialTeams
  ]);

  const buildTeamUrl = (teamId) => {
    const params = new URLSearchParams();

    if (query.trim()) params.set("q", query.trim());
    if (divisionFilter !== "all") params.set("division", divisionFilter);
    if (leagueFilter !== "all") params.set("league", leagueFilter);
    if (showCategoryFilter && categoryFilter !== "all") {
      params.set("category", categoryFilter);
    }
    if (sortBy !== "team") params.set("sort", sortBy);

    const returnQuery = params.toString();
    const returnUrl = returnQuery ? `/?${returnQuery}` : "/";

    return `/team/${teamId}?returnTo=${encodeURIComponent(returnUrl)}`;
  };

  const resetFilters = () => {
    setQuery("");
    setDivisionFilter("all");
    setLeagueFilter("all");
    setCategoryFilter("all");
    setSortBy("team");
  };

  const handleLeagueChange = (event) => {
    const nextLeague = event.target.value;
    const categories = categoriesForLeague(initialTeams, nextLeague);

    setLeagueFilter(nextLeague);
    setDivisionFilter("all");

    if (categories.length > 1 && categories.includes("herrer")) {
      setCategoryFilter("herrer");
    } else {
      setCategoryFilter("all");
    }
  };

  const handleCategoryChange = (event) => {
    setCategoryFilter(event.target.value);
    setDivisionFilter("all");
  };

  return (
    <>
      <section className="search-panel">
        <div className="search-block">
          <label htmlFor="teamSearch">Søg efter hold, række eller spiller</label>
          <div className="search-field">
            <span className="search-icon">⌕</span>
            <input
              id="teamSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Fx Mikkel, EPF 5, 1. Division eller ForeningsLigaen"
              autoComplete="off"
            />
            {query && (
              <button className="clear-search" onClick={() => setQuery("")}>
                ×
              </button>
            )}
          </div>
        </div>

        <div
          className="filters-row"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))"
          }}
        >
          <div className="filter-field">
            <label htmlFor="leagueFilter">Liga</label>
            <select
              id="leagueFilter"
              value={leagueFilter}
              onChange={handleLeagueChange}
            >
              <option value="all">Alle ligaer</option>
              {leagues.map((league) => (
                <option key={league} value={league}>
                  {league}
                </option>
              ))}
            </select>
          </div>

          {showCategoryFilter && (
            <div className="filter-field">
              <label htmlFor="categoryFilter">Herrer / Damer</label>
              <select
                id="categoryFilter"
                value={categoryFilter}
                onChange={handleCategoryChange}
              >
                <option value="all">Alle</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-field">
            <label htmlFor="divisionFilter">Række</label>
            <select
              id="divisionFilter"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
            >
              <option value="all">
                {leagueFilter === "all"
                  ? "Alle rækker"
                  : showCategoryFilter && categoryFilter !== "all"
                    ? `Alle ${categoryLabel(categoryFilter).toLowerCase()}rækker`
                    : "Alle rækker i valgt liga"}
              </option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="sortBy">Sortér efter</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="team">Holdnavn</option>
              <option value="nextMatch">Næste kamp</option>
              <option value="nextHomeMatch">Næste hjemmekamp</option>
              <option value="division">Række</option>
              <option value="league">Liga</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="reset-button" onClick={resetFilters}>
              Nulstil
            </button>
          </div>
        </div>

        <div className="search-result-text">
          {filteredTeams.length === 1
            ? "1 hold vises"
            : `${filteredTeams.length} hold vises`}
        </div>
      </section>

      <div className="all-teams-count">
        <strong>{initialTeams.length}</strong>
        <span>aktive EPF-hold fundet i Rankedin</span>
      </div>

      <section className="teams-grid">
        {filteredTeams.map((team) => (
          <article className="team-card" key={team.id}>
            <div className="team-card-top">
              <div>
                <div className="league-label">{team.league || ""}</div>
                <h2>{team.name}</h2>

                {team.division && (
                  <div className="division-badge">{team.division}</div>
                )}
              </div>

              {team.region && (
                <div className="team-meta">
                  <span>{team.region}</span>
                </div>
              )}
            </div>

            <div className="card-section-title">
              Spillere
              <span>{team.players.length}</span>
            </div>

            <PlayerChips players={team.players} />

            <NextMatch team={team} />

            <div className="team-card-footer">
              {team.homeCourt ? (
                <span className="venue">⌖ {team.homeCourt}</span>
              ) : (
                <span />
              )}

              <Link className="team-button" href={buildTeamUrl(team.id)}>
                Kampe & stilling
                <span>→</span>
              </Link>
            </div>
          </article>
        ))}
      </section>

      {!filteredTeams.length && (
        <div className="empty-state">
          <strong>Ingen hold fundet</strong>
          <p>
            Prøv et andet søgeord, vælg en anden række eller nulstil filtrene.
          </p>
        </div>
      )}
    </>
  );
}
