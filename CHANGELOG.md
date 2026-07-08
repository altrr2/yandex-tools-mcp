# Changelog

All notable changes to the packages in this monorepo are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2026-07-08

### yandex-direct-mcp — 1.0.0

#### Added
- New package: MCP server for the Yandex Direct API (PPC campaign management).
  18 tools organized by read/write risk — campaign/ad-group/ad/keyword reads, a
  flexible `get-report` statistics engine (Reports service, TSV + polling),
  account balance (via the Live v4 API) and geo-region reference, plus
  WRITE-flagged mutations: create/update/manage campaigns, create ad groups/ads,
  add keywords, set bids, and set negative keywords.
- Defaults to the Yandex Direct **sandbox** host; `YANDEX_DIRECT_LIVE=1` switches
  to the production account (real money). Bearer auth with optional `Client-Login`
  for agency/managed accounts (`YANDEX_DIRECT_LOGIN`). Bids/budgets are given in
  account currency and converted to Yandex micro-units at the boundary.
- Wired into `.mcp.json`, `plugin.mcp.json`, `.env.example`, the root README, and
  CLAUDE.md.

## 2026-07-05 (later)

### yandex-metrika-mcp — 1.2.1

#### Fixed
- Two Reporting API attribute names replaced with their documented
  equivalents (issue #3). The old names are undocumented aliases that
  currently return identical data, so nothing was broken live, but only
  the documented names are contractual:
  - `ym:s:sumGoalReachesAny` → `ym:s:anyGoalReaches` in the `goalMetrics`
    helper — the "any goal" path of all 8 goal-conversion tools, including
    the derived sort in the three tools that order by it
  - `ym:s:dayOfWeekName` → `ym:s:dayOfWeek` in
    `get-organic-activity-by-day-of-week`

#### Changed
- Base hosts use the documented `api-metrika.yandex.net` spelling instead
  of `api-metrica.yandex.net` (both resolve to the same service).

## 2026-07-05

### yandex-webmaster-mcp — 1.2.1

#### Fixed
- Four tools called upstream paths that 404 against the Webmaster API v4
  (issue #2); they now match the official docs and were verified live:
  - `get-insearch-history`: `/indexing/insearch/history` →
    `/search-urls/in-search/history`
  - `get-insearch-samples`: `/indexing/insearch/samples` →
    `/search-urls/in-search/samples`
  - `get-broken-internal-links`: `/links/internal/samples` →
    `/links/internal/broken/samples`
  - `get-broken-internal-links-history`: `/links/internal/history` →
    `/links/internal/broken/history`

#### Added
- `test/endpoints.test.mjs` — end-to-end test that spawns the MCP server
  against a mock API and asserts the upstream path each tool requests. To
  support it, `BASE_URL` is overridable via `YANDEX_WEBMASTER_BASE_URL`.

## 2026-07-02 (later)

### yandex-search-mcp — 1.3.1

#### Fixed
- Internationalized (IDN) domains no longer leak their punycode form to the
  model. Yandex returns Cyrillic `.рф`/IDN hosts as ASCII punycode
  (`заречнев.рф` → `xn--d1abiacj6ales3d1b.xn--p1ai`); result `domain` and `url`
  fields are now converted back to Unicode for display via `node:url`'s
  `domainToUnicode` (non-IDN hosts and decode failures pass through unchanged).

#### Changed
- README: replaced the `redirekto.ru/seo` link with the hosted version
  (`unoapi.ru/services/yandex-search`) and an online example (`seyka.ru`).

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
