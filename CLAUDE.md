# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo containing two MCP (Model Context Protocol) servers for Yandex APIs:
- **yandex-search-mcp**: Web search optimized for Russian/Cyrillic content
- **yandex-wordstat-mcp**: Keyword research and search trend analysis

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

# Publish packages
cd packages/yandex-wordstat-mcp && npm publish
cd packages/yandex-search-mcp && npm publish
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
├── yandex-search-mcp/src/index.mjs    # Single-file MCP server (1 tool: search)
└── yandex-wordstat-mcp/
    └── src/
        ├── index.mjs                   # MCP server (5 tools)
        └── auth.mjs                    # OAuth token exchange flow
```

### MCP Protocol Pattern
Both servers follow the same pattern:
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

### Environment Variables
See `.env.example`:
- `YANDEX_SEARCH_API_KEY` / `YANDEX_FOLDER_ID` for search
- `YANDEX_WORDSTAT_TOKEN` for wordstat
- `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` for OAuth flow (optional)
