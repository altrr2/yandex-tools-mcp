# Changelog

All notable changes to the packages in this monorepo are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2026-07-02

### yandex-metrika-mcp — 1.2.0

#### Added
Thirty-four pre-built SEO report tools layered on the Reporting API
(`/stat/v1/data`), bringing the server from 10 to 44 tools. All were verified
live against a real counter. Grouped as:
- **Bounce & behavior:** `get-high-bounce-pages-organic`, `get-critical-pages`,
  `get-bounce-comparison-search-engines`, `get-bounce-by-devices-organic`,
  `get-bounce-device-search-engine`.
- **Page & exit analysis:** `get-page-depth-by-sections`,
  `get-exit-pages-by-section`, `get-entry-exit-paths`,
  `get-top-exit-pages-organic`, `get-exit-pages-by-devices`.
- **Organic conversions** (optional `goal_id`, else all goals):
  `get-conversions-by-search-engine`, `get-conversions-by-landing-pages`,
  `get-conversions-by-search-phrases`, `get-conversions-by-devices`,
  `get-conversions-by-regions`, `get-conversions-device-region`.
- **Referral:** `get-referral-donors-behavior`, `get-referral-full-urls`,
  `get-quality-referral-traffic`, `get-referral-conversions`.
- **Social:** `get-social-networks-traffic`, `get-social-networks-quality`,
  `get-social-landing-pages`.
- **Audience & demographics:** `get-new-vs-returning-organic`,
  `get-visit-frequency-organic`, `get-demographics-organic`,
  `get-audience-interests`.
- **Temporal:** `get-organic-activity-by-hour`,
  `get-organic-activity-by-day-of-week`, `get-organic-traffic-dynamics`,
  `get-organic-seasonality`.
- **Technology:** `get-organic-browsers`, `get-problematic-os`,
  `get-screen-resolutions`.

Most tools filter to organic search (`ym:s:trafficSource=='organic'`) and share
new `statData` / `formatReport` helpers.

#### Fixed
- `get-traffic-summary` crashed (`metrics is not iterable`) — it read
  `data.totals[0]` (a single number) instead of the flat `data.totals` array.
- `get-traffic-summary` and `get-traffic-sources` multiplied `bounceRate` by 100,
  displaying e.g. "3032%"; the Reporting API already returns it as a 0–100
  percentage. `get-report`'s totals-only fallback had the same `totals[0]` bug.

## 2026-07-01

### yandex-webmaster-mcp — 1.2.0

#### Added
Ten new tools expanding Yandex Webmaster API v4 coverage (24 → 34 tools):
- **Recrawl:** `get-recrawl-queue` (list tasks), `get-recrawl-task` (task status),
  and `submit-recrawl` — the server's first write operation, which queues a URL
  for reindexing and consumes the daily recrawl quota.
- **Search queries:** `get-single-query-history`
  (`/search-queries/{query-id}/history`) and `get-query-analytics`
  (`POST /query-analytics/list`, the query↔URL intersection report).
- **Sitemaps:** `get-user-sitemap` — details for a single user-added sitemap.
- **Feeds:** `get-feeds` (`/feeds/list`) and `get-feed-status`
  (`/feeds/add/info`).
- **Static references:** `get-region-ids` and `get-feed-regions` — Yandex
  documents these region ID lists rather than exposing an endpoint, so they are
  served from bundled data (no API call).

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
