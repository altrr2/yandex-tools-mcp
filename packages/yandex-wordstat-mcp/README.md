# yandex-wordstat-mcp

MCP server for the **Yandex Wordstat v2 API** — keyword research and search trend analysis for the Russian market.

> ℹ️ This server targets **Wordstat v2**, served by the **Yandex Cloud Search API**
> (`searchapi.api.cloud.yandex.net/v2/wordstat/*`). It authenticates with a Yandex Cloud
> **`Api-Key` + folder ID** — *not* the legacy `api.wordstat.yandex.net` OAuth token. The old
> v1 OAuth flow was removed in v2.0.0; see [Setup](#setup).

[![npm version](https://badge.fury.io/js/yandex-wordstat-mcp.svg)](https://www.npmjs.com/package/yandex-wordstat-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

### Features

| Tool | Description |
|------|-------------|
| `get-regions-tree` | Get top 3 levels of region hierarchy (configurable depth) |
| `get-region-children` | Drill down into a specific region to see its children |
| `top-requests` | Popular queries containing a keyword (last 30 days) + related queries |
| `dynamics` | Search volume trends over time (daily / weekly / monthly) |
| `regions` | Regional distribution with region names and affinity insights |

**v2.0.0 — Wordstat v2 (Yandex Cloud):**
- **New API** — migrated to the Wordstat v2 API served by the Yandex Cloud Search API
- **Shared credentials** — uses the same `YANDEX_SEARCH_API_KEY` + `YANDEX_FOLDER_ID` as
  [`yandex-search-mcp`](https://www.npmjs.com/package/yandex-search-mcp); no separate OAuth token
- **Region names included** — v2 returns region IDs only; names are resolved from the cached tree
- **Affinity insights** — `regions` tool shows both top by volume and top by interest

> **Breaking change:** v2.0.0 drops the old OAuth `YANDEX_WORDSTAT_TOKEN` flow. Configure a
> Yandex Cloud API key instead (see Setup below).

### Setup

> **Prefer a hosted tool?** If you'd rather not manage Yandex Cloud credentials yourself,
> a hosted MCP endpoint is available at <a href="https://unoapi.ru/services/wordstat" target="_blank">unoapi.ru/services/wordstat</a>.

#### Step 1: Get a Yandex Cloud API key

1. In the [Yandex Cloud console](https://console.yandex.cloud/), create a **service account**
   and assign it the role **`search-api.webSearch.user`**.
2. Create an **API key** for that service account with the scope **`yc.search-api.execute`**.
3. Note your **folder ID** (shown in the console, e.g. `b1g…`).

This is the same key and folder used by `yandex-search-mcp` — you can reuse them.

#### Step 2: Configure Claude

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_SEARCH_API_KEY": "your_api_key_here",
        "YANDEX_FOLDER_ID": "your_folder_id_here"
      }
    }
  }
}
```

To keep the wordstat key separate from the search key, set `YANDEX_WORDSTAT_API_KEY`
(and optionally `YANDEX_WORDSTAT_FOLDER_ID`) instead — each takes precedence over its
`YANDEX_SEARCH_*` / `YANDEX_FOLDER_ID` equivalent when set.

**Claude Code:**

```bash
claude mcp add yandex-wordstat \
  -e YANDEX_SEARCH_API_KEY=your_api_key \
  -e YANDEX_FOLDER_ID=your_folder_id \
  -- npx -y yandex-wordstat-mcp
```

### Usage Examples

Once configured, ask Claude:

**Keyword Research:**
- "What are the most popular search queries for 'buy iPhone' in Russia?"
- "Show me top searches containing 'real estate Moscow'"
- "What are people searching for about 'artificial intelligence'?"

**Search Trends:**
- "Show me the search trend for 'cryptocurrency' over the past year"
- "How has interest in 'electric cars' changed over time?"
- "Show weekly search dynamics for 'vacation Turkey'"

**Regional Analysis:**
- "Which regions search for 'jobs' the most?"
- "Show regional distribution for 'delivery food'"
- "Where in Russia do people search for 'ski resort' most often?"

**Get Region IDs:**
- "Get the Yandex Wordstat regions tree"
- "What is the region ID for Moscow?"

Online usage example: <a href="https://seyka.ru" target="_blank">seyka.ru</a>

---

## Русский

MCP-сервер для **Yandex Wordstat v2 API** — исследование ключевых слов и анализ поисковых трендов для российского рынка.

> ℹ️ Сервер работает с **Wordstat v2**, который обслуживается **Yandex Cloud Search API**
> (`searchapi.api.cloud.yandex.net/v2/wordstat/*`), и использует **`Api-Key` + идентификатор
> каталога** Yandex Cloud, а *не* OAuth-токен старого `api.wordstat.yandex.net`. Старый поток
> v1 (OAuth) удалён в v2.0.0; см. [Настройку](#настройка).

### Возможности

| Инструмент | Описание |
|------------|----------|
| `get-regions-tree` | Получить топ-3 уровня иерархии регионов (глубина настраивается) |
| `get-region-children` | Детализация региона — показать дочерние регионы |
| `top-requests` | Популярные запросы с ключевым словом (за 30 дней) + похожие запросы |
| `dynamics` | Динамика поисковых запросов во времени (день / неделя / месяц) |
| `regions` | Региональное распределение с названиями и индексом аффинитивности |

**v2.0.0 — Wordstat v2 (Yandex Cloud):**
- **Новый API** — переход на Wordstat v2, который обслуживается Yandex Cloud Search API
- **Общие учётные данные** — используются те же `YANDEX_SEARCH_API_KEY` + `YANDEX_FOLDER_ID`,
  что и в [`yandex-search-mcp`](https://www.npmjs.com/package/yandex-search-mcp); OAuth-токен не нужен
- **Названия регионов** — v2 возвращает только ID; названия берутся из кэшированного дерева
- **Аналитика аффинитивности** — `regions` показывает топ по объёму и топ по интересу

> **Несовместимое изменение:** в v2.0.0 удалён старый OAuth-поток `YANDEX_WORDSTAT_TOKEN`.
> Вместо него настройте API-ключ Yandex Cloud (см. Настройку ниже).

### Настройка

> **Нужен готовый инструмент?** Если вы не хотите самостоятельно управлять учётными данными
> Yandex Cloud, доступен размещённый MCP-эндпоинт: <a href="https://unoapi.ru/services/wordstat" target="_blank">unoapi.ru/services/wordstat</a>.

#### Шаг 1: Получение API-ключа Yandex Cloud

1. В [консоли Yandex Cloud](https://console.yandex.cloud/) создайте **сервисный аккаунт**
   и назначьте ему роль **`search-api.webSearch.user`**.
2. Создайте для него **API-ключ** с областью действия **`yc.search-api.execute`**.
3. Запишите **идентификатор каталога** (folder ID, например `b1g…`).

Это те же ключ и каталог, что использует `yandex-search-mcp` — их можно переиспользовать.

#### Шаг 2: Настройка Claude

**Claude Desktop** — отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_SEARCH_API_KEY": "ваш_api_ключ",
        "YANDEX_FOLDER_ID": "ваш_folder_id"
      }
    }
  }
}
```

Чтобы использовать для wordstat отдельный ключ, задайте `YANDEX_WORDSTAT_API_KEY`
(и при необходимости `YANDEX_WORDSTAT_FOLDER_ID`) — они имеют приоритет над
`YANDEX_SEARCH_API_KEY` / `YANDEX_FOLDER_ID`.

**Claude Code:**

```bash
claude mcp add yandex-wordstat \
  -e YANDEX_SEARCH_API_KEY=ваш_api_ключ \
  -e YANDEX_FOLDER_ID=ваш_folder_id \
  -- npx -y yandex-wordstat-mcp
```

### Примеры использования

После настройки спросите Claude:

**Исследование ключевых слов:**
- "Какие самые популярные запросы по 'купить iPhone' в России?"
- "Покажи топ запросов по 'недвижимость Москва'"
- "Что ищут люди по запросу 'искусственный интеллект'?"

**Динамика поиска:**
- "Покажи тренд поиска 'криптовалюта' за последний год"
- "Как менялся интерес к 'электромобили' со временем?"
- "Покажи недельную динамику запросов 'отдых Турция'"

**Региональный анализ:**
- "В каких регионах больше всего ищут 'работа'?"
- "Покажи региональное распределение для 'доставка еды'"
- "Где в России чаще всего ищут 'горнолыжный курорт'?"

**Получение ID регионов:**
- "Получи дерево регионов Яндекс Вордстат"
- "Какой ID региона у Москвы?"

Онлайн пример использования: <a href="https://seyka.ru" target="_blank">seyka.ru</a>

---

## Limits & billing

- **Rate limit** — 10 requests per second (enforced client-side, automatically)
- **Billing** — Wordstat v2 is billed through Yandex Cloud (Search API). See your Yandex
  Cloud console for usage and quotas.

---

## Development

```bash
git clone https://github.com/altrr2/yandex-tools-mcp.git
cd yandex-tools-mcp/packages/yandex-wordstat-mcp
bun install
```

No build step needed — runs directly with Node.

```bash
bun run lint        # check
bun run lint:fix    # fix issues
bun run format      # format code
bun test            # unit tests for the v2 conversion helpers
```

Test locally:

```bash
YANDEX_SEARCH_API_KEY=your-key YANDEX_FOLDER_ID=your-folder node src/index.mjs
```

---

## License

MIT © Alternex
