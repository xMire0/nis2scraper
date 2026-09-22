# Requirements: NIS2 Lead Intelligence

**Defined:** 2026-09-22
**Core Value:** Find og dokumentér relevante danske leverandør-leads uden at fremsætte en juridisk NIS2-konklusion.

## v1 Requirements

### Discovery og virksomhedsdata

- [ ] **DISC-01**: Brugeren kan starte en CVRbasen-søgning fra dashboardet uden CSV-import
- [ ] **DISC-02**: Systemet kan fortsætte gennem CVRbasen-resultater med gemt cursor/status og uden dublerede CVR-numre
- [ ] **DISC-03**: CVRbasen-data gemmes med kilde, hentetidspunkt og rå identifikatorer, mens API-nøglen forbliver server-side
- [ ] **DISC-04**: Discovery kan filtreres mod målgruppen, herunder 20–250 ansatte og relevante brancher, gennem redigerbare indstillinger
- [ ] **DISC-05**: Manglende eller ugyldig CVRbasen-konfiguration vises klart uden at appen crasher

### Website enrichment

- [ ] **ENR-01**: Brugeren kan starte analyse manuelt for én virksomhed
- [ ] **ENR-02**: Crawleren respekterer robots.txt, rate limits, Retry-After, side- og bytegrænser
- [ ] **ENR-03**: Crawleren afviser private netværk, localhost, metadataadresser og usikre redirects
- [ ] **ENR-04**: Fund gemmes som nødvendige tekstudsnit med kilde-URL, tidspunkt og signaltype
- [ ] **ENR-05**: Offentlige arbejdskontakter kan gemmes med provenance; gættede eller login-beskyttede kontaktdata gemmes ikke

### Regelbaseret prioritering

- [ ] **RULE-01**: Leadscore 0–100 beregnes lokalt og deterministisk uden LLM- eller AI-kald
- [ ] **RULE-02**: Regler, point, søgeord, segmenter og negative signaler kan redigeres i dashboardet
- [ ] **RULE-03**: Hvert lead viser de tre stærkeste konkrete signaler med URL og tekstbevis
- [ ] **RULE-04**: Systemet viser A/B/C/D-prioritet, segment, datadækning og direkte/afledt relevansniveau
- [ ] **RULE-05**: Systemet bruger kun klasserne “Mulig direkte NIS2-relevans”, “Sandsynlig leverandør med afledte kundekrav”, “Kræver manuel vurdering” og “Lav relevans”
- [ ] **RULE-06**: Fejlet eller utilstrækkelig crawl medfører manuel vurdering frem for kunstigt lav relevans

### Salgsworkflow

- [ ] **SALE-01**: Leadstatus kan følge Ny → undersøgt → klar til kontakt → kontaktet → møde → gratis scope-afklaring → tilbud → vundet/tabt
- [ ] **SALE-02**: Brugeren kan gemme seneste analyse, næste handling og historik uden at miste manuel status ved genanalyse
- [ ] **SALE-03**: Systemet kan oprette korte danske udkast til e-mail, telefon, LinkedIn og webinar ud fra verificerede regler og evidence
- [ ] **SALE-04**: Udkast bruger forsigtige formuleringer og udsendes aldrig automatisk

### Drift og kontrol

- [ ] **OPS-01**: En ny lokal installation kan starte med dokumenterede kommandoer, database og miljøvariabler
- [ ] **OPS-02**: Migration, typecheck, tests og produktionsbuild gennemføres uden fejl
- [ ] **OPS-03**: Dashboardets aktive vej indeholder ingen produktionsafhængighed til en LLM-udbyder eller AI-nøgle
- [ ] **OPS-04**: Detaljerede upstream- og databasefejl logges server-side og returneres som stabile, ufølsomme klientfejl

## v2 Requirements

### Automatisering

- **AUTO-01**: Planlagte batch-kørsler kan fortsætte discovery og analyse med durable jobs
- **AUTO-02**: Offentlige udbuds- og rammeaftaledata kan tilføjes som separat, kildebelagt evidence
- **AUTO-03**: Dashboardlister kan pagineres og detaljedata indlæses efter behov ved større datamængder

## Out of Scope

| Feature | Reason |
|---------|--------|
| Juridisk NIS2-afgørelse | Offentlige signaler er utilstrækkelige til en juridisk konklusion |
| LLM/AI i produktets analyse | Brugeren kræver lokale regler uden tokenforbrug |
| Adgangsomgåelse | Login, CAPTCHA, robots og rate limits skal respekteres |
| Automatisk outreach-afsendelse | Lovlighed og budskab kræver manuel vurdering |
| Gættede personlige e-mails | Kun offentlige arbejdskontakter er tilladt |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 1 | Pending |
| DISC-02 | Phase 1 | Pending |
| DISC-03 | Phase 1 | Pending |
| DISC-04 | Phase 1 | Pending |
| DISC-05 | Phase 1 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 1 | Pending |
| OPS-03 | Phase 1 | Pending |
| ENR-01 | Phase 2 | Pending |
| ENR-02 | Phase 2 | Pending |
| ENR-03 | Phase 2 | Pending |
| ENR-04 | Phase 2 | Pending |
| ENR-05 | Phase 2 | Pending |
| RULE-01 | Phase 2 | Pending |
| RULE-02 | Phase 2 | Pending |
| RULE-03 | Phase 2 | Pending |
| RULE-04 | Phase 2 | Pending |
| RULE-05 | Phase 2 | Pending |
| RULE-06 | Phase 2 | Pending |
| SALE-01 | Phase 3 | Pending |
| SALE-02 | Phase 3 | Pending |
| SALE-03 | Phase 3 | Pending |
| SALE-04 | Phase 3 | Pending |
| OPS-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

## Definition of Done

- CVRbasen discovery kan køres fra dashboardet med en gyldig nøgle og giver sporbare virksomheder uden dubletter
- En virksomhed kan analyseres, scores og flyttes gennem salgsflowet uden LLM-kald
- Juridiske og datamæssige begrænsninger fremgår i UI og evidence
- Migration, tests, typecheck, build og en manuel browserkontrol består

---
*Requirements defined: 2026-09-22*
*Last updated: 2026-09-22 after initial definition*
