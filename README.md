# yandex-tools-mcp

MCP servers for Yandex APIs — search and keyword research for the Russian market.

[English](#english) | [Русский](#русский)

---

## English

### Packages

| Package | Description | npm |
|---------|-------------|-----|
| [yandex-wordstat-mcp](./packages/yandex-wordstat-mcp) | Keyword research & search trends via Yandex Wordstat API | [![npm](https://img.shields.io/npm/v/yandex-wordstat-mcp)](https://www.npmjs.com/package/yandex-wordstat-mcp) |
| [yandex-search-mcp](./packages/yandex-search-mcp) | Web search via Yandex Search API | [![npm](https://img.shields.io/npm/v/yandex-search-mcp)](https://www.npmjs.com/package/yandex-search-mcp) |

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

See individual package READMEs for detailed setup instructions.

---

## Русский

### Пакеты

| Пакет | Описание | npm |
|-------|----------|-----|
| [yandex-wordstat-mcp](./packages/yandex-wordstat-mcp) | Исследование ключевых слов через API Яндекс Вордстат | [![npm](https://img.shields.io/npm/v/yandex-wordstat-mcp)](https://www.npmjs.com/package/yandex-wordstat-mcp) |
| [yandex-search-mcp](./packages/yandex-search-mcp) | Веб-поиск через Yandex Search API | [![npm](https://img.shields.io/npm/v/yandex-search-mcp)](https://www.npmjs.com/package/yandex-search-mcp) |

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

Подробные инструкции по настройке в README каждого пакета.

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
```

## License

MIT © Alternex
