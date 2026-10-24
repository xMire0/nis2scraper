# Vurdering af eksisterende projekt og forslag til MVP

Dato: 21. september 2026. Denne gennemgang vurderer den eksisterende kode mod det nye lead intelligence-brief. Applikationen er ikke ombygget som led i vurderingen.

## Anbefaling

Byg videre på projektets Next.js-, TypeScript-, Tailwind- og Prisma-fundament. Behold PostgreSQL; Supabase kan senere levere en administreret database og login. Den vigtigste ændring er produktets formål: prioritering af interessante leverandørleads med kildebeviser skal være den centrale funktion.

Det eksisterende projekt er en CVR-/årsrapport-pipeline med AI-baseret NIS2-scoping. Der findes ikke en implementeret crawler til virksomhedernes hjemmesider. Et valgfrit `websiteSummary`-felt i AI-input bliver aldrig udfyldt af den nuværende pipeline.

## Hvad kan genbruges?

| Område | Eksisterende implementering | Anbefaling |
|---|---|---|
| Dashboard | Leadtabel, filtre, KPI'er og detaljepanel | Behold komponentfundamentet; tilpas information og arbejdsgang |
| Virksomhedsdata | Unikt CVR, branche, adresse, ansatte, website, finansielle data | Udvid den eksisterende Company-model |
| CVR-integration | Virk Elasticsearch-klient med godkendelse og mapping | Behold til senere brug med legitim systemadgang; CSV først |
| Årsrapporter | XBRL/iXBRL samt PDF-fallback | Sekundær datakilde senere; kræver realistiske parser-tests |
| AI | Anthropic-klient, struktureret tool-output, Zod-validering | Genbrug integrationen; erstat prompt, outputskema og beslutningslogik |
| Leverandørrelevans | `SUPPLY_CHAIN_TARGET` og tekstsignaler | Relevant idé, men mangler kildebeviser og salgsprioritering |
| Salgsstatus | Status, noter, opfølgning og statushistorik | Udvid statusforløbet og beskyt manuelle valg ved genanalyse |
| Drift | Fejllog, kørselslog, retries og rate limiter | Genbrug mønstre; crawler kræver egen sikker URL-håndtering og domænebegrænsning |
| Kontakter | CVR-personer, Apollo/Hunter/Dropcontact og suppression-flag | Brug ikke provider-enrichment i denne MVP; implementér offentlig kontaktkilde med URL |
| Outreach | Én dansk e-mailskabelon | Erstat teksten; tilføj telefon, LinkedIn og webinar som udkast |

## Hvad mangler i forhold til briefet?

- CSV-upload, kolonnemapping, import-preview, CVR-validering, dubletrapport og rå importhistorik.
- Hjemmeside-crawl, robots.txt, vilkårsvurdering, relevante undersider, synlig tekst og kildesporing pr. fund.
- Kommerciel leadscore 0–100, A/B/C/D og særskilte signalvurderinger for direkte relevans og afledte kundekrav.
- De fire forsigtige relevansklasser fra briefet.
- Redigerbare segmenter, søgeord, vægte og versionering af scoring.
- Dokumenterede top-3-signaler med URL, uddrag og tidspunkt.
- Statusser for undersøgt, klar til kontakt, gratis scope-afklaring og tilbud.
- Login/adgangskontrol på alle relevante API'er samt praktiske funktioner til sletning, indsigelser og opbevaringsfrister.

## Konkrete fejl og risici i den eksisterende kode

