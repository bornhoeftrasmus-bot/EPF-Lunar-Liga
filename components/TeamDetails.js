"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen";

function parseMatchDate(value) {
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
  // Parse these explicitly so 06/09/2026 becomes 6 September,
  // not 9 June in browsers that assume MM/DD/YYYY.
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

    const hasExplicitTime = Boolean(european[4]);
    const hasTime =
      hasExplicitTime &&
      !(Number(hour) === 0 && Number(minute) === 0);

    return {
      date,
      sortValue: timestamp,
      hasTime,
      wallClock: true
    };
  }

  // RankedIn can also return ISO-looking values without timezone information.
  // Treat those as a wall-clock value and avoid browser timezone conversion.
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

    const hasExplicitTime = Boolean(localIso[4]);
    const hasTime =
      hasExplicitTime &&
      !(Number(hour) === 0 && Number(minute) === 0);

    return {
      date,
      sortValue: timestamp,
      hasTime,
      wallClock: true
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const timeMatch = raw.match(/[T ](\d{1,2}):(\d{2})/);
  const hasTime =
    Boolean(timeMatch) &&
    !(Number(timeMatch?.[1]) === 0 && Number(timeMatch?.[2]) === 0);

  return {
    date,
    sortValue: date.getTime(),
    hasTime,
    wallClock: false
  };
}

function formatDate(value) {
  if (!value) return { date: "Dato ikke angivet", time: "" };

  const parsed = parseMatchDate(value);
  if (!parsed) return { date: String(value), time: "" };

  const timeZone = parsed.wallClock ? "UTC" : COPENHAGEN_TIME_ZONE;

  return {
    date: new Intl.DateTimeFormat("da-DK", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(parsed.date),
    time: parsed.hasTime
      ? new Intl.DateTimeFormat("da-DK", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit"
        }).format(parsed.date)
      : ""
  };
}

function PlayerLink({ name, url }) {
  if (!url) return <span>{name}</span>;
  const href = url.startsWith("http") ? url : `https://www.rankedin.com${url}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="detail-player-link">
      {name}
    </a>
  );
}

function MatchDetails({ details }) {
  if (!details?.individualMatches?.length) {
    return <div className="match-detail-empty">Ingen individuelle kampe fundet.</div>;
  }

  return (
    <div className="individual-matches">
      <div className="individual-heading">
        <strong>Individuelle kampe</strong>
        <span>
          {details.firstTeam?.name} mod {details.secondTeam?.name}
        </span>
      </div>

      {details.individualMatches.map((m, index) => (
        <div className={`individual-match ${m.notPlayed ? "not-played" : ""}`} key={m.id}>
          <div className="individual-number">{index + 1}</div>

          <div className="pair">
            <PlayerLink name={m.firstPair.player1} url={m.firstPair.player1Url} />
            <PlayerLink name={m.firstPair.player2} url={m.firstPair.player2Url} />
          </div>

          <div className="individual-result">
            {m.notPlayed ? (
              <span className="not-played-pill">Ikke spillet</span>
            ) : (
              <>
                <strong>{m.firstScore}–{m.secondScore}</strong>
                <span className="set-scores">
                  {m.sets.map((s, i) => (
                    <span key={i}>{s.first}–{s.second}</span>
                  ))}
                </span>
              </>
            )}
          </div>

          <div className="pair">
            <PlayerLink name={m.secondPair.player1} url={m.secondPair.player1Url} />
            <PlayerLink name={m.secondPair.player2} url={m.secondPair.player2Url} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ match, selectedTeam, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const cardRef = useRef(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const when = formatDate(match.date);

  const isHome =
    match.home?.trim().toLowerCase() === selectedTeam.trim().toLowerCase();
  const isAway =
    match.away?.trim().toLowerCase() === selectedTeam.trim().toLowerCase();

  useEffect(() => {
    if (!defaultOpen) return;

    const timer = setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 150);

    // Load details automatically when arriving from calendar.
    if (!details && !loading) {
      (async () => {
        setLoading(true);
        setError("");

        try {
          const res = await fetch(`/api/match/${match.id}`);
          if (!res.ok) throw new Error("Kunne ikke hente kampdetaljer");
          setDetails(await res.json());
        } catch (e) {
          console.error(e);
          setError("Kampdetaljerne kunne ikke hentes.");
        } finally {
          setLoading(false);
        }
      })();
    }

    return () => clearTimeout(timer);
  }, [defaultOpen]);

  async function toggleDetails() {
    const next = !open;
    setOpen(next);

    if (!next || details || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/match/${match.id}`);
      if (!res.ok) throw new Error("Kunne ikke hente kampdetaljer");
      setDetails(await res.json());
    } catch (e) {
      console.error(e);
      setError("Kampdetaljerne kunne ikke hentes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      ref={cardRef}
      className={`match-card-wrap ${defaultOpen ? "focused-match-card" : ""}`}
    >
      <div className="match-card">
        <div className="match-date">
          <strong>{when.date}</strong>
          {when.time && <span>kl. {when.time}</span>}
          {match.round && <small>{match.round}</small>}
        </div>

        <div className="match-teams">
          <div className={isHome ? "selected-team-name" : ""}>
            <span>{match.home}</span>
            {match.showResults && <strong>{match.homeScore}</strong>}
          </div>
          <div className={isAway ? "selected-team-name" : ""}>
            <span>{match.away}</span>
            {match.showResults && <strong>{match.awayScore}</strong>}
          </div>
        </div>

        <div className="match-location">
          <small>Spillested</small>
          <strong>{match.location || "Ikke angivet"}</strong>
          {match.address && <span>{match.address}</span>}
        </div>

        <div className={`match-status status-${match.status.toLowerCase().replaceAll(" ", "-")}`}>
          {match.status}
        </div>

        <button className="match-detail-button" onClick={toggleDetails}>
          {open ? "Skjul detaljer" : "Se kampdetaljer"}
          <span>{open ? "↑" : "↓"}</span>
        </button>
      </div>

      {open && (
        <div className="match-detail-panel">
          {loading && <div className="match-detail-empty">Henter kampdetaljer…</div>}
          {error && <div className="match-detail-empty error-text">{error}</div>}
          {details && <MatchDetails details={details} />}
        </div>
      )}
    </article>
  );
}

