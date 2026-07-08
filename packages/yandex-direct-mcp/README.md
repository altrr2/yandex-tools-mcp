# yandex-direct-mcp

MCP server for [Yandex Direct API](https://yandex.com/dev/direct/) — PPC campaign management: campaigns, ad groups, ads, keywords, bids, and statistics.

[![npm version](https://badge.fury.io/js/yandex-direct-mcp.svg)](https://www.npmjs.com/package/yandex-direct-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](#english) | [Русский](#русский)

---

## English

> ⚠️ **This server can spend real money.** It defaults to the Yandex Direct **sandbox** environment so setup and testing never touch a live account. Set `YANDEX_DIRECT_LIVE=1` to operate on the real (production) account. Write tools (create/update/manage/set-bids) are clearly flagged in their descriptions.

### Features

- **Campaigns** — list, inspect, create, update, and manage lifecycle (suspend/resume/archive/delete)
- **Ad groups** — list, create, delete, with region targeting
- **Ads** — list and create text ads, manage moderation/lifecycle
- **Keywords & bids** — list with current bids, add keywords, set search/network bids (in account currency), set negative keywords
- **Statistics** — one flexible `get-report` covering any report type, fields, and date range
- **Account** — balance and geo-region reference

### Setup

#### Step 1: Get OAuth Token

1. Create an app at [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)
2. Enable **Yandex Direct** API access (scope: `direct:api`)
3. Set callback URL to `https://oauth.yandex.ru/verification_code`
4. Run the auth helper:

```bash
export YANDEX_CLIENT_ID=your_client_id
export YANDEX_CLIENT_SECRET=your_client_secret
npx yandex-direct-mcp auth
```

The same token works for both the sandbox and production environments.

#### Step 2: Configure Claude

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-direct": {
      "command": "npx",
      "args": ["-y", "yandex-direct-mcp"],
      "env": {
        "YANDEX_DIRECT_TOKEN": "your_oauth_token"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-direct \
  -e YANDEX_DIRECT_TOKEN=your_oauth_token \
  -- npx -y yandex-direct-mcp
```

To operate on a real account, add `-e YANDEX_DIRECT_LIVE=1`. For agency/managed accounts, add `-e YANDEX_DIRECT_LOGIN=client_login`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YANDEX_DIRECT_TOKEN` | yes | OAuth token with Yandex Direct API access |
| `YANDEX_DIRECT_LIVE` | no | Set to `1` to use the production account (real money). Defaults to sandbox. |
| `YANDEX_DIRECT_LOGIN` | no | Client login for agency/managed accounts (`Client-Login` header) |

### Tools

| Tool | Type | Description |
|------|------|-------------|
| `list-campaigns` | read | List campaigns with type, state, status, daily budget |
| `get-campaign` | read | Campaign details by ID |
| `create-campaign` | write | Create a text campaign |
| `update-campaign` | write | Update campaign name / daily budget |
| `manage-campaign` | write | Suspend/resume/archive/unarchive/delete a campaign |
| `list-adgroups` | read | List ad groups (optionally by campaign) |
| `create-adgroup` | write | Create an ad group with region targeting |
| `delete-adgroup` | write | Delete an ad group |
| `list-ads` | read | List ads with text and moderation status |
| `create-text-ad` | write | Create a text ad in an ad group |
| `manage-ad` | write | Moderate/suspend/resume/archive/unarchive/delete an ad |
| `list-keywords` | read | List keywords with current search/network bids |
| `add-keywords` | write | Add keywords to an ad group |
| `set-bids` | write | Set search/network bids on keywords (in account currency) |
| `set-negative-keywords` | write | Set negative keywords on a campaign or ad group |
| `get-report` | read | Flexible statistics: any report type, fields, and date range |
| `get-balance` | read | Account balance and currency |
| `get-regions` | read | Geo-region IDs for targeting |

Bids and budgets are given in account currency (e.g. rubles) and converted to Yandex's micro-units automatically.

### Usage Examples

Once configured, ask Claude:

- "List my Direct campaigns and their budgets"
- "Create a sandbox campaign named 'Summer Sale' with a 500 daily budget"
- "Add these keywords to ad group 12345 and set bids to 15"
- "Show me clicks, cost, and CTR by campaign for last month"
- "What's my account balance?"

---

## Русский

> ⚠️ **Этот сервер может тратить реальные деньги.** По умолчанию он работает в **песочнице** Yandex Direct, поэтому настройка и тесты не затрагивают боевой аккаунт. Установите `YANDEX_DIRECT_LIVE=1`, чтобы работать с реальным (боевым) аккаунтом. Инструменты записи (create/update/manage/set-bids) явно помечены в описаниях.

### Возможности

- **Кампании** — список, детали, создание, обновление, управление статусом (пауза/возобновление/архив/удаление)
- **Группы объявлений** — список, создание, удаление, с таргетингом по регионам
- **Объявления** — список и создание текстовых объявлений, управление модерацией/статусом
- **Ключевые фразы и ставки** — список с текущими ставками, добавление фраз, установка ставок на поиске/в сетях (в валюте аккаунта), минус-фразы
- **Статистика** — один гибкий `get-report` с любым типом отчёта, полями и диапазоном дат
- **Аккаунт** — баланс и справочник регионов

### Настройка

#### Шаг 1: Получите OAuth токен

1. Создайте приложение на [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)
2. Включите доступ к **API Яндекс Директа** (scope: `direct:api`)
3. Укажите callback URL: `https://oauth.yandex.ru/verification_code`
4. Запустите помощник авторизации:

```bash
export YANDEX_CLIENT_ID=ваш_client_id
export YANDEX_CLIENT_SECRET=ваш_client_secret
npx yandex-direct-mcp auth
```

Один и тот же токен работает и в песочнице, и в боевом окружении.

#### Шаг 2: Настройте Claude

**Claude Desktop** — отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) или `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yandex-direct": {
      "command": "npx",
      "args": ["-y", "yandex-direct-mcp"],
      "env": {
        "YANDEX_DIRECT_TOKEN": "ваш_oauth_токен"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add yandex-direct \
  -e YANDEX_DIRECT_TOKEN=ваш_oauth_токен \
  -- npx -y yandex-direct-mcp
```

Для работы с боевым аккаунтом добавьте `-e YANDEX_DIRECT_LIVE=1`. Для агентских/управляемых аккаунтов добавьте `-e YANDEX_DIRECT_LOGIN=логин_клиента`.

### Переменные окружения

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `YANDEX_DIRECT_TOKEN` | да | OAuth токен с доступом к API Яндекс Директа |
| `YANDEX_DIRECT_LIVE` | нет | Установите `1` для боевого аккаунта (реальные деньги). По умолчанию — песочница. |
| `YANDEX_DIRECT_LOGIN` | нет | Логин клиента для агентских аккаунтов (заголовок `Client-Login`) |

### Инструменты

| Инструмент | Тип | Описание |
|------------|-----|----------|
| `list-campaigns` | чтение | Список кампаний с типом, статусом, дневным бюджетом |
| `get-campaign` | чтение | Детали кампании по ID |
| `create-campaign` | запись | Создать текстовую кампанию |
| `update-campaign` | запись | Обновить название / дневной бюджет |
| `manage-campaign` | запись | Пауза/возобновление/архив/удаление кампании |
| `list-adgroups` | чтение | Список групп объявлений (можно по кампании) |
| `create-adgroup` | запись | Создать группу объявлений с таргетингом по регионам |
| `delete-adgroup` | запись | Удалить группу объявлений |
| `list-ads` | чтение | Список объявлений с текстом и статусом модерации |
| `create-text-ad` | запись | Создать текстовое объявление в группе |
| `manage-ad` | запись | Модерация/пауза/возобновление/архив/удаление объявления |
| `list-keywords` | чтение | Список ключевых фраз с текущими ставками |
| `add-keywords` | запись | Добавить ключевые фразы в группу |
| `set-bids` | запись | Установить ставки на поиске/в сетях (в валюте аккаунта) |
| `set-negative-keywords` | запись | Установить минус-фразы на кампанию или группу |
| `get-report` | чтение | Гибкая статистика: любой тип отчёта, поля и диапазон дат |
| `get-balance` | чтение | Баланс и валюта аккаунта |
| `get-regions` | чтение | ID регионов для таргетинга |

Ставки и бюджеты указываются в валюте аккаунта (например, в рублях) и автоматически конвертируются в микро-единицы Яндекса.

### Примеры использования

После настройки спросите Claude:

- "Покажи мои кампании в Директе и их бюджеты"
- "Создай в песочнице кампанию 'Летняя распродажа' с дневным бюджетом 500"
- "Добавь эти ключевые фразы в группу 12345 и установи ставки 15"
- "Покажи клики, расход и CTR по кампаниям за прошлый месяц"
- "Какой у меня баланс?"

---

## License

MIT
