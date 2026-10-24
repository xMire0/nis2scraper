# Produktbacklog — Northstar

Dato: 23. september 2026. Status: prioriteret forslag, klar til at vælge næste leverance.

## Produktmål

Gør det hurtigt at finde relevante danske virksomheder, dokumentere deres mulige behov og klargøre en konkret salgssamtale. Et brugbart lead skal have korrekt virksomhedsidentitet, sporbare oplysninger, forståelig ICP-vurdering og en relevant næste handling.

OpenAI bruges efter den seneste beslutning til hjemmesidesøgning. Crawling, scoring, ICP og salgstekster bygger fortsat på lokale regler og skabeloner. Systemet må ikke fremstille offentlig research som en juridisk NIS2-afgørelse.

Backloggen bygger på gennemgang af den aktuelle kode og projektdokumentation. At en funktion findes i koden er ikke dokumentation for, at den virker på alle virksomheder. Der er ikke gennemført en ny repræsentativ live-pilot som del af denne plan.

Den eksisterende `.planning/ROADMAP.md` og `.planning/REQUIREMENTS.md` er historiske: deres afkrydsninger afspejler ikke den aktuelle implementering, og det generelle forbud mod AI-afhængighed er overhalet af beslutningen om OpenAI til hjemmesidesøgning. De er ikke automatisk markeret færdige her.

## Hvad findes allerede?

| Område | Findes nu | Hvad mangler især? |
|---|---|---|
| Virksomheder | CSV-import, CVR-validering, dubletkontrol og CVRbasen-discovery | Måling af kvaliteten af de fundne leads og bedre daglig udvælgelse |
| Register og regnskab | Berigelse med kilder og regnskabsoplysninger | Tydeligere fuldstændighed, alder og genkørsel af enkelte trin |
| Hjemmeside | OpenAI-søgning og lokal CVR-verifikation | Bedre identitetskontrol og enkel rettelse af forkert hjemmeside |
| Crawling | Robots, begrænsninger, kildebeviser og stop ved adgangsblokering | Brugbar håndtering af blokerede og teknisk utilgængelige hjemmesider |
| Kontakter | Udtræk af offentlige arbejdskontakter, kilde og undertrykkelse/udløb | Valg af relevant kontaktperson og synlig kontaktkvalitet |
| Prioritering | Lokal score, A–D, segment, ICP og redigerbare regler | Validering mod manuelt vurderede leads og senere salgsresultater |
| Automatisk forløb | Én primær knap og kø med trin, fejl og budgetstatus | Pause, annullering, målrettet genkørsel og bedre historik |
| Salgsarbejde | Status, noter, næste handling og opfølgningsdato | En samlet arbejdsdag med opgaver og prioriterede leads |
| Salgsmateriale | Fire danske, kildebaserede skabelonudkast | Redigering, godkendelse, personas og bedre tilbudstilpasning |
| Drift | Lokal installation, database, tests og basal adgangskontrol | Pilotmålinger, backup/restore og teamadgang før fælles drift |

## Prioriteringsprincip

- **P0 — næste leverance:** korrekte data og et kontrollerbart arbejdsforløb.
- **P1 — derefter:** færre manuelle salgstrin og bedre daglig produktivitet.
- **P2 — ved dokumenteret behov:** flere datakilder, integrationer og større kapacitet.

Størrelse er relativ: **S** = en afgrænset ændring, **M** = flere sammenhængende ændringer, **L** = ændringer på tværs af data, backend og brugerflade. Det er ikke kalenderestimater. Implementeringsopgaver inkluderer relevant test, review og fejlretning.

## P0: Få data og gennemløb til at være pålidelige

### PB-01 · Korrekt hjemmeside og mulighed for rettelse · L

**Nu:** Der søges efter kandidater og kontrolleres CVR i sidetekst. CVR-numre fra flere virksomheder kan skabe tvivl; et nummer i en kundecase er ikke nødvendigvis sidens ejer.

**Leverance:** Styrk identitetskontrollen, og tilføj en kompakt rettemulighed under den eksisterende hovedknap. Brugeren skal kunne rette, afvise eller fastholde et domæne uden at få flere primære knapper.

**Acceptkriterier:**
- Viser, hvorfor et domæne blev valgt, med kilde og kontroltidspunkt.
- Ejeroplysninger adskilles fra kundereferencer; tvetydig koncernidentitet sendes til manuel vurdering.
- Et manuelt fastholdt domæne overskrives ikke af næste automatiske kørsel. Afviste kandidater genvælges ikke uden aktiv nulstilling.
- Ved domæneskift bliver gamle websitekontakter, beviser, score og udkast tydeligt historiske, indtil ny analyse er gennemført.
- Kontroller med cases for ens firmanavne, kundens CVR i referencecase, koncernside, intet CVR og korrekt ejer-CVR.

