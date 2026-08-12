import LeagueOverview from "@/components/LeagueOverview";
import { getOrganisationTeams } from "@/lib/rankedin";

export const revalidate = 300;

export default async function HomePage() {
  let teams = [];
  let error = "";

  try {
    teams = await getOrganisationTeams();
  } catch (e) {
    console.error(e);
    error = "Holdene kunne ikke hentes fra Rankedin lige nu.";
  }

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

      {error ? (
        <div className="notice error">{error}</div>
      ) : (
        <LeagueOverview teams={teams} />
      )}

      <footer className="footer">
        Data hentes automatisk fra Rankedin. Kun hold med Home Club
        “Esbjerg Padel Forening” vises.
        <div className="version-tag">EPF Liga v20</div>
      </footer>
    </main>
  );
}