1. **NIS2-pligt fastslås i outreach.** `src/lib/teaser.ts:57` skriver, at virksomheden falder under NIS2. Linje 46–48 påstår også, at størrelsestærsklen er overskredet uden at kontrollere det. AI-prompten i `src/services/nis2Scoper.ts` beder direkte modellen afgøre, om virksomheden er omfattet. Det er uforeneligt med det nye brief.
2. **Medarbejderinterval parses forkert.** `src/services/cvrService.ts:195` omdanner det kommenterede eksempel `50-99` til `509`. Intervaller skal gemmes som minimum, maksimum og original kildeværdi; kildeformatet skal testes på faktiske CVR-/CSV-eksempler.
3. **Navnesøgning kan returnere alle virksomheder.** `src/app/api/leads/route.ts:51` fjerner bogstaver fra søgningen og tilføjer derefter `cvr contains ""` i en OR-betingelse. CVR-betingelsen skal kun medtages, når der faktisk er cifre at søge på.
4. **Filtre og KPI'er bruger historiske vurderinger.** Linje 64 i samme route matcher enhver tidligere vurdering; linje 162 grupperer alle vurderinger. Listen viser derimod den seneste. En virksomhed kan derfor tælles flere gange eller optræde under et gammelt filter. Alle tre skal tage udgangspunkt i samme effektive, aktuelle vurdering.
5. **Genkørsel kan overskrive salgsarbejdet.** `src/services/pipeline.ts:342–346` sætter status til `QUALIFIED`, selv hvis leadet allerede er kontaktet, vundet eller tabt. Ændringen føres heller ikke gennem den normale statushistorik.
6. **Manuel override er bundet til én vurdering.** Datamodellen siger, at override altid vinder ved genkørsel, men pipelinen opretter en ny vurdering, og API'et læser den nyeste. En tidligere override bliver dermed ikke automatisk videreført. Brug en særskilt gældende manuel vurdering med historik.
7. **Manglende AI-resultat kan ligne lav relevans.** Fallback og lav modeltillid i `nis2Scoper.ts:311–357` kan ende som `OUT_OF_SCOPE`. Manglende beviser, mislykket hentning og lav relevans skal være adskilte tilstande.
8. **API-adgang er ufuldstændig.** Leadlæsning og statusændringer har ingen sessionkontrol. Batch-endpointet tillader kørsel, hvis token ikke er sat. Dashboardet sender ikke et token, hvis det er sat. Dette er ikke klar til ekstern brug.
9. **Batchkørsel er ikke holdbar.** Dashboardet starter en fire-and-forget-kørsel og henter listen igen én gang efter fem sekunder; fejlstatus fra startkaldet kontrolleres ikke. Det opfylder ikke ønsket om en sporbar manuel analyse pr. virksomhed.

## Informationsarkitektur

1. **Overblik:** prioriterede leads, manglende analyser, manuelle vurderinger og næste handlinger. KPI'er tæller virksomheder én gang.
2. **Virksomheder:** søgning og filtre for segment, 20–250 ansatte, score, A/B/C/D, relevans, salgsstatus og datofrist.
3. **Virksomhedsdetalje:** stamdata → seneste analyse → top-3-beviser → begrundelse og outreach-vinkel → kontaktkilder → salgsstatus og næste handling. Tydelig knap: “Analyser hjemmeside”.
4. **Import:** upload → vælg datakilde og kolonner → preview og fejl → importresultat. Se tidligere importer og dubletter.
5. **Salgsarbejde:** Ny → undersøgt → klar til kontakt → kontaktet → møde → gratis scope-afklaring → tilbud → vundet/tabt. Analyse må ikke automatisk flytte et eksisterende salg baglæns.
6. **Indstillinger:** segmenter, signaler, vægte, A/B/C/D-grænser, crawlgrænser, opbevaring og afsenderoplysninger.

## Foreslået datamodel

Udvid eksisterende tabeller med migrationer; opret ikke en konkurrerende virksomhedsbase.

