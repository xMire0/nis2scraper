# Northstar — dansk lead intelligence

Et lokalt, databasebaseret MVP til at prioritere danske leverandører med mulig NIS2-relevans og afledte cyberkrav fra kunder. Scorer og signalniveauer er salgsresearch, ikke juridiske scope-afgørelser.

## Start lokalt

Node.js 22 og Docker kræves. Alle data gemmes i PostgreSQL, ikke browserens hukommelse.

```bash
cp .env.example .env
npm ci
npm run db:up
npm run db:deploy
npm run dev
```

Åbn [dashboardet](http://127.0.0.1:3000/dashboard). Udviklingsserveren lytter kun på 127.0.0.1. Hvis containeren allerede er startet manuelt, behøver `db:up` ikke køres igen. Stop databasen med `docker stop nis2-leads-mvp-db`; start den igen med `docker start nis2-leads-mvp-db`. Undlad `docker compose down -v`, medmindre data skal slettes.

Stack: Next.js 15, React 19, TypeScript, Tailwind/CSS, Prisma 6, PostgreSQL 16. Lokale udviklingsartefakter ligger i `.next-dev`; produktionsbuild ligger i `.next`.

## Det første forløb

Alternativ CSV-import (automatisk CVR-søgning beskrives nedenfor):

1. Åbn **Importer** og klik **Importér CSV**. Vælg et legitimt Proff-/CVR-udtræk som UTF-8.
2. Kontrollér kolonner, kildenavn og rækkevalidering. CVR-format og kontrolciffer kontrolleres; det er ikke et registeropslag, som bekræfter aktiv virksomhed.
3. Importér. Eksisterende CVR-numre springes over uden overskrivning. Råfil og resultat gemmes i importhistorikken.
4. Åbn en virksomhed og klik **Find hjemmeside og klargør kunden**.
5. Følg forløbet under **Kø**: register → hjemmeside → kontakter og ICP → salgsmateriale → regnskab. Manglende beviser eller adgangsblokering vises tydeligt.
6. Brug **Salgsarbejde** i profilen til status, noter, hjemmeside og næste handling. **Salgsmateriale** viser de automatisk tilpassede udkast, som aldrig afsendes automatisk.
7. Tilpas segmenter, søgeord, vægte og afsender under **Indstillinger**. Nye versioner gælder fra næste analyse.

`public/eksempel-import.csv` indeholder **fiktive virksomheder**, syntetiske CVR-værdier med gyldigt kontrolciffer og ikke-eksisterende `.invalid`-domæner. Skabelonen demonstrerer import og workflow; den kan ikke levere en reel hjemmesideanalyse og må ikke bruges til salg. Det er ikke et CVR-registerudtræk.

CSV: komma, semikolon eller tabulator; højst 1.000 rækker / 2 MB pr. import. MVP-listen understøtter op til 2.000 virksomheder. Ansatte kan være fx `35` eller `50-99`. Omsætning skal være **DKK**, fx `12.500.000,50`, ikke tusinde kroner eller “12 mio.”. Tomme felter bliver ukendte værdier.

## CVRbasen og automatisk søgning

### Automatisk berigelse — 23. september 2026

Kundeprofilen har én primær handlingsknap til hele forløbet. **Kø** viser virksomhed, trin, aktiv behandling, næste forsøg og årsag/resultat. Et eksplicit bestilt forløb kører også, når baggrundsberigelse er pauset. Gentagne klik genstarter ikke et ventende eller aktivt job. Køtid og aktivt trin gemmes i databasen; gamle tidsstemplede købestillinger migreres.

En ny analyse gemmer en særskilt regelbaseret ICP-vurdering (stærkt/muligt/lavt/uafklaret match) ud fra målsegment, størrelse og dokumenterede kundesignaler. `OUTREACH` opretter fire udkast knyttet til netop denne score: e-mail, telefon, LinkedIn og webinar. Gentagelse af samme trin opretter ikke dubletter. Regnskabet kommer efter salgsmaterialet, så et regnskabsbudget ikke forsinker det. Ved manglende hjemmesidebevis eller HTTP 403 laves ingen ny hjemmesidebaseret ICP eller nye udkast; register/regnskab kan stadig behandles, og tidligere resultater mærkes som tidligere.

HTTP 403 kommer fra kildesiden og betyder afvist adgang. Svaret alene forklarer ikke, om årsagen er firewall, botbeskyttelse eller en anden adgangspolitik. Crawleren stopper og omgår ikke begrænsningen. UI viser nu en forklaring frem for blot "Fejlet".

Valideret: 39 automatiske tests, typecheck, build, API-test af gentagen købestilling og databevarelse samt `node --env-file=.env --import tsx tests/queue-smoke.ts`. Sidstnævnte bruger en disponibel databasevirksomhed og erstatter eksterne services; den tester hjemmeside → ICP → fire udkast, 403-stop og bevarede salgsnoter uden eksterne kald. Browseren er kontrolleret for kø og forenklet APPORT-profil.

Eksisterende og nye CVRbasen-virksomheder beriges uden bekræftelse pr. virksomhed. Indstillingen **Berig automatisk eksisterende og nye CVR-virksomheder** under Find virksomheder kan pause baggrundsberigelsen uafhængigt af discovery. Eksplicit bestilte forløb fortsætter. CSV-importer indgår kun efter bestilling med kundens knap.

Køens trin, næste forsøg og fejl gemmes pr. virksomhed. Node-serveren forsøger ét trin hvert minut, og dashboardet opdateres hvert 20. sekund. API-loft og pauser respekteres. Manglende hjemmeside eller mislykket analyse ender i manuel vurdering. Egne næste-handling-noter og salgsstatus bevares. Automatisk søgning registreres ikke som menneskelig vilkårsgennemgang. Robots.txt, SSRF-beskyttelse, domænelåse og rate limits gælder fortsat. Operatøren er ansvarlig for kildevilkår og behandlingsgrundlag.

32 automatiske tests, produktionsbuild og API-integrationstest består. Køens registertrin er også afprøvet live. Datadækningen afhænger af virksomhedernes offentlige sider.

Integrationen følger [CVRbasens dokumentation](https://cvrbasen.dk/docs): server-side Bearer-nøgle, `POST /v1/companies/search`, ét branchepræfiks via `industry_code_start`, `sorts: "vat ASC"` og sider på 100. Indsæt `CVRBASEN_API_KEY` i `.env`, genstart, og åbn **Find virksomheder**. Brug **Find virksomheder nu**, eller aktivér automatik og gem. Live søgning, virksomhedsopslag og regnskabsopslag er valideret i den lokale opsætning den 22. september 2026. Ingen nøgle medleveres i kildekoden.

Valgfri reserve: sæt `CVR_REGISTRY_PROVIDER=apicvr` for at bruge [ApiCVR](https://apicvr.dk/docs) til **Opdater CVR** (gratis, ingen nøgle på den offentlige tjeneste). ApiCVR har **ikke** branchesøgning eller regnskab, så Find virksomheder kræver fortsat CVRbasen. Se `.env.example`.

Standardfilter: Danmark, NORMAL og Aktiv i separate søgninger, seneste headcount 20–250, branchepræfikser 62/63/58/26/33/71. Filtrene er redigerbare; land, størrelse og beskyttelse efterkontrolleres lokalt. Reklamebeskyttelse og ukendt beskyttelse frasorteres. Søgning gemmer ikke personfelter. **Opdater CVR** gemmer aktuelle direktørnavne/roller med kilde og 30 dages udløb samt et domænespor fra registreret e-mail; den fulde registermail gemmes ikke. Ændret beskyttelse fjerner indsamlede kontakter og udkast. Registerdata ældre end 7 dage blokerer nye analyser/udkast indtil opdatering. Dette er ikke en kontrol af samtykke til markedsføring.

Medarbejderhistorikken sorteres efter år og måned. Nyeste ukendte antal bliver ikke erstattet med et gammelt tal. Gemte noter, hjemmesider og salgsstatus bevares ved registeropdatering.

**Find og kontrollér hjemmeside** prøver eksisterende hjemmeside/registerdomæne og derefter OpenAI med websøgning. Navnebaserede `.dk`-gæt er fjernet. AI-kandidater kræver en faktisk søgekilde på samme hostname; derefter kontrollerer crawleren CVR på op til fire sider pr. kandidat. Højst fire kandidatadresser kontrolleres pr. kørsel. Kun et entydigt synligt CVR-match gemmes og sendes videre til automatisk analyse. AI-forklaring, kilde, model og tokenforbrug vises i virksomhedsprofilen. CVR-kontrollen er konservativ, men er ikke en garanti mod fx CVR-numre nævnt i kundecases.

### OpenAI til hjemmesidesøgning

Under **Indstillinger → Søgebudget** kan dagsloftet ændres med et talfelt eller **+10 søgninger** og gemmes med **Gem indstillinger**. Gemte værdier (0–1.000) ligger i databasen og erstatter miljøets startværdi uden genstart. Aktuelt forbrug vises og nulstilles ikke ved ændring. Et højere loft frigiver virksomheder, der afventer OpenAI-dagsbudget; leverandørpauser ophæves ikke. 0 pauser nye betalte søgninger, men cachede resultater kan fortsat genbruges.

Indsæt `OPENAI_API_KEY` lokalt i serverens `.env` og genstart. Nøglen sendes aldrig til browseren. Standard: `OPENAI_WEBSITE_MODEL=gpt-4.1-mini`, `OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY=10`. Sæt loftet til 0 for at pause nye betalte søgninger. En Anthropic- eller CVRbasen-nøgle kan ikke bruges til OpenAI.

Integrationen bruger [Responses API med web_search](https://developers.openai.com/api/docs/guides/tools-web-search), krævet værktøjsbrug, kildehenvisninger, `store:false`, højst tre værktøjskald og 1.800 outputtokens pr. request. Input er kun offentlige virksomhedsidentifikatorer: navn, CVR, by og adresse. Søgeresultatet valideres lokalt; ingen fri AI-tekst accepteres som en verificeret hjemmeside. Scoring, kontakter og outreach bruger fortsat lokale regler/skabeloner.

`website_search_runs` reserverer betalte forsøg atomisk før API-kald. Fejl tæller med i UTC-døgnloftet; API-pauser og forbrug overlever genstart. Identiske søgeresultater genbruges i syv dage, også ved **Berig igen**. Requests har 90 sekunders timeout og ingen skjult automatisk retry. API-nøgle og rå leverandørfejl logges ikke. HTTP 400/401/403/429 giver mindst en times pause; Retry-After kan forlænge den. Søgeværktøj og tokens faktureres særskilt af OpenAI; dagsloftet er et requestloft, ikke en dollargrænse. Migration: `npm run db:deploy`.

Verificeret 23. september 2026: 36 automatiske tests, typecheck, produktionsbuild, API-smoke og separat databasekontrol af samtidighed/cache/budget (`node --env-file=.env --import tsx tests/openai-budget-smoke.ts`). Browseren viser opsætning og den nye søgeknap. Derefter er brugerens nøgle tilføjet lokalt og Responses API afprøvet live: NAPATECH A/S gav www.napatech.com som kildebelagt kandidat. Crawleren fandt ikke entydigt CVR-bevis; hjemmesiden blev derfor ikke automatisk gemt. Live-testen afdækkede sporingsparametre i kildelinks og tekstsvar frem for JSON. Begge formater håndteres nu via validerede URL-kilder; fri tekst bruges ikke til at gætte domæner.

**Hent regnskab** bruger `GET /v1/companies/:vat/statements` og den eksisterende `FinancialData`-tabel. Profilen viser periode, valuta, omsætning, bruttofortjeneste, resultat, egenkapital og kilder. Manglende tal vises som ukendte; bruttofortjeneste bliver aldrig omsætning. Begge registerknapper deler discovery-budget, lås og API-pauser. Se [implementeringsplanen](docs/LEAD-ENRICHMENT-PLAN.md).

Automatikken kører hvert minut i den vedvarende Next.js Node-proces og tager én side, når intervallet er udløbet. Standard er en time mellem sider og højst 10 kald pr. UTC-døgn. Den skal aktiveres i dashboardet. `discovery_state` gemmer side, branche, aktiv-status, budget, pause og lås; `discovery_runs` gemmer resultater og frasorteringsårsager. Ingen automatisk retry inden udløb af API-pause. HTTP 400/401/403 slår automatik fra; 429 respekterer Retry-After. Genstart bevarer cursor og forbrug. Efter sidste side skiftes fra NORMAL til Aktiv og derefter til næste branche. Pagination over et skiftende eksternt register kan forskyde resultater; efterfølgende runder og CVR-deduplikering begrænser konsekvensen.

Serveren skal være tændt for automatik. Serverless-hosting kræver en ekstern scheduler/worker. Et API-kald kan være betalingspligtigt hos CVRbasen; loftet tæller requests, ikke leverandørens faktureringsenheder.

## Lokal scoring og outreach

AI bruges nu kun til hjemmesidesøgning, når OpenAI er konfigureret. Scoring og outreach kører lokalt med TypeScript-regler og skabeloner. Historiske AI-scorer er markeret som historiske og kan genberegnes.

Standardpoint: størrelse +20, konkrete relevante kunder +30 (generel sektoromtale +10), tekniske ydelser +25, udbud +10, sikkerhedsord +10, jobs +5. B2C uden tekniske/kundesignaler −35, stor virksomhed −25, lille uden konkrete kunder −15, ingen ydelses-/kundesignaler ved fuld dækning −20. Hver gruppe tæller én gang; 0–100, A≥75/B≥55/C≥30. Stor enterprise højst C. Vægte, segmenter og nøgleord redigeres under Indstillinger. Konkrete kunder kræver også en sproglig leverancerelation; en cases-URL alene er utilstrækkelig. Negationer og hypotetiske formuleringer i den matchende sætning filtreres konservativt. Regler forstår ikke alle sproglige nuancer; beviser skal kontrolleres manuelt.

## Analyse og begrænsninger

- Automatisk berigelse af CVRbasen-virksomheder samt manuel genanalyse. Ingen automatisk kontaktudsendelse.
- Maksimalt 8 almindelige sider plus 12 medarbejderprofiler, mindst 3 sekunder mellem requests, offentlig HTTP(S), eget domæne samt www-variant, begrænsede redirects, 2 MB pr. svar og 8 sekunders timeout pr. request. Grænsen blev hævet fra 300 KB efter live-testen af Napatechs hjemmeside.
- DNS-resultater kontrolleres mod private/reserverede adresser, og forbindelsen bindes til den kontrollerede IP. Redirects kontrolleres igen.
- robots.txt kontrolleres pr. origin. 404/410 tillader normal gennemgang; uafklaret robots-politik stopper hentningen. 401/403/429 og genkendt CAPTCHA stopper videre indholdshentning.
- HTML udtrækkes uden JavaScript-rendering. Sites med klientrenderet tekst eller kompliceret cookie-/botkontrol kan derfor give ufuldstændige resultater. CSS fra eksterne stylesheets fortolkes ikke; udtræk fjerner almindelige skjulte elementer, scripts, formularer og navigationstekst.
- Op til to signaler pr. gruppe pr. side gemmes. En signalgruppe giver point én gang, uanset antal gentagelser. Hjemmesideudsnit kan være ufuldstændige; ingen ordliste beviser en faktisk kunderelation eller juridisk scope.
- Direkte og afledt relevans vises som høj/middel/lav/ukendt. Det er ikke kalibrerede sandsynligheder. En mislykket kørsel sletter ikke tidligere score og ændrer aldrig salgsstatus.
- Publicerede fælles arbejds-e-mailadresser på eget domæne eller hos kendte gratis mailudbydere uden for sidefoden indsamles. Telefonnumre kræver telefonlink eller en eksplicit Tlf/telefon/phone/mobil-label. En kontakt knyttes kun til en person i en afgrænset blok med ét navn, genkendelig jobtitel og kontaktlink. Teamsider er med i crawlbudgettet på 8 sider; op til 12 navngivne profillinks kan følges derudover inden for samme tidsgrænse. Delte telefonnumre mærkes fælles; tvetydige blokke springes over. Ingen gættede personadresser eller private profiler. Konservativ HTML-genkendelse kan overse gyldige kontakter.
- Kontakter har udløbsdato og ryddes op, når arbejdsrummet læses. “Slet og blokér genindsamling” fjerner kontakten og gemmer et match-hash til at respektere indsigelsen. Dette hash er ikke en garanti for anonymisering.
- Rå importer, beviser, noter og udkast har ikke automatisk udløb i denne første version. Rå importer kan slettes separat. Sletning af en virksomhed sletter også tilknyttede rå importfiler (som kan indeholde flere virksomheder); øvrige virksomhedsprofiler bevares.

## Adgang og drift

Sæt en lang, unik `APP_PASSWORD` før ekstern eller produktionsbrug. Login bruger en HttpOnly/SameSite-cookie, og mutationskald kræver samme origin. Uden adgangskode er API-adgang kun tilladt i lokal udvikling. Produktion afviser adgang uden konfigureret adgangskode. Start i produktion med `npm run build` og `npm start -- --hostname 127.0.0.1`; brug TLS og et rigtigt identitets-/rollesystem ved delt ekstern hosting.

Den fælles adgangskode er en MVP-adgangskontrol, ikke brugeradministration, personligt revisionsspor eller SSO. Login-forsøg begrænses pr. proces. Domænelåse ligger i databasen, men kørsler er fortsat synkrone HTTP-requests; brug en holdbar kø/worker før serverless-drift eller batchkørsler. Adgang til websteder og databehandlingsgrundlag skal afklares af operatøren. Offentlig kontaktinformation er ikke i sig selv markedsføringssamtykke.

Den gamle `/api/leads`- og `/api/prospecting`-flade returnerer 410; den tidligere CLI-scopingkørsel er deaktiveret. CVR-/årsrapportmoduler er bevaret til senere integration. Den nye pipeline bruger kun `enrichment_runs`, `evidence` og `scores` til lead intelligence. Se [arkitektur og genbrugsvurdering](docs/GENBRUG-OG-MVP.md).

## Datamodel

`companies` er den eksisterende fælles virksomhedstabel. Nye tabeller: `imports`, `import_rows`, `enrichment_runs`, `evidence`, `scores`, `contacts`, `contact_suppressions`, `outreach`, `scoring_configs`, `crawl_locks`, `discovery_state`, `discovery_runs`. Salgsstatus og historik ligger fortsat i `lead_outreach_status` og `outreach_events`.

Migrationen initialiserer en **tom** database med både det gamle og det nye skema. Ved tilslutning til en eksisterende database skal migrationen først baselines og forskellen gennemgås; kør ikke blindt en initialmigration mod en database med eksisterende tabeller. Der var ingen konfigureret gammel database i dette projekt.

## Verifikation

```bash
npm test
npm run typecheck
npm run build
# Mod en kørende lokal udviklingsserver:
node tests/api-smoke.mjs
```

Enhedstests dækker CSV, kontrolcifre, tal/intervaller, evidensscoring, SSRF-adresser, redirects, robots-afvisning, 429-stop, synlig tekst, sikre outreach-formuleringer og konfigurationsgrænser. Crawlerens succes-/fejlscenarier bruger deterministiske HTTP-fixtures; de giver ikke dokumentation for adgang til alle eksterne websites.

Integrationstesten importerer tre fiktive virksomheder, kontrollerer dubletter, persistens, workflow, fejlet analyse, fire udkast, versionering, CSRF og udfasede endpoints. Den fjerner kun virksomheder med sin egen testkilde og deres rå importer. Kør den i en lokal testdatabase. Den ændrer regelversionen, men ikke indholdet af de aktuelle regler.

## Afleveringskontrol — 22. september 2026

- Den oprindelige MVP havde 22 automatiske tests; CVRbasen har yderligere fixturetests. TypeScript-kontrol og produktionsbuild bestod.
- API-integrationstest bestod: import, dubletter, persistens, salgsstatus, fejlet analyse, fire outreach-formater, regelversion, origin-kontrol og udfasede endpoints.
- CSV-filvalg/import, virksomhedsprofil, redigering af salgsstatus og oprettelse af telefonmanuskript er afprøvet i den indbyggede browser. Desktoplayout er inspiceret; mobilens dokumentbredde havde ikke vandret side-overløb (tabellen scroller selv).
- Ét live HTTPS-kald til `example.com` returnerede HTTP 200 gennem crawlerens kontrollerede DNS/IP-forbindelse. En fuld analyse af rigtige målvirksomheder er endnu ikke valideret.
- npm audit rapporterede 0 kendte sårbarheder ved installationen. Dette er et tidspunktstjek, ikke en sikkerhedsgaranti.
- Alle virksomheder og rå importfiler oprettet til test er fjernet. Dashboardet starter med jeres egne data; testkørsler har alene oprettet versioner af de uændrede standardregler.
