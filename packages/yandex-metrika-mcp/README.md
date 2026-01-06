# yandex-metrika-mcp

MCP server for [Yandex Metrika API](https://yandex.com/dev/metrika/) — web analytics, traffic data, and visitor insights.

[![npm version](https://badge.fury.io/js/yandex-metrika-mcp.svg)](https://www.npmjs.com/package/yandex-metrika-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

### Features

- **Traffic analytics** — visits, users, pageviews, bounce rate, session duration
- **Traffic sources** — breakdown by direct, search, social, referral
- **Geography** — visitor countries and cities
- **Devices** — device types, browsers, operating systems
- **Popular pages** — top pages by views
- **Search phrases** — keywords that brought visitors
- **Custom reports** — flexible queries with any dimensions/metrics
- **Counter management** — list counters and goals

### Setup

#### Step 1: Get OAuth Token

**Option A: Quick (manual token)**

1. Go to [Yandex OAuth](https://oauth.yandex.ru/)
2. Create an app with **Metrika API** access (scope: `metrika:read`)
3. Get a debug token from the app settings

**Option B: OAuth flow (recommended)**

1. Create an app at [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)
2. Enable **Yandex Metrica** API access with `metrika:read` scope
3. Set callback URL to `https://oauth.yandex.ru/verification_code`
4. Run the auth helper:

```bash
export YANDEX_CLIENT_ID=your_client_id
export YANDEX_CLIENT_SECRET=your_client_secret
npx yandex-metrika-mcp auth
```

#### Step 2: Configure Claude

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-metrika": {
      "command": "npx",
      "args": ["-y", "yandex-metrika-mcp"],
      "env": {
        "YANDEX_METRIKA_TOKEN": "your_oauth_token"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-metrika \
  -e YANDEX_METRIKA_TOKEN=your_oauth_token \
  -- npx -y yandex-metrika-mcp
```

### Tools

| Tool | Description |
|------|-------------|
| `get-counters` | List all Metrica counters |
| `get-counter` | Get counter details |
| `get-goals` | List counter goals |
| `get-traffic-summary` | Visits, users, pageviews, bounce rate |
| `get-traffic-sources` | Traffic source breakdown |
| `get-geography` | Visitor countries and cities |
| `get-devices` | Device/browser/OS stats |
| `get-popular-pages` | Top pages by views |
| `get-search-phrases` | Search keywords |
| `get-report` | Custom report with any dimensions/metrics |

### Usage Examples

Once configured, ask Claude:

- "Show me traffic for my site last month"
- "What are the top traffic sources?"
- "Which pages get the most views?"
- "Where are my visitors from?"
- "What devices do visitors use?"
- "What search phrases bring traffic?"

---

## Русский

### Возможности

- **Аналитика трафика** — визиты, пользователи, просмотры, отказы, длительность сессии
- **Источники трафика** — разбивка по прямым, поиску, соцсетям, переходам
- **География** — страны и города посетителей
- **Устройства** — типы устройств, браузеры, ОС
- **Популярные страницы** — топ страниц по просмотрам
- **Поисковые фразы** — ключевые слова, приводящие посетителей
- **Кастомные отчёты** — гибкие запросы с любыми измерениями/метриками
- **Управление счётчиками** — список счётчиков и целей

### Настройка

#### Шаг 1: Получите OAuth токен

**Вариант A: Быстрый (ручной токен)**

1. Перейдите на [Yandex OAuth](https://oauth.yandex.ru/)
2. Создайте приложение с доступом к **API Метрики** (scope: `metrika:read`)
3. Получите отладочный токен в настройках приложения

**Вариант B: OAuth поток (рекомендуется)**

1. Создайте приложение на [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)
2. Включите доступ к **Яндекс Метрике** с правом `metrika:read`
3. Укажите callback URL: `https://oauth.yandex.ru/verification_code`
4. Запустите помощник авторизации:

```bash
export YANDEX_CLIENT_ID=ваш_client_id
export YANDEX_CLIENT_SECRET=ваш_client_secret
npx yandex-metrika-mcp auth
```

#### Шаг 2: Настройте Claude

**Claude Desktop** — отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-metrika": {
      "command": "npx",
      "args": ["-y", "yandex-metrika-mcp"],
      "env": {
        "YANDEX_METRIKA_TOKEN": "ваш_oauth_токен"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-metrika \
  -e YANDEX_METRIKA_TOKEN=ваш_oauth_токен \
  -- npx -y yandex-metrika-mcp
```

### Инструменты

| Инструмент | Описание |
|------------|----------|
| `get-counters` | Список счётчиков Метрики |
| `get-counter` | Детали счётчика |
| `get-goals` | Список целей счётчика |
| `get-traffic-summary` | Визиты, пользователи, просмотры, отказы |
| `get-traffic-sources` | Разбивка по источникам трафика |
| `get-geography` | Страны и города посетителей |
| `get-devices` | Статистика устройств/браузеров/ОС |
| `get-popular-pages` | Топ страниц по просмотрам |
| `get-search-phrases` | Поисковые запросы |
| `get-report` | Кастомный отчёт с любыми измерениями/метриками |

### Примеры использования

После настройки спросите Claude:

- "Покажи трафик моего сайта за последний месяц"
- "Какие основные источники трафика?"
- "Какие страницы самые популярные?"
- "Откуда мои посетители?"
- "Какие устройства используют посетители?"
- "По каким поисковым запросам приходят?"

---

## License

MIT