| Tabel | Centrale felter og relationer |
|---|---|
| `companies` | id, unikt cvr, navn, website, by, branche og kodeversion, land, ansatte/min/max/kilde/dato, seneste score-id |
| `financial_data` | Eksisterende årsbaserede beløb med valuta, kilde og periode; omsætning må ikke forveksles med bruttofortjeneste |
| `imports` | kildebetegnelse, filnavn, filhash, beskyttet råfil, importtid, kolonnemapping og resultat |
| `import_rows` | import-id, rækkenummer, rå værdier, normaliseret CVR, company-id, fejl og dubletbeslutning |
| `enrichment_runs` | company-id, status, start/slut, crawlpolitik, besøgte/afviste URL'er, HTTP-status, fejl, model og promptversion |
| `evidence` | company-id, run-id, kilde-URL, hentet tidspunkt, kort ordret uddrag, signaltype, kundesektor og dokumenthash |
| `scores` | company-id, run-id, 0–100, A/B/C/D, segment, relevansklasse, direkte/afledt signalniveau, datadækning, pointforklaring og regelversion |
| `score_evidence` | score-id, evidence-id, regel-id og pointbidrag; gør de tre stærkeste signaler efterprøvelige |
| `contacts` | company-id, navn/rolle når relevant, offentlig arbejds-e-mail/telefon, kilde-URL, funddato, opbevaringsfrist og suppression |
| `outreach` | company-id, evt. contact-id og score-id, kanal, tekstudkast, oprettet dato og reviewstatus |
| `lead_outreach_status` | Eksisterende statusmodel udvidet med alle trin, næste handling, dato, ejer og noter |
| `outreach_events` | Eksisterende historik for ændringer med aktør og tidspunkt |
| `scoring_configs` | Versioneret konfiguration med segmenter, søgeord, vægte, prioritetsgrænser og aktiveringstidspunkt |
| `manual_reviews` | company-id, vurdering, begrundelse, reviewer og dato; skal overleve automatisk genanalyse |

Relationer: én virksomhed har mange importerede rækker, kørsler, beviser, scores, kontakter og udkast. Hver score refererer til præcis den kørsel og konfiguration, som producerede den. Beviser forbindes til scoren via `score_evidence`. En mislykket kørsel erstatter ikke den seneste brugbare analyse med et tomt resultat.

## Scoringlogik, første version

AI udtrækker og fortolker signaler fra hentet tekst. Serveren kontrollerer, at evidens-id og citat findes i materialet, og beregner scoren efter redigerbare regler. AI bestemmer ikke juridisk scope. Hjemmesidetekst behandles som data, aldrig som instruktioner til modellen.

| Positiv signalgruppe | Maks. point | Beviskrav |
|---|---:|---|
| Konkrete leverancer til relevante kundesektorer | 30 | Navngiven case/reference eller tydelig beskrivelse af faktisk leverance; salgstekst om en målgruppe vægtes lavere |
| Relevante tekniske ydelser | 25 | Leverede ydelser: drift, cloud, hosting, backup, software, ERP, integration, OT/IoT mv. |
| 20–250 ansatte | 20 | Importeret kildetal; ukendt størrelse giver 0 point og datamangelflag, ikke negativt bevis |
| Offentlige kunder, udbud og rammeaftaler | 10 | Faktisk reference/aftale; omtale af SKI alene beviser ikke en kontrakt |
| Sikkerheds- og dokumentationssignaler | 10 | Relevant kontekst omkring ISO, ISAE, SOC 2, NIS2, DORA, beredskab mv. |
| Aktuel sikkerheds-/compliance-rekruttering | 5 | Jobopslag med relevant funktion og kilde; udløbet opslag må ikke kaldes aktuelt |

Foreslåede fradrag: dokumenteret ren B2C −35; under 20 ansatte uden konkrete kritiske kunder −15; over 250 ansatte −25; ingen tekniske eller kundemæssige signaler efter en brugbar analyse −20. Fradrag må ikke udløses af en fejlet crawl. Alle tal er forslag til kommerciel prioritering, ikke validerede prædiktioner.

Samlet score = summen af positive bidrag minus fradrag, begrænset til 0–100. Gentagne søgeord giver ikke ekstra point. Samme bevis må ikke udløse fuld betaling flere gange for samme forhold. A = 75–100, B = 55–74, C = 30–54, D = 0–29. Enterprise-leads begrænses som udgangspunkt til højst C. Manglende evidens eller uafklaret målgruppe gør prioriteten foreløbig og kræver manuel vurdering.

