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
    const token = process.env.YANDEX_METRIKA_TOKEN;
    if (!token) {
      throw new Error(
        'YANDEX_METRIKA_TOKEN environment variable is required. Run "npx yandex-metrika-mcp auth" to get a token.',
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

  // Run a Reporting API /data query with sensible defaults.
  async function statData({ counter_id, metrics, dimensions, filters, sort, date_from, date_to, limit = 10 }) {
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
    return apiRequest(STAT_URL, `/data?${params}`);
  }

  // Format /data rows into a readable numbered list. metricLabels aligns with
  // the order of the `metrics` string; bounceRate/conversionRate values from the
  // API are already percentages (0-100), so they are shown as-is.
  function formatReport(data, metricLabels = []) {
    const rows = data.data || [];
    if (!rows.length) return 'No data';
    return rows
      .map((row, i) => {
        const dims = (row.dimensions || []).map((d) => d.name ?? '(not set)').join(' | ');
        const mets = (row.metrics || [])
          .map((m, j) => {
            const val =
              typeof m === 'number' ? m.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (m ?? 'N/A');
            return metricLabels[j] ? `${metricLabels[j]}: ${val}` : val;
          })
          .join(', ');
        return `${i + 1}. ${dims || 'Total'} — ${mets}`;
      })
      .join('\n');
  }

  // Organic-search traffic filter, reused by most SEO report tools.
  const ORGANIC = "ym:s:trafficSource=='organic'";

  // Standard input schema for report tools (fresh object per call).
  const reportSchema = (extra = {}) => ({
    counter_id: z.number().describe('Counter ID'),
    date_from: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 30 days ago'),
    date_to: z.string().optional().describe('End date (YYYY-MM-DD), defaults to today'),
    limit: z.number().min(1).max(100).optional().describe('Number of results (default: 10)'),
    ...extra,
  });

  // Goal metrics + labels: a specific goal_id, or "any goal" when omitted.
  const goalMetrics = (goal_id) =>
    goal_id
      ? { metrics: `ym:s:goal${goal_id}reaches,ym:s:goal${goal_id}conversionRate`, labels: ['goal reaches', 'conv %'] }
      : { metrics: 'ym:s:sumGoalReachesAny,ym:s:anyGoalConversionRate', labels: ['goal reaches (any)', 'conv %'] };
  const goalIdSchema = { goal_id: z.number().optional().describe('Goal ID (from get-goals); defaults to all goals') };

  const server = new McpServer({ name: 'yandex-metrika', version: '1.0.0' });

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

      const metrics = data.totals || [];
      const [visits, users, pageviews, bounceRate, avgDuration] = metrics;

      return {
        content: [
          {
            type: 'text',
            text: `Traffic Summary (${params.get('date1')} to ${params.get('date2')}):\n\n- Visits: ${visits?.toLocaleString() || 0}\n- Users: ${users?.toLocaleString() || 0}\n- Pageviews: ${pageviews?.toLocaleString() || 0}\n- Bounce rate: ${bounceRate ? bounceRate.toFixed(1) : 0}%\n- Avg session: ${avgDuration ? Math.round(avgDuration) : 0} seconds`,
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
          return `${i + 1}. ${source}: ${visits?.toLocaleString() || 0} visits, ${users?.toLocaleString() || 0} users, ${bounceRate ? bounceRate.toFixed(1) : 0}% bounce`;
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
      const totals = data.totals || [];

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

  // ============ SEO: Bounce & Behavior ============

  server.registerTool(
    'get-high-bounce-pages-organic',
    {
      title: 'High-Bounce Organic Landing Pages',
      description: 'Organic-search landing pages ranked by bounce rate — pages losing visitors.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:pageDepth',
        dimensions: 'ym:s:startURLPathFull',
        filters: ORGANIC,
        sort: '-ym:s:bounceRate',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: `High-bounce organic landing pages:\n\n${formatReport(data, ['visits', 'bounce %', 'depth'])}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-critical-pages',
    {
      title: 'Critical Pages (>70% Bounce)',
      description: 'Organic landing pages with a bounce rate above 70%.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:pageDepth',
        dimensions: 'ym:s:startURLPathFull',
        filters: `${ORGANIC} AND ym:s:bounceRate>70`,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Critical pages (>70% bounce):\n\n${formatReport(data, ['visits', 'bounce %', 'depth'])}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-bounce-comparison-search-engines',
    {
      title: 'Bounce by Search Engine',
      description: 'Compares organic bounce rate and engagement across search engines (Yandex vs Google, etc.).',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:pageDepth',
        dimensions: 'ym:s:searchEngineRoot',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Bounce by search engine:\n\n${formatReport(data, ['visits', 'bounce %', 'depth'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-bounce-by-devices-organic',
    {
      title: 'Bounce by Device (Organic)',
      description: 'Organic bounce rate broken down by device category.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate',
        dimensions: 'ym:s:deviceCategory',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Bounce by device (organic):\n\n${formatReport(data, ['visits', 'bounce %'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-bounce-device-search-engine',
    {
      title: 'Bounce by Device × Search Engine',
      description: 'Cross-tabulates organic bounce rate by device and search engine.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate',
        dimensions: 'ym:s:deviceCategory,ym:s:searchEngineRoot',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Bounce by device × search engine:\n\n${formatReport(data, ['visits', 'bounce %'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Page & Exit Analysis ============

  server.registerTool(
    'get-page-depth-by-sections',
    {
      title: 'Page Depth by Section',
      description: 'Organic engagement depth and session duration across top-level site sections.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:pageDepth,ym:s:avgVisitDurationSeconds',
        dimensions: 'ym:s:startURLPathLevel1',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Page depth by section:\n\n${formatReport(data, ['visits', 'depth', 'avg sec'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-exit-pages-by-section',
    {
      title: 'Exit Pages by Section',
      description: 'Where organic visitors leave, grouped by top-level site section.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:endURLPathLevel1',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Exit pages by section:\n\n${formatReport(data, ['exits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-entry-exit-paths',
    {
      title: 'Entry → Exit Paths',
      description: 'Maps organic visitor journeys as entry-page → exit-page pairs.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:startURLPathFull,ym:s:endURLPathFull',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Entry → exit paths:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-top-exit-pages-organic',
    {
      title: 'Top Exit Pages (Organic)',
      description: 'Pages where organic traffic most often exits the site.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:endURLPathFull',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Top exit pages (organic):\n\n${formatReport(data, ['exits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-exit-pages-by-devices',
    {
      title: 'Exit Pages by Device',
      description: 'Compares organic exit pages between mobile and desktop.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:deviceCategory,ym:s:endURLPathFull',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Exit pages by device:\n\n${formatReport(data, ['exits'])}` }],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Organic Conversions ============

  server.registerTool(
    'get-conversions-by-search-engine',
    {
      title: 'Conversions by Search Engine',
      description: 'Organic goal conversions grouped by search engine.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:searchEngineRoot',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Conversions by search engine:\n\n${formatReport(data, ['visits', ...g.labels])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-conversions-by-landing-pages',
    {
      title: 'Conversions by Landing Page',
      description: 'Organic goal conversions grouped by landing page.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:startURLPathFull',
        filters: ORGANIC,
        sort: `-${g.metrics.split(',')[0]}`,
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Conversions by landing page:\n\n${formatReport(data, ['visits', ...g.labels])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-conversions-by-search-phrases',
    {
      title: 'Conversions by Search Phrase',
      description: 'Organic goal conversions grouped by search query.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 20 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:searchPhrase',
        filters: ORGANIC,
        sort: `-${g.metrics.split(',')[0]}`,
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Conversions by search phrase:\n\n${formatReport(data, ['visits', ...g.labels])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-conversions-by-devices',
    {
      title: 'Conversions by Device',
      description: 'Organic goal conversions grouped by device category.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:deviceCategory',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Conversions by device:\n\n${formatReport(data, ['visits', ...g.labels])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-conversions-by-regions',
    {
      title: 'Conversions by Region',
      description: 'Organic goal conversions grouped by visitor region (city).',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:regionCity',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Conversions by region:\n\n${formatReport(data, ['visits', ...g.labels])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-conversions-device-region',
    {
      title: 'Conversions by Device × Region',
      description: 'Organic goal conversions segmented by device and region.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 20 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:deviceCategory,ym:s:regionCity',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Conversions by device × region:\n\n${formatReport(data, ['visits', ...g.labels])}` },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Referral Traffic ============

  server.registerTool(
    'get-referral-donors-behavior',
    {
      title: 'Referral Donor Behavior',
      description: 'Referring domains ranked by visits, with bounce rate and depth (donor quality).',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:pageDepth',
        dimensions: 'ym:s:refererDomain',
        filters: "ym:s:trafficSource=='referral'",
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Referral donor behavior:\n\n${formatReport(data, ['visits', 'bounce %', 'depth'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-referral-full-urls',
    {
      title: 'Referral Full URLs',
      description: 'Specific referring page URLs that link to the site.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:referer',
        filters: "ym:s:trafficSource=='referral'",
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Referral full URLs:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-quality-referral-traffic',
    {
      title: 'Quality Referral Traffic',
      description: 'Referring domains with the lowest bounce rate (highest-quality referral traffic).',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate',
        dimensions: 'ym:s:refererDomain',
        filters: "ym:s:trafficSource=='referral' AND ym:s:visits>5",
        sort: 'ym:s:bounceRate',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Quality referral traffic (low bounce):\n\n${formatReport(data, ['visits', 'bounce %'])}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-referral-conversions',
    {
      title: 'Referral Conversions',
      description: 'Goal conversions contributed by referring domains.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,${g.metrics}`,
        dimensions: 'ym:s:refererDomain',
        filters: "ym:s:trafficSource=='referral'",
        sort: `-${g.metrics.split(',')[0]}`,
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Referral conversions:\n\n${formatReport(data, ['visits', ...g.labels])}` }],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Social Traffic ============

  server.registerTool(
    'get-social-networks-traffic',
    {
      title: 'Social Networks Traffic',
      description: 'Traffic volume by social network.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:socialNetwork',
        filters: "ym:s:trafficSource=='social'",
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Social networks traffic:\n\n${formatReport(data, ['visits', 'users'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-social-networks-quality',
    {
      title: 'Social Networks Quality',
      description: 'Traffic quality (bounce) and conversions by social network.',
      inputSchema: reportSchema(goalIdSchema),
    },
    async ({ counter_id, goal_id, date_from, date_to, limit = 10 }) => {
      const g = goalMetrics(goal_id);
      const data = await statData({
        counter_id,
        metrics: `ym:s:visits,ym:s:bounceRate,${g.metrics}`,
        dimensions: 'ym:s:socialNetwork',
        filters: "ym:s:trafficSource=='social'",
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Social networks quality:\n\n${formatReport(data, ['visits', 'bounce %', ...g.labels])}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-social-landing-pages',
    {
      title: 'Social Landing Pages',
      description: 'Landing pages that receive social traffic.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:startURLPathFull',
        filters: "ym:s:trafficSource=='social'",
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Social landing pages:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Audience & Demographics ============

  server.registerTool(
    'get-new-vs-returning-organic',
    {
      title: 'New vs Returning (Organic)',
      description: 'Compares new and returning organic visitors.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:users,ym:s:bounceRate',
        dimensions: 'ym:s:isNewUser',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: `New vs returning (organic):\n\n${formatReport(data, ['visits', 'users', 'bounce %'])}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-visit-frequency-organic',
    {
      title: 'Visit Frequency (Organic)',
      description: 'Distribution of organic visitors by how many times they have visited.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:userVisits',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Visit frequency (organic):\n\n${formatReport(data, ['visits', 'users'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-demographics-organic',
    {
      title: 'Demographics (Organic)',
      description: 'Organic audience by gender and age group.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 20 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:gender,ym:s:ageInterval',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Demographics (organic):\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-audience-interests',
    {
      title: 'Audience Interests',
      description: 'Interest categories of organic visitors.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 15 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:interest',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Audience interests:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Temporal Patterns ============

  server.registerTool(
    'get-organic-activity-by-hour',
    {
      title: 'Organic Activity by Hour',
      description: 'Organic traffic distribution across hours of the day.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 24 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:hour',
        filters: ORGANIC,
        sort: 'ym:s:hour',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Organic activity by hour:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-organic-activity-by-day-of-week',
    {
      title: 'Organic Activity by Day of Week',
      description: 'Organic traffic distribution across days of the week.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 7 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:dayOfWeekName',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Organic activity by day of week:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-organic-traffic-dynamics',
    {
      title: 'Organic Traffic Dynamics',
      description: 'Daily organic traffic trend over the date range.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 100 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:date',
        filters: ORGANIC,
        sort: 'ym:s:date',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Organic traffic dynamics (daily):\n\n${formatReport(data, ['visits', 'users'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-organic-seasonality',
    {
      title: 'Organic Seasonality',
      description: 'Organic traffic by month (seasonal fluctuations). Use a wide date range.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 24 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:users',
        dimensions: 'ym:s:month',
        filters: ORGANIC,
        sort: 'ym:s:month',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Organic seasonality (by month):\n\n${formatReport(data, ['visits', 'users'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  // ============ SEO: Technology ============

  server.registerTool(
    'get-organic-browsers',
    {
      title: 'Organic Browsers',
      description: 'Browsers used by organic visitors, with bounce rate.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate',
        dimensions: 'ym:s:browser',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Organic browsers:\n\n${formatReport(data, ['visits', 'bounce %'])}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-problematic-os',
    {
      title: 'Problematic Operating Systems',
      description: 'Operating systems with the highest organic bounce rate.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits,ym:s:bounceRate',
        dimensions: 'ym:s:operatingSystem',
        filters: `${ORGANIC} AND ym:s:visits>5`,
        sort: '-ym:s:bounceRate',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [
          { type: 'text', text: `Problematic operating systems:\n\n${formatReport(data, ['visits', 'bounce %'])}` },
        ],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-screen-resolutions',
    {
      title: 'Screen Resolutions',
      description: 'Physical screen resolutions of organic visitors.',
      inputSchema: reportSchema(),
    },
    async ({ counter_id, date_from, date_to, limit = 10 }) => {
      const data = await statData({
        counter_id,
        metrics: 'ym:s:visits',
        dimensions: 'ym:s:physicalScreenResolution',
        filters: ORGANIC,
        sort: '-ym:s:visits',
        date_from,
        date_to,
        limit,
      });
      return {
        content: [{ type: 'text', text: `Screen resolutions:\n\n${formatReport(data, ['visits'])}` }],
        structuredContent: data,
      };
    },
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Yandex Metrika MCP server running on stdio');
}