### PB-02 · Genkør det relevante trin · M

**Nu:** Hele forløbet kan sættes i kø; en eksisterende købestilling er beskyttet mod dubletter. Der mangler enkel kontrol med, hvad der genkøres.

**Leverance:** Bevar én hovedknap. Tilføj sekundære muligheder for at fortsætte et fejlet trin eller bevidst søge efter en ny hjemmeside.

**Acceptkriterier:**
- En regnskabsfejl kræver ikke en ny betalt hjemmesidesøgning.
- En ny søgning kan tilsidesætte søgecache, men respekterer budgetter og brugerens domænevalg.
- Dobbeltklik eller samtidige bestillinger skaber ikke parallelle analyser eller dublerede automatiske udkast.
- Noter, salgsstatus og manuelt redigeret materiale bevares.

**Afhængighed:** PB-01 for regler om fastholdte og afviste domæner.

### PB-03 · Synlig og styrbar kø · M

**Nu:** Køvisning findes med virksomhed, trin, status og fejl. Arbejdet er globalt serialiseret.

**Acceptkriterier:**
- Brugeren kan pause, fortsætte og annullere en bestilling. Allerede igangsatte eksterne kald afsluttes sikkert; efterfølgende trin starter ikke efter annullering.
- Viser forskel på automatisk opdagede og manuelt bestilte opgaver, budgetpause, adgangsblokering og teknisk fejl.
- Viser seneste aktivitet og tidligste næste forsøg; viser kun estimeret ventetid, hvis den kan underbygges.
- Genstart midt i et job kan ikke efterlade det permanent som aktivt eller fordoble gemte resultater.
- Kort køhistorik viser slutresultat og fejlårsag pr. kørsel.

### PB-04 · Brugbar håndtering af 403 og manglende data · M

**Nu:** Crawleren stopper ved adgangsbegrænsning. Det er korrekt, men virksomheden bliver vanskelig at arbejde videre med.

**Acceptkriterier:**
- Viser eksempelvis: “Hjemmesiden afviser automatisk hentning. Registerdata er bevaret; websiteanalyse kræver manuel vurdering.”
- Manglende websitebeviser giver ukendt datagrundlag, ikke automatisk lavt ICP-match.
- Brugeren kan tilføje et kort manuelt bevis med offentlig kilde, dato og oprindelse; det fremstår særskilt fra crawlerfund.
- Register- og regnskabsdata kan færdiggøres uafhængigt af websiteblokering.
- Ingen gentagne automatiske forsøg mod en vedvarende blokering, og ingen omgåelse af adgangsbegrænsninger.

### PB-05 · Mål kvaliteten på en rigtig pilot · M

**Nu:** Der findes automatiske kontroller, men ingen dokumenteret præcision og dækning på et repræsentativt udsnit.

**Leverance:** Et manuelt vurderet sæt på cirka 30–50 virksomheder fordelt på segmenter, størrelser og vanskelige hjemmesider. Hold en del af sættet ude af regeltilpasningen.

**Acceptkriterier:**
- Registrér korrekt/forkert/ukendt hjemmeside, blokerede sider, brugbare kontakter, ICP-enighed, gennemløbstid og API-forbrug pr. brugbart lead.
- Vis både præcision blandt accepterede hjemmesider og dækning blandt alle undersøgte virksomheder.
- Gennemgå alle forkert accepterede domæner og alle udokumenterede salgsudsagn, før bredere automatisk kørsel.
- Dokumentér fejlrettelser og genafprøvning på de berørte cases samt det tilbageholdte udvalg.
- Aftal kvalitetsgrænser efter baseline. Ingen markedsføring af et “præcisionstal” før det er målt.

**Afhængighed:** Baseline kan begynde straks; afsluttende pilot følger PB-01–04.

## P1: Gør systemet til et dagligt salgsværktøj

