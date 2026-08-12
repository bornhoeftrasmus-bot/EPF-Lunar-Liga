"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function cleanDivision(value) {
  return (value || "").trim();
}

function matchDateValue(match) {
  if (!match?.date) return Number.POSITIVE_INFINITY;
  const d = new Date(match.date);
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
}

function formatNextMatchDate(value) {
  if (!value) return "Ingen planlagt kamp";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
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

      {match.location && (
        <small>⌖ {match.location}</small>
      )}
    </div>
  );
}

function PlayerChips({ players }) {
  if (!players?.length) {
    return <div className="muted">Ingen spillere fundet.</div>;
  }

  return (
    <div className="player-list">
      {players.map((player) =>
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
            <span>{player.name}</span>
            {String(player.role).toLowerCase().includes("captain") && (
              <small>Anfører</small>
            )}
            <span className="external">↗</span>
          </a>
        ) : (
          <div key={`${player.id}-${player.name}`} className="player-chip">
            <span>{player.name}</span>
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
  const [sortBy, setSortBy] = useState("team");

  const divisions = useMemo(() => {
    return [...new Set(initialTeams.map((t) => cleanDivision(t.division)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [initialTeams]);

  const leagues = useMemo(() => {
    return [...new Set(initialTeams.map((t) => (t.league || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  }, [initialTeams]);

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
        (team.league || "").trim() === leagueFilter;

      return matchesQuery && matchesDivision && matchesLeague;
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
        const leagueCompare = (a.league || "").localeCompare(
          b.league || "",
          "da",
          { numeric: true }
        );
        if (leagueCompare !== 0) return leagueCompare;
      }

      return a.name.localeCompare(b.name, "da", { numeric: true });
    });

    return teams;
  }, [query, divisionFilter, leagueFilter, sortBy, initialTeams]);

  const resetFilters = () => {
    setQuery("");
    setDivisionFilter("all");
    setLeagueFilter("all");
    setSortBy("team");
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

        <div className="filters-row">
          <div className="filter-field">
            <label htmlFor="divisionFilter">Række</label>
            <select
              id="divisionFilter"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
            >
              <option value="all">Alle rækker</option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="leagueFilter">Liga</label>
            <select
              id="leagueFilter"
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
            >
              <option value="all">Alle ligaer</option>
              {leagues.map((league) => (
                <option key={league} value={league}>
                  {league}
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

          <button className="reset-button" onClick={resetFilters}>
            Nulstil
          </button>
        </div>

        <div className="search-result-text">
          {filteredTeams.length === 1
            ? "1 hold vises"
            : `${filteredTeams.length} hold vises`}
        </div>
      </section>

      <div className="all-teams-count">
        <strong>{initialTeams.length}</strong>
        <span>aktive EPF-hold fundet på tværs af ligaer</span>
      </div>

      <section className="teams-grid">
        {filteredTeams.map((team) => (
          <article className="team-card" key={team.id}>
            <div className="team-card-top">
              <div>
                <div className="league-label">
                  {team.league || "Liga"}
                </div>
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

              <Link className="team-button" href={`/team/${team.id}`}>
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
