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
  const BASE_URL = 'https://api.wordstat.yandex.net';
  const RATE_LIMIT = 10;

  const requestTimestamps = [];

  async function rateLimit() {
    const now = Date.now();
    const windowStart = now - 1000;

    while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
      requestTimestamps.shift();
    }

    if (requestTimestamps.length >= RATE_LIMIT) {
      const waitTime = requestTimestamps[0] - windowStart;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      requestTimestamps.shift();
    }

    requestTimestamps.push(Date.now());
  }

  function getToken() {
    const token = process.env.YANDEX_WORDSTAT_TOKEN;
    if (!token) {
      throw new Error(
        'YANDEX_WORDSTAT_TOKEN environment variable is required. Get your OAuth token by running: npx yandex-wordstat-mcp auth',
      );
    }
    return token;
  }

  async function wordstatRequest(endpoint, body) {
    await rateLimit();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${getToken()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter ?? 'unknown'} seconds. ${errorText}`);
      }

      if (response.status === 503) {
        throw new Error(`Service unavailable (quota exceeded). ${errorText}`);
      }

      throw new Error(`Wordstat API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  const server = new McpServer({
    name: 'yandex-wordstat',
    version: '1.0.0',
  });

  // Tool 1: Get Regions Tree (no quota cost)
  server.registerTool(
    'get-regions-tree',
    {
      title: 'Get Regions Tree',
      description:
        'Returns a tree of all Wordstat-supported regions with their IDs. Use these IDs in other tools. Does not consume quota.',
      inputSchema: {},
    },
    async () => {
      const data = await wordstatRequest('/v1/getRegionsTree');

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // Tool 2: Top Requests (1 quota unit)
  server.registerTool(
    'top-requests',
    {
      title: 'Top Requests',
      description:
        'Returns popular search queries containing the specified keyword for the last 30 days. Also includes similar/related queries. Costs 1 quota unit.',
      inputSchema: {
        phrase: z.string().describe("Keyword to search for (e.g., 'купить телефон')"),
        regions: z
          .array(z.number())
          .optional()
          .describe('Array of region IDs to filter by (get IDs from get-regions-tree)'),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
      },
      outputSchema: {
        topRequests: z.array(z.object({ phrase: z.string(), count: z.number() })),
      },
    },
    async ({ phrase, regions, devices }) => {
      const body = { phrase };
      if (regions?.length) body.regions = regions;
      if (devices?.length) body.devices = devices;

      const data = await wordstatRequest('/v1/topRequests', body);

      return {
        content: [
          {
            type: 'text',
            text: `Found ${data.topRequests.length} queries for "${phrase}":\n\n${data.topRequests
              .slice(0, 20)
              .map((r, i) => `${i + 1}. "${r.phrase}" — ${r.count.toLocaleString()} queries`)
              .join('\n')}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  // Tool 3: Dynamics (2 quota units)
  server.registerTool(
    'dynamics',
    {
      title: 'Search Dynamics',
      description: 'Returns search volume dynamics (trend) for a keyword over time. Costs 2 quota units.',
      inputSchema: {
        phrase: z.string().describe('Keyword to analyze trends for'),
        period: z
          .enum(['daily', 'weekly', 'monthly'])
          .optional()
          .describe('Time granularity: daily (last 60 days), weekly, or monthly (default)'),
        fromDate: z.string().optional().describe('Start date in YYYY-MM-DD format (default: 1 year ago)'),
        toDate: z.string().optional().describe('End date in YYYY-MM-DD format (default: today)'),
        regions: z.array(z.number()).optional().describe('Array of region IDs to filter by'),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
      },
      outputSchema: {
        dynamics: z.array(z.object({ date: z.string(), count: z.number() })),
      },
    },
    async ({ phrase, period = 'monthly', fromDate, toDate, regions, devices }) => {
      const now = new Date();

      // Calculate default dates based on period
      let defaultToDate = toDate;
      let defaultFromDate = fromDate;

      if (!toDate) {
        if (period === 'monthly') {
          // Last day of previous month
          const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          defaultToDate = lastMonth.toISOString().split('T')[0];
        } else if (period === 'weekly') {
          // Last Sunday
          const lastSunday = new Date(now);
          lastSunday.setDate(now.getDate() - now.getDay());
          defaultToDate = lastSunday.toISOString().split('T')[0];
        } else {
          // Yesterday for daily
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          defaultToDate = yesterday.toISOString().split('T')[0];
        }
      }

      if (!fromDate) {
        if (period === 'monthly') {
          // First day of month, 1 year ago
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          defaultFromDate = oneYearAgo.toISOString().split('T')[0];
        } else if (period === 'weekly') {
          // Monday ~1 year ago
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const dayOfWeek = oneYearAgo.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          oneYearAgo.setDate(oneYearAgo.getDate() - daysToMonday);
          defaultFromDate = oneYearAgo.toISOString().split('T')[0];
        } else {
          // 60 days ago for daily
          const sixtyDaysAgo = new Date(now);
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          defaultFromDate = sixtyDaysAgo.toISOString().split('T')[0];
        }
      }

      const body = {
        phrase,
        period,
        fromDate: defaultFromDate,
        toDate: defaultToDate,
      };
      if (regions?.length) body.regions = regions;
      if (devices?.length) body.devices = devices;

      const data = await wordstatRequest('/v1/dynamics', body);

      const points = data.dynamics;
      let trendText = '';
      if (points.length >= 2) {
        const first = points[0].count;
        const last = points[points.length - 1].count;
        const change = ((last - first) / first) * 100;
        trendText = `\n\nTrend: ${change > 0 ? '📈' : '📉'} ${change.toFixed(1)}% change`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Search dynamics for "${phrase}" (${points.length} data points):${trendText}\n\n${points
              .map((p) => `${p.date}: ${p.count.toLocaleString()}`)
              .join('\n')}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  // Tool 4: Regions Distribution (2 quota units)
  server.registerTool(
    'regions',
    {
      title: 'Regional Distribution',
      description:
        'Returns how search volume for a keyword is distributed across regions. Includes share percentage and affinity index. Costs 2 quota units.',
      inputSchema: {
        phrase: z.string().describe('Keyword to analyze regional distribution for'),
        regions: z.array(z.number()).optional().describe('Array of region IDs to filter by (optional)'),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
      },
      outputSchema: {
        regions: z.array(
          z.object({
            regionId: z.number(),
            count: z.number(),
            share: z.number(),
            affinityIndex: z.number(),
          }),
        ),
      },
    },
    async ({ phrase, regions, devices }) => {
      const body = { phrase };
      if (regions?.length) body.regions = regions;
      if (devices?.length) body.devices = devices;

      const data = await wordstatRequest('/v1/regions', body);
      const sorted = [...data.regions].sort((a, b) => b.count - a.count);

      return {
        content: [
          {
            type: 'text',
            text: `Regional distribution for "${phrase}" (${sorted.length} regions):\n\n${sorted
              .slice(0, 15)
              .map(
                (r, i) =>
                  `${i + 1}. Region ${r.regionId}: ${r.count.toLocaleString()} queries (${r.share.toFixed(2)}% share, affinity: ${r.affinityIndex.toFixed(1)})`,
              )
              .join('\n')}`,
          },
        ],
        structuredContent: data,
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Yandex Wordstat MCP server running on stdio');
}