function StandingTeamDetails({ teamId, fallbackName, rankedInUrl }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!teamId) {
        setError("Team ID mangler.");
        return;
      }

      try {
        const res = await fetch(`/api/team/${teamId}`);
        if (!res.ok) throw new Error("Kunne ikke hente holdet");

        const json = await res.json();

        if (active) {
          setData(json);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setError("Holdoplysningerne kunne ikke hentes.");
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [teamId]);

  if (!data && !error) {
    return (
      <div className="standing-inline-loading">
        Henter holdoplysninger…
      </div>
    );
  }

  if (error) {
    return (
      <div className="standing-inline-loading error-text">
        {error}
      </div>
    );
  }

  return (
    <div className="standing-inline-details">
      <div className="standing-inline-header">
        <div>
          <div className="eyebrow">{data.league || "Liga"}</div>
          <h3>{data.name || fallbackName}</h3>
        </div>

        <a
          href={rankedInUrl || data.rankedInUrl}
          target="_blank"
          rel="noreferrer"
          className="rankedin-team-link compact-link"
        >
          Åbn på Rankedin ↗
        </a>
      </div>

      <div className="opponent-meta-grid inline-grid">
        <div>
          <small>Række</small>
          <strong>{data.division || "Ikke angivet"}</strong>
        </div>

        <div>
          <small>Region</small>
          <strong>{data.region || "Ikke angivet"}</strong>
        </div>

        <div>
          <small>Home Club</small>
          <strong>{data.homeClub || "Ikke angivet"}</strong>
        </div>

        <div>
          <small>Hjemmebane</small>
          <strong>{data.homeCourt || "Ikke angivet"}</strong>
        </div>
      </div>

      <div className="opponent-player-title">
        Spillere <span>{data.players?.length || 0}</span>
      </div>

      <div className="opponent-player-list">
        {data.players?.length ? (
          data.players.map((player) =>
            player.url ? (
              <a
                key={`${player.id}-${player.name}`}
                href={player.url}
                target="_blank"
                rel="noreferrer"
                className="opponent-player"
              >
                {player.name} <span>↗</span>
              </a>
            ) : (
              <div
                key={`${player.id}-${player.name}`}
                className="opponent-player"
              >
                {player.name}
              </div>
            )
          )
        ) : (
          <span className="team-modal-muted">
            Ingen spillere fundet.
          </span>
        )}
      </div>
    </div>
  );
}

