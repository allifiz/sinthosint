# SinthOSINT

Indonesia-first, entity-driven OSINT orchestrator that combines three reference approaches into one recursive workflow.

## Three core engines

1. **Maigret engine**
   - Loads the upstream Maigret site database at runtime.
   - Checks hundreds of username rules with Maigret-style presence/absence, status-code, response-URL and regex logic.
   - Extracts public display names, emails, phone numbers, usernames and domains from matching profiles so they can be pivoted automatically.

2. **OSINT in Indonesia engine**
   - Implements source packs based on the categories documented by `OSINT-for-countries/OSINT_in_Indonesia`.
   - Searches social platforms, government/semi-official domains, education, business, media/news, indexed public documents and contact footprints.
   - Uses Google, Bing and DuckDuckGo in parallel and converts discovered public identifiers into new entities.

3. **Indonesia v5 phone engine**
   - Reimplements the public-source phone workflow from `spyschools/osint-indonesia-v5`.
   - Normalizes `08`, `62` and `+62` number formats, infers Indonesian operator prefixes and performs multi-engine dorking.
   - Adds targeted phone-context pivots across social, business, government, education and contact pages.

Discovered domains and URLs are additionally enriched using DNS, certificate transparency, RDAP, Wayback Machine and public HTTP metadata.

## Recursive workflow

```text
seed
  ↓
classify entity
  ↓
matching toolkit engine
  ↓
findings + entity extraction
  ↓
deduplicate + confidence
  ↓
queue new entities
  ↓
matching toolkit engine
  ↺ until selected depth/budget
```

Typical pivot:

```text
username
  → Maigret profile
  → display name
  → OSINT in Indonesia source packs
  → public phone mention
  → Indonesia v5 phone engine
  → public URL/domain
  → web intelligence
```

## Current inputs

- username
- human name
- Indonesian phone number
- email
- domain
- URL

NIK is intentionally not exposed as a general-purpose remote lookup endpoint because it is a high-risk personal identifier. The upstream v5 project includes NIK search-engine dorking; SinthOSINT does not expose that capability to arbitrary public users.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy

This is a standard Next.js App Router application and can be imported directly into Vercel from GitHub.

## Scope

The application works with publicly accessible sources. It does not include credential theft, private-account bypasses, stolen/leaked databases, or authentication circumvention. Correlation/confidence is evidence weight, not proof that two accounts belong to the same person.