Segmenterne er kommercielle: IT-drift/MSP; cloud/hosting; software/SaaS/ERP/integration; industriel automation/OT/IoT; medico/sundheds-IT; øvrige. De er adskilt fra kundesektorer og mulige NIS2-sektorer.

Relevansklasse vælges separat:

- **Mulig direkte NIS2-relevans:** konkrete aktiviteter giver grund til nærmere scope-afklaring. Også her kan afledte kundekrav være relevante.
- **Sandsynlig leverandør med afledte kundekrav:** konkrete leverancer og kunde-/sektorsignaler understøtter hypotesen, uden at kundens juridiske status antages bevist.
- **Kræver manuel vurdering:** utilstrækkelige, modstridende eller utilgængelige oplysninger. Ingen analyse er ikke det samme som lav relevans.
- **Lav relevans:** tilstrækkeligt materiale peger væk fra målgruppen.

Vis direkte og afledt signalniveau som høj/middel/lav/ukendt sammen med datadækning. Modellens selverklærede confidence og leadscore er ikke statistisk kalibrerede sandsynligheder. Procenter kræver et manuelt mærket evalueringssæt og efterfølgende kalibrering.

ISO 27001-omtale er ikke bevis på gyldigt certifikat, og et certifikat er ikke automatisk et rådgivningsbehov. Skeln mellem omtale, dokumenteret certificering og konkrete tegn på behov; tilpas outreach-vinklen derefter.

## Website enrichment og kontaktdata

- Start manuelt pr. virksomhed, med højst 8 sider og mindst 3 sekunder mellem forespørgsler pr. domæne. Indfør lås mod samtidige kørsler for samme virksomhed/domæne.
- Hent robots.txt før indhold. Følg relevante user-agent-regler, længere crawl-delay og Retry-After. Ved adgangsfejl, login, CAPTCHA eller rate limit skal kørslen standse eller udskydes uden omgåelse.
- Afklar og registrer brugsvilkår pr. domæne. Robots-tilladelse er ikke i sig selv dokumentation for, at vilkårene tillader behandlingen.
- Følg kun relevante interne links til om-os, referencer, cases, kunder, sikkerhed, compliance, certificeringer, karriere og kontakt. Skip login, søgninger, kalendere, downloads og URL-fælder i første version.
- Tillad kun HTTP(S) til offentlige adresser. Kontrollér DNS/IP og hvert redirect mod private netværk, localhost og metadataadresser; bind forbindelsen til den validerede destination.
- Sæt side-, byte- og tidsgrænser. Fjern scripts, navigation, formularer og skjult indhold. Gem nødvendige uddrag med provenance; fuld midlertidig analysetekst får en kort opbevaringsfrist.
- Markér JavaScript-tomme sider som utilstrækkelige frem for at give lav score. Browser-rendering kan tilføjes senere ved behov.
- Indsaml kun offentlige arbejdskontakter fra relevante kontaktsider, med kilde og dato. Ingen gættede e-mails, personlige profiler eller provider-opslag i første version.
- Implementér sletning og suppression uden, at næste crawl eller CSV-import genopretter de frabedte kontaktoplysninger. Begræns adgang til rå importer og kontaktdata, og fastlæg opbevaring og behandlingsgrundlag før drift.

## Outreach

Generér danske udkast til e-mail, telefon, LinkedIn og webinar ud fra verificerede signaler og segment. Gem hvilket analysegrundlag teksten anvendte. Ingen automatisk afsendelse.

Eksempel på forsigtig grundvinkel: “Vi kan se, at I arbejder med [konkret ydelse/reference]. Kundekrav til cyber- og leverandørsikkerhed kan derfor være relevante for jer. Vi tilbyder en gratis afklaring af, hvilke krav der realistisk rammer jer, og hvor I med fordel kan starte.”

