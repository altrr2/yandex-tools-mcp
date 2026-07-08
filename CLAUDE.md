# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo containing five MCP (Model Context Protocol) servers for Yandex APIs:
- **yandex-search-mcp**: Web search optimized for Russian/Cyrillic content
- **yandex-wordstat-mcp**: Keyword research and search trend analysis (**Wordstat v2** via the Yandex Cloud Search API)
- **yandex-webmaster-mcp**: Site analytics, indexing status, and SEO diagnostics
- **yandex-metrika-mcp**: Web analytics, traffic data, and visitor insights
- **yandex-direct-mcp**: PPC campaign management — campaigns, ad groups, ads, keywords, bids, statistics (the only server with real-money writes)

## Commands

```bash
# Install dependencies (from root)
bun install

# Code quality
bun run lint          # Check code style with Biome
bun run lint:fix      # Fix linting issues
bun run format        # Format code

# Run servers locally (for testing)
YANDEX_SEARCH_API_KEY=key YANDEX_FOLDER_ID=folder node packages/yandex-wordstat-mcp/src/index.mjs
YANDEX_SEARCH_API_KEY=key YANDEX_FOLDER_ID=folder node packages/yandex-search-mcp/src/index.mjs
YANDEX_WEBMASTER_TOKEN=token node packages/yandex-webmaster-mcp/src/index.mjs
YANDEX_METRIKA_TOKEN=token node packages/yandex-metrika-mcp/src/index.mjs
YANDEX_DIRECT_TOKEN=token node packages/yandex-direct-mcp/src/index.mjs   # defaults to sandbox; YANDEX_DIRECT_LIVE=1 for production

# Publish packages
cd packages/yandex-wordstat-mcp && npm publish
cd packages/yandex-search-mcp && npm publish
cd packages/yandex-webmaster-mcp && npm publish
cd packages/yandex-metrika-mcp && npm publish
cd packages/yandex-direct-mcp && npm publish
```

## Architecture

### Tech Stack
- Node.js >= 18.0.0
- Bun package manager (monorepo workspaces)
- Pure ES Modules (no TypeScript, no build step)
- Biome for linting/formatting

### Package Structure
```
packages/
├── yandex-search-mcp/src/index.mjs     # Single-file MCP server (1 tool: search)
├── yandex-wordstat-mcp/
│   ├── src/
│   │   ├── index.mjs                   # MCP server (5 tools)
│   │   └── convert.mjs                 # Pure v2 wire-format conversion helpers
│   └── test/
│       └── conversions.test.mjs        # bun test for convert.mjs
├── yandex-webmaster-mcp/
│   └── src/
│       ├── index.mjs                   # MCP server (34 tools)
│       └── auth.mjs                    # OAuth token exchange flow
├── yandex-metrika-mcp/
│   └── src/
│       ├── index.mjs                   # MCP server (44 tools)
│       └── auth.mjs                    # OAuth token exchange flow
└── yandex-direct-mcp/                  # Multi-file (unlike siblings): ~18 tools split by resource
    └── src/
        ├── index.mjs                   # Thin entry: CLI dispatch, build client, register tool groups
        ├── auth.mjs                    # OAuth token exchange flow
        ├── client.mjs                  # v5 directRequest + Reports reportRequest + Live4 liveV4Request
        ├── money.mjs                   # toMicro/fromMicro (micro-unit conversion)
        ├── format.mjs                  # summarizeResults (mutation result formatter), today()
        └── tools/                      # campaigns, adgroups, ads, keywords, reports, account
```

### MCP Protocol Pattern
All servers follow the same pattern:
1. Import `@modelcontextprotocol/sdk` and `zod`
2. Register tools with input schemas (Zod)
3. Use `StdioServerTransport` for communication
4. Return structured responses with `text` + optional `structuredContent`

### Key Implementation Details

**yandex-search-mcp:**
- Parses XML responses from Yandex Search API
- Auto-detects language (Cyrillic vs Latin) to choose search type
- Extracts: position, url, domain, title, headline, passages, snippet, size, lang, cachedUrl

**yandex-wordstat-mcp:**
- Uses Yandex Wordstat **v2** API, served by the Yandex Cloud Search API
  (`searchapi.api.cloud.yandex.net/v2/wordstat/*`), `Api-Key` header + `folderId` in body —
  same credentials as `yandex-search-mcp`
- v2 wire format quirks handled in `convert.mjs`: counts as JSON strings (proto3),
  RFC3339 dates, `PERIOD_*`/`DEVICE_*`/`REGION_*` enums, region tree under `{regions:[…]}`
- Rate limited to 10 requests/second (client-side enforcement)
- Session-level caching for regions tree; v2 region responses return IDs only, so names
  are enriched from the cached tree (flat lookup map)
- `regions` tool: server-side `granularity` enum (REGION_ALL/CITIES/REGIONS) + client-side
  `regions` ID filter (v2 has no server-side region-ID filter for distribution)

