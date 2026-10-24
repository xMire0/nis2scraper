# Plan: søgebaseret hjemmesideidentifikation og lokal lead enrichment

Dato: 23. september 2026. Status: forslag, ikke implementeret.

Opdatering samme dag: Brugeren har valgt OpenAI med websøgning til første version. Responses API-integrationen erstatter derfor anbefalingen om Brave nedenfor. Navnegæt er fjernet; lokale CVR-kontroller og regelbaseret analyse bevares. Implementeret med servernøgle, kildevalidering, databasebaseret dagsloft og syv dages genbrug af søgeresultater. Den mere omfattende ejerblok-verificering, koncernhåndtering og pilot nedenfor er fortsat planlagt. OpenAI-nøglen er tilføjet lokalt, og live søgning fandt napatech.com; crawlerens manglende entydige CVR-bevis gav fortsat manuel vurdering.

Denne plan erstatter navnegæt som primær hjemmesidesøgning i LEAD-ENRICHMENT-PLAN.md. Eksisterende crawler, jobkø, CVR-integration, kontaktudtræk og regelbaseret leadscore genbruges.

## Problem og beslutning

websiteCandidates laver i dag primært firmanavn.dk og firma-navn.dk samt et eventuelt registreret e-maildomæne. Det finder ikke pålideligt brands, internationale domæner eller omdøbte virksomheder. verifiedWebsite sammenligner CVR-numre på hele de hentede sider; det skelner ikke tilstrækkeligt mellem sidens ejer og omtalte kunder.

Vi skal bruge et eksisterende søgeindeks til at finde kandidater og egen kode til at kontrollere identitet og udtrække oplysninger. Ingen LLM-kald, embeddings eller genererede personoplysninger.

Anbefalet første integration: Brave Web Search API. En enkelt serverfunktion er tilstrækkelig; ingen generisk providerplatform eller ny crawler.

## Kilder og økonomi

- Brave Web Search leverer URL'er, titler og uddrag. Brug kun web/search, ikke Answers. Aktuel pris er 5 USD pr. 1.000 kald med 5 USD månedlige credits. Eksempel: 1.000 virksomheder med præcis to opslag hver giver 10 USD før credits, eksklusive CVR og drift. Det er et regneeksempel, ikke et målt gennemsnit. Se https://brave.com/search/api/ og https://api-dashboard.search.brave.com/app/documentation/web-search.
- Google Custom Search JSON API er ikke tilgængelig for nye kunder; eksisterende kunder skal migrere senest 1. januar 2027. Det er derfor ikke vores nye fundament: https://developers.google.com/custom-search/v1/overview.
- SearXNG er en mulig senere løsning, men aggregerer andre søgemaskiner og kræver drift samt håndtering af deres begrænsninger. Det er ikke et gratis, uafhængigt indeks: https://docs.searxng.org/dev/search_api og https://docs.searxng.org/admin/searx.limiter.
- Direkte scraping af Googles resultatsider vælges ikke som primær integration. CAPTCHA, blokeringer og ændret HTML må ikke føre til omgåelse af adgangsbegrænsninger.

En API-nøgle til søgeudbyderen bliver en ekstern forudsætning. Kontrollér tilladt opbevaring/cache af søgeresultater inden integrationen aktiveres. Vi har ikke tilmeldt en konto eller købt adgang som del af denne plan.

## 1. Find kandidater

1. Genbrug en frisk, verificeret hjemmeside. En manuelt godkendt hjemmeside låses mod automatisk overskrivning.
2. Prøv eksplicit hjemmeside fra en datakilde, hvis feltet findes og er dokumenteret, samt registreret arbejds-e-maildomæne. Hints er ikke identitetsbevis.
3. Søg sekventielt, indtil en kandidat er verificeret:
   - præcist CVR-nummer i citationstegn;
   - juridisk virksomhedsnavn i citationstegn + by + kontakt;
   - navn + kendt adresse eller hovednummer som sidste forsøg.
