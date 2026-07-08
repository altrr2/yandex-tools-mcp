// Shared Yandex Direct API v5 client. Built once in index.mjs (bound to the chosen
// host + token) and passed to every register*Tools() call. Two request helpers:
//   - directRequest(): the standard v5 services (campaigns, ads, keywords, ...),
//     which are POST endpoints with a { method, params } body and return errors
//     *inside* the JSON body even on HTTP 200.
//   - reportRequest(): the separate Reports service, which returns TSV and may
//     reply 201/202 ("report is being prepared") requiring polling.

const SANDBOX_BASE = 'https://api-sandbox.direct.yandex.com/json/v5/';
const LIVE_BASE = 'https://api.direct.yandex.com/json/v5/';

// Account balance is not exposed by v5 — it lives in the older Live v4 JSON API,
// which takes the token in the body rather than an Authorization header.
const LIVE4_SANDBOX = 'https://api-sandbox.direct.yandex.ru/live/v4/json/';
const LIVE4_LIVE = 'https://api.direct.yandex.ru/live/v4/json/';

function getToken() {
  const token = process.env.YANDEX_DIRECT_TOKEN;
  if (!token) {
    throw new Error(
      'YANDEX_DIRECT_TOKEN environment variable is required. Run "npx yandex-direct-mcp auth" to get a token.',
    );
  }
  return token;
}

function baseHeaders() {
  const headers = {
    Authorization: `Bearer ${getToken()}`,
    'Accept-Language': 'en',
    'Content-Type': 'application/json; charset=utf-8',
  };
  // Agency / managed accounts operate on a client account via Client-Login.
  const login = process.env.YANDEX_DIRECT_LOGIN;
  if (login) headers['Client-Login'] = login;
  return headers;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createClient() {
  const live = process.env.YANDEX_DIRECT_LIVE === '1';
  const base = live ? LIVE_BASE : SANDBOX_BASE;

  // Standard v5 service call. Returns the `result` object; throws a readable error
  // for both transport failures and in-body API errors.
  async function directRequest(service, method, params = {}) {
    const response = await fetch(`${base}${service}`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ method, params }),
    });

    const { text, data } = await readJson(response, 'Yandex Direct API error');

    // v5 reports API errors in the body (even with HTTP 200).
    if (data.error) {
      const e = data.error;
      throw new Error(
        `Yandex Direct API error (${e.error_code ?? response.status}): ${e.error_string || ''}${
          e.error_detail ? ` — ${e.error_detail}` : ''
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(`Yandex Direct API error (${response.status}): ${text}`);
    }

    return data.result ?? {};
  }

  // Reports service. `params` is the ReportDefinition (SelectionCriteria, FieldNames,
  // ReportName, ReportType, DateRangeType, ...). Money is requested in real currency
  // units (returnMoneyInMicros:false) so no conversion is needed on the way out.
  // Returns parsed rows: [{ FieldName: value, ... }].
  async function reportRequest(params, { maxAttempts = 10 } = {}) {
    const headers = {
      ...baseHeaders(),
      processingMode: 'auto',
      returnMoneyInMicros: 'false',
      skipReportHeader: 'true',
      skipColumnHeader: 'false',
      skipReportSummary: 'true',
    };
    const body = JSON.stringify({ params: { Format: 'TSV', ...params } });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${base}reports`, { method: 'POST', headers, body });

      if (response.status === 200) {
        return parseTsv(await response.text());
      }

      // 201 = report queued (offline), 202 = report being generated. Poll after retryIn seconds.
      if (response.status === 201 || response.status === 202) {
        const retryIn = Number(response.headers.get('retryIn')) || 5;
        await delay(Math.min(retryIn, 15) * 1000);
        continue;
      }

      const errText = await response.text();
      throw new Error(`Yandex Direct Reports error (${response.status}): ${errText}`);
    }

    throw new Error(`Yandex Direct report not ready after ${maxAttempts} attempts; try a narrower date range.`);
  }

  // Live v4 JSON call — used only where v5 has no equivalent (account balance).
  // Token goes in the body; errors are reported as top-level error_code/error_str.
  async function liveV4Request(method, param = {}) {
    const url = live ? LIVE4_LIVE : LIVE4_SANDBOX;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ method, token: getToken(), param, locale: 'en' }),
    });

    const { text, data } = await readJson(response, 'Yandex Direct Live4 error');

    if (data.error_code || data.error_str) {
      throw new Error(
        `Yandex Direct Live4 error (${data.error_code ?? response.status}): ${data.error_str || ''}${
          data.error_detail ? ` — ${data.error_detail}` : ''
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(`Yandex Direct Live4 error (${response.status}): ${text}`);
    }

    return data.data;
  }

  return { live, directRequest, reportRequest, liveV4Request };
}

// Read a response body as JSON, throwing a labeled error if it isn't parseable.
// Returns both the parsed data and the raw text (the callers reuse the text in
// their own non-parse error branches).
async function readJson(response, label) {
  const text = await response.text();
  try {
    return { text, data: text ? JSON.parse(text) : {} };
  } catch {
    throw new Error(`${label} (${response.status}): ${text || 'unparseable response'}`);
  }
}

// Parse a Direct Reports TSV body (column header on the first line) into row objects.
function parseTsv(tsv) {
  const lines = tsv.trimEnd().split('\n');
  if (!lines[0]) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
  });
}
