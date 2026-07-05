#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Handle CLI commands
const command = process.argv[2];
if (command === 'auth') {
  const { runAuth } = await import('./auth.mjs');
  await runAuth();
} else {
  await runServer();
}

async function runServer() {
  const BASE_URL = process.env.YANDEX_WEBMASTER_BASE_URL || 'https://api.webmaster.yandex.net/v4';

  // Cache user_id for the session
  let cachedUserId = null;

  function getToken() {
    const token = process.env.YANDEX_WEBMASTER_TOKEN;
    if (!token) {
      throw new Error(
        'YANDEX_WEBMASTER_TOKEN environment variable is required. Run "npx yandex-webmaster-mcp auth" to get a token.',
      );
    }
    return token;
  }

  async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `OAuth ${getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webmaster API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Get user ID (cached)
  async function getUserId() {
    if (!cachedUserId) {
      const data = await apiRequest('/user');
      cachedUserId = data.user_id;
    }
    return cachedUserId;
  }

  // Helper to build host endpoint
  async function hostEndpoint(hostId, path = '') {
    const userId = await getUserId();
    return `/user/${userId}/hosts/${encodeURIComponent(hostId)}${path}`;
  }

  // Format date for API
  function formatDate(date) {
    if (!date) return undefined;
    return new Date(date).toISOString();
  }

  // Static reference of common Yandex geo region IDs. Used for the region_ids
  // parameter of query-analytics and feeds tools. Yandex has thousands of
  // regions; this is a curated shortlist of the most commonly used ones.
  const REGION_IDS = [
    { id: 225, name: 'Russia' },
    { id: 213, name: 'Moscow' },
    { id: 2, name: 'Saint Petersburg' },
    { id: 1, name: 'Moscow and Moscow Oblast' },
    { id: 10174, name: 'Saint Petersburg and Leningrad Oblast' },
    { id: 65, name: 'Novosibirsk' },
    { id: 54, name: 'Yekaterinburg' },
    { id: 47, name: 'Nizhny Novgorod' },
    { id: 43, name: 'Kazan' },
    { id: 56, name: 'Chelyabinsk' },
    { id: 51, name: 'Samara' },
    { id: 66, name: 'Omsk' },
    { id: 39, name: 'Rostov-on-Don' },
    { id: 172, name: 'Ufa' },
    { id: 35, name: 'Krasnodar' },
    { id: 62, name: 'Krasnoyarsk' },
    { id: 193, name: 'Voronezh' },
    { id: 63, name: 'Volgograd' },
    { id: 187, name: 'Ukraine' },
    { id: 143, name: 'Kyiv' },
    { id: 149, name: 'Belarus' },
    { id: 157, name: 'Minsk' },
    { id: 159, name: 'Kazakhstan' },
    { id: 162, name: 'Almaty' },
    { id: 10393, name: 'Nur-Sultan (Astana)' },
    { id: 983, name: 'Uzbekistan' },
    { id: 10295, name: 'Armenia' },
    { id: 10277, name: 'Azerbaijan' },
    { id: 20544, name: 'Georgia' },
    { id: 207, name: 'Kyrgyzstan' },
  ];

  // Static reference of regions available for YML feed uploads (feeds tools).
  // Per the Yandex docs, feeds only support Russia (225, the default) and the
  // Russian regions below — there is no API endpoint for this list.
  // Source: https://yandex.com/dev/webmaster/doc/en/reference/feeds-regions
  const FEED_REGIONS = [
    { id: 225, name: 'Россия (default)' },
    { id: 20, name: 'Архангельск' },
    { id: 37, name: 'Астрахань' },
    { id: 197, name: 'Барнаул' },
    { id: 4, name: 'Белгород' },
    { id: 77, name: 'Благовещенск' },
    { id: 191, name: 'Брянск' },
    { id: 24, name: 'Великий Новгород' },
    { id: 75, name: 'Владивосток' },
    { id: 33, name: 'Владикавказ' },
    { id: 192, name: 'Владимир' },
    { id: 38, name: 'Волгоград' },
    { id: 21, name: 'Вологда' },
    { id: 193, name: 'Воронеж' },
    { id: 1106, name: 'Грозный' },
    { id: 54, name: 'Екатеринбург' },
    { id: 5, name: 'Иваново' },
    { id: 63, name: 'Иркутск' },
    { id: 41, name: 'Йошкар-Ола' },
    { id: 43, name: 'Казань' },
    { id: 22, name: 'Калининград' },
    { id: 64, name: 'Кемерово' },
    { id: 7, name: 'Кострома' },
    { id: 35, name: 'Краснодар' },
    { id: 62, name: 'Красноярск' },
    { id: 53, name: 'Курган' },
    { id: 8, name: 'Курск' },
    { id: 9, name: 'Липецк' },
    { id: 28, name: 'Махачкала' },
    { id: 1, name: 'Москва и Московская область' },
    { id: 213, name: 'Москва' },
    { id: 1092, name: 'Назрань' },
    { id: 30, name: 'Нальчик' },
    { id: 47, name: 'Нижний Новгород' },
    { id: 65, name: 'Новосибирск' },
    { id: 66, name: 'Омск' },
    { id: 10, name: 'Орел' },
    { id: 48, name: 'Оренбург' },
    { id: 49, name: 'Пенза' },
    { id: 50, name: 'Пермь' },
    { id: 25, name: 'Псков' },
    { id: 39, name: 'Ростов-на-Дону' },
    { id: 11, name: 'Рязань' },
    { id: 51, name: 'Самара' },
    { id: 2, name: 'Санкт-Петербург' },
    { id: 42, name: 'Саранск' },
    { id: 12, name: 'Смоленск' },
    { id: 239, name: 'Сочи' },
    { id: 36, name: 'Ставрополь' },
    { id: 973, name: 'Сургут' },
    { id: 13, name: 'Тамбов' },
    { id: 14, name: 'Тверь' },
    { id: 67, name: 'Томск' },
    { id: 15, name: 'Тула' },
    { id: 195, name: 'Ульяновск' },
    { id: 172, name: 'Уфа' },
    { id: 76, name: 'Хабаровск' },
    { id: 45, name: 'Чебоксары' },
    { id: 56, name: 'Челябинск' },
    { id: 1104, name: 'Черкесск' },
    { id: 16, name: 'Ярославль' },
  ];

  const server = new McpServer({ name: 'yandex-webmaster', version: '1.0.0' });

  // ============ Core Tools ============

  server.registerTool(
    'get-user',
    {
      title: 'Get User ID',
      description: 'Returns the authenticated user ID. This ID is required for all other API calls.',
      inputSchema: {},
    },
    async () => {
      const userId = await getUserId();
      return {
        content: [{ type: 'text', text: `User ID: ${userId}` }],
        structuredContent: { user_id: userId },
      };
    },
  );

  server.registerTool(
    'list-hosts',
    {
      title: 'List Sites',
      description: 'Returns the list of sites added by the user to Yandex Webmaster.',
      inputSchema: {},
    },
    async () => {
      const userId = await getUserId();
      const data = await apiRequest(`/user/${userId}/hosts`);

      const summary = data.hosts
        .map((h) => `- ${h.unicode_host_url || h.ascii_host_url} (verified: ${h.verified}, id: ${h.host_id})`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Found ${data.hosts.length} sites:\n\n${summary}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-host',
    {
      title: 'Get Site Info',
      description: 'Returns detailed information about a specific site.',
      inputSchema: {
        host_id: z.string().describe('Site identifier (e.g., "https:example.com:443")'),
      },
    },
    async ({ host_id }) => {
      const endpoint = await hostEndpoint(host_id);
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `Site: ${data.unicode_host_url || data.ascii_host_url}\nStatus: ${data.host_data_status}\nVerified: ${data.verified}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-region-ids',
    {
      title: 'Get Region IDs Reference',
      description:
        'Returns a static reference list of common Yandex geo region IDs (with names) for use in the region_ids parameter of get-query-analytics and feeds tools. No API call is made.',
      inputSchema: {},
    },
    async () => {
      const text = REGION_IDS.map((r) => `- ${r.id}: ${r.name}`).join('\n');
      return {
        content: [{ type: 'text', text: `Common Yandex region IDs:\n\n${text}` }],
        structuredContent: { regions: REGION_IDS },
      };
    },
  );

  // ============ Statistics & Summary ============

  server.registerTool(
    'get-summary',
    {
      title: 'Get Site Summary',
      description:
        'Returns general site statistics including SQI, indexed pages count, excluded pages, and problem counts.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
      },
    },
    async ({ host_id }) => {
      const endpoint = await hostEndpoint(host_id, '/summary');
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `Site Summary:\n- SQI: ${data.sqi}\n- Searchable pages: ${data.searchable_pages_count}\n- Excluded pages: ${data.excluded_pages_count}\n- Problems: Fatal=${data.site_problems?.FATAL || 0}, Critical=${data.site_problems?.CRITICAL || 0}, Possible=${data.site_problems?.POSSIBLE_PROBLEM || 0}, Recommendations=${data.site_problems?.RECOMMENDATION || 0}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-sqi-history',
    {
      title: 'Get SQI History',
      description: 'Returns the history of Site Quality Index (SQI) changes over time.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/sqi-history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const points = data.points || [];
      const text = points.length
        ? points.map((p) => `${p.date.split('T')[0]}: SQI ${p.value}`).join('\n')
        : 'No SQI history available';

      return {
        content: [{ type: 'text', text: `SQI History (${points.length} points):\n\n${text}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Diagnostics ============

  server.registerTool(
    'get-diagnostics',
    {
      title: 'Get Site Diagnostics',
      description:
        'Returns site diagnostics with detected problems categorized by severity (fatal, critical, possible, recommendation).',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
      },
    },
    async ({ host_id }) => {
      const endpoint = await hostEndpoint(host_id, '/diagnostics');
      const data = await apiRequest(endpoint);

      const problems = data.problems || {};
      const lines = Object.entries(problems).map(
        ([key, val]) =>
          `- ${key}: ${val.severity} (${val.state}) - last updated: ${val.last_state_update?.split('T')[0] || 'N/A'}`,
      );

      return {
        content: [
          {
            type: 'text',
            text: lines.length ? `Diagnostics:\n\n${lines.join('\n')}` : 'No diagnostic issues detected.',
          },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ Search Queries ============

  server.registerTool(
    'get-popular-queries',
    {
      title: 'Get Popular Queries',
      description: 'Returns popular search queries that brought users to the site, sorted by shows or clicks.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        order_by: z.enum(['TOTAL_SHOWS', 'TOTAL_CLICKS']).describe('Sort by shows or clicks'),
        device_type: z
          .enum(['ALL', 'DESKTOP', 'MOBILE', 'TABLET', 'MOBILE_AND_TABLET'])
          .optional()
          .describe('Device filter (default: ALL)'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(500).optional().describe('Number of results (default: 100, max: 500)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, order_by, device_type, date_from, date_to, limit = 100, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/search-queries/popular');
      const params = new URLSearchParams();
      params.set('order_by', order_by);
      params.set('query_indicator', 'TOTAL_SHOWS');
      params.append('query_indicator', 'TOTAL_CLICKS');
      params.append('query_indicator', 'AVG_SHOW_POSITION');
      params.append('query_indicator', 'AVG_CLICK_POSITION');
      if (device_type) params.set('device_type_indicator', device_type);
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const queries = data.queries || [];
      const summary = queries
        .slice(0, 20)
        .map(
          (q, i) =>
            `${i + 1}. "${q.query_text}" - shows: ${q.indicators?.TOTAL_SHOWS || 0}, clicks: ${q.indicators?.TOTAL_CLICKS || 0}, avg pos: ${q.indicators?.AVG_SHOW_POSITION?.toFixed(1) || 'N/A'}`,
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Popular queries (${data.count} total, showing top ${Math.min(20, queries.length)}):\n\n${summary}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-query-history',
    {
      title: 'Get All Queries History',
      description: 'Returns aggregated search query statistics over time (shows, clicks, positions).',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        device_type: z
          .enum(['ALL', 'DESKTOP', 'MOBILE', 'TABLET', 'MOBILE_AND_TABLET'])
          .optional()
          .describe('Device filter (default: ALL)'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, device_type, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/search-queries/all/history');
      const params = new URLSearchParams();
      params.set('query_indicator', 'TOTAL_SHOWS');
      params.append('query_indicator', 'TOTAL_CLICKS');
      params.append('query_indicator', 'AVG_SHOW_POSITION');
      if (device_type) params.set('device_type_indicator', device_type);
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const shows = data.indicators?.TOTAL_SHOWS || [];
      const text = shows
        .slice(-14)
        .map((p) => `${p.date.split('T')[0]}: ${p.value.toLocaleString()} shows`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Query history (last 14 days shown):\n\n${text}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-single-query-history',
    {
      title: 'Get Single Query History',
      description:
        'Returns statistics over time (shows, clicks, positions) for one specific search query. Use get-popular-queries to obtain a query_id.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        query_id: z.string().describe('Search query identifier (from get-popular-queries)'),
        device_type: z
          .enum(['ALL', 'DESKTOP', 'MOBILE', 'TABLET', 'MOBILE_AND_TABLET'])
          .optional()
          .describe('Device filter (default: ALL)'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, query_id, device_type, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, `/search-queries/${encodeURIComponent(query_id)}/history`);
      const params = new URLSearchParams();
      params.set('query_indicator', 'TOTAL_SHOWS');
      params.append('query_indicator', 'TOTAL_CLICKS');
      params.append('query_indicator', 'AVG_SHOW_POSITION');
      if (device_type) params.set('device_type_indicator', device_type);
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const shows = data.indicators?.TOTAL_SHOWS || [];
      const text = shows
        .slice(-14)
        .map((p) => `${p.date.split('T')[0]}: ${p.value.toLocaleString()} shows`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Query history (last 14 days shown):\n\n${text || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-query-analytics',
    {
      title: 'Get Query Analytics',
      description:
        'Returns the query↔URL intersection report (last ~2 weeks) with shows, clicks, CTR and positions, grouped by URL or query. Supports device, region and custom filters. Note: this endpoint is not part of the public API reference index.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        text_indicator: z
          .enum(['URL', 'QUERY'])
          .optional()
          .describe('Group results by URL or by query text (default: URL)'),
        device_type_indicator: z
          .enum(['ALL', 'DESKTOP', 'MOBILE', 'TABLET', 'MOBILE_AND_TABLET'])
          .optional()
          .describe('Device filter (default: ALL)'),
        region_ids: z.array(z.number()).optional().describe('Filter by Yandex region IDs (see get-region-ids)'),
        limit: z.number().min(1).max(500).optional().describe('Number of rows (default: 20)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
        filters: z.record(z.any()).optional().describe('Optional API filters object (advanced, passed through as-is)'),
        sort_by_date: z
          .record(z.any())
          .optional()
          .describe('Optional sort_by_date object (advanced, passed through as-is)'),
      },
    },
    async ({ host_id, text_indicator, device_type_indicator, region_ids, limit, offset, filters, sort_by_date }) => {
      const endpoint = await hostEndpoint(host_id, '/query-analytics/list');
      const body = {
        text_indicator: text_indicator || 'URL',
        device_type_indicator: device_type_indicator || 'ALL',
        limit: limit ?? 20,
        offset: offset ?? 0,
      };
      if (region_ids) body.region_ids = region_ids;
      if (filters) body.filters = filters;
      if (sort_by_date) body.sort_by_date = sort_by_date;

      const data = await apiRequest(endpoint, { method: 'POST', body });

      const rows = data.text_indicator_to_statistics || data.rows || [];
      return {
        content: [
          {
            type: 'text',
            text: `Query analytics retrieved (${Array.isArray(rows) ? rows.length : 0} rows). See structuredContent for details.`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ Indexing ============

  server.registerTool(
    'get-indexing-history',
    {
      title: 'Get Indexing History',
      description:
        'Returns the history of pages downloaded by the robot, grouped by HTTP status codes (2xx, 3xx, 4xx, 5xx).',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/indexing/history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const indicators = data.indicators || {};
      const summary = Object.entries(indicators)
        .map(([code, points]) => {
          const latest = points[points.length - 1];
          return `${code}: ${latest?.value || 0} pages (as of ${latest?.date?.split('T')[0] || 'N/A'})`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: `Indexing history by HTTP status:\n\n${summary}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-indexing-samples',
    {
      title: 'Get Downloaded Pages Samples',
      description: 'Returns examples of pages downloaded by the robot.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of samples (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/indexing/samples');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const samples = data.samples || [];
      const text = samples
        .map((s) => `- ${s.url} (${s.http_code}) - ${s.access_date?.split('T')[0] || 'N/A'}`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Downloaded pages (${data.count} total):\n\n${text || 'No samples'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-insearch-history',
    {
      title: 'Get Pages In Search History',
      description: 'Returns the history of pages appearing in search results over time.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/search-urls/in-search/history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const points = data.history || [];
      const text = points
        .slice(-14)
        .map((p) => `${p.date.split('T')[0]}: ${p.value.toLocaleString()} pages in search`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Pages in search (last 14 days):\n\n${text || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-insearch-samples',
    {
      title: 'Get Pages In Search Samples',
      description: 'Returns examples of pages currently appearing in search results.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of samples (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/search-urls/in-search/samples');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const samples = data.samples || [];
      const text = samples.map((s) => `- ${s.url}`).join('\n');

      return {
        content: [{ type: 'text', text: `Pages in search (${data.count} total):\n\n${text || 'No samples'}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Search Events ============

  server.registerTool(
    'get-search-events-history',
    {
      title: 'Get Search Events History',
      description: 'Returns the history of pages added to or removed from search results.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/search-urls/events/history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      return {
        content: [{ type: 'text', text: `Search events history retrieved.` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-search-events-samples',
    {
      title: 'Get Search Events Samples',
      description: 'Returns examples of pages that recently appeared in or were removed from search.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        event_type: z.enum(['APPEARED', 'REMOVED']).describe('Event type to filter'),
        limit: z.number().min(1).max(100).optional().describe('Number of samples (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, event_type, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/search-urls/events/samples');
      const params = new URLSearchParams();
      params.set('event_type', event_type);
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const samples = data.samples || [];
      const text = samples.map((s) => `- ${s.url} (${s.event_date?.split('T')[0] || 'N/A'})`).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Pages ${event_type.toLowerCase()} (${data.count} total):\n\n${text || 'No samples'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ Links ============

  server.registerTool(
    'get-external-links',
    {
      title: 'Get External Links (Backlinks)',
      description: 'Returns examples of external links pointing to the site (backlinks).',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of samples (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/links/external/samples');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const links = data.links || [];
      const text = links
        .map((l) => `- ${l.source_url} -> ${l.destination_url} (found: ${l.discovery_date || 'N/A'})`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `External links (${data.count} total):\n\n${text || 'No backlinks found'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-external-links-history',
    {
      title: 'Get External Links History',
      description: 'Returns the history of external links count over time.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/links/external/history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const points = data.history || [];
      const text = points
        .slice(-14)
        .map((p) => `${p.date.split('T')[0]}: ${p.value.toLocaleString()} backlinks`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `External links history:\n\n${text || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-broken-internal-links',
    {
      title: 'Get Broken Internal Links',
      description: 'Returns examples of broken internal links on the site.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of samples (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/links/internal/broken/samples');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const links = data.links || [];
      const text = links.map((l) => `- ${l.source_url} -> ${l.destination_url} (${l.status || 'broken'})`).join('\n');

      return {
        content: [
          { type: 'text', text: `Broken internal links (${data.count} total):\n\n${text || 'No broken links'}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-broken-internal-links-history',
    {
      title: 'Get Broken Internal Links History',
      description: 'Returns the history of broken internal links count over time.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/links/internal/broken/history');
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      if (params.toString()) endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const points = data.history || [];
      const text = points
        .slice(-14)
        .map((p) => `${p.date.split('T')[0]}: ${p.value} broken links`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Broken internal links history:\n\n${text || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Sitemaps ============

  server.registerTool(
    'get-sitemaps',
    {
      title: 'Get Sitemaps',
      description: 'Returns the list of sitemap files detected for the site.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ host_id, limit = 10 }) => {
      let endpoint = await hostEndpoint(host_id, '/sitemaps');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const sitemaps = data.sitemaps || [];
      const text = sitemaps
        .map(
          (s) =>
            `- ${s.sitemap_url}\n  Type: ${s.sitemap_type}, URLs: ${s.urls_count}, Errors: ${s.errors_count}, Sources: ${(s.sources || []).join(', ')}`,
        )
        .join('\n');

      return {
        content: [{ type: 'text', text: `Sitemaps:\n\n${text || 'No sitemaps found'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-sitemap',
    {
      title: 'Get Sitemap Info',
      description: 'Returns detailed information about a specific sitemap file.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        sitemap_id: z.string().describe('Sitemap identifier'),
      },
    },
    async ({ host_id, sitemap_id }) => {
      const endpoint = await hostEndpoint(host_id, `/sitemaps/${encodeURIComponent(sitemap_id)}`);
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `Sitemap: ${data.sitemap_url}\nType: ${data.sitemap_type}\nURLs: ${data.urls_count}\nErrors: ${data.errors_count}\nLast accessed: ${data.last_access_date?.split('T')[0] || 'N/A'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-user-sitemaps',
    {
      title: 'Get User-Added Sitemaps',
      description: 'Returns the list of sitemap files manually added by the user.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ host_id, limit = 10 }) => {
      let endpoint = await hostEndpoint(host_id, '/user-added-sitemaps');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const sitemaps = data.sitemaps || [];
      const text = sitemaps
        .map((s) => `- ${s.sitemap_url} (URLs: ${s.urls_count}, Errors: ${s.errors_count})`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `User-added sitemaps:\n\n${text || 'No user-added sitemaps'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-user-sitemap',
    {
      title: 'Get User-Added Sitemap Info',
      description: 'Returns detailed information about a single sitemap file that was manually added by the user.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        sitemap_id: z.string().describe('User-added sitemap identifier (from get-user-sitemaps)'),
      },
    },
    async ({ host_id, sitemap_id }) => {
      const endpoint = await hostEndpoint(host_id, `/user-added-sitemaps/${encodeURIComponent(sitemap_id)}`);
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `User-added sitemap: ${data.sitemap_url}\nAdded: ${data.added_date?.split('T')[0] || 'N/A'}\nURLs: ${data.urls_count ?? 'N/A'}\nErrors: ${data.errors_count ?? 'N/A'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ Important URLs ============

  server.registerTool(
    'get-important-urls',
    {
      title: 'Get Important URLs',
      description: 'Returns the list of important pages being monitored.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/important-urls');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const urls = data.urls || [];
      const text = urls.map((u) => `- ${u.url} (status: ${u.indexing_status || 'N/A'})`).join('\n');

      return {
        content: [{ type: 'text', text: `Important URLs (${data.count} total):\n\n${text || 'No important URLs'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-important-url-history',
    {
      title: 'Get Important URL History',
      description: 'Returns the history of changes for a specific important URL.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        url: z.string().describe('The important URL to get history for'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ host_id, url, date_from, date_to }) => {
      let endpoint = await hostEndpoint(host_id, '/important-urls/history');
      const params = new URLSearchParams();
      params.set('url', url);
      if (date_from) params.set('date_from', formatDate(date_from));
      if (date_to) params.set('date_to', formatDate(date_to));
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      return {
        content: [{ type: 'text', text: `Important URL history for ${url}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Recrawl Quota ============

  server.registerTool(
    'get-recrawl-quota',
    {
      title: 'Get Recrawl Quota',
      description: 'Returns the current reindexing quota status.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
      },
    },
    async ({ host_id }) => {
      const endpoint = await hostEndpoint(host_id, '/recrawl/quota');
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `Recrawl quota:\n- Daily limit: ${data.daily_quota || 'N/A'}\n- Remaining: ${data.quota_remainder || 'N/A'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-recrawl-queue',
    {
      title: 'Get Recrawl Queue',
      description: 'Returns the list of pending/recent reindexing (recrawl) tasks submitted for the site.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        limit: z.number().min(1).max(100).optional().describe('Number of tasks (default: 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      },
    },
    async ({ host_id, limit = 10, offset }) => {
      let endpoint = await hostEndpoint(host_id, '/recrawl/queue');
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      const tasks = data.tasks || [];
      const text = tasks
        .map((t) => `- ${t.task_id}: ${t.url} [${t.state}] (added: ${t.added_time?.split('T')[0] || 'N/A'})`)
        .join('\n');

      return {
        content: [
          { type: 'text', text: `Recrawl queue (${data.count ?? tasks.length} total):\n\n${text || 'No tasks'}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-recrawl-task',
    {
      title: 'Get Recrawl Task Status',
      description: 'Returns the status of a specific reindexing (recrawl) task.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        task_id: z.string().describe('Recrawl task identifier (from submit-recrawl or get-recrawl-queue)'),
      },
    },
    async ({ host_id, task_id }) => {
      const endpoint = await hostEndpoint(host_id, `/recrawl/queue/${encodeURIComponent(task_id)}`);
      const data = await apiRequest(endpoint);

      return {
        content: [
          {
            type: 'text',
            text: `Recrawl task ${data.task_id}\nURL: ${data.url}\nState: ${data.state}\nAdded: ${data.added_time?.split('T')[0] || 'N/A'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'submit-recrawl',
    {
      title: 'Submit URL for Recrawl',
      description:
        'Queues a URL for reindexing by the Yandex robot. This is a WRITE operation that consumes the daily recrawl quota (check get-recrawl-quota). Returns a task_id that can be tracked via get-recrawl-task.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        url: z.string().describe('Full URL of the page to recrawl (must belong to the site)'),
      },
    },
    async ({ host_id, url }) => {
      const endpoint = await hostEndpoint(host_id, '/recrawl/queue');
      const data = await apiRequest(endpoint, { method: 'POST', body: { url } });

      return {
        content: [{ type: 'text', text: `URL queued for recrawl.\nTask ID: ${data.task_id}\nURL: ${url}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Feeds ============

  server.registerTool(
    'get-feeds',
    {
      title: 'Get Feeds',
      description: 'Returns the list of data feeds loaded for the site (enhanced site representation / фиды).',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
      },
    },
    async ({ host_id }) => {
      const endpoint = await hostEndpoint(host_id, '/feeds/list');
      const data = await apiRequest(endpoint);

      const feeds = data.feeds || [];
      const text = feeds.map((f) => `- ${f.url || f.feed_url} [${f.state || f.status || 'N/A'}]`).join('\n');

      return {
        content: [{ type: 'text', text: `Feeds (${feeds.length}):\n\n${text || 'No feeds'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-feed-status',
    {
      title: 'Get Feed Upload Status',
      description: 'Returns the status of an asynchronous feed upload task.',
      inputSchema: {
        host_id: z.string().describe('Site identifier'),
        task_id: z.string().describe('Feed upload task identifier'),
      },
    },
    async ({ host_id, task_id }) => {
      let endpoint = await hostEndpoint(host_id, '/feeds/add/info');
      const params = new URLSearchParams();
      params.set('task_id', task_id);
      endpoint += `?${params}`;

      const data = await apiRequest(endpoint);

      return {
        content: [
          { type: 'text', text: `Feed upload status: ${data.state || data.status || 'see structuredContent'}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-feed-regions',
    {
      title: 'Get Feed Regions',
      description:
        'Returns the static reference list of regions that can be specified when uploading a YML feed (Russia is the default, id 225). This is a documentation reference, not a live API call.',
      inputSchema: {},
    },
    async () => {
      const text = FEED_REGIONS.map((r) => `- ${r.id}: ${r.name}`).join('\n');
      return {
        content: [{ type: 'text', text: `Feed upload regions:\n\n${text}` }],
        structuredContent: { regions: FEED_REGIONS },
      };
    },
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Yandex Webmaster MCP server running on stdio');
}