4. Start med højst tre søgekald og fem forskellige kandidatdomæner pr. virksomhed. Stop tidligt ved et verificeret match. Grænserne er foreslåede pilotværdier.
5. Bevar .com og andre domæner samt lokale undersider som /da-dk. Normalisér selskabssuffikser og tegnvarianter forsigtigt; fjern ikke brandord vilkårligt.
6. Filtrér kataloger, sociale profiler, jobportaler og nyhedssider fra som slutdestination. Et eksplicit eksternt hjemmesidelink fra en tilladt kilde kan give en ny kandidat, men er ikke endeligt bevis.

Navnegæt udgår af standardflowet. De kan senere tilføjes som sidste fallback, hvis piloten viser en konkret gevinst.

## 2. Kontroller virksomhedens identitet

Søgeresultatets placering og tekst bruges kun til rækkefølgen af kandidater. Bevis skal komme fra den faktiske hjemmeside.

Hent forside og højst tre relevante kontakt-, om os- eller juridiske sider med eksisterende crawler. Find afgrænsede blokke med ejeroplysninger: juridisk navn, CVR/VAT, adresse og telefon. Strukturerede Organization-data kan understøtte samme vurdering, men tæller ikke som en ekstra uafhængig kilde.

| Fund | Beslutning i første version |
| --- | --- |
| Præcist CVR i ejer-/kontaktblok, genkendeligt juridisk navn og ingen modstridende ejeroplysninger | Verificér og gem automatisk |
| Navn, adresse og telefon passer, men CVR mangler | Sandsynlig kandidat; manuel vurdering |
| CVR findes kun i kundecase, kundeliste eller reference | Utilstrækkeligt bevis; søg videre |
| En anden virksomhed står som juridisk ejer | Afvis eller markér dokumenteret koncernrelation til vurdering |
| Flere selskaber på en koncernside | Kræv en afgrænset blok for målvirksomheden; tvetydighed giver manuel vurdering |
| Parkeret domæne, uvedkommende virksomhed eller katalog | Afvis |
| Timeout, robots-afvisning eller adgangsblokering | Teknisk/adgangsmæssigt uafklaret, ikke bevis for manglende hjemmeside |

Identitetsregler giver forklarlige kategorier, ikke opdigtede sandsynligheder som "93 % sikker". En senere regel for automatisk accept uden CVR skal først dokumentere høj præcision i piloten.

Et redirect til et andet domæne bliver en ny kandidat med egen DNS-, URL- og robots-kontrol. Crawlens eksisterende domæneafgrænsning svækkes ikke generelt. TLS-fejl omgås ikke. Koncernens kunder og sikkerhedscertifikater overføres ikke automatisk til datterselskabet.

## 3. Berig den verificerede virksomhed

- Hjemmesideanalyse starter automatisk efter verificering. Genbrug allerede hentede sider inden for samme kørsel.
- Kontakter udtrækkes fra afgrænsede personblokke med navn, rolle og offentlig arbejdskontakt. Fællesnumre forbliver fællesnumre. Ingen gættede personlige e-mails. Eksisterende suppression og udløb respekteres.
- Branche-/kundesignaler kræver relevante formuleringer i kontekst: "vi leverer til hospitaler" er stærkere end ordet "hospital" i en nyhed. Rekrutteringssignaler tæller kun på job-/karrieresider.
- Samme signal på flere sider tæller kun én gang pr. kategori; sidefod og gentagne menuer må ikke oppuste score. Negationer og tvetydige udsagn giver lavere vægt eller ingen point. Manglende data vises som ukendt.
- Registrér URL, kort tekstbevis, hentetid og regelversion for hvert signal. Rangér de tre stærkeste dokumenterede signaler.
- Bevar den eksisterende redigerbare NIS2-score og A–D-prioritet. Identitetsvurdering og kommerciel leadscore er separate størrelser. Ingen juridisk konklusion om NIS2-pligt.
- Regnskab hentes fra CVRbasens dokumenterede integration uafhængigt af websøgning. Manglende omsætning forbliver null; bruttofortjeneste erstatter den ikke.
- Næste handling vælges med regler: tvetydig hjemmeside → kontrollér identitet; stærkt lead uden kontakt → undersøg kontakt; stærkt lead med kontakt → forbered scope-afklaring. Brugerens eksisterende noter og salgsstatus bevares. Ingen automatisk udsendelse.