Påstanden “Jeres største kunder stiller allerede større krav” må kun bruges om den konkrete virksomhed, hvis der findes dokumentation. Ellers formuleres den som et muligt behov. Gratis afklaring kan efterfølges af betalt gap-analyse og implementering, når behovet er bekræftet.

Offentlig adgang til en arbejds-e-mail er ikke i sig selv samtykke til markedsføring. Forbrugerombudsmandens spamvejledning omfatter også elektronisk markedsføring til virksomheder. Udkast og lovlig anvendelse skal derfor være adskilt; GDPR-behandlingsgrundlag giver ikke automatisk lov til at sende en kold e-mail. Se [Forbrugerombudsmanden](https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/uanmodede-elektroniske-henvendelser-spam).

NIS2-relevans skal undersøges ud fra aktiviteter og konkret scope; dashboardet er et prioriteringsværktøj. Officiel dansk indgang: [Styrelsen for Samfundssikkerhed](https://samsik.dk/nis2/).

## Foreslået implementeringsrækkefølge

1. **Fundament og CSV:** ret bygbarhed og dataproblemer, opret reproducerbart setup og migrationer, implementér import med preview, CVR-format/checksum, fejlrapport og idempotent dublethåndtering. Formatvalidering beviser ikke aktiv CVR-status.
2. **Manuel hjemmesideanalyse:** sikker hentning, robots/vilkår, domænerate, relevante sider, kørselsstatus og evidence-tabellen. Vis fejl og datamangler i detaljepanelet.
3. **Prioritering:** struktureret AI-udtræk med citatvalidering, konfigurerbar scoring, fire relevansklasser, top-3-signaler og seneste-score-filtre/KPI'er. Uden modeladgang vises analysen som utilgængelig eller tydeligt regelbaseret, aldrig som udført AI-analyse.
4. **Salgsworkflow:** alle statusser, historik, næste handling, offentlig kontaktprovenance og fire typer forsigtige udkast.
5. **Pilot:** evaluer med 30–50 legitimt importerede virksomheder fra målsegmenterne. Mål fejl i evidens, relevans og prioritet manuelt. Kalibrér reglerne før eventuelle automatiske batchjobs og udbudsdata.

Accepttest skal især dække gentagen CSV-import uden dubletter, talformater og intervaller, robots-afvisning, 429, redirect til privat IP, manglende citater, prompt injection, nultekstsider, seneste-score-filtre og genanalyse uden tab af manuel salgsstatus.

## Verifikation af eksisterende kode

- Eksisterende tests for størrelsesregler, scopedecision og branchemapping bestod både via Node-transpilation og med `node --import tsx src/domain/nis2/__tests__/thresholds.test.ts` i den midlertidige kopi.
- Intervalfejlen og den tomme CVR-søgestreng er reproduceret fra de eksisterende udtryk.
- Der er ikke medleveret `.env.example`, migrationshistorik eller dependency-lockfil, selv om README omtaler opstart med miljøfil og migration.
- Live CVR, årsrapporter, kontaktleverandører og AI er ikke verificeret mod eksterne tjenester; der er ikke konfigureret adgang i den udleverede mappe.
- Afhængigheder blev installeret i en midlertidig kopi, og `prisma generate` lykkedes. Uden lockfil blev versionerne Next.js 15.5.25, Prisma 6.19.3 og TypeScript 5.9.3 valgt inden for package.json-intervallerne.
- `npm run typecheck` fejlede med syv fejl: fem i CVR-mappingens typer, én i AI-sektornøglernes typekonvertering og manglende typer for `pdf-parse`.
- `npm run build` kompilerede bundlen, men fejlede under typekontrol ved `cvrService.ts:214`. Next.js advarede desuden om den flyttede indstilling `experimental.serverComponentsExternalPackages`.
- Projektet er dermed ikke et verificeret køreklart MVP. Applikationskoden er uændret; denne vurdering og byggeplan er eneste tilføjelse i projektmappen.
