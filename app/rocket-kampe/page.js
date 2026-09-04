import { getOrganisationTeams } from "@/lib/rankedin";
import styles from "./page.module.css";

export const revalidate = 300;

export const metadata = {
  title: "Rocket Padel Esbjerg – kommende kampe",
  description:
    "Automatisk oversigt over kommende hjemmekampe i Rocket Padel Esbjerg.",
};

const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen";

function timeZoneOffsetMs(date, timeZone = COPENHAGEN_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function dateInCopenhagen(year, month, day, hour = 0, minute = 0, second = 0) {
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  let candidate = new Date(wallClockAsUtc);
  let offset = timeZoneOffsetMs(candidate);
  candidate = new Date(wallClockAsUtc - offset);

  const correctedOffset = timeZoneOffsetMs(candidate);
  if (correctedOffset !== offset) {
    candidate = new Date(wallClockAsUtc - correctedOffset);
  }

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function parseRankedinDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();

  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (european) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = european;
    return dateInCopenhagen(year, month, day, hour, minute, second);
  }

  const localIso = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
  );

  if (localIso) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = localIso;
    return dateInCopenhagen(year, month, day, hour, minute, second);
  }

  const native = new Date(raw);
  return Number.isNaN(native.getTime()) ? null : native;
}

function hasTime(value) {
  const raw = String(value || "").trim();

  const european = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
  );
  if (european) {
    return Boolean(european[4]) && !(Number(european[4]) === 0 && Number(european[5]) === 0);
  }

  const iso = raw.match(/[T ](\d{1,2}):(\d{2})/);
  return Boolean(iso) && !(Number(iso[1]) === 0 && Number(iso[2]) === 0);
}

function normalizeVenue(value) {
  return String(value || "")
    .toLocaleLowerCase("da")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9æøå\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRocketPadelEsbjerg(value) {
  const venue = normalizeVenue(value);

  return (
    venue.includes("rocket padel esbjerg") ||
    (venue.includes("rocket") && venue.includes("padel") && venue.includes("esbjerg"))
  );
}

function startOfTodayInCopenhagen() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COPENHAGEN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return dateInCopenhagen(values.year, values.month, values.day, 0, 0, 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: COPENHAGEN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: COPENHAGEN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildRocketMatches(teams) {
  const today = startOfTodayInCopenhagen();
  const unique = new Map();

  for (const team of teams) {
    for (const match of team.upcomingHomeMatches || []) {
      const date = parseRankedinDate(match.date);
      if (!date || (today && date.getTime() < today.getTime())) continue;

      // Kampens konkrete spillested har førsteprioritet.
      // Hvis RankedIn ikke har angivet et spillested på kampen, bruges holdets hjemmebane.
      const venue = match.location || team.homeCourt || "";
      if (!isRocketPadelEsbjerg(venue)) continue;

      const key = String(
        match.id || `${team.id}-${match.date}-${match.home}-${match.away}`
      );

      if (!unique.has(key)) {
        unique.set(key, {
          id: key,
          date,
          hasTime: hasTime(match.date),
          home: match.home || team.name || "Ukendt hjemmehold",
          away: match.away || "Ukendt udehold",
          league: team.league || "–",
          division: team.division || team.region || "–",
        });
      }
    }
  }

  return [...unique.values()].sort((a, b) => a.date - b.date);
}

export default async function RocketKampePage() {
  const teams = await getOrganisationTeams();
  const matches = buildRocketMatches(teams);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>ROCKET PADEL ESBJERG</div>
        <h1>Kommende kampe</h1>
        <p>
          Oversigten viser kommende hjemmekampe, der er registreret med
          Rocket Padel Esbjerg som spillested eller hjemmebane i Rankedin.
          Kampene sorteres automatisk efter dato.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTop}>
          <div>
            <span className={styles.smallLabel}>KAMPOVERSIGT</span>
            <h2>Rocket Padel Esbjerg</h2>
          </div>

          <div className={styles.count}>
            <strong>{matches.length}</strong>
            <span>{matches.length === 1 ? "kommende kamp" : "kommende kampe"}</span>
          </div>
        </div>

        {matches.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Tid</th>
                  <th>Hjemmehold</th>
                  <th>Udehold</th>
                  <th>Liga</th>
                  <th>Række</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td data-label="Dato">
                      <strong>{formatDate(match.date)}</strong>
                    </td>
                    <td data-label="Tid">
                      {match.hasTime ? formatTime(match.date) : "Afventer"}
                    </td>
                    <td data-label="Hjemmehold">
                      <strong>{match.home}</strong>
                    </td>
                    <td data-label="Udehold">{match.away}</td>
                    <td data-label="Liga">{match.league}</td>
                    <td data-label="Række">{match.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            Der er ingen kommende kampe registreret i Rocket Padel Esbjerg lige nu.
          </div>
        )}

        <div className={styles.footerNote}>
          Data hentes automatisk fra Rankedin og opdateres løbende.
        </div>
      </section>
    </main>
  );
}
