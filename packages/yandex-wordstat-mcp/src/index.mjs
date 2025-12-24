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

  // Session-level cache for regions tree (rarely changes)
  let regionsTreeCache = null;
  let regionsFlatCache = null; // Map of regionId -> {label, parentId}

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

  // Fetch and cache regions tree
  async function getRegionsTree() {
    if (!regionsTreeCache) {
      regionsTreeCache = await wordstatRequest('/v1/getRegionsTree');
      // Build flat lookup map
      regionsFlatCache = new Map();
      flattenRegionsTree(regionsTreeCache, null);
    }
    return regionsTreeCache;
  }

  // Recursively flatten tree into a lookup map
  function flattenRegionsTree(nodes, parentId) {
    if (!nodes) return;
    for (const node of nodes) {
      regionsFlatCache.set(Number(node.value), {
        label: node.label,
        parentId: parentId,
      });
      if (node.children) {
        flattenRegionsTree(node.children, Number(node.value));
      }
    }
  }

  // Trim tree to specified depth
  function trimTreeToDepth(nodes, maxDepth, currentDepth = 1) {
    if (!nodes || currentDepth > maxDepth) return null;
    return nodes.map((node) => ({
      value: node.value,
      label: node.label,
      children: currentDepth < maxDepth ? trimTreeToDepth(node.children, maxDepth, currentDepth + 1) : null,
    }));
  }

  // Find a region node by ID in the tree
  function findRegionInTree(nodes, regionId) {
    if (!nodes) return null;
    for (const node of nodes) {
      if (Number(node.value) === regionId) {
        return node;
      }
      if (node.children) {
        const found = findRegionInTree(node.children, regionId);
        if (found) return found;
      }
    }
    return null;
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
        'Returns the top 3 levels of the Wordstat regions tree (countries, federal districts, major regions). Use get-region-children to drill down into specific regions. Does not consume quota.',
      inputSchema: {
        depth: z.number().min(1).max(5).optional().describe('Tree depth to return (1-5, default: 3)'),
      },
    },
    async ({ depth = 3 }) => {
      const fullTree = await getRegionsTree();
      const trimmedTree = trimTreeToDepth(fullTree, depth);

      return {
        content: [
          {
            type: 'text',
            text: `Regions tree (depth: ${depth}). Use get-region-children to drill down into a specific region.\n\n${JSON.stringify(trimmedTree, null, 2)}`,
          },
        ],
      };
    },
  );

  // Tool 1b: Get Region Children (drill down)
  server.registerTool(
    'get-region-children',
    {
      title: 'Get Region Children',
      description:
        'Returns the children of a specific region. Use this to drill down into a region from get-regions-tree. Does not consume quota.',
      inputSchema: {
        regionId: z.number().describe('Region ID to get children for'),
        depth: z.number().min(1).max(3).optional().describe('Depth of children to return (1-3, default: 2)'),
      },
    },
    async ({ regionId, depth = 2 }) => {
      const fullTree = await getRegionsTree();
      const regionNode = findRegionInTree(fullTree, regionId);

      if (!regionNode) {
        return {
          content: [{ type: 'text', text: `Region ${regionId} not found` }],
        };
      }

      const children = regionNode.children ? trimTreeToDepth(regionNode.children, depth) : null;

      return {
        content: [
          {
            type: 'text',
            text: `Children of "${regionNode.label}" (ID: ${regionId}):\n\n${children ? JSON.stringify(children, null, 2) : 'No children (leaf region)'}`,
          },
        ],
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

  // Get all descendant region IDs for a given region
  function getDescendantRegionIds(regionId) {
    const descendants = new Set([regionId]);
    const fullTree = regionsTreeCache;
    if (!fullTree) return descendants;

    const regionNode = findRegionInTree(fullTree, regionId);
    if (!regionNode) return descendants;

    function collectDescendants(node) {
      if (!node.children) return;
      for (const child of node.children) {
        descendants.add(Number(child.value));
        collectDescendants(child);
      }
    }
    collectDescendants(regionNode);
    return descendants;
  }

  // Tool 4: Regions Distribution (2 quota units)
  server.registerTool(
    'regions',
    {
      title: 'Regional Distribution',
      description:
        'Returns how search volume for a keyword is distributed across regions. Includes region names, share percentage and affinity index. Costs 2 quota units.',
      inputSchema: {
        phrase: z.string().describe('Keyword to analyze regional distribution for'),
        regions: z
          .array(z.number())
          .optional()
          .describe(
            'Array of region IDs to filter results by (filters client-side to show only these regions and their children)',
          ),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
        limit: z.number().min(1).max(50).optional().describe('Number of top regions to return (default: 20)'),
      },
      outputSchema: {
        regions: z.array(
          z.object({
            regionId: z.number(),
            regionName: z.string(),
            count: z.number(),
            share: z.number(),
            affinityIndex: z.number(),
          }),
        ),
      },
    },
    async ({ phrase, regions: filterRegions, devices, limit = 20 }) => {
      const body = { phrase };
      // Note: API doesn't support regions filter, we filter client-side
      if (devices?.length) body.devices = devices;

      // Fetch regions data and ensure regions tree is cached
      const [data] = await Promise.all([wordstatRequest('/v1/regions', body), getRegionsTree()]);

      let filteredData = data.regions;

      // If regions filter specified, filter to only include those regions and their descendants
      if (filterRegions?.length) {
        const allowedRegionIds = new Set();
        for (const regionId of filterRegions) {
          const descendants = getDescendantRegionIds(regionId);
          for (const id of descendants) {
            allowedRegionIds.add(id);
          }
        }
        filteredData = data.regions.filter((r) => allowedRegionIds.has(r.regionId));
      }

      const sorted = [...filteredData].sort((a, b) => b.count - a.count);

      // Enrich with region names
      const enriched = sorted.slice(0, limit).map((r) => ({
        ...r,
        regionName: regionsFlatCache.get(r.regionId)?.label || `Unknown (${r.regionId})`,
      }));

      // Also get top by affinity for interesting insights
      const topByAffinity = [...filteredData]
        .sort((a, b) => b.affinityIndex - a.affinityIndex)
        .slice(0, 5)
        .map((r) => ({
          ...r,
          regionName: regionsFlatCache.get(r.regionId)?.label || `Unknown (${r.regionId})`,
        }));

      const filterNote = filterRegions?.length
        ? ` (filtered to ${filteredData.length} regions in specified areas)`
        : '';

      return {
        content: [
          {
            type: 'text',
            text:
              `Regional distribution for "${phrase}"${filterNote}:\n\n` +
              `**Top ${Math.min(limit, enriched.length)} by search volume:**\n` +
              enriched
                .map(
                  (r, i) =>
                    `${i + 1}. ${r.regionName}: ${r.count.toLocaleString()} queries (${r.share.toFixed(2)}% share, affinity: ${r.affinityIndex.toFixed(0)})`,
                )
                .join('\n') +
              `\n\n**Top ${Math.min(5, topByAffinity.length)} by affinity (most interested relative to size):**\n` +
              topByAffinity
                .map(
                  (r) =>
                    `• ${r.regionName}: affinity ${r.affinityIndex.toFixed(0)} (${r.count.toLocaleString()} queries)`,
                )
                .join('\n'),
          },
        ],
        structuredContent: { regions: enriched, topByAffinity },
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Yandex Wordstat MCP server running on stdio');
}
