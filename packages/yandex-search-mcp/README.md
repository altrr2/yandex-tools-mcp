# yandex-search-mcp

MCP server for [Yandex Search API](https://yandex.cloud/en/services/search-api) — web search optimized for Russian and Cyrillic content.

[![npm version](https://badge.fury.io/js/yandex-search-mcp.svg)](https://www.npmjs.com/package/yandex-search-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

### Features

- **Optimized for Russian/Cyrillic** — auto-detects language and uses appropriate search index
- **Full Yandex Search** — same results as yandex.ru
- **Rich structured results** — position, URL, domain, title, headline, passages, snippet, size, language, cached URL
- **Content filtering** — family mode support
- **Regional search** — filter by geographic region
- **Pagination** — fetch multiple pages of results

**v1.1.0 Improvements:**
- **Structured JSON output** — results now include all available metadata
- **Domain extraction** — each result includes parsed domain
- **Passages array** — separate text snippets for better processing
- **Cached URLs** — links to Yandex cached versions when available

### Setup

#### Step 1: Create Yandex Cloud Account

1. Go to [Yandex Cloud](https://cloud.yandex.com/) and create an account
2. Create a new folder (or use default)
3. Note your **Folder ID** from the folder settings

#### Step 2: Enable Search API

1. Go to [Search API](https://cloud.yandex.com/services/search-api) in Yandex Cloud console
2. Click **Enable API**
3. Create a **Service Account** with `search-api.executor` role
4. Create an **API Key** for the service account
5. Note your **API Key**

#### Step 3: Configure Claude

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

**Claude Code:**

```bash
claude mcp add yandex-search \
  -e YANDEX_SEARCH_API_KEY=your_api_key \
  -e YANDEX_FOLDER_ID=your_folder_id \
  -- npx -y yandex-search-mcp
```

### Usage Examples

Once configured, ask Claude:

**General Search:**
- "Search Yandex for 'best restaurants in Moscow'"
- "Find information about 'machine learning' using Yandex"
- "Search for 'купить квартиру Москва'"

**Russian Content:**
- "Найди информацию о 'история России'"
- "Поищи в Яндексе 'рецепт борща'"
- "Что пишут о 'новости технологий'?"

**With Options:**
- "Search Yandex for 'weather' in Moscow region (region 213)"
- "Find 'news' with strict family filter"
- "Search for 'cats' and include images"

### Tool Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `maxResults` | number | 10 | Results per page (1-100) |
| `includeImages` | boolean | false | Include image URLs |
| `region` | number | auto | Region ID (e.g., 213 for Moscow) |
| `page` | number | 0 | Page number for pagination |
| `familyMode` | string | MODERATE | Content filter: NONE, MODERATE, STRICT |

Online example: <a href="https://redirekto.ru/seo/en" target="_blank">AI SEO-Analysis on redirekto.ru</a>

---

## Русский

### Возможности

- **Оптимизирован для русского языка** — автоматически определяет язык и использует нужный индекс
- **Полноценный поиск Яндекса** — те же результаты, что и на yandex.ru
- **Структурированные результаты** — позиция, URL, домен, заголовок, headline, passages, сниппет, размер, язык, кэш
- **Фильтрация контента** — поддержка семейного режима
- **Региональный поиск** — фильтрация по географическому региону
- **Пагинация** — получение нескольких страниц результатов

**Улучшения v1.1.0:**
- **Структурированный JSON** — результаты содержат все доступные метаданные
- **Извлечение домена** — каждый результат включает распарсенный домен
- **Массив passages** — отдельные текстовые фрагменты для лучшей обработки
- **Кэшированные URL** — ссылки на кэшированные версии Яндекса

### Настройка

#### Шаг 1: Создание аккаунта Yandex Cloud

1. Перейдите на [Yandex Cloud](https://cloud.yandex.ru/) и создайте аккаунт
2. Создайте новый каталог (или используйте default)
3. Запишите **Folder ID** из настроек каталога

#### Шаг 2: Подключение Search API

1. Перейдите в [Search API](https://cloud.yandex.ru/services/search-api) в консоли Yandex Cloud
2. Нажмите **Подключить API**
3. Создайте **Сервисный аккаунт** с ролью `search-api.executor`
4. Создайте **API-ключ** для сервисного аккаунта
5. Сохраните **API-ключ**

#### Шаг 3: Настройка Claude

**Claude Desktop** — отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

**Claude Code:**

```bash
claude mcp add yandex-search \
  -e YANDEX_SEARCH_API_KEY=ваш_api_ключ \
  -e YANDEX_FOLDER_ID=ваш_folder_id \
  -- npx -y yandex-search-mcp
```

### Примеры использования

После настройки спросите Claude:

**Общий поиск:**
- "Поищи в Яндексе 'лучшие рестораны Москвы'"
- "Найди информацию о 'машинное обучение'"
- "Search for 'buy apartment Moscow'"

**Русскоязычный контент:**
- "Найди информацию о 'история России'"
- "Поищи в Яндексе 'рецепт борща'"
- "Что пишут о 'новости технологий'?"

**С параметрами:**
- "Поищи 'погода' в Московском регионе (region 213)"
- "Найди 'новости' со строгим семейным фильтром"
- "Поищи 'котики' и включи изображения"

### Параметры инструмента

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `query` | string | обязательный | Поисковый запрос |
| `maxResults` | number | 10 | Результатов на странице (1-100) |
| `includeImages` | boolean | false | Включить URL изображений |
| `region` | number | авто | ID региона (например, 213 для Москвы) |
| `page` | number | 0 | Номер страницы для пагинации |
| `familyMode` | string | MODERATE | Фильтр контента: NONE, MODERATE, STRICT |

Онлайн пример: <a href="https://redirekto.ru/seo" target="_blank">AI SEO-Анализ на редиректо.ru</a>

---

## Common Region IDs / Популярные ID регионов

| Region | ID |
|--------|-----|
| Russia / Россия | 225 |
| Moscow / Москва | 213 |
| Saint Petersburg / Санкт-Петербург | 2 |
| Novosibirsk / Новосибирск | 65 |
| Yekaterinburg / Екатеринбург | 54 |
| Kazan / Казань | 43 |

---

## Development

```bash
git clone https://github.com/altrr2/yandex-tools-mcp.git
cd yandex-tools-mcp/packages/yandex-search-mcp
bun install
```

No build step needed.

```bash
bun run lint        # check
bun run lint:fix    # fix issues
bun run format      # format code
```

Test locally:

```bash
YANDEX_SEARCH_API_KEY=key YANDEX_FOLDER_ID=folder node src/index.mjs
```

---

## License

MIT © Alternex
