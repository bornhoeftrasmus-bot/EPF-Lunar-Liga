"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TeamsExplorer from "@/components/TeamsExplorer";

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameTeam(a, b) {
  return String(a || "").trim().toLowerCase() ===
         String(b || "").trim().toLowerCase();
}

function buildHomeMatches(teams) {
  const matches = [];

  for (const team of teams) {
    const candidates =
      Array.isArray(team.upcomingHomeMatches) &&
      team.upcomingHomeMatches.length
        ? team.upcomingHomeMatches
        : [team.nextHomeMatch].filter(Boolean);

    for (const match of candidates) {
      const date = parseDate(match.date);
      if (!date) continue;

      if (!sameTeam(match.home, team.name)) continue;

      const key =
        `${match.id || ""}|${team.id}|${date.toISOString()}|${match.home}|${match.away}`;

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
          match.location ||
          team.homeCourt ||
          "Spillested ikke angivet",
        address: match.address || ""
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

    const dayMatches = matches.filter((match) =>
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


function buildMatchLink(match, activeMonth, leagueFilter, teamFilter) {
  const calendarParams = new URLSearchParams();

  calendarParams.set("view", "calendar");
  calendarParams.set(
    "month",
    `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, "0")}`
  );

  if (leagueFilter !== "all") {
    calendarParams.set("calendarLeague", leagueFilter);
  }

  if (teamFilter !== "all") {
    calendarParams.set("calendarTeam", teamFilter);
  }

  const returnTo = `/?${calendarParams.toString()}`;

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
  teamFilter
}) {
  const href = buildMatchLink(
    match,
    activeMonth,
    leagueFilter,
    teamFilter
  );

  return (
    <Link
      href={href}
      className="calendar-match calendar-match-link"
      title={`Åbn ${match.teamName} mod ${match.away}`}
    >
      <div className="calendar-match-time">
        {formatTime(match.date)}
      </div>

      <strong>{match.teamName}</strong>
      <span>vs. {match.away}</span>

      <div className="calendar-venue">
        ⌖ {match.location}
      </div>

      {match.division && (
        <small>{match.division}</small>
      )}
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
  const [teamFilter, setTeamFilter] = useState("all");

  const leagues = useMemo(() => {
    return [...new Set(teams.map(t => t.league).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [teams]);

  const teamOptions = useMemo(() => {
    return [...teams]
      .sort((a, b) => a.name.localeCompare(b.name, "da", { numeric: true }));
  }, [teams]);

  const filteredMatches = useMemo(() => {
    return allHomeMatches.filter((match) => {
      const leagueOk = leagueFilter === "all" || match.league === leagueFilter;
      const teamOk = teamFilter === "all" || String(match.teamId) === String(teamFilter);
      return leagueOk && teamOk;
    });
  }, [allHomeMatches, leagueFilter, teamFilter]);

  const monthMatches = filteredMatches.filter(
    (m) => monthKey(m.date) === monthKey(activeMonth)
  );

  const cells = getCalendarCells(activeMonth, filteredMatches);

  const changeMonth = (delta) => {
    setActiveMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <section className="calendar-section">
      <div className="calendar-toolbar">
        <div>
          <div className="eyebrow">EPF hjemmekampe</div>
          <h2>Kalender</h2>
        </div>

        <div className="calendar-controls">
          <button onClick={() => changeMonth(-1)}>←</button>
          <strong>{formatMonth(activeMonth)}</strong>
          <button onClick={() => changeMonth(1)}>→</button>
        </div>
      </div>

      <div className="calendar-filters">
        <div className="filter-field">
          <label> Liga </label>
          <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
            <option value="all">Alle ligaer</option>
            {leagues.map((league) => (
              <option key={league} value={league}>{league}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label> Hold </label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">Alle EPF-hold</option>
            {teamOptions.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="desktop-calendar">
        <div className="calendar-weekdays">
          {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {cells.map((cell) => (
            <div
              key={cell.date.toISOString()}
              className={`calendar-cell ${cell.inMonth ? "" : "outside-month"}`}
            >
              <div className="calendar-day-number">{cell.date.getDate()}</div>

              <div className="calendar-day-matches">
                {cell.matches.map((match) => (
                  <MatchBlock
                    key={match.key}
                    match={match}
                    activeMonth={activeMonth}
                    leagueFilter={leagueFilter}
                    teamFilter={teamFilter}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mobile-agenda">
        {monthMatches.length ? (
          monthMatches.map((match) => (
            <Link
              className="agenda-match agenda-match-link"
              key={match.key}
              href={buildMatchLink(
                match,
                activeMonth,
                leagueFilter,
                teamFilter
              )}
            >
              <div className="agenda-date">
                <strong>{formatDate(match.date)}</strong>
                <span>{formatTime(match.date)}</span>
              </div>

              <div className="agenda-main">
                <strong>{match.teamName} vs. {match.away}</strong>
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
