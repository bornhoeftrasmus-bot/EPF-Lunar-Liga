import Link from "next/link";
import { notFound } from "next/navigation";
import TeamDetails from "@/components/TeamDetails";
import { getTeamDetails, getTeamHomepage } from "@/lib/rankedin";

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

export default async function TeamPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo =
    typeof resolvedSearchParams?.returnTo === "string"
      ? resolvedSearchParams.returnTo
      : "/";

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

  return (
    <main className="page-shell team-page">
      <Link href={returnTo} className="back-link">← Alle EPF-hold</Link>

      <section className="team-hero">
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
      <div className="version-tag team-version">EPF Liga v26</div>
    </main>
  );
}
