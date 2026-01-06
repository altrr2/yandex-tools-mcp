# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo containing four MCP (Model Context Protocol) servers for Yandex APIs:
- **yandex-search-mcp**: Web search optimized for Russian/Cyrillic content
- **yandex-wordstat-mcp**: Keyword research and search trend analysis
- **yandex-webmaster-mcp**: Site analytics, indexing status, and SEO diagnostics
- **yandex-metrica-mcp**: Web analytics, traffic data, and visitor insights

## Commands

```bash
# Install dependencies (from root)
bun install

# Code quality
bun run lint          # Check code style with Biome
bun run lint:fix      # Fix linting issues
bun run format        # Format code

# Run servers locally (for testing)
YANDEX_WORDSTAT_TOKEN=token node packages/yandex-wordstat-mcp/src/index.mjs
YANDEX_SEARCH_API_KEY=key YANDEX_FOLDER_ID=folder node packages/yandex-search-mcp/src/index.mjs
YANDEX_WEBMASTER_TOKEN=token node packages/yandex-webmaster-mcp/src/index.mjs
YANDEX_METRICA_TOKEN=token node packages/yandex-metrica-mcp/src/index.mjs

# Publish packages
cd packages/yandex-wordstat-mcp && npm publish
cd packages/yandex-search-mcp && npm publish
cd packages/yandex-webmaster-mcp && npm publish
cd packages/yandex-metrica-mcp && npm publish
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
│   └── src/
│       ├── index.mjs                   # MCP server (5 tools)
│       └── auth.mjs                    # OAuth token exchange flow
├── yandex-webmaster-mcp/
│   └── src/
│       ├── index.mjs                   # MCP server (24 tools)
│       └── auth.mjs                    # OAuth token exchange flow
└── yandex-metrica-mcp/
    └── src/
        ├── index.mjs                   # MCP server (10 tools)
        └── auth.mjs                    # OAuth token exchange flow
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
- Uses Yandex Wordstat API (JSON responses)
- Rate limited to 10 requests/second (client-side enforcement)
- Session-level caching for regions tree
- Tools have quota costs (0-2 units per call)
- Hierarchical region support with flat lookup maps

**yandex-webmaster-mcp:**
- Uses Yandex Webmaster API v4 (JSON responses)
- Caches user_id for the session (required for all API calls)
- Read-only tools: site stats, search queries, indexing, backlinks, sitemaps, diagnostics
- Requires verified site ownership in Yandex Webmaster

**yandex-metrica-mcp:**
- Uses Yandex Metrica API (JSON responses)
- Management API for counters/goals, Reporting API for statistics
- Default date range: last 30 days
- Flexible custom reports with any dimensions/metrics

### Environment Variables
See `.env.example`:
- `YANDEX_SEARCH_API_KEY` / `YANDEX_FOLDER_ID` for search
- `YANDEX_WORDSTAT_TOKEN` for wordstat
- `YANDEX_WEBMASTER_TOKEN` for webmaster
- `YANDEX_METRICA_TOKEN` for metrica
- `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` for OAuth flow (optional)

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
