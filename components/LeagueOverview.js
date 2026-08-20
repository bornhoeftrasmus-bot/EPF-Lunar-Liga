"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamsExplorer from "@/components/TeamsExplorer";

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

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  // RankedIn may return DD/MM/YYYY HH:mm.
  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
  );

  if (european) {
    const [, day, month, year, hour = "0", minute = "0"] = european;

    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );

    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameTeam(a, b) {
  return (
    String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase()
  );
}

function buildHomeMatches(teams) {
  const matches = [];

  for (const team of teams) {
    const candidates =
      Array.isArray(team.upcomingHomeMatches) && team.upcomingHomeMatches.length
        ? team.upcomingHomeMatches
        : [team.nextHomeMatch].filter(Boolean);

    for (const match of candidates) {
      const date = parseDate(match.date);
      if (!date) continue;

      if (!sameTeam(match.home, team.name)) continue;

      const key = `${match.id || ""}|${team.id}|${date.toISOString()}|${match.home}|${match.away}`;

      matches.push({
        key,
        matchId: match.id || "",
        teamId: team.id,
        teamName: team.name,
        league: team.league || "",
        division: team.division || "",
        region: team.region || "",
        date,
        home: match.home,
        away: match.away,
        location:
          match.location || team.homeCourt || "Spillested ikke angivet",
        address: match.address || "",
        status: match.status || "",
        showResults: Boolean(match.showResults),
        homeScore: match.homeScore ?? "",
        awayScore: match.awayScore ?? ""
      });
    }
  }

  const unique = new Map();

  for (const match of matches) {
    unique.set(match.key, match);
  }

  return [...unique.values()].sort((a, b) => a.date - b.date);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(date);
}

function getCalendarCells(activeMonth, matches) {
  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Danish week starts Monday. JS Sunday = 0.
  const leading = (first.getDay() + 6) % 7;
  const total = leading + last.getDate();
  const cells = Math.ceil(total / 7) * 7;

  const result = [];

  for (let i = 0; i < cells; i++) {
    const dayNum = i - leading + 1;
    const date = new Date(year, month, dayNum);
    const inMonth = date.getMonth() === month;

    const dayMatches = matches.filter(
      (match) =>
        match.date.getFullYear() === date.getFullYear() &&
        match.date.getMonth() === date.getMonth() &&
        match.date.getDate() === date.getDate()
    );

    result.push({
      date,
      inMonth,
      matches: dayMatches
    });
  }

  return result;
}

function calendarAnchor(match) {
  return `calendar-match-${String(match.key).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildMatchLink(
  match,
  activeMonth,
  leagueFilter,
  categoryFilter,
  divisionFilter,
  teamFilter,
  displayMode
) {
  const calendarParams = new URLSearchParams();

  calendarParams.set("view", "calendar");
  calendarParams.set(
    "calendarView",
    displayMode === "list" ? "list" : "calendar"
  );
  calendarParams.set(
    "month",
    `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, "0")}`
  );

  if (leagueFilter !== "all") {
    calendarParams.set("calendarLeague", leagueFilter);
  }

  if (categoryFilter !== "all") {
    calendarParams.set("calendarCategory", categoryFilter);
  }

  if (divisionFilter !== "all") {
    calendarParams.set("calendarDivision", divisionFilter);
  }

  if (teamFilter !== "all") {
    calendarParams.set("calendarTeam", teamFilter);
  }

  const anchor = calendarAnchor(match);
  const returnTo = `/?${calendarParams.toString()}#${anchor}`;

  const teamParams = new URLSearchParams();
  teamParams.set("returnTo", returnTo);

  if (match.matchId) {
    teamParams.set("focusMatch", String(match.matchId));
  }

  return `/team/${match.teamId}?${teamParams.toString()}`;
}

function MatchBlock({
  match,
  activeMonth,
  leagueFilter,
  categoryFilter,
  divisionFilter,
  teamFilter,
  displayMode
}) {
  const href = buildMatchLink(
    match,
    activeMonth,
    leagueFilter,
    categoryFilter,
    divisionFilter,
    teamFilter,
    displayMode
  );

  return (
    <Link
      id={calendarAnchor(match)}
      href={href}
      className="calendar-match calendar-match-link"
      title={`Åbn ${match.teamName} mod ${match.away}`}
    >
      <div className="calendar-match-time">{formatTime(match.date)}</div>

      <strong>{match.teamName}</strong>
      <span>vs. {match.away}</span>

      <div className="calendar-venue">⌖ {match.location}</div>

      {match.division && <small>{match.division}</small>}
    </Link>
  );
}

