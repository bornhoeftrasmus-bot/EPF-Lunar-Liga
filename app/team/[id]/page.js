import Link from "next/link";
import { notFound } from "next/navigation";
import TeamDetails from "@/components/TeamDetails";
import { getTeamDetails, getTeamHomepage } from "@/lib/rankedin";
import styles from "./team-shell.module.css";

export const revalidate = 60;

function valueFrom(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function playerName(player) {
  const direct = valueFrom(player, "name", "Name");
  if (direct) return String(direct).trim();

  return [
    valueFrom(player, "firstName", "FirstName"),
    valueFrom(player, "middleName", "MiddleName"),
    valueFrom(player, "lastName", "LastName")
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function rankedPlayer(player, fallbackPlayers = []) {
  const name = playerName(player) || "Ukendt spiller";
  const id = valueFrom(player, "id", "Id") || name;
  const rankedInId = valueFrom(player, "rankedinId", "RankedinId");
  const explicitUrl = valueFrom(player, "playerUrl", "PlayerUrl");

  const fallback = fallbackPlayers.find((candidate) =>
    String(candidate.id) === String(id) ||
    candidate.name?.trim().toLocaleLowerCase("da") ===
      name.trim().toLocaleLowerCase("da")
  );

  let url = fallback?.url || "";

  if (explicitUrl) {
    url = String(explicitUrl).startsWith("http")
      ? String(explicitUrl)
      : `https://www.rankedin.com${explicitUrl}`;
  } else if (rankedInId) {
    url = `https://www.rankedin.com/en/player/${rankedInId}`;
  }

  return {
    id,
    name,
    role: valueFrom(
      player,
      "teamParticipantType",
      "TeamParticipantType",
      "role",
      "Role"
    ) || fallback?.role || "",
    rating: valueFrom(
      player,
      "ratingBegin",
      "RatingBegin",
      "rating",
      "Rating",
      "skillIndex",
      "SkillIndex"
    ) || fallback?.rating || "",
    url
  };
}

function playersInRankedInOrder(homepage, fallbackPlayers = []) {
  const team = homepage?.team || homepage?.Team || {};
  const rawPlayers = Array.isArray(team.players)
    ? team.players
    : Array.isArray(team.Players)
      ? team.Players
      : [];

  if (!rawPlayers.length) return fallbackPlayers;

  // Important: Do not sort this list alphabetically.
  // RankedIn returns the team roster in the same order as its ranking/line-up,
  // so we preserve that source order exactly.
  return rawPlayers.map((player) => rankedPlayer(player, fallbackPlayers));
}

function safeReturnTo(value) {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/";
}

export default async function TeamPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = safeReturnTo(resolvedSearchParams?.returnTo);

  const focusMatch =
    typeof resolvedSearchParams?.focusMatch === "string"
      ? resolvedSearchParams.focusMatch
      : "";

  let data;
  let homepage;

  try {
    [data, homepage] = await Promise.all([
      getTeamDetails(id),
      getTeamHomepage(id)
    ]);
  } catch (e) {
    console.error(e);
    notFound();
  }

  const orderedPlayers = playersInRankedInOrder(
    homepage,
    data.team.players
  );

  const cameFromCalendar =
    returnTo.includes("view=calendar") ||
    returnTo.includes("calendarView=");

  const teamsHref = cameFromCalendar ? "/" : returnTo;
  const calendarHref = cameFromCalendar ? returnTo : "/?view=calendar";

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

      <nav className={styles.overviewTabs} aria-label="EPF liga navigation">
        <Link
          href={teamsHref}
          className={`${styles.tab} ${!cameFromCalendar ? styles.active : ""}`}
        >
          Hold
        </Link>
        <Link
          href={calendarHref}
          className={`${styles.tab} ${cameFromCalendar ? styles.active : ""}`}
        >
          Kalender
        </Link>
      </nav>

      <div className={styles.detailView}>
        <Link href={returnTo} className={styles.backLink}>
          ← Tilbage til oversigten
        </Link>

        <section className={`team-hero ${styles.teamHeroCard}`}>
          <div>
            <div className="eyebrow">{data.team.league || "Liga"}</div>
            <h1>{data.team.name}</h1>
            <div className="team-subline">
              {data.team.division && <span>{data.team.division}</span>}
              {data.team.region && <span>· {data.team.region}</span>}
            </div>
          </div>

          <div className="team-hero-venue">
            <small>Hjemmebane</small>
            <strong>{data.team.homeCourt || "Ikke angivet"}</strong>
            {data.team.homeCourtAddress && <span>{data.team.homeCourtAddress}</span>}
          </div>
        </section>

        <section className="roster-strip">
          <div className="card-section-title">
            Spillere <span>{orderedPlayers.length}</span>
          </div>

          <div className="player-list compact">
            {orderedPlayers.map((player, index) =>
              player.url ? (
                <a
                  key={`${player.id}-${player.name}`}
                  className="player-chip"
                  href={player.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{index + 1}. {player.name}</span>
                  <span className="external">↗</span>
                </a>
              ) : (
                <div key={`${player.id}-${player.name}`} className="player-chip">
                  {index + 1}. {player.name}
                </div>
              )
            )}
          </div>
        </section>

        <TeamDetails data={data} focusMatchId={focusMatch} />
      </div>

      <footer className="footer">
        Data hentes automatisk fra Rankedin. Kun hold med Home Club “Esbjerg Padel Forening” vises.
        <div className="version-tag">EPF Liga v26</div>
      </footer>
    </main>
  );
}