| ID | Funktion / størrelse | Nuværende hul | Acceptkriterier |
|---|---|---|---|
| PB-06 | ICP med tydelige kriterier · M | ICP findes, men fit og datamangler skal være lettere at arbejde med | Redigér obligatoriske kriterier og fravalg; vis opfyldt, ikke opfyldt og ukendt særskilt. Målgruppematch, datakvalitet og eventuelle købssignaler blandes ikke til en udokumenteret sandsynlighed. Manuel vurdering gemmes med begrundelse. |
| PB-07 | Salgsmateriale der kan redigeres · M | Fire udkast findes; fuldt redigerings- og godkendelsesflow mangler | Gem egne ændringer, version og kladdestatus. Regenerering opretter en ny version og overskriver ikke manuelt arbejde. Beviser kan åbnes fra materialet. Intet sendes automatisk. |
| PB-08 | Tilpas tilbud og budskab pr. segment · M | Segmenttekst findes, men ikke et samlet redigerbart indholdsbibliotek | Gem problem, relevant rolle, tilbud og forsigtig vinkel for hvert aktivt segment. Telefon, e-mail, LinkedIn og webinar bruger samme godkendte grundlag. Ingen opdigtede kunder, certificeringer eller økonomiske gevinster. |
| PB-09 | Kontaktkvalitet og primær kontakt · M | Kontaktfund er ikke det samme som en kvalificeret køber | Vis rolle, kontaktform, kilde og alder. Skeln mellem hovednummer/fællespostkasse og navngiven kontakt. Brugeren kan vælge eller rette primær kontakt. Fravalg respekteres efter genanalyse. |
| PB-10 | “Mit salgsarbejde i dag” · M | Næste handling og dato findes, men mangler samlet arbejdsvisning | Vis forfaldne handlinger, dagens opfølgninger og klargjorte leads. Filtrér og markér udført. Foreslå en relevant næste handling uden at overskrive brugerens egen. |
| PB-11 | Gemte leadlister og eksport · M | Der mangler et samlet flow fra udvælgelse til brug uden for appen | Gem filtre for segment, prioritet, datakvalitet og status. Eksportér valgte virksomheder med kilde, dato og næste handling. Eksport respekterer kontaktfravalg; gentaget eksport skaber ikke nye virksomheder. |
| PB-12 | Dataalder og opdateringspolitik · M | Kildetidspunkter findes, men samlet aktualitet og selektiv opdatering mangler | Vis alder separat for register, regnskab, website og kontakter. Opdatér kun relevante forældede data inden for budget. Bevar historik og forklar ændringer i score. |
| PB-13 | Forbrug og fejloverblik · M | Daglige kaldeloft findes; det er ikke et loft i kroner | Vis forbrug, reserverede kald, cachebrug og fejl pr. kilde. Eventuelle prisestimater mærkes som estimater og versionsdateres. API-budgetændringer må ikke alene markere alle scores som forældede regler. |
| PB-14 | Salgsresultater og læring · M | Statushistorik findes, men ikke et samlet resultatbillede | Vis kontakt → møde → scope-afklaring → tilbud → vundet/tabt med entydige definitioner. Gem tabsårsag og sammenlign segmenter/scoregrupper med synlig stikprøvestørrelse. Ændr ikke vægte automatisk på et lille datasæt. |

PB-06 bygger på pilotens observationer. PB-07 og PB-08 hænger sammen; start med redigering af eksisterende skabeloner. PB-10 kan bygges på de felter, der allerede findes. PB-14 bliver først beslutningsstøtte, når reelle salgsresultater er registreret.

## P2: Udvid efter behov — eller før fælles drift

| ID | Funktion / størrelse | Hvornår? | Acceptkriterier |
|---|---|---|---|
| PB-15 | Kort kundebrief · S–M | Når sælgerne bruger de nuværende udkast | En printvenlig side med virksomhed, ICP, tre beviser, relevant kontakt, spørgsmål til scope-afklaring og næste handling. Genbrug eksisterende data; PDF via print før en særskilt dokumentmotor. |
| PB-16 | Én CRM-integration · L | Når et konkret CRM er valgt og CSV ikke er nok | Definér ejerskab over felter, match på CVR, vis synkroniseringsfejl og undgå dubletter. Start med én retning før tovejssynkronisering. |
| PB-17 | Udbud, rammeaftaler og nye signaler · L | Når websitebaseret kvalitet er målt | Tilføj én dokumenteret kilde ad gangen. Gem CVR-match, kilde, dato og udløb. Skeln mellem deltagelse, aftale og dokumenteret leverance. Mål om kilden giver flere brugbare leads. |
| PB-18 | Hurtigere lister og selvstændig worker · M–L | Ved mærkbar langsomhed eller behov for drift uden åben lokal server | Serverpaginering og detaljer efter behov erstatter det brede snapshot med op til 2.000 virksomheder. Flyt først køarbejdet til selvstændig worker, hvis driftsbehovet kræver det. Budget- og domænelåse bevares. |
| PB-19 | Teamadgang, backup og gendannelse · L | Obligatorisk før fælles eller eksternt tilgængelig drift | Individuelle brugere og relevante rettigheder, sporbarhed for ændringer, beskyttede secrets, automatisk backup og en dokumenteret restore-prøve. Lokal fælles adgangskode er ikke slutløsningen for et team. |
| PB-20 | Samlet datalivscyklus · M | Før større datamængder eller fælles drift | Udvid eksisterende kontaktudløb med tydelige slette- og opbevaringsregler for rå import, beviser, drafts og logs. Vis konsekvens før sletning og test at andre virksomheders data ikke påvirkes. Bevar nødvendige forbrugstællere uden unødige persondata. |

