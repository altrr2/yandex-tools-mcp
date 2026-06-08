# Changelog

All notable changes to the packages in this monorepo are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2026-06-08

### yandex-wordstat-mcp — 2.0.0

#### Changed (BREAKING)
- Migrated from the legacy Wordstat API to **Wordstat v2**, served by the Yandex
  Cloud Search API (`searchapi.api.cloud.yandex.net/v2/wordstat/*`).
- Authentication now uses an `Api-Key` header plus `folderId` in the request body
  — the same credentials as `yandex-search-mcp`. Configure via
  `YANDEX_SEARCH_API_KEY` / `YANDEX_FOLDER_ID`, or the dedicated
  `YANDEX_WORDSTAT_API_KEY` / `YANDEX_WORDSTAT_FOLDER_ID` (each takes precedence
  over the search equivalent when set).
- The `regions` tool now exposes a server-side `granularity` enum
  (`REGION_ALL` / `CITIES` / `REGIONS`) with client-side filtering by region ID,
  since v2 has no server-side region-ID filter for distribution.

#### Added
- `convert.mjs` with pure helpers for the v2 wire format: counts as proto3 JSON
  strings, RFC3339 dates, `PERIOD_*` / `DEVICE_*` / `REGION_*` enums, and the
  region tree under `{ regions: [...] }`.
- Session-level enrichment of region IDs to names from the cached regions tree
  (v2 responses return IDs only).
- `test/conversions.test.mjs` covering the conversion helpers (`bun test`).

#### Dependencies
- `@modelcontextprotocol/sdk` `^1.25.1` → `^1.29.0`
- `zod` `^4.3.5` → `^4.4.3`

### yandex-search-mcp — 1.3.0

#### Dependencies
- `@modelcontextprotocol/sdk` `^1.25.1` → `^1.29.0`
- `zod` `^4.3.5` → `^4.4.3`

### yandex-webmaster-mcp — 1.1.0

#### Dependencies
- `@modelcontextprotocol/sdk` `^1.25.1` → `^1.29.0`
- `zod` `^4.3.5` → `^4.4.3`

### yandex-metrika-mcp — 1.1.0

#### Changed
- Renamed package from `yandex-metrica-mcp` to `yandex-metrika-mcp`.

#### Added
- Bundled `LICENSE` file (MIT) so it ships in the published tarball.

#### Dependencies
- `@modelcontextprotocol/sdk` `^1.25.1` → `^1.29.0`
- `zod` `^4.3.5` → `^4.4.3`