function MonthCalendar({ teams }) {
  const allHomeMatches = useMemo(() => buildHomeMatches(teams), [teams]);

  const initialMonth = useMemo(() => {
    const next = allHomeMatches.find((m) => m.date >= new Date());
    const base = next?.date || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [allHomeMatches]);

  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [displayMode, setDisplayMode] = useState("calendar");
  const [isMobile, setIsMobile] = useState(false);
  const [calendarHydrated, setCalendarHydrated] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  // Keep upcoming matches current even when the page stays open.
  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());

    updateNow();
    const timer = window.setInterval(updateNow, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const mobileNow = mobileQuery.matches;
    setIsMobile(mobileNow);

    const monthParam = params.get("month");
    if (/^\d{4}-\d{2}$/.test(monthParam || "")) {
      const [year, month] = monthParam.split("-").map(Number);
      setActiveMonth(new Date(year, month - 1, 1));
    }

    const rawLeague = params.get("calendarLeague") || "all";
    const nextLeague =
      rawLeague === "all" ? "all" : logicalLeagueName(rawLeague);

    const availableCategories = categoriesForLeague(teams, nextLeague);
    const requestedCategory = params.get("calendarCategory") || "";

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

    setLeagueFilter(nextLeague);
    setCategoryFilter(nextCategory);
    setDivisionFilter(params.get("calendarDivision") || "all");
    setTeamFilter(params.get("calendarTeam") || "all");

    const savedView =
      params.get("calendarView") ||
      localStorage.getItem("epfCalendarView") ||
      "calendar";

    setDisplayMode(
      mobileNow ? "calendar" : savedView === "list" ? "list" : "calendar"
    );

    setCalendarHydrated(true);

    const onMobileChange = (event) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setDisplayMode("calendar");
      }
    };

    mobileQuery.addEventListener?.("change", onMobileChange);

    return () => {
      mobileQuery.removeEventListener?.("change", onMobileChange);
    };
  }, [teams]);

  const leagues = useMemo(() => {
    return [
      ...new Set(
        teams
          .map((team) => logicalLeagueName(team.league))
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [teams]);

  const categoryOptions = useMemo(() => {
    return categoriesForLeague(teams, leagueFilter);
  }, [teams, leagueFilter]);

  const showCategoryFilter =
    leagueFilter !== "all" && categoryOptions.length > 1;

  const divisions = useMemo(() => {
    let relevantTeams = teams;

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
  }, [teams, leagueFilter, categoryFilter, showCategoryFilter]);

  const teamOptions = useMemo(() => {
    let relevantTeams = teams;

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

    if (divisionFilter !== "all") {
      relevantTeams = relevantTeams.filter(
        (team) => cleanDivision(team.division) === divisionFilter
      );
    }

    return [...relevantTeams].sort((a, b) =>
      a.name.localeCompare(b.name, "da", { numeric: true })
    );
  }, [teams, leagueFilter, categoryFilter, divisionFilter, showCategoryFilter]);

  useEffect(() => {
    if (!calendarHydrated || divisionFilter === "all") return;

    if (!divisions.includes(divisionFilter)) {
      setDivisionFilter("all");
      setTeamFilter("all");
    }
  }, [divisions, divisionFilter, calendarHydrated]);

  useEffect(() => {
    if (!calendarHydrated || teamFilter === "all") return;

    if (!teamOptions.some((team) => String(team.id) === String(teamFilter))) {
      setTeamFilter("all");
    }
  }, [teamOptions, teamFilter, calendarHydrated]);

  useEffect(() => {
    if (!calendarHydrated) return;

    if (!isMobile) {
      localStorage.setItem("epfCalendarView", displayMode);
    }

    const params = new URLSearchParams(window.location.search);
    params.set("view", "calendar");
    params.set(
      "month",
      `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, "0")}`
    );

    if (!isMobile) {
      params.set("calendarView", displayMode);
    } else {
      params.delete("calendarView");
    }

    if (leagueFilter !== "all") {
      params.set("calendarLeague", leagueFilter);
    } else {
      params.delete("calendarLeague");
    }

    if (showCategoryFilter && categoryFilter !== "all") {
      params.set("calendarCategory", categoryFilter);
    } else {
      params.delete("calendarCategory");
    }

    if (divisionFilter !== "all") {
      params.set("calendarDivision", divisionFilter);
    } else {
      params.delete("calendarDivision");
    }

    if (teamFilter !== "all") {
      params.set("calendarTeam", teamFilter);
    } else {
      params.delete("calendarTeam");
    }

    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${query}${window.location.hash || ""}`
    );
  }, [
    activeMonth,
    leagueFilter,
    categoryFilter,
    divisionFilter,
    teamFilter,
    displayMode,
    showCategoryFilter,
    isMobile,
    calendarHydrated
  ]);

  useEffect(() => {
    if (!calendarHydrated) return;

    const hash = window.location.hash;
    if (!hash) return;

    const id = decodeURIComponent(hash.slice(1));

    const timer = setTimeout(() => {
      const element = isMobile
        ? document.getElementById(`${id}-mobile`)
        : displayMode === "list"
          ? document.getElementById(`${id}-list`)
          : document.getElementById(id);

      element?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      if (element) {
        element.classList.add("calendar-return-focus");
        setTimeout(() => {
          element.classList.remove("calendar-return-focus");
        }, 1600);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    calendarHydrated,
    activeMonth,
    leagueFilter,
    categoryFilter,
    divisionFilter,
    teamFilter,
    displayMode,
    isMobile
  ]);

  const filteredMatches = useMemo(() => {
    return allHomeMatches.filter((match) => {
      const validDate =
        match.date instanceof Date && !Number.isNaN(match.date.getTime());

      const kickoffStillAhead = validDate && match.date.getTime() > nowMs;

      const isPlayed = match.status === "Spillet" || match.showResults === true;

      const leagueOk =
        leagueFilter === "all" ||
        logicalLeagueName(match.league) === leagueFilter;

      const categoryOk =
        !showCategoryFilter ||
        categoryFilter === "all" ||
        teamCategory(match) === categoryFilter;

      const divisionOk =
        divisionFilter === "all" ||
        cleanDivision(match.division) === divisionFilter;

      const teamOk =
        teamFilter === "all" ||
        String(match.teamId) === String(teamFilter);

      return (
        kickoffStillAhead &&
        !isPlayed &&
        leagueOk &&
        categoryOk &&
        divisionOk &&
        teamOk
      );
    });
  }, [
    allHomeMatches,
    leagueFilter,
    categoryFilter,
    divisionFilter,
    teamFilter,
    showCategoryFilter,
    nowMs
  ]);

  const monthMatches = filteredMatches.filter(
    (match) => monthKey(match.date) === monthKey(activeMonth)
  );

  const cells = getCalendarCells(activeMonth, filteredMatches);

  const changeMonth = (delta) => {
    setActiveMonth((prev) =>
      new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
    );
  };

  const goToToday = () => {
    const today = new Date();
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));

    setTimeout(() => {
      document.getElementById("calendar-today")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 120);
  };

  const handleLeagueChange = (event) => {
    const nextLeague = event.target.value;
    const nextCategories = categoriesForLeague(teams, nextLeague);

    setLeagueFilter(nextLeague);
    setDivisionFilter("all");
    setTeamFilter("all");

    if (nextCategories.length > 1 && nextCategories.includes("herrer")) {
      setCategoryFilter("herrer");
    } else {
      setCategoryFilter("all");
    }
  };

  const handleCategoryChange = (event) => {
    setCategoryFilter(event.target.value);
    setDivisionFilter("all");
    setTeamFilter("all");
  };

  const handleDivisionChange = (event) => {
    setDivisionFilter(event.target.value);
    setTeamFilter("all");
  };

  return (
    <section className="calendar-section">
      <div className="calendar-toolbar">
        <div>
          <div className="eyebrow">Kun kommende EPF-hjemmekampe</div>
          <h2>Kalender</h2>
        </div>

        <div className="calendar-controls">
          <button onClick={() => changeMonth(-1)}>←</button>
          <strong>{formatMonth(activeMonth)}</strong>
          <button onClick={() => changeMonth(1)}>→</button>
          <button className="today-button" onClick={goToToday}>
            IDAG
          </button>
        </div>
      </div>

      {!isMobile && (
        <div className="calendar-view-switcher">
          <button
            className={displayMode === "calendar" ? "active" : ""}
            onClick={() => setDisplayMode("calendar")}
          >
            Kalender
          </button>

          <button
            className={displayMode === "list" ? "active" : ""}
            onClick={() => setDisplayMode("list")}
          >
            Liste
          </button>
        </div>
      )}

      <div className="calendar-filters">
        <div className="filter-field">
          <label htmlFor="calendarLeagueFilter">Liga</label>
          <select
            id="calendarLeagueFilter"
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
            <label htmlFor="calendarCategoryFilter">Herrer / Damer</label>
            <select
              id="calendarCategoryFilter"
              value={categoryFilter}
              onChange={handleCategoryChange}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-field">
          <label htmlFor="calendarDivisionFilter">Række</label>
          <select
            id="calendarDivisionFilter"
            value={divisionFilter}
            onChange={handleDivisionChange}
          >
            <option value="all">
              {leagueFilter === "all" ? "Alle rækker" : "Alle relevante rækker"}
            </option>
            {divisions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="calendarTeamFilter">Hold</label>
          <select
            id="calendarTeamFilter"
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
          >
            <option value="all">Alle relevante EPF-hold</option>
            {teamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isMobile && displayMode === "list" && (
        <div className="calendar-list-view">
          {filteredMatches.length ? (
            filteredMatches.map((match) => (
              <Link
                id={`${calendarAnchor(match)}-list`}
                key={match.key}
                href={buildMatchLink(
                  match,
                  activeMonth,
                  leagueFilter,
                  categoryFilter,
                  divisionFilter,
                  teamFilter,
                  displayMode
                )}
                className="calendar-list-item"
              >
                <div className="calendar-list-date">
                  <strong>{formatDate(match.date)}</strong>
                  <span>{formatTime(match.date)}</span>
                </div>

                <div className="calendar-list-match">
                  <strong>
                    {match.teamName} vs. {match.away}
                  </strong>

                  <span>{match.division || match.league}</span>

                  <small>⌖ {match.location}</small>
                </div>

                <div className="calendar-list-arrow">→</div>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <strong>Ingen kommende hjemmekampe</strong>
              <p>Der er ingen fremtidige kampe med de valgte filtre.</p>
            </div>
          )}
        </div>
      )}

      <div
        className={`desktop-calendar ${
          displayMode === "list" ? "hidden-calendar-view" : ""
        }`}
      >
        <div className="calendar-weekdays">
          {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {cells.map((cell) => {
            const now = new Date();
            const isToday =
              cell.date.getFullYear() === now.getFullYear() &&
              cell.date.getMonth() === now.getMonth() &&
              cell.date.getDate() === now.getDate();

            return (
              <div
                id={isToday ? "calendar-today" : undefined}
                key={cell.date.toISOString()}
                className={`calendar-cell ${
                  cell.inMonth ? "" : "outside-month"
                } ${isToday ? "today-cell" : ""}`}
              >
                <div className="calendar-day-number">
                  {cell.date.getDate()}
                </div>

                <div className="calendar-day-matches">
                  {cell.matches.map((match) => (
                    <MatchBlock
                      key={match.key}
                      match={match}
                      activeMonth={activeMonth}
                      leagueFilter={leagueFilter}
                      categoryFilter={categoryFilter}
                      divisionFilter={divisionFilter}
                      teamFilter={teamFilter}
                      displayMode={displayMode}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mobile-agenda">
        {monthMatches.length ? (
          monthMatches.map((match) => (
            <Link
              id={`${calendarAnchor(match)}-mobile`}
              className="agenda-match agenda-match-link"
              key={match.key}
              href={buildMatchLink(
                match,
                activeMonth,
                leagueFilter,
                categoryFilter,
                divisionFilter,
                teamFilter,
                "calendar"
              )}
            >
              <div className="agenda-date">
                <strong>{formatDate(match.date)}</strong>
                <span>{formatTime(match.date)}</span>
              </div>

              <div className="agenda-main">
                <strong>
                  {match.teamName} vs. {match.away}
                </strong>
                <span>{match.division || match.league}</span>
                <small>⌖ {match.location}</small>
              </div>
            </Link>
          ))
        ) : (
          <div className="empty-state">
            <strong>Ingen hjemmekampe denne måned</strong>
            <p>Prøv en anden måned eller et andet filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function LeagueOverview({ teams }) {
  const [tab, setTab] = useState("teams");
  const [tabHydrated, setTabHydrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("view") === "calendar") {
      setTab("calendar");
    }

    setTabHydrated(true);
  }, []);

  useEffect(() => {
    if (!tabHydrated) return;

    const params = new URLSearchParams(window.location.search);

    if (tab === "calendar") {
      params.set("view", "calendar");
    } else {
      params.delete("view");
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${
      query ? `?${query}` : ""
    }${window.location.hash || ""}`;

    window.history.replaceState({}, "", nextUrl);
  }, [tab, tabHydrated]);

  return (
    <>
      <div className="overview-tabs">
        <button
          className={tab === "teams" ? "active" : ""}
          onClick={() => setTab("teams")}
        >
          Hold
        </button>

        <button
          className={tab === "calendar" ? "active" : ""}
          onClick={() => setTab("calendar")}
        >
          Kalender
        </button>
      </div>

      {tab === "teams" ? (
        <TeamsExplorer initialTeams={teams} />
      ) : (
        <MonthCalendar teams={teams} />
      )}
    </>
  );
}
