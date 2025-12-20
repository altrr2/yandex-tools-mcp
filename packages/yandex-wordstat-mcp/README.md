# yandex-wordstat-mcp

MCP server for [Yandex Wordstat API](https://wordstat.yandex.com/) — keyword research and search trend analysis for the Russian market.

[![npm version](https://badge.fury.io/js/yandex-wordstat-mcp.svg)](https://www.npmjs.com/package/yandex-wordstat-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

### Features

| Tool | Description | Quota Cost |
|------|-------------|------------|
| `get-regions-tree` | Get all supported regions with IDs | Free |
| `top-requests` | Popular queries containing a keyword (last 30 days) | 1 unit |
| `dynamics` | Search volume trends over time | 2 units |
| `regions` | Regional distribution of search volume | 2 units |

### Setup

#### Step 1: Create Yandex OAuth App

1. Create a [Yandex ID account](https://passport.yandex.com/) if you don't have one
2. Go to [Yandex OAuth](https://oauth.yandex.com/) and create a new app
3. Under **Platforms**, check "Web services"
4. Under **Data access**, search for `wordstat:api` and add it
5. Click **Create app**
6. Note your **Client ID** and **Client Secret**

#### Step 2: Request API Access

**Important:** You must request access to the Wordstat API separately.

1. Go to [Yandex Wordstat](https://wordstat.yandex.com/)
2. Click on your profile → **API access**
3. Submit a request with your Client ID
4. Wait for approval (usually 1-2 business days)

#### Step 3: Get Your Token

```bash
export YANDEX_CLIENT_ID=your_client_id
export YANDEX_CLIENT_SECRET=your_client_secret

npx yandex-wordstat-mcp auth
```

This will:
1. Open your browser to Yandex authorization page
2. After you authorize, Yandex shows a code
3. Paste the code into the terminal
4. Get your access token

#### Step 4: Configure Claude

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_WORDSTAT_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-wordstat -e YANDEX_WORDSTAT_TOKEN=your_token -- npx -y yandex-wordstat-mcp
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

---

## Русский

### Возможности

| Инструмент | Описание | Расход квоты |
|------------|----------|--------------|
| `get-regions-tree` | Получить все поддерживаемые регионы с ID | Бесплатно |
| `top-requests` | Популярные запросы с ключевым словом (за 30 дней) | 1 единица |
| `dynamics` | Динамика поисковых запросов во времени | 2 единицы |
| `regions` | Региональное распределение запросов | 2 единицы |

### Настройка

#### Шаг 1: Создание OAuth-приложения Яндекса

1. Создайте [Яндекс ID](https://passport.yandex.com/), если у вас его нет
2. Перейдите в [Яндекс OAuth](https://oauth.yandex.com/) и создайте новое приложение
3. В разделе **Платформы** выберите "Веб-сервисы"
4. В разделе **Доступ к данным** найдите `wordstat:api` и добавьте
5. Нажмите **Создать приложение**
6. Сохраните **Client ID** и **Client Secret**

#### Шаг 2: Запрос доступа к API

**Важно:** Необходимо отдельно запросить доступ к API Вордстата.

1. Перейдите на [Яндекс Вордстат](https://wordstat.yandex.com/)
2. Нажмите на профиль → **Доступ к API**
3. Отправьте заявку с вашим Client ID
4. Дождитесь подтверждения (обычно 1-2 рабочих дня)

#### Шаг 3: Получение токена

```bash
export YANDEX_CLIENT_ID=ваш_client_id
export YANDEX_CLIENT_SECRET=ваш_client_secret

npx yandex-wordstat-mcp auth
```

Команда:
1. Откроет браузер на странице авторизации Яндекса
2. После авторизации Яндекс покажет код
3. Вставьте код в терминал
4. Получите токен доступа

#### Шаг 4: Настройка Claude

**Claude Desktop** — отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-wordstat": {
      "command": "npx",
      "args": ["-y", "yandex-wordstat-mcp"],
      "env": {
        "YANDEX_WORDSTAT_TOKEN": "ваш_токен"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-wordstat -e YANDEX_WORDSTAT_TOKEN=ваш_токен -- npx -y yandex-wordstat-mcp
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

---

## API Quotas

Yandex Wordstat API has two quota types:

1. **Total daily quota** — limits total API calls per day
2. **Rate limit** — 10 requests per second (handled automatically)

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
```

Test locally:

```bash
YANDEX_WORDSTAT_TOKEN=your-token node src/index.mjs
```

---

## License

MIT © Alternex
