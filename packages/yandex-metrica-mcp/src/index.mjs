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
  const MANAGEMENT_URL = 'https://api-metrica.yandex.net/management/v1';
  const STAT_URL = 'https://api-metrica.yandex.net/stat/v1';

  function getToken() {
    const token = process.env.YANDEX_METRICA_TOKEN;
    if (!token) {
      throw new Error(
        'YANDEX_METRICA_TOKEN environment variable is required. Run "npx yandex-metrica-mcp auth" to get a token.',
      );
    }
    return token;
  }

  async function apiRequest(baseUrl, endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
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
      throw new Error(`Metrica API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Helper to format date for API (YYYY-MM-DD)
  function formatDate(date) {
    if (!date) return undefined;
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    return new Date(date).toISOString().split('T')[0];
  }

  // Get default date range (last 30 days)
  function getDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return {
      date1: formatDate(thirtyDaysAgo.toISOString()),
      date2: formatDate(today.toISOString()),
    };
  }

  const server = new McpServer({ name: 'yandex-metrica', version: '1.0.0' });

  // ============ Management Tools ============

  server.registerTool(
    'get-counters',
    {
      title: 'List Counters',
      description: 'Returns the list of Yandex Metrica counters (tags) available to the user.',
      inputSchema: {},
    },
    async () => {
      const data = await apiRequest(MANAGEMENT_URL, '/counters');

      const counters = data.counters || [];
      const summary = counters.map((c) => `- ${c.name} (ID: ${c.id}, site: ${c.site}, status: ${c.status})`).join('\n');

      return {
        content: [{ type: 'text', text: `Found ${counters.length} counters:\n\n${summary}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-counter',
    {
      title: 'Get Counter Details',
      description: 'Returns detailed information about a specific Metrica counter.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
      },
    },
    async ({ counter_id }) => {
      const data = await apiRequest(MANAGEMENT_URL, `/counter/${counter_id}`);

      const c = data.counter || data;
      return {
        content: [
          {
            type: 'text',
            text: `Counter: ${c.name}\nID: ${c.id}\nSite: ${c.site}\nStatus: ${c.status}\nCreate time: ${c.create_time || 'N/A'}\nCode status: ${c.code_status || 'N/A'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-goals',
    {
      title: 'Get Counter Goals',
      description: 'Returns the list of goals configured for a counter.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
      },
    },
    async ({ counter_id }) => {
      const data = await apiRequest(MANAGEMENT_URL, `/counter/${counter_id}/goals`);

      const goals = data.goals || [];
      const summary = goals.map((g) => `- ${g.name} (ID: ${g.id}, type: ${g.type})`).join('\n');

      return {
        content: [{ type: 'text', text: `Found ${goals.length} goals:\n\n${summary || 'No goals configured'}` }],
        structuredContent: data,
      };
    },
  );

  // ============ Reporting Tools ============

  server.registerTool(
    'get-traffic-summary',
    {
      title: 'Get Traffic Summary',
      description: 'Returns traffic summary: visits, users, pageviews, bounce rate, and session duration.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 30 days ago'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD), defaults to today'),
      },
    },
    async ({ counter_id, date_from, date_to }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const metrics = data.totals?.[0] || [];
      const [visits, users, pageviews, bounceRate, avgDuration] = metrics;

      return {
        content: [
          {
            type: 'text',
            text: `Traffic Summary (${params.get('date1')} to ${params.get('date2')}):\n\n- Visits: ${visits?.toLocaleString() || 0}\n- Users: ${users?.toLocaleString() || 0}\n- Pageviews: ${pageviews?.toLocaleString() || 0}\n- Bounce rate: ${bounceRate ? (bounceRate * 100).toFixed(1) : 0}%\n- Avg session: ${avgDuration ? Math.round(avgDuration) : 0} seconds`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-traffic-sources',
    {
      title: 'Get Traffic Sources',
      description: 'Returns traffic breakdown by source: direct, search, social, referral, etc.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:s:visits,ym:s:users,ym:s:bounceRate',
        dimensions: 'ym:s:trafficSource',
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
        sort: '-ym:s:visits',
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const summary = rows
        .map((row, i) => {
          const source = row.dimensions?.[0]?.name || 'Unknown';
          const [visits, users, bounceRate] = row.metrics || [];
          return `${i + 1}. ${source}: ${visits?.toLocaleString() || 0} visits, ${users?.toLocaleString() || 0} users, ${bounceRate ? (bounceRate * 100).toFixed(1) : 0}% bounce`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: `Traffic Sources:\n\n${summary || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-geography',
    {
      title: 'Get Visitor Geography',
      description: 'Returns visitor breakdown by country and region.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:regionCountry,ym:s:regionCity',
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
        sort: '-ym:s:visits',
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const summary = rows
        .map((row, i) => {
          const country = row.dimensions?.[0]?.name || 'Unknown';
          const city = row.dimensions?.[1]?.name || '';
          const [visits, users] = row.metrics || [];
          return `${i + 1}. ${country}${city ? `, ${city}` : ''}: ${visits?.toLocaleString() || 0} visits, ${users?.toLocaleString() || 0} users`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: `Visitor Geography:\n\n${summary || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-devices',
    {
      title: 'Get Device Statistics',
      description: 'Returns visitor breakdown by device type, browser, and operating system.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        group_by: z.enum(['device', 'browser', 'os']).optional().describe('Group by: device (default), browser, or os'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ counter_id, group_by = 'device', date_from, date_to, limit = 10 }) => {
      const dimensionMap = {
        device: 'ym:s:deviceCategory',
        browser: 'ym:s:browser',
        os: 'ym:s:operatingSystem',
      };

      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: dimensionMap[group_by],
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
        sort: '-ym:s:visits',
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const summary = rows
        .map((row, i) => {
          const name = row.dimensions?.[0]?.name || 'Unknown';
          const [visits, users] = row.metrics || [];
          return `${i + 1}. ${name}: ${visits?.toLocaleString() || 0} visits, ${users?.toLocaleString() || 0} users`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `${group_by.charAt(0).toUpperCase() + group_by.slice(1)} Statistics:\n\n${summary || 'No data'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-popular-pages',
    {
      title: 'Get Popular Pages',
      description: 'Returns the most visited pages on the site.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:pv:pageviews,ym:pv:users',
        dimensions: 'ym:pv:URLPath',
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
        sort: '-ym:pv:pageviews',
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const summary = rows
        .map((row, i) => {
          const path = row.dimensions?.[0]?.name || '/';
          const [pageviews, users] = row.metrics || [];
          return `${i + 1}. ${path}: ${pageviews?.toLocaleString() || 0} views, ${users?.toLocaleString() || 0} users`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: `Popular Pages:\n\n${summary || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-search-phrases',
    {
      title: 'Get Search Phrases',
      description: 'Returns search phrases that brought visitors from search engines.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 20)'),
      },
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:searchPhrase',
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
        sort: '-ym:s:visits',
      });

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const summary = rows
        .map((row, i) => {
          const phrase = row.dimensions?.[0]?.name || '(not set)';
          const [visits] = row.metrics || [];
          return `${i + 1}. "${phrase}": ${visits?.toLocaleString() || 0} visits`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Search Phrases:\n\n${summary || 'No search phrase data (may be hidden for privacy)'}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-report',
    {
      title: 'Get Custom Report',
      description: 'Returns a custom report with specified dimensions and metrics. Use this for advanced queries.',
      inputSchema: {
        counter_id: z.number().describe('Counter ID'),
        metrics: z
          .string()
          .describe(
            'Comma-separated metrics (e.g., "ym:s:visits,ym:s:users,ym:s:bounceRate"). Common: ym:s:visits, ym:s:users, ym:s:pageviews, ym:s:bounceRate, ym:s:avgVisitDurationSeconds',
          ),
        dimensions: z
          .string()
          .optional()
          .describe(
            'Comma-separated dimensions (e.g., "ym:s:trafficSource,ym:s:deviceCategory"). Common: ym:s:trafficSource, ym:s:searchEngine, ym:s:regionCountry, ym:s:deviceCategory, ym:s:browser',
          ),
        date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
        filters: z.string().optional().describe('Filter expression (e.g., "ym:s:trafficSource==\'organic\'")'),
        sort: z.string().optional().describe('Sort field with - for descending (e.g., "-ym:s:visits")'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
      },
    },
    async ({ counter_id, metrics, dimensions, date_from, date_to, filters, sort, limit = 10 }) => {
      const defaults = getDefaultDates();
      const params = new URLSearchParams({
        ids: counter_id.toString(),
        metrics,
        date1: date_from ? formatDate(date_from) : defaults.date1,
        date2: date_to ? formatDate(date_to) : defaults.date2,
        limit: limit.toString(),
      });

      if (dimensions) params.set('dimensions', dimensions);
      if (filters) params.set('filters', filters);
      if (sort) params.set('sort', sort);

      const data = await apiRequest(STAT_URL, `/data?${params}`);

      const rows = data.data || [];
      const totals = data.totals?.[0] || [];

      let summary = '';
      if (rows.length > 0) {
        summary = rows
          .slice(0, 20)
          .map((row, i) => {
            const dims = (row.dimensions || []).map((d) => d.name).join(' | ');
            const mets = (row.metrics || []).map((m) => (typeof m === 'number' ? m.toLocaleString() : m)).join(', ');
            return `${i + 1}. ${dims || 'Total'}: ${mets}`;
          })
          .join('\n');
      } else {
        summary = `Totals: ${totals.map((t) => (typeof t === 'number' ? t.toLocaleString() : t)).join(', ')}`;
      }

      return {
        content: [{ type: 'text', text: `Custom Report:\n\n${summary || 'No data'}` }],
        structuredContent: data,
      };
    },
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Yandex Metrica MCP server running on stdio');
}
