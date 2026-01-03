# yandex-webmaster-mcp

MCP server for [Yandex Webmaster API](https://yandex.com/dev/webmaster/doc/en/) — site analytics, indexing status, search queries, and SEO diagnostics.

[![npm version](https://img.shields.io/npm/v/yandex-webmaster-mcp)](https://www.npmjs.com/package/yandex-webmaster-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

### Features

| Tool | Description |
|------|-------------|
| `get-user` | Get authenticated user ID |
| `list-hosts` | List all sites in Webmaster |
| `get-host` | Get site information and status |
| `get-summary` | Site statistics (SQI, indexed pages, problems) |
| `get-sqi-history` | Site Quality Index history |
| `get-diagnostics` | Site health diagnostics |
| `get-popular-queries` | Popular search queries (shows, clicks, positions) |
| `get-query-history` | Aggregated query statistics over time |
| `get-indexing-history` | Pages downloaded by robot (by HTTP status) |
| `get-indexing-samples` | Examples of downloaded pages |
| `get-insearch-history` | Pages in search results over time |
| `get-insearch-samples` | Examples of pages in search |
| `get-search-events-history` | Pages added/removed from search |
| `get-search-events-samples` | Examples of search events |
| `get-external-links` | Backlinks pointing to the site |
| `get-external-links-history` | Backlinks count over time |
| `get-broken-internal-links` | Broken internal links |
| `get-broken-internal-links-history` | Broken links count over time |
| `get-sitemaps` | Auto-detected sitemap files |
| `get-sitemap` | Specific sitemap details |
| `get-user-sitemaps` | User-added sitemaps |
| `get-important-urls` | Monitored important pages |
| `get-important-url-history` | Important page change history |
| `get-recrawl-quota` | Reindexing quota status |

### Installation

#### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

### Getting an OAuth Token

Follow the [official Yandex Webmaster OAuth guide](https://yandex.com/dev/webmaster/doc/en/tasks/how-to-get-oauth) or these steps:

#### Step 1: Create an OAuth Application

1. Go to [Yandex OAuth app registration](https://oauth.yandex.ru/client/new)
2. Create an application:
   - Select platform: **Web services** (Веб-сервисы)
   - Set Redirect URI to: `https://oauth.yandex.ru/verification_code`
   - Under "Data access", enable these scopes:
     - `webmaster:hostinfo` — access to site statistics
     - `webmaster:verify` — access to site verification
3. Save the application and copy your **ClientID** (and **Client secret** for auth command)

#### Step 2: Get a Token

**Option A: Using the auth command**

```bash
export YANDEX_CLIENT_ID=your_client_id
export YANDEX_CLIENT_SECRET=your_client_secret

npx yandex-webmaster-mcp auth
```

**Option B: Manual token retrieval**

Open this URL in your browser (replace `<ClientID>` with your actual ID):
```
https://oauth.yandex.ru/authorize?response_type=token&client_id=<ClientID>
```
Authorize and copy the token from the resulting page.

#### Step 3: Configure

Set the token as `YANDEX_WEBMASTER_TOKEN` environment variable.

> **Note:** Tokens are valid for 6 months. Repeat Step 2 to get a new token when it expires.

### Usage Examples

**List your sites:**
```
"Show me all my sites in Yandex Webmaster"
```

**Get site statistics:**
```
"What's the SQI and indexing status for example.com?"
```

**Analyze search queries:**
```
"What are the top search queries bringing traffic to my site?"
```

**Check backlinks:**
```
"Show me external links pointing to my site"
```

**Site diagnostics:**
```
"Are there any SEO problems detected for my site?"
```

---

## Русский

### Возможности

| Инструмент | Описание |
|------------|----------|
| `get-user` | Получить ID пользователя |
| `list-hosts` | Список всех сайтов в Вебмастере |
| `get-host` | Информация о сайте |
| `get-summary` | Статистика сайта (ИКС, индексация, проблемы) |
| `get-sqi-history` | История изменения ИКС |
| `get-diagnostics` | Диагностика проблем сайта |
| `get-popular-queries` | Популярные поисковые запросы |
| `get-query-history` | История статистики запросов |
| `get-indexing-history` | История загрузки страниц роботом |
| `get-indexing-samples` | Примеры загруженных страниц |
| `get-insearch-history` | История страниц в поиске |
| `get-insearch-samples` | Примеры страниц в поиске |
| `get-search-events-history` | История добавления/удаления из поиска |
| `get-search-events-samples` | Примеры изменений в поиске |
| `get-external-links` | Внешние ссылки на сайт |
| `get-external-links-history` | История количества внешних ссылок |
| `get-broken-internal-links` | Битые внутренние ссылки |
| `get-broken-internal-links-history` | История битых ссылок |
| `get-sitemaps` | Обнаруженные файлы Sitemap |
| `get-sitemap` | Детали конкретного Sitemap |
| `get-user-sitemaps` | Добавленные пользователем Sitemap |
| `get-important-urls` | Мониторинг важных страниц |
| `get-important-url-history` | История изменений важных страниц |
| `get-recrawl-quota` | Квота на переобход |

### Установка

#### Claude Desktop

Добавьте в конфигурацию Claude Desktop:

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

### Получение OAuth токена

Следуйте [официальной инструкции Яндекса](https://yandex.com/dev/webmaster/doc/ru/tasks/how-to-get-oauth) или этим шагам:

#### Шаг 1: Создание OAuth-приложения

1. Перейдите на [страницу регистрации приложения](https://oauth.yandex.ru/client/new)
2. Создайте приложение:
   - Выберите платформу: **Веб-сервисы**
   - Укажите Redirect URI: `https://oauth.yandex.ru/verification_code`
   - В разделе "Доступ к данным" включите:
     - `webmaster:hostinfo` — доступ к статистике сайтов
     - `webmaster:verify` — доступ к верификации сайтов
3. Сохраните приложение и скопируйте **ClientID** (и **Client secret** для команды auth)

#### Шаг 2: Получение токена

**Вариант А: Через команду auth**

```bash
export YANDEX_CLIENT_ID=your_client_id
export YANDEX_CLIENT_SECRET=your_client_secret

npx yandex-webmaster-mcp auth
```

**Вариант Б: Вручную**

Откройте в браузере (замените `<ClientID>` на ваш ID):
```
https://oauth.yandex.ru/authorize?response_type=token&client_id=<ClientID>
```
Авторизуйтесь и скопируйте токен со страницы результата.

#### Шаг 3: Настройка

Установите токен в переменную окружения `YANDEX_WEBMASTER_TOKEN`.

> **Примечание:** Токен действителен 6 месяцев. Для получения нового повторите шаг 2.

### Примеры использования

**Список сайтов:**
```
"Покажи все мои сайты в Яндекс.Вебмастере"
```

**Статистика сайта:**
```
"Какой ИКС и статус индексации у example.com?"
```

**Анализ запросов:**
```
"Какие поисковые запросы приводят трафик на мой сайт?"
```

**Проверка ссылок:**
```
"Покажи внешние ссылки на мой сайт"
```

**Диагностика:**
```
"Есть ли какие-то SEO проблемы на моем сайте?"
```

---

## License

MIT
