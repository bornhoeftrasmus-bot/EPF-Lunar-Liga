import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="empty-state">
        <strong>Holdet kunne ikke hentes</strong>
        <p>
          Holdet findes muligvis ikke længere i den aktive Lunar Liga, eller
          Rankedin svarer ikke lige nu.
        </p>
        <Link className="team-button inline-button" href="/">
          Tilbage til alle hold
        </Link>
      </div>
    </main>
  );
}
