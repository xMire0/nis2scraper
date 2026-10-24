# Plan: kildebelagt lead enrichment uden AI

Grundlag: brugerens `Lead enrichment (1).md`, eksisterende NIS2-dashboard og https://cvrbasen.dk/docs. Dokumentets resultater og prisoplysninger er forfatterens påstande, ikke verificerede mål for dette projekt.

## Leverance og rækkefølge

1. Register: opdatér en virksomhed direkte via CVR, gem aktuelle ledelsesroller med kilde/dato og et domænehint fra registreret e-mail. Personers e-mail gættes aldrig. Alle opslag deler eksisterende API-budget og pause. Undersøg aktiv-status; bevar stabil CVR-sortering og lokale filtre.
2. Hjemmeside: foreslå højst tre domæner fra registerhint og navn. Kandidater vises før hentning; operatøren gennemgår vilkår. Brug eksisterende sikre crawler til at kontrollere forside/kontaktside. Gem kun hjemmeside automatisk ved præcist, synligt CVR-bevis; forkert eller flere forskellige CVR-numre kræver manuel vurdering. Gem forsøg, URL, dato og bevis. Eksisterende hjemmeside overskrives ikke.
3. Kontakter: udvid crawl til teamsider. Tilknyt person kun i en afgrænset kontaktblok med ét navn, titel og en offentlig arbejds-e-mail/telefon. Fælles telefonnumre må ikke præsenteres som direkte. Bevar suppression og udløb. Ingen kontaktdata fra private profiler.
4. Regnskab: brug CVRbasens dokumenterede statements-endpoint og eksisterende FinancialData-model. Vis seneste regnskabsperiode, valuta, omsætning, bruttofortjeneste, resultat og kildelink. Null betyder ukendt; bruttofortjeneste er aldrig omsætning. Rå XBRL-pipeline udsættes, da den dokumenterede API allerede leverer disse tal.
5. UI og kontrol: tilføj enrichment i virksomhedsprofilen, tydelige mangler/fejl og næste handling. Opdatér README. Kør regressionstest, typecheck, build og kontrolleret API-/browserafprøvning.

## Afgrænsning

NIS2-score på 0–100 og A–D bevares. Gammel hjemmeside, bookingsoftware og Google-anmeldelser er ikke NIS2-signaler. Google Places og CVR-navnematch af Google-leads udskydes til separat integration med verificerede priser, konto og vilkår. Domæneforslag er hypoteser, aldrig verificerede kontaktoplysninger. DNS alene beviser intet.

## Acceptkriterier

- CVR-bekræftet hjemmeside kan gemmes; forkert/manglende CVR, private adresser, robots-afvisning og rate limits stopper accept.
- Registerkontakter har rolle, kilde og udløb; suppression forhindrer genindsamling.
- Nabopersoners telefon/e-mail kobles ikke sammen; gentaget hovednummer mærkes fælles.
- Regnskaber vælges efter periode og offentliggørelse; manglende tal og valuta bevares uden gæt.
- Fejl overskriver ikke tidligere hjemmeside, score, noter eller salgsstatus.
- Budget og pauser gælder også manuelle register- og regnskabsopslag.

## Verifikation

### Kontaktregler fra Lead enrichment.md — 23. september 2026

Udvidet med eksplicitte Tlf/telefon/phone/mobil-labels, delte hovednumre uden persontilknytning og fælles mailadresser hos kendte gratis mailudbydere uden for sidefoden. Job-, noreply- og bogholderimails samt webbureauets mail afvises. Højst 12 navngivne medarbejderprofil-links kan følges ud over de almindelige sider, altid på samme domæne og inden for crawlerens samlede tidsgrænse. Svargrænsen er 300 KB, og request-timeout er 8 sekunder; for store sider afvises frem for at skabe beviser fra et afklippet svar.

Google Places/navnematch, bookinggenkendelse og hjemmesidealder er fortsat de særskilte, udskudte funktioner beskrevet ovenfor. Regnskaber leveres fortsat af CVRbasens statements-endpoint. En CVR-ledelsesrolle er ikke i sig selv bevis for købsmandat. Dokumentets ukendte 1–5-formel er ikke indført; NIS2-score 0–100/A–D bevares.

### Udvidelse 23. september 2026

Efter brugerens udtrykkelige ønske er hjemmesidesøgning uden individuel bekræftelse samt automatisk udfyldning af regnskab, kontakter, score og næste handling implementeret. Den tidligere manuelle rækkefølge og vilkårscheckbox for hjemmesidesøgning er dermed erstattet. Automatikken registrerer aldrig en fiktiv menneskelig vilkårsvurdering.

`automatic-enrichment.ts` gemmer trin/fejl/næste forsøg i databasen og bruger en fælles tidsbegrænset arbejdslås. Profil → hjemmeside → regnskab → analyse → færdig/manuel vurdering. `analysis.ts` deles af manuel og automatisk analyse. API-budget, providerpauser, reklamebeskyttelse, friske registerdata, SSRF, robots og rate limits bevares. Timeren er begrænset til Next.js Node-runtime. UI opdaterer automatisk hvert 20. sekund.

32 tests, typecheck, produktionsbuild og API-smoke består. Live registertrin har flyttet virksomheder frem i køen. Browserkontrol af den sidste ændring kunne ikke afsluttes: browserforbindelsen afviste localhost, mens direkte HTTP/API-kontrol lykkedes. De tre marketing-skills product-marketing, prospecting og sales-enablement er installeret lokalt.

Implementeret 22. september 2026: alle fem trin ovenfor, med de beskrevne afgrænsninger. Migrationen `20260922200000_lead_enrichment` er anvendt lokalt.

- 31 automatiske tests består, herunder CVR-match/fejlmatch, skjult tekst, personblokke, delte telefoner, regnskabsdatoer, ukendt omsætning, aktive roller og dokumenterede API-kald.
- TypeScript-kontrol, produktionsbuild og den eksisterende API-integrationstest består. Testens egne virksomheder/importer er ryddet op.
- Live GET-opslag for IFS Danmark: én aktuel ledelsesrolle og regnskab til 2025-12-31 gemt. Omsætning er null; bruttofortjeneste 73.657.000 DKK og resultat 6.998.000 DKK. De to kald øgede det fælles døgnforbrug fra 4 til 6 af 10.
- Separat live statusopslag bekræftede, at `Aktiv` returnerer virksomheder. Discovery gennemløber nu begge statusværdier med stabil sortering.
- Browserkontrol: regnskabsfelter, kilde, ledelsesrolle, hjemmesideforslag og deaktiveret søgeknap før vilkårsvurdering er verificeret; ingen browserfejl observeret.
- Hjemmeside- og kontaktgenkendelse er testet med deterministisk HTML. Finderens samlede succesrate mod rigtige virksomheder er ikke målt. Live websitehentning kræver konkret gennemgang af vilkår; fixturetests beviser ikke adgang til en ekstern hjemmeside.

Næste pilot: gennemgå vilkår for et lille udvalg af kendte firmaer, kontrollér CVR-beviser og kontaktblokke manuelt, og ret kun dokumenterede fejl før større kørsler. Google Places, bookinggenkendelse og hjemmesidealder forbliver uden for denne NIS2-leverance.