## 4. Data, jobkø og brugerflade

Tilføj en lille website_candidates-tabel: companyId, URL, kildetype, fundet tidspunkt, status, regelversion, beslutningsårsager og bevisreference. Kandidater skal kunne afvises pr. virksomhed, så et forkert domæne ikke vælges igen. Genbrug enrichment_runs og evidence til kørsler og kildebeviser.

Statusser: verificeret, sandsynlig, konflikt, ikke fundet, blokeret. Gem tekniske fejl særskilt fra identitetsafvisning. Kun verificerede eller manuelt godkendte adresser vises som virksomhedens valgte hjemmeside.

Genbrug jobkø og låse. Register, søgning/analyse og regnskab får separate resultater og retry-tidspunkter, så ét utilgængeligt API ikke spærrer alt andet. Budgetter og 429-pauser håndhæves også ved manuelle knaptryk.

"Berig igen" genstarter relevante trin, deduplikerer samtidige klik og bevarer manuelt godkendt hjemmeside. Tilføj en særskilt "Find anden hjemmeside"-handling for et forkert eksisterende valg. En ny kandidat må ikke slette gamle data, før den er verificeret. Ved et bekræftet domæneskifte markeres gamle websiteafledte kontakter/beviser forældede, og scoren genberegnes fra den nye kilde; historikken bevares.

Foreslåede startgrænser: eksisterende lave crawl-rate, maks. tre søgekald pr. virksomhed, samlet døgnbudget og pause ved providerfejl. Negative søgeresultater genprøves først efter en cooldown; et eksplicit nyt forsøg kan omgå cooldown, men aldrig budgettet. Vis næste forsøg og årsag i UI.

JavaScript-rendering og PDF-udtræk udskydes, indtil pilotdata viser, hvor mange relevante virksomheder den almindelige crawler overser.

## 5. Implementeringsrækkefølge og accept

1. Baseline: udvælg 30–50 manuelt verificerede virksomheder. Medtag internationale domæner, ens navne, koncerner, omdøbninger, manglende CVR, redirects og blokerede sider. Mål den nuværende finder.
2. Søgning: implementér én Brave-funktion og kandidatregistrering med budget, fejlhåndtering og tidligt stop. Kør først uden at overskrive company.website.
3. Verificering: ejerblokke, konflikter og redirects. Automatiske regressionstests skal dække CVR i kundecase, forkert ejer, koncernside, privat redirect, robots, 429 og bevarelse af tidligere data ved fejl.
4. Integration: automatisk analyse efter accept, uafhængigt regnskab, korrekt genberigelse og synlig forklaring i dashboardet. Test genstart og samtidige klik.
5. Pilot, review og rettelser: adskil virksomheder brugt til regeltilpasning fra dem brugt til slutkontrol. Kør typecheck, build, API-test og browserkontrol. Gennemgå fejl, ret og gentest før bred aktivering.

Mål: andel korrekte automatisk accepterede hjemmesider, andel virksomheder med fundet hjemmeside, uafklarede årsager, forkerte persontilknytninger, søgekald/pris og tid pr. lead. Aktiveringskrav: ingen forkerte automatiske matches i den gennemgåede pilot, fuld sporbarhed og beståede regressionstests. Det er et pilotkrav, ikke et løfte om 100 % korrekthed på alle virksomheder.

Første leverance prioriterer korrekt hjemmeside frem for maksimal dækning. Derefter forbedres dækning ud fra faktiske fejlgrupper. En ukendt hjemmeside er bedre end analyser og kontakter fra et forkert selskab.
