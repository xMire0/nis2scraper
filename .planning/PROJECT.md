# NIS2 Lead Intelligence

## What This Is

Et dansk lead intelligence-dashboard for et NIS2- og cybersikkerhedskonsulenthus. Systemet finder mellemstore danske virksomheder via CVRbasen, beriger dem med offentlige virksomheds- og websitedata og prioriterer dem med gennemsigtige, lokale regler uden LLM- eller AI-kald i produktet.

## Core Value

Brugeren skal hurtigt kunne finde og dokumentere virksomheder, der sandsynligvis møder øgede cyber- og leverandørsikkerhedskrav fra deres kunder, uden at systemet fremsætter en juridisk NIS2-konklusion.

## Business Context

- **Customer**: Et dansk NIS2- og cybersikkerhedskonsulenthus
- **Revenue model**: Gratis scope-afklaring som indgang til betalt gap-analyse og senere implementeringsrådgivning
- **Success metric**: Flere dokumenterede, relevante leads som kan kvalificeres til en gratis scope-afklaring
- **Strategy notes**: Målgruppen er primært danske B2B-leverandører med 20–250 ansatte inden for IT, cloud, software, OT/IoT, medico og teknisk drift

## Requirements

### Validated

- ✓ Next.js-dashboard med PostgreSQL/Prisma og serverbaserede API-ruter — eksisterende
- ✓ CVR-validering, deduplikering og sporbar datalagring — eksisterende
- ✓ Manuel, robots-respekterende websiteanalyse med URL- og SSRF-beskyttelse — eksisterende
- ✓ Deterministisk scoring med redigerbare regler og dokumenteret evidence — eksisterende
- ✓ Salgsstatus, offentlige arbejdskontakter og danske outreach-udkast — eksisterende
- ✓ CVRbasen-klient og automatisk discovery-flow — eksisterende

### Active

- [ ] Verificér CVRbasen-discovery end-to-end med korrekt API-konfiguration og robust fejlvisning
- [ ] Fjern eller isolér rester af den tidligere LLM-baserede produktvej, så aktiv analyse er fuldt regelbaseret
- [ ] Gør den lokale opstart reproducerbar og dokumentér de få nødvendige miljøvariabler
- [ ] Kontrollér at dashboard, database, discovery, crawl, scoring og salgsworkflow fungerer samlet
- [ ] Bevar juridisk forsigtige relevansklasser og kildebevis for alle væsentlige signaler

### Out of Scope

- Automatisk juridisk afgørelse af NIS2-pligt — kræver manuel og juridisk vurdering
- LLM- eller generativ AI-analyse i produktet — brugeren har valgt lokale, deterministiske regler
- Omgåelse af login, CAPTCHA, robots.txt, rate limits eller andre adgangsbegrænsninger — strider mod produktets dataprincipper
- Automatisk udsendelse af e-mail, LinkedIn-beskeder eller anden markedsføring — udkast skal vurderes manuelt
- Gættede personlige kontaktoplysninger — kun offentligt tilgængelige arbejdskontakter må gemmes

## Context

Kodebasen er en eksisterende Next.js 15-applikation med React 19, TypeScript, Prisma og PostgreSQL. Den aktive intelligence-vej understøtter discovery, hjemmesideberigelse, evidence, scoring, kontakter og outreach, mens ældre pipeline- og datamodeller stadig rummer spor af en tidligere LLM-løsning. CVRbasen skal være den automatiske kilde til nye virksomheder, men live discovery kræver en gyldig server-side `CVRBASEN_API_KEY`.

## Constraints

- **Dataetik**: Kun offentlige, arbejdsrelaterede oplysninger med kilde og hentetidspunkt må indsamles
- **Juridisk formulering**: Resultater er kommercielle relevanssignaler, ikke juridiske afgørelser
- **Analyse**: Scoring skal være lokal, deterministisk, forklarlig og redigerbar uden tokenforbrug
- **Crawler**: Robots.txt, vilkår, rate limits, offentlige IP-adresser og sidegrænser skal respekteres
- **Sikkerhed**: API-nøgler forbliver server-side; upstream-fejl og følsomme rådata må ikke lækkes til klienten
- **Levering**: Første driftbare vej er CVRbasen discovery efterfulgt af manuel analyse pr. virksomhed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CVRbasen finder virksomheder automatisk | Fjerner manuel CSV-import som nødvendig start | — Pending live API verification |
| Produktanalysen bruger lokale regler uden LLM | Ingen tokenomkostning og fuld forklarlighed | ✓ Implemented in active intelligence flow |
| Hjemmesideanalyse startes manuelt pr. virksomhed | Begrænser belastning og gør databrug kontrollerbar | ✓ Good |
| Relevans vises som fire forsigtige klasser | Offentlige data kan ikke alene fastslå NIS2-pligt | ✓ Good |
| GSD bruger få brede faser og automatiske kontroller | Holder udviklingsflowet enkelt og kontrollerbart | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-22 after initialization*
