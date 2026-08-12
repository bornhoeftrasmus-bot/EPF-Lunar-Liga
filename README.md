# EPF i Lunar Ligaen

Next.js/Vercel-app til Esbjerg Padel Forening.

## Funktioner

- Henter aktive EPF-hold automatisk fra Rankedin.
- Viser kun hold hvor `Home Club = Esbjerg Padel Forening`.
- Forside med holdnavn, række/division og spillere.
- Søg på hold eller spillernavn.
- Klik på spiller åbner spillerens Rankedin-profil.
- Klik på et hold åbner en holdside med:
  - Kampe
  - Spillested
  - Resultater
  - Stilling
  - Matches / Sets / Games
- Data hentes server-side, så frontend ikke er afhængig af Rankedin CORS.
- Cache/revalidate: 5 minutter.

## Lokal test

Installer Node.js hvis det ikke allerede er installeret.

Kør derefter i projektmappen:

```bash
npm install
npm run dev
```

Åbn:

```text
http://localhost:3000
```

## Deploy til Vercel

### Via GitHub
1. Opret et nyt GitHub repository.
2. Upload hele projektmappen.
3. Log ind på Vercel.
4. Vælg **Add New → Project**.
5. Importér GitHub-repositoriet.
6. Vercel bør automatisk registrere Next.js.
7. Klik **Deploy**.

Der kræves ingen environment variables i denne version.

### Via Vercel CLI
Fra projektmappen:

```bash
npm i -g vercel
vercel
```

Følg spørgsmålene på skærmen.

## Rankedin

Organisation ID:

```text
9002
```

Home Club-filter:

```text
Esbjerg Padel Forening
```

API-kaldene ligger i:

```text
lib/rankedin.js
```


## Version 3

- Logo fjernet fra appen.
- Søgefelt søger i holdnavn, række/division, liga, region og spillernavne.
- Nyt eksempelnavn i søgefeltet.
- Filter på række og liga.
- Sortering efter holdnavn, række eller liga.
- Række vises tydeligt på hvert holdkort.


## Version 4
- Spillere sorteres alfabetisk.
- Holdkampe kan åbnes og viser individuelle doubler og sætcifre.
- Kampstatus skelner mellem Spillet, Kommende og Afventer resultat.
- 0-0 behandles ikke længere automatisk som et spillet resultat.
- Matchdetaljer hentes via Rankedin endpoints for result model, team matches og lineups.
- Stillingsparseren bevarer fallback-logik for varierende Rankedin-feltnavne.


## Version 5
- Henter organisationens hold side for side i stedet for kun første side.
- Stopper først når Rankedin ikke returnerer nye unikke hold.
- Filtrerer på Home Club = Esbjerg Padel Forening i stedet for holdnavn.
- Hold med sponsor-/andre navne bliver derfor også fundet, hvis Home Club er EPF.
- Rankedin team-homepages hentes i små batches med retry for at undgå at hold forsvinder ved throttling.
- Viser samlet antal aktive EPF-hold på forsiden.


## Version 6
- Siden er ikke længere begrænset til Lunar Ligaen.
- Alle aktive hold med Home Club = Esbjerg Padel Forening hentes.
- ForeningsLigaen og andre aktive ligaer kommer derfor automatisk med.
- Liga kan fortsat filtreres og bruges i søgningen.
- Titel og tekster er ændret fra Lunar Liga-overblik til samlet EPF hold- og ligaoverblik.


## Version 7
- Viser næste kamp direkte på hvert holdkort.
- Viser modstander, hjemme/ude, dato/tid og spillested.
- Ny sortering efter næste kamp.
- Ny sortering efter næste hjemmekamp.
- Hold uden kommende kamp placeres sidst ved disse sorteringer.
- Stillingsparseren læser nu også Rankedin-felter hvor Team er en tekstværdi eller ligger i andre nested felter.
- Ekstra rekursiv fallback til holdnavne i standings.


## Version 8
- Oversigten scanner alle aktive organisationssider i RankedIn og stopper først efter to tomme sider.
- Hold filtreres fortsat udelukkende på Home Club = Esbjerg Padel Forening.
- Data revalideres hvert 60. sekund, så nye hold, spillere, kampe og stillingsændringer kommer automatisk med.
- Matches, Sets og Games forsøges nu sammensat som Vundet - Tabt (difference), hvis RankedIn leverer komponenterne separat.
- Stillingen viser tydeligere kolonneoverskrifter for Matches og Sets.


## Version 9
- Modstanderhold i stillingen er klikbare.
- Klik åbner et internt panel med liga, række, region, Home Club, hjemmebane og spillere.
- Spillere i modstanderholdets panel linker til Rankedin, når profillink findes.
- Hvis Rankedin leverer et direkte holdlink, vises også en knap til holdets Rankedin-side.
- Valgte EPF-hold forbliver markeret og er ikke gjort til et modstanderlink.


## Version 10
- Modstanderhold åbnes nu direkte inde i stillingen i stedet for i popup/modal.
- Ny "Se hold"-knap på hver modstander.
- Klik folder liga, række, region, Home Club, hjemmebane og spillertrup ud direkte under holdets række.
- Samme interaktionsprincip som kampdetaljerne.
- Klik igen på "Skjul hold" lukker detaljerne.