**yandex-webmaster-mcp:**
- Uses Yandex Webmaster API v4 (JSON responses)
- Caches user_id for the session (required for all API calls)
- Mostly read-only tools: site stats, search queries, query analytics, indexing, backlinks,
  sitemaps, diagnostics, recrawl queue/status, feeds
- One write tool: `submit-recrawl` (POST /recrawl/queue) queues a URL for reindexing and
  consumes the daily recrawl quota
- `get-region-ids` and `get-feed-regions` are static references (no API call) — Yandex
  documents these region ID lists rather than exposing an endpoint
- Requires verified site ownership in Yandex Webmaster

**yandex-metrika-mcp:**
- Uses Yandex Metrica API (JSON responses)
- Management API for counters/goals, Reporting API (`/stat/v1/data`) for statistics
- Default date range: last 30 days
- Flexible custom reports with any dimensions/metrics (`get-report`)
- 34 pre-built SEO report tools layered on the Reporting API: bounce/behavior,
  page & exit analysis, organic conversions (optional `goal_id`, else "any goal"),
  referral, social, audience/demographics, temporal patterns, technology. Most
  filter to organic search via `ym:s:trafficSource=='organic'` and share the
  `statData` / `formatReport` helpers. Metrica returns `bounceRate` and
  conversion rates as 0–100 percentages (do not multiply by 100)

**yandex-direct-mcp:**
- Uses Yandex Direct API **v5** (JSON). Split into modules (not single-file): a shared
  `client` (built once in `index.mjs`, bound to host + token) is passed to each
  `register*Tools(server, client)` in `src/tools/`
- **Sandbox by default** for safety — hits `api-sandbox.direct.yandex.com` unless
  `YANDEX_DIRECT_LIVE=1`, which switches to production (`api.direct.yandex.com`); the startup
  stderr line reports `SANDBOX` vs `LIVE (real money)`
- **Auth differs from siblings**: `Authorization: Bearer <token>` (not the `OAuth` prefix used
  by webmaster/metrika); optional `Client-Login` header when `YANDEX_DIRECT_LOGIN` is set
  (agency/managed accounts)
- v5 quirks in `client.mjs`: services are POST endpoints with a `{ method, params }` body and
  return errors **inside** the JSON body (`data.error`) even on HTTP 200 — `directRequest`
  inspects the body and throws
- **Money is micro-units** (currency × 1,000,000) — `money.mjs` `toMicro`/`fromMicro`; tools
  accept plain currency amounts (rubles) and convert at the boundary
- **`get-report`** is a flexible statistics engine (like metrika's) on the separate Reports
  service (`reportRequest`): returns **TSV**, may reply `201/202` → polls `retryIn` seconds;
  requests money in real currency (`returnMoneyInMicros:false`) so no conversion on output
- **`get-balance`** uses the older **Live v4** JSON API (`liveV4Request`, token in body) since
  v5 has no balance endpoint
- **Write tools** (`create-*`, `update-*`, `manage-*`, `add-keywords`, `set-bids`,
  `set-negative-keywords`) are flagged as WRITE in their descriptions (no code-level gate,
  same convention as webmaster's `submit-recrawl`); the sandbox default is the real guard

### Environment Variables
See `.env.example`:
- `YANDEX_SEARCH_API_KEY` / `YANDEX_FOLDER_ID` for search **and wordstat**
- wordstat optionally uses `YANDEX_WORDSTAT_API_KEY` / `YANDEX_WORDSTAT_FOLDER_ID` to keep
  keys separate (each takes precedence over the search equivalent when set)
- `YANDEX_WEBMASTER_TOKEN` for webmaster
- `YANDEX_METRIKA_TOKEN` for metrica
- `YANDEX_DIRECT_TOKEN` for direct; optional `YANDEX_DIRECT_LIVE=1` (production instead of the
  default sandbox) and `YANDEX_DIRECT_LOGIN` (agency `Client-Login`)
- `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` for the webmaster/metrika/direct OAuth flow (optional)

## Skills

Located in `.claude/skills/`, these are automatically invoked by Claude based on task context:

| Skill | Triggers on |
|-------|-------------|
| `yandex-keyword-research` | Keyword research, search volumes, trends, "what are people searching for" |
| `yandex-competitive-analysis` | Competitor analysis, SERP research, "who ranks for", content gaps |

Skills combine multiple MCP tools into guided workflows with output formatting guidelines.

## Plugin Structure

This repo can be used as a Claude Code plugin. Two MCP configs exist:

| File | Purpose | Secrets |
|------|---------|---------|
| `.mcp.json` | Local development | `--env-file=.env` |
| `plugin.mcp.json` | Plugin distribution | `${VAR}` interpolation |

**Plugin files:**
```
.claude-plugin/plugin.json    # Plugin manifest
plugin.mcp.json               # MCP config for distribution (uses npx + ${VAR})
.claude/skills/               # Skills (referenced by plugin)
```

**Testing as plugin:**
```bash
# Set env vars, then:
claude --plugin-dir .
```

**Local dev (unchanged):**
```bash
# Uses .mcp.json with --env-file=.env
claude
```