P2 betyder behovsstyret, ikke uvigtigt: PB-19 og PB-20 flyttes frem, hvis produktet skal deles eller hostes.

## Teknisk oprydning, knyttet til produktleverancerne

- **Under PB-01–03:** gennemgå domænelåse, identitetsændringer, køejerskab og samtidige genkørsler. Automatiske udkast bør også have en databasegaranti mod dubletter.
- **Under PB-03:** erstat tvetydig historisk markering af manuelle købestillinger med en eksplicit oprindelse; migrér konservativt, når oprindelsen er ukendt.
- **Under PB-05:** gør testdata og testkonfiguration uafhængige af brugerens aktuelle budgetter. Kør tests mod en særskilt testdatabase, så smoke-tests ikke ændrer arbejdsdatabasens konfigurationshistorik.
- **Under PB-13:** adskil ændringer i scoringsregler fra API- og driftsindstillinger.
- **Før næste GSD-plan:** afstem roadmap og requirements med implementeringen og beslutningen om AI til hjemmesidesøgning. Markér først krav verificeret, når der foreligger passende evidens.

## Foreslået leveranceplan

### Leverance A — “Jeg stoler på mine leads”

1. Start PB-05 med baseline og et lille udvalg af kendte fejl.
2. Implementér PB-01 og PB-04: korrekt domæne, rettelse og forståelige blokeringer.
3. Implementér PB-02 og PB-03: genkørsel og køkontrol.
4. Review identitet, gamle data, samtidighed og budgethåndtering; ret fundne fejl.
5. Gennemfør pilotens resterende cases, ændringsrunde og stabilisering.

**Afslutning:** En sælger kan forstå og rette et lead, og pilotens fejl og begrænsninger er dokumenteret. Uafklarede leads fremstår uafklarede.

### Leverance B — “Jeg kan arbejde fra systemet hver dag”

PB-06–10 samt en enkel eksport fra PB-11. Start med eksisterende ICP, kontaktfelter, opfølgningsdatoer og skabeloner.

**Afslutning:** Brugeren kan vælge dagens leads, gennemgå en kontakt, redigere materiale og registrere næste handling. Afprøv forløbet i reelt salgsarbejde, saml feedback og afsæt en ændrings- og fejlretningsrunde.

### Leverance C — “Vi kan drive og forbedre det”

PB-12–14. Tag kun PB-15–20 med, når behovet er konkret. Ved teamlancering kommer adgangskontrol, backup og datalivscyklus før lanceringen.

**Afslutning:** Datakvalitet, forbrug og salgsresultater kan følges, og den valgte driftsform er afprøvet inklusive gendannelse.

## Fælles definition af færdig

- Acceptkriterier demonstreret med realistiske data og relevante fejlscenarier.
- Ingen overskrivning af brugerens noter, status, fravalg eller redigerede materiale uden en udtrykkelig handling.
- Relevante automatiske kontroller, typecheck og build for kodeændringer; manuel browserkontrol af berørte flows.
- Review, fejlretning og genafprøvning afsluttet. Begrænsninger dokumenteret.
- Ingen udokumenterede juridiske konklusioner eller salgspåstande; kilder og usikkerhed følger resultatet.

## Bevidst udskudt

Automatisk udsendelse af e-mails/LinkedIn-beskeder, egen søgemaskine, mange CRM-integrationer på én gang, nye AI-agenter til scoring og microservices. De løser ikke de aktuelle problemer med domæneidentitet, datadækning og et brugbart salgsforløb.

## Kodegrundlag

- `src/lib/intelligence/website.ts`, `enrichment.ts`, `openai-website.ts` og `crawler.ts`: hjemmesidevalg, verifikation og hentning.
- `src/lib/intelligence/automatic-enrichment.ts`, `queue.ts` og `src/instrumentation.ts`: kø og afvikling.
- `src/lib/intelligence/scoring.ts`, `contacts.ts`, `outreach.ts` og `sales-material.ts`: kvalifikation, kontakter og udkast.
- `src/app/api/intelligence/route.ts`: dataudlevering, bestilling og indstillinger.
- `prisma/schema.prisma`, `tests/` og `README.md`: datamodel, eksisterende kontroller og dokumenteret opsætning.
