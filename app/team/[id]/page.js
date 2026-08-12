import Link from "next/link";
import { notFound } from "next/navigation";
import TeamDetails from "@/components/TeamDetails";
import { getTeamDetails } from "@/lib/rankedin";

export const revalidate = 60;

export default async function TeamPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo =
    typeof resolvedSearchParams?.returnTo === "string"
      ? resolvedSearchParams.returnTo
      : "/";

  let data;

  try {
    data = await getTeamDetails(id);
  } catch (e) {
    console.error(e);
    notFound();
  }

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
          Spillere <span>{data.team.players.length}</span>
        </div>

        <div className="player-list compact">
          {data.team.players.map((player) =>
            player.url ? (
              <a
                key={`${player.id}-${player.name}`}
                className="player-chip"
                href={player.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>{player.name}</span>
                <span className="external">↗</span>
              </a>
            ) : (
              <div key={`${player.id}-${player.name}`} className="player-chip">
                {player.name}
              </div>
            )
          )}
        </div>
      </section>

      <TeamDetails data={data} />
      <div className="version-tag team-version">EPF Liga v16</div>
    </main>
  );
}