function Standings({ rows, selectedTeam }) {
  const [showRules, setShowRules] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  return (
    <>
      <div className="standing-heading">
        <div>
          <h2>Stilling</h2>
          <p>Den aktuelle stilling i holdets pulje.</p>
        </div>

        <button
          className="info-button"
          onClick={() => setShowRules(true)}
        >
          ⓘ Sådan afgøres stillingen
        </button>
      </div>

      <div className="standings-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="align-left">Hold</th>
              <th>M. point</th>
              <th>Spillet</th>
              <th>V–T</th>
              <th>Matches</th>
              <th>Sets</th>
              <th>Games</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const selected =
                row.name?.trim().toLowerCase() ===
                selectedTeam.trim().toLowerCase();

              const isExpanded =
                !selected &&
                expandedTeamId === row.teamId;

              return (
                <Fragment key={`${row.position}-${row.teamId || row.name}`}>
                  <tr className={selected ? "selected-row" : ""}>
                    <td className="position-cell">{row.position}</td>

                    <td className="align-left team-cell">
                      {row.rankedInUrl ? (
                        <a
                          href={row.rankedInUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="standing-rankedin-link"
                        >
                          {row.name}
                          <span>↗</span>
                        </a>
                      ) : (
                        <span>{row.name}</span>
                      )}
                    </td>

                    <td>{row.matchPoints ?? "–"}</td>
                    <td>{row.played ?? "–"}</td>

                    <td>
                      {row.won !== "" || row.lost !== ""
                        ? `${row.won || 0}–${row.lost || 0}`
                        : "–"}
                    </td>

                    <td>{row.matches || "–"}</td>
                    <td>{row.sets || "–"}</td>
                    <td>{row.games || "–"}</td>

                    <td className="standing-action-cell">
                      {!selected && row.teamId && (
                        <button
                          className="standing-detail-button"
                          onClick={() =>
                            setExpandedTeamId(
                              isExpanded ? null : row.teamId
                            )
                          }
                        >
                          {isExpanded ? "Skjul hold" : "Se hold"}
                          <span>{isExpanded ? "↑" : "↓"}</span>
                        </button>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="standing-detail-row">
                      <td colSpan="9">
                        <StandingTeamDetails
                          teamId={row.teamId}
                          fallbackName={row.name}
                          rankedInUrl={row.rankedInUrl}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <div className="empty-state">
          <strong>Stillingen kunne ikke vises</strong>
          <p>Rankedin returnerede ingen stilling for denne pulje.</p>
        </div>
      )}

      {showRules && (
        <div
          className="modal-backdrop"
          onClick={() => setShowRules(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowRules(false)}
            >
              ×
            </button>

            <div className="eyebrow">Ved pointlighed</div>

            <h2>Sådan afgøres placeringerne</h2>

            <ol className="rules">
              <li>Vundne holdkampe</li>
              <li>Match difference</li>
              <li>Set difference</li>
              <li>Game difference</li>
              <li>Indbyrdes opgør</li>
              <li>Match-points</li>
              <li>Vundne individuelle matches</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

export default function TeamDetails({ data, focusMatchId = "" }) {
  const [tab, setTab] = useState("matches");

  useEffect(() => {
    if (focusMatchId) {
      setTab("matches");
    }
  }, [focusMatchId]);

  const matches = useMemo(() => {
    return [...data.matches].sort((a, b) => {
      const da = parseMatchDate(a.date)?.sortValue ?? Number.POSITIVE_INFINITY;
      const db = parseMatchDate(b.date)?.sortValue ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [data.matches]);

  return (
    <section className="details-panel">
      <div className="detail-tabs">
        <button
          className={tab === "matches" ? "active" : ""}
          onClick={() => setTab("matches")}
        >
          Kampe <span>{matches.length}</span>
        </button>
        <button
          className={tab === "standings" ? "active" : ""}
          onClick={() => setTab("standings")}
        >
          Stilling
        </button>
      </div>

      {tab === "matches" && (
        <div className="matches-section">
          <div className="standing-heading">
            <div>
              <h2>Kampe</h2>
              <p>Resultater og kommende kampe for {data.team.name}.</p>
            </div>
          </div>

          <div className="matches-list">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                selectedTeam={data.team.name}
                defaultOpen={
                  focusMatchId &&
                  String(match.id) === String(focusMatchId)
                }
              />
            ))}
          </div>

          {!matches.length && (
            <div className="empty-state">
              <strong>Ingen kampe fundet</strong>
              <p>Rankedin har ikke returneret kampe for holdet endnu.</p>
            </div>
          )}
        </div>
      )}

      {tab === "standings" && (
        <Standings rows={data.standings} selectedTeam={data.team.name} />
      )}
    </section>
  );
}
