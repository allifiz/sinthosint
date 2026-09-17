# SinthOSINT

Indonesia-first, entity-driven OSINT orchestrator for lawful public-source investigations.

SinthOSINT accepts a username, human name, Indonesian phone number, email, domain, or URL. It classifies the seed, runs the matching adapter, extracts new entities, deduplicates them, assigns evidence confidence, and automatically pivots those entities through compatible adapters.

## Workflow

- `username` → Maigret-style public profile discovery
- `name` → Indonesia-oriented search queries and public-source discovery
- `phone` → Indonesian normalization/operator inference + indexed public mentions
- `email` → indexed public footprint
- `domain` → DNS + certificate transparency + RDAP
- `url` → public web metadata and entity extraction
- every discovered entity → queued for the next compatible adapter up to the selected depth

The implementation is inspired by Maigret, `OSINT-for-countries/OSINT_in_Indonesia`, and `spyschools/osint-indonesia-v5`, but uses its own adapter/orchestrator implementation for Vercel compatibility and clearer licensing boundaries.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy

This is a standard Next.js App Router application and can be imported directly into Vercel from GitHub.

## Scope

The app works with publicly accessible sources. It does not include credential theft, private-account bypasses, stolen/leaked databases, or authentication circumvention. Correlation/confidence is evidence weight, not proof that two accounts belong to the same person.
