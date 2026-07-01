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
| `get-high-bounce-pages-organic` | Organic landing pages by bounce rate |
| `get-critical-pages` | Organic pages with >70% bounce |
| `get-bounce-comparison-search-engines` | Bounce by search engine (Yandex vs Google) |
| `get-bounce-by-devices-organic` | Organic bounce by device |
| `get-bounce-device-search-engine` | Bounce by device × search engine |
| `get-page-depth-by-sections` | Engagement depth by site section |
| `get-exit-pages-by-section` | Exits grouped by section |
| `get-entry-exit-paths` | Entry → exit page journeys |
| `get-top-exit-pages-organic` | Where organic traffic exits |
| `get-exit-pages-by-devices` | Exit pages by device |
| `get-conversions-by-search-engine` | Organic conversions by search engine |
| `get-conversions-by-landing-pages` | Organic conversions by landing page |
| `get-conversions-by-search-phrases` | Organic conversions by search phrase |
| `get-conversions-by-devices` | Organic conversions by device |
| `get-conversions-by-regions` | Organic conversions by region |
| `get-conversions-device-region` | Organic conversions by device × region |
| `get-referral-donors-behavior` | Referring domains by behavior/quality |
| `get-referral-full-urls` | Specific referring page URLs |
| `get-quality-referral-traffic` | Low-bounce referring domains |
| `get-referral-conversions` | Conversions from referring domains |
| `get-social-networks-traffic` | Traffic by social network |
| `get-social-networks-quality` | Quality/conversions by social network |
| `get-social-landing-pages` | Landing pages for social traffic |
| `get-new-vs-returning-organic` | New vs returning organic visitors |
| `get-visit-frequency-organic` | Organic visit-frequency distribution |
| `get-demographics-organic` | Organic audience by gender/age |
| `get-audience-interests` | Interests of organic visitors |
| `get-organic-activity-by-hour` | Organic traffic by hour of day |
| `get-organic-activity-by-day-of-week` | Organic traffic by day of week |
| `get-organic-traffic-dynamics` | Daily organic traffic trend |
| `get-organic-seasonality` | Organic traffic by month |
| `get-organic-browsers` | Browsers of organic visitors |
| `get-problematic-os` | OSes with highest organic bounce |
| `get-screen-resolutions` | Screen resolutions of organic visitors |

Conversion tools accept an optional `goal_id` (from `get-goals`); when omitted they report all goals combined. SEO report tools filter to organic search traffic by default.

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
| `get-high-bounce-pages-organic` | Органические страницы входа по отказам |
| `get-critical-pages` | Органические страницы с отказами >70% |
| `get-bounce-comparison-search-engines` | Отказы по поисковикам (Яндекс vs Google) |
| `get-bounce-by-devices-organic` | Органические отказы по устройствам |
| `get-bounce-device-search-engine` | Отказы по устройству × поисковику |
| `get-page-depth-by-sections` | Глубина просмотра по разделам сайта |
| `get-exit-pages-by-section` | Выходы по разделам |
| `get-entry-exit-paths` | Пути вход → выход |
| `get-top-exit-pages-organic` | Где выходит органический трафик |
| `get-exit-pages-by-devices` | Страницы выхода по устройствам |
| `get-conversions-by-search-engine` | Органические конверсии по поисковику |
| `get-conversions-by-landing-pages` | Органические конверсии по странице входа |
| `get-conversions-by-search-phrases` | Органические конверсии по запросу |
| `get-conversions-by-devices` | Органические конверсии по устройству |
| `get-conversions-by-regions` | Органические конверсии по регионам |
| `get-conversions-device-region` | Органические конверсии по устройству × региону |
| `get-referral-donors-behavior` | Домены-доноры по поведению/качеству |
| `get-referral-full-urls` | Конкретные URL страниц-источников |
| `get-quality-referral-traffic` | Домены-доноры с низким отказом |
| `get-referral-conversions` | Конверсии с доменов-доноров |
| `get-social-networks-traffic` | Трафик по соцсетям |
| `get-social-networks-quality` | Качество/конверсии по соцсетям |
| `get-social-landing-pages` | Страницы входа для соцтрафика |
| `get-new-vs-returning-organic` | Новые vs вернувшиеся (органика) |
| `get-visit-frequency-organic` | Частота визитов (органика) |
| `get-demographics-organic` | Пол/возраст органической аудитории |
| `get-audience-interests` | Интересы органических посетителей |
| `get-organic-activity-by-hour` | Органический трафик по часам |
| `get-organic-activity-by-day-of-week` | Органический трафик по дням недели |
| `get-organic-traffic-dynamics` | Дневная динамика органического трафика |
| `get-organic-seasonality` | Органический трафик по месяцам |
| `get-organic-browsers` | Браузеры органических посетителей |
| `get-problematic-os` | ОС с наибольшим отказом (органика) |
| `get-screen-resolutions` | Разрешения экранов органических посетителей |

Инструменты конверсий принимают необязательный `goal_id` (из `get-goals`); без него считаются все цели вместе. SEO-отчёты по умолчанию фильтруют органический поисковый трафик.

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
