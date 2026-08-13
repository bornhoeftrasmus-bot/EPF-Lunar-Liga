import "./frister.css";

export const metadata = {
  title: "EPF · Lunar Liga frister",
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

const DPF_URL = "https://www.danskpadelforbund.dk/turnering/dpf-holdliga/";

const MONTHS = {
  januar: 1,
  februar: 2,
  marts: 3,
  april: 4,
  maj: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
};

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAJ",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DEC",
];

const FALLBACK = [
  { date: "2026-08-13", title: "Deadline for ændring af holdnavn, hjemmebane & hjemmeklub" },
  { date: "2026-08-19", title: "Deadline for indskrivning af spillere på divisionsholdenes interne ranglister" },
  { date: "2026-08-21", title: "Sidste frist for indskrivning af hjemmekampe i Rankedin" },
  { date: "2026-08-24", title: "Sidste frist for at flytte/rykke kampe i Elitedivisionens runde 2-5" },
  { date: "2026-08-28", title: "Sidste frist for at flytte/rykke udekampe i Rankedin" },
  { date: "2026-10-10", title: "Alle kampe på udendørsbaner uden overdækning skal være afviklet" },
  { date: "2026-11-02", title: "Sidste frist for valg af modstander til semifinalerne i Elitedivisionen" },
  { date: "2026-11-15", title: "Sidste spilledag i Lunar Ligaens grundspil i alle divisioner" },
  { date: "2026-11-22", title: "Sidste frist for ændring/fastsættelse af alle playoff-kampe i Rankedin" },
  { date: "2026-11-29", title: "Sidste spilledag i Lunar Ligaens grundspil i alle serier" },
  { date: "2026-12-06", title: "Playoff-kampe til Elitedivision & 1. division skal afvikles eller være afviklet" },
  { date: "2026-12-20", title: "Afsluttende playoff-kamp til Elitedivisionen skal afvikles eller være afviklet" },
];

function decodeHtml(text = "") {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&aelig;/gi, "æ")
    .replace(/&oslash;/gi, "ø")
    .replace(/&aring;/gi, "å")
    .replace(/&AElig;/g, "Æ")
    .replace(/&Oslash;/g, "Ø")
    .replace(/&Aring;/g, "Å");
}

function htmlToLines(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function seasonYearFromLines(lines) {
  const heading = lines.find((line) => /Lunar Ligaen\s*[–-]\s*Efterår\s+20\d{2}/i.test(line));
  const match = heading?.match(/(20\d{2})/);
  return match ? Number(match[1]) : new Date().getUTCFullYear();
}

function parseDeadlines(html) {
  const lines = htmlToLines(html);
  const year = seasonYearFromLines(lines);
  const deadlineWords = /(deadline|sidste frist|skal være afviklet|sidste spilledag)/i;
  const datePattern = /^(\d{1,2})\.\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\s*[–—-]\s*(.+)$/i;

  const parsed = [];

  for (const line of lines) {
    const match = line.match(datePattern);
    if (!match || !deadlineWords.test(match[3])) continue;

    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    const title = match[3].trim().replace(/\.+$/, "");
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    parsed.push({ date, title });
  }

  return Array.from(
    new Map(parsed.map((item) => [`${item.date}|${item.title}`, item])).values()
  ).sort((a, b) => a.date.localeCompare(b.date));
}

async function getDeadlines() {
  try {
    const response = await fetch(DPF_URL, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "EPF-Lunar-Frister/1.0" },
    });

    if (!response.ok) throw new Error(`DPF svarede ${response.status}`);
    const html = await response.text();
    const parsed = parseDeadlines(html);
    return parsed.length >= 3 ? parsed : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function copenhagenTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetween(fromISO, toISO) {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function dateParts(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return { day, month, monthLabel: MONTH_LABELS[month - 1] };
}

function shortDate(iso) {
  const { day, monthLabel } = dateParts(iso);
  return `${day}. ${monthLabel}`;
}

function statusFor(days) {
  if (days === 0) return { tone: "urgent", label: "Frist i dag", sub: "Fristen er i dag" };
  if (days === 1) return { tone: "urgent", label: "Frist i morgen", sub: "Der er 1 dag til fristen" };
  if (days <= 7) return { tone: "soon", label: "Kommende frist", sub: `Der er ${days} dage til fristen` };
  return { tone: "normal", label: "Næste frist", sub: `Der er ${days} dage til fristen` };
}

export default async function FristerPage() {
  const deadlines = await getDeadlines();
  const today = copenhagenTodayISO();
  const upcoming = deadlines.filter((item) => item.date >= today).slice(0, 3);

  if (!upcoming.length) {
    return (
      <main className="deadlineFrame">
        <section className="deadlineWidget emptyWidget">
          <div>
            <span className="eyebrow">LUNAR LIGA</span>
            <h1>Ingen kommende frister</h1>
            <p>Se DPF’s ligaoversigt for den nyeste sæson.</p>
          </div>
          <a className="allDatesButton" href={DPF_URL} target="_blank" rel="noreferrer">
            Se alle datoer hos DPF →
          </a>
        </section>
      </main>
    );
  }

  const main = upcoming[0];
  const mainDate = dateParts(main.date);
  const days = daysBetween(today, main.date);
  const status = statusFor(days);
  const seasonYear = Number(main.date.slice(0, 4));

  return (
    <main className="deadlineFrame">
      <section className="deadlineWidget">
        <header className="deadlineTopbar">
          <div className="deadlineTitleWrap">
            <span className="deadlineBrand">EPF</span>
            <div>
              <span className="eyebrow">LUNAR LIGA</span>
              <h1>Vigtige frister</h1>
            </div>
          </div>
          <span className="season">Efterår {seasonYear}</span>
        </header>

        <div className={`deadlinePrimary ${status.tone}`}>
          <div className="deadlineDateCard">
            <strong>{mainDate.day}</strong>
            <span>{mainDate.monthLabel}</span>
          </div>

          <div className="deadlineMainCopy">
            <span className="deadlineStatus"><i />{status.label}</span>
            <h2>{main.title}</h2>
            <p>{status.sub}</p>
          </div>
        </div>

        {upcoming.length > 1 && (
          <div className="deadlineNext">
            <div className="deadlineNextLabel">DEREFTER</div>
            {upcoming.slice(1).map((item) => (
              <div className="deadlineNextRow" key={`${item.date}-${item.title}`}>
                <strong className="deadlineNextDate">{shortDate(item.date)}</strong>
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        )}

        <footer className="deadlineFooter">
          <span>Opdateres automatisk fra Dansk Padel Forbund</span>
          <a href={DPF_URL} target="_blank" rel="noreferrer">
            Alle datoer hos DPF <b>→</b>
          </a>
        </footer>
      </section>
    </main>
  );
}
