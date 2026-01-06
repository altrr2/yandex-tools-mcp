# yandex-tools-mcp

MCP servers for Yandex APIs — search, keyword research, and webmaster tools for the Russian market.

[English](#english) | [Русский](#русский)

---

## English

### Packages

| Package | Description | npm |
|---------|-------------|-----|
| [yandex-wordstat-mcp](./packages/yandex-wordstat-mcp) | Keyword research & search trends via Yandex Wordstat API | [![npm](https://img.shields.io/npm/v/yandex-wordstat-mcp)](https://www.npmjs.com/package/yandex-wordstat-mcp) |
| [yandex-search-mcp](./packages/yandex-search-mcp) | Web search via Yandex Search API | [![npm](https://img.shields.io/npm/v/yandex-search-mcp)](https://www.npmjs.com/package/yandex-search-mcp) |
| [yandex-webmaster-mcp](./packages/yandex-webmaster-mcp) | Site analytics, indexing & SEO via Yandex Webmaster API | [![npm](https://img.shields.io/npm/v/yandex-webmaster-mcp)](https://www.npmjs.com/package/yandex-webmaster-mcp) |

### Quick Start

**Yandex Wordstat** (keyword research):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_WORDSTAT_TOKEN": "your_oauth_token"
      }
    }
  }
}
```

**Yandex Search** (web search):

```json
{
  "mcpServers": {
    "yandex-search": {
      "command": "npx",
      "args": ["-y", "yandex-search-mcp"],
      "env": {
        "YANDEX_SEARCH_API_KEY": "your_api_key",
        "YANDEX_FOLDER_ID": "your_folder_id"
      }
    }
  }
}
```

**Yandex Webmaster** (site analytics & SEO):

```json
{
  "mcpServers": {
    "yandex-webmaster": {
      "command": "npx",
      "args": ["-y", "yandex-webmaster-mcp"],
      "env": {
        "YANDEX_WEBMASTER_TOKEN": "your_oauth_token"
      }
    }
  }
}
```

See individual package READMEs for detailed setup instructions.

Online example: <a href="https://redirekto.ru/seo/en" target="_blank">AI SEO-Analysis on redirekto.ru</a>

### Claude Code Plugin

Install all three MCPs as a single plugin with built-in skills for keyword research and competitive analysis:

```bash
# Set your API keys
export YANDEX_SEARCH_API_KEY=your_api_key
export YANDEX_FOLDER_ID=your_folder_id
export YANDEX_WORDSTAT_TOKEN=your_oauth_token
export YANDEX_WEBMASTER_TOKEN=your_oauth_token

# Run with plugin
claude --plugin-dir /path/to/yandex-tools-mcp
```

**Included Skills:**
- `yandex-keyword-research` — Automatically triggered for keyword research, search volumes, and trend analysis
- `yandex-competitive-analysis` — Automatically triggered for competitor analysis and SERP research

---

## Русский

### Пакеты

| Пакет | Описание | npm |
|-------|----------|-----|
| [yandex-wordstat-mcp](./packages/yandex-wordstat-mcp) | Исследование ключевых слов через API Яндекс Вордстат | [![npm](https://img.shields.io/npm/v/yandex-wordstat-mcp)](https://www.npmjs.com/package/yandex-wordstat-mcp) |
| [yandex-search-mcp](./packages/yandex-search-mcp) | Веб-поиск через Yandex Search API | [![npm](https://img.shields.io/npm/v/yandex-search-mcp)](https://www.npmjs.com/package/yandex-search-mcp) |
| [yandex-webmaster-mcp](./packages/yandex-webmaster-mcp) | Аналитика сайта, индексация и SEO через Яндекс Вебмастер API | [![npm](https://img.shields.io/npm/v/yandex-webmaster-mcp)](https://www.npmjs.com/package/yandex-webmaster-mcp) |

### Быстрый старт

**Яндекс Вордстат** (исследование ключевых слов):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_WORDSTAT_TOKEN": "ваш_oauth_токен"
      }
    }
  }
}
```

**Яндекс Поиск** (веб-поиск):

```json
{
  "mcpServers": {
    "yandex-search": {
      "command": "npx",
      "args": ["-y", "yandex-search-mcp"],
      "env": {
        "YANDEX_SEARCH_API_KEY": "ваш_api_ключ",
        "YANDEX_FOLDER_ID": "ваш_folder_id"
      }
    }
  }
}
```

**Яндекс Вебмастер** (аналитика сайта и SEO):

```json
{
  "mcpServers": {
    "yandex-webmaster": {
      "command": "npx",
      "args": ["-y", "yandex-webmaster-mcp"],
      "env": {
        "YANDEX_WEBMASTER_TOKEN": "ваш_oauth_токен"
      }
    }
  }
}
```

Подробные инструкции по настройке в README каждого пакета.

Онлайн пример: <a href="https://redirekto.ru/seo" target="_blank">AI SEO-Анализ на редиректо.ru</a>

### Плагин для Claude Code

Установите все три MCP как единый плагин со встроенными навыками для исследования ключевых слов и анализа конкурентов:

```bash
# Установите API ключи
export YANDEX_SEARCH_API_KEY=ваш_api_ключ
export YANDEX_FOLDER_ID=ваш_folder_id
export YANDEX_WORDSTAT_TOKEN=ваш_oauth_токен
export YANDEX_WEBMASTER_TOKEN=ваш_oauth_токен

# Запустите с плагином
claude --plugin-dir /path/to/yandex-tools-mcp
```

**Включённые навыки:**
- `yandex-keyword-research` — Автоматически активируется для исследования ключевых слов, объёмов поиска и анализа трендов
- `yandex-competitive-analysis` — Автоматически активируется для анализа конкурентов и исследования SERP

---

## Development

```bash
git clone https://github.com/altrr2/yandex-tools-mcp.git
cd yandex-tools-mcp
bun install
```

Lint and format:

```bash
bun run lint
bun run format
```

Publish packages:

```bash
cd packages/yandex-wordstat-mcp && npm publish
cd packages/yandex-search-mcp && npm publish
cd packages/yandex-webmaster-mcp && npm publish
```

## License

MIT © Alternex
