# Roadmap: NIS2 Lead Intelligence

## Overview

Roadmappet gør den eksisterende brownfield-applikation driftbar gennem tre brede leverancer. Først gøres CVRbasen-discovery og lokal opstart reproducerbar uden en aktiv LLM-afhængighed. Derefter færdiggøres den kontrollerede hjemmesideberigelse og den forklarlige regelbaserede prioritering. Til sidst bindes leadets evidence, status og forsigtige kontaktudkast sammen i et robust salgsworkflow med stabile klientfejl og en samlet end-to-end-kontrol.

## Phases

- [ ] **Phase 1: Driftbar CVRbasen-discovery** - Brugeren kan starte og fortsætte sporbar discovery fra en reproducerbar lokal installation uden LLM-afhængighed.
- [ ] **Phase 2: Sikker enrichment og forklarlig prioritering** - Brugeren kan analysere én virksomhed sikkert og få en deterministisk, kildebelagt relevansvurdering.
- [ ] **Phase 3: Kontrolleret salgsworkflow** - Brugeren kan føre et dokumenteret lead gennem næste handling og forsigtig outreach med robuste fejlgrænser.

## Phase Details

### Phase 1: Driftbar CVRbasen-discovery
**Goal**: Brugeren kan finde målgruppevirksomheder via CVRbasen i en reproducerbar installation, mens data og discovery-fremdrift er sporbar og produktets aktive vej er fri for LLM-afhængigheder.
**Depends on**: Nothing (first phase)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. En ny lokal installation kan startes med de dokumenterede kommandoer og få nødvendige miljøvariabler, og migration, typecheck, tests og produktionsbuild består.
  2. Brugeren kan starte CVRbasen-discovery fra dashboardet, filtrere mod 20–250 ansatte og valgte brancher og fortsætte fra gemt cursor/status uden dublerede CVR-numre.
  3. Hvert fundet firma viser sporbar CVRbasen-kilde, hentetidspunkt og rå identifikatorer, mens API-nøglen aldrig eksponeres til browseren.
  4. Manglende eller ugyldig CVRbasen-konfiguration giver en klar, stabil besked i dashboardet uden crash.
  5. Den aktive dashboard- og discovery-vej kan bruges uden AI-nøgle, providerkald eller anden produktionsafhængighed til en LLM.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Sikker enrichment og forklarlig prioritering
**Goal**: Brugeren kan starte en kontrolleret analyse af én virksomhed og få en deterministisk prioritet, der kan forklares med offentligt kildebevis og forsigtige relevansklasser.
**Depends on**: Phase 1
**Requirements**: ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06
**Success Criteria** (what must be TRUE):
  1. Brugeren kan starte analyse manuelt for én virksomhed, og crawleren respekterer robots.txt, rate limits, Retry-After samt side- og bytegrænser.
  2. Analyse afviser private netværk, localhost, metadataadresser og usikre redirects, og gemmer kun nødvendige tekstudsnit og offentlige arbejdskontakter med URL, tidspunkt og provenance.
  3. Den samme evidence og de samme redigerbare regler giver samme lokale score fra 0–100 uden LLM- eller AI-kald.
  4. Brugeren kan redigere point, søgeord, segmenter og negative signaler og bagefter se A/B/C/D-prioritet, segment, datadækning, direkte/afledt relevans og de tre stærkeste signaler med URL og tekstbevis.
  5. Resultatet bruger kun de fire godkendte relevansklasser, og en fejlet eller utilstrækkelig crawl vises som “Kræver manuel vurdering” frem for kunstigt lav relevans.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Kontrolleret salgsworkflow
**Goal**: Brugeren kan føre et kildebelagt lead gennem et manuelt salgsforløb og udarbejde forsigtig outreach uden at miste historik eller få lækket interne fejldetaljer.
**Depends on**: Phase 2
**Requirements**: SALE-01, SALE-02, SALE-03, SALE-04, OPS-04
**Success Criteria** (what must be TRUE):
  1. Brugeren kan flytte et lead gennem Ny → undersøgt → klar til kontakt → kontaktet → møde → gratis scope-afklaring → tilbud → vundet/tabt.
  2. Seneste analyse, næste handling og historik bevares, og en genanalyse overskriver ikke den manuelt valgte salgsstatus.
  3. Brugeren kan oprette korte danske udkast til e-mail, telefon, LinkedIn og webinar alene ud fra verificerede regler og evidence.
  4. Alle udkast bruger forsigtige formuleringer, fremsætter ingen juridisk NIS2-afgørelse og kræver manuel handling for at blive sendt.
  5. Fejl fra CVRbasen, crawl og database logges med nødvendige detaljer server-side, mens dashboardet modtager stabile, ufølsomme fejlbeskeder og forbliver anvendeligt.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Driftbar CVRbasen-discovery | 0/TBD | Not started | - |
| 2. Sikker enrichment og forklarlig prioritering | 0/TBD | Not started | - |
| 3. Kontrolleret salgsworkflow | 0/TBD | Not started | - |