## Version 11
- Matches, Sets og Games identificeres nu ud fra de faktiske hierarkiske scoremodeller i RankedIn.
- Irrelevante 0-0 scoremodeller ignoreres, når der findes reelle scoreværdier.
- Scorelinjer sorteres efter omfang: Matches < Sets < Games.
- Modstanderholdets Team ID kobles på stillingen via holdets kampplan, hvis stillings-API'et ikke selv sender ID.
- "Se hold" er dermed aktiv for modstandere, når Team ID findes i kampplanen.
- Holdoplysninger indlæses korrekt med React useEffect ved udfoldning.


## Version 12
Stillingen er nu mappet direkte efter det faktiske JSON-svar fra
GetTeamStandingsAsync:

- participantName = holdnavn
- participantUrl = direkte Rankedin holdlink
- standing = placering
- matchPoints = M. point
- played = spillet
- wins/losses = holdkampe V-T
- gamesWon/gamesLost/gamesDifference = Matches
- teamGamesWon/teamGamesLost/teamGamesDifference = Sets
- scoredPoints/concededPoints/pointsDifference = Games

Team ID udledes direkte af participantUrl, fx:
`/en/team/homepage/3007047` -> `3007047`.

Det gør samtidig "Se hold" mere robust, og holdnavnet i stillingen linker
direkte til Rankedin.


## Version 13 – stabiliseret datalag

Denne version rydder de tidligere fallback-gæt væk og bruger faste kilder:

### Alle aktive EPF-hold
- Organisation ID 9002 pagineres med `GetOrganisationTeamLeaguesAsync`.
- Der stoppes først efter to på hinanden følgende tomme sider.
- Kandidater verificeres via holdets homepage.
- Det eneste medlemsfilter er `Home Club = Esbjerg Padel Forening`.
- Holdnavnet bruges aldrig som medlemsfilter.
- Organisationsoversigten revalideres hvert 5. minut.

### Stilling
`GetTeamStandingsAsync` bruges direkte med præcis mapping:

- participantName = holdnavn
- participantUrl = Team ID + direkte Rankedin-link
- standing = placering
- matchPoints = M. point
- played = spillet
- wins / losses = holdkampe V-T
- gamesWon / gamesLost / gamesDifference = Matches
- teamGamesWon / teamGamesLost / teamGamesDifference = Sets
- scoredPoints / concededPoints / pointsDifference = Games

Stilling og kampe revalideres hvert 60. sekund.

### Se hold
- Team ID udledes direkte af `participantUrl`.
- Knappen henter holdets homepage via `/api/team/[id]`.
- Holdet foldes ud direkte under stillingsrækken.
- Direkte Rankedin-link vises via participantUrl.


## Version 14
- Bekræftet via GetTeamsLineupsAsync at teamUrl-id'et er det rigtige Team ID.
- Eksempel: `/en/team/homepage/3017045` = Team ID 3017045.
- "Se hold" bruger derfor direkte Team ID fra participantUrl.
- Holdnavnet linker direkte til Rankedin.
- Stillingen bruger kun den verificerede mapping:
  - gamesWon/gamesLost = Matches
  - teamGamesWon/teamGamesLost = Sets
  - scoredPoints/concededPoints = Games
- Ingen fallback-gæt anvendes for Matches/Sets/Games.


## Version 15 – clean repository package
- Ren samlet pakke til nyt GitHub repository.
- Synligt versionsmærke: EPF Liga v15.
- Bygger på V14 med verificeret standings-mapping og Team ID fra participantUrl.


## Version 16
- Søgetekst, række-filter, liga-filter og sortering gemmes i URL'en.
- Samme valg gemmes også i localStorage som fallback.
- Scroll-position på holdoversigten gemmes i sessionStorage.
- "Kampe & stilling" sender returnTo med til holdsiden.
- "← Alle EPF-hold" fører tilbage til samme filtre, sortering og søgning.
- Oversigten forsøger også at genskabe den seneste scroll-position.
- Synligt versionsmærke: EPF Liga v16.


## Version 17 – hold må aldrig forsvinde
- Organisationslisten er nu master-listen for holdoversigten.
- Homepage-data og kampdata hentes uafhængigt.
- Hvis GetTeamMatchesAsync fejler, forsvinder holdet IKKE længere.
- Hvis team homepage midlertidigt fejler, beholdes holdet fra EPF's organisationsoversigt.
- Home Club-reglen anvendes fortsat, når homepage-data er tilgængelig.
- Nye/ændrede hold kommer fortsat automatisk ind via organisationens aktive holdliste.
- Synligt versionsmærke: EPF Liga v17.


## Version 18
- Fjerner den kunstige fallback-liga "Liga".
- Hold beholdes fortsat, selv hvis Rankedin midlertidigt mangler liga-detaljer.
- Et manglende liganavn vises som tomt og oprettes ikke som ekstra filtervalg.
- Synligt versionsmærke: EPF Liga v18.


## Version 19 – Kalender
- Ny hovedfane: Hold | Kalender.
- Kalender viser EPF's kommende hjemmekampe.
- Desktop: rigtig månedskalender.
- Mobil: agenda-visning.
- Måned kan skiftes frem/tilbage.
- Filter på liga og EPF-hold.
- Kamp viser tid, EPF-hold, modstander og række.
- Synligt versionsmærke: EPF Liga v19.
