#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  calculateTrend,
  flattenRegionsTree,
  formatShare,
  fromRFC3339Date,
  normalizePeriod,
  regionsToStrings,
  resolveDynamicsDates,
  toInt,
  toRFC3339Date,
  toYandexDevices,
  toYandexPeriod,
  toYandexRegionGranularity,
} from './convert.mjs';

await runServer();

async function runServer() {
  // Wordstat v2 is served by the Yandex Cloud Search API (same product/host as web
  // search), under /v2/wordstat/*, authenticated with an Api-Key + folderId.
  const BASE_URL = 'https://searchapi.api.cloud.yandex.net';
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

  function getCredentials() {
    const apiKey = process.env.YANDEX_WORDSTAT_API_KEY || process.env.YANDEX_SEARCH_API_KEY;
    const folderId = process.env.YANDEX_WORDSTAT_FOLDER_ID || process.env.YANDEX_FOLDER_ID;
    if (!apiKey) {
      throw new Error(
        'YANDEX_WORDSTAT_API_KEY or YANDEX_SEARCH_API_KEY environment variable is required. Get an API key from the Yandex Cloud console (service account with role search-api.webSearch.user, API key scope yc.search-api.execute).',
      );
    }
    if (!folderId) {
      throw new Error(
        'YANDEX_FOLDER_ID (or YANDEX_WORDSTAT_FOLDER_ID) environment variable is required. Get your folder ID from the Yandex Cloud console.',
      );
    }
    return { apiKey, folderId };
  }

  // Make a request to the Wordstat v2 API. The folderId is injected into the body.
  async function wordstatRequest(endpoint, body = {}) {
    await rateLimit();

    const { apiKey, folderId } = getCredentials();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Api-Key ${apiKey}`,
      },
      body: JSON.stringify({ ...body, folderId }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter ?? 'unknown'} seconds. ${errorText}`);
      }

      if (response.status === 403) {
        throw new Error(`Forbidden (quota exceeded or insufficient permissions). ${errorText}`);
      }

      if (response.status === 503) {
        throw new Error(`Service unavailable. ${errorText}`);
      }

      throw new Error(`Wordstat API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Fetch and cache regions tree
  async function getRegionsTree() {
    if (!regionsTreeCache) {
      const data = await wordstatRequest('/v2/wordstat/getRegionsTree');
      regionsTreeCache = data.regions ?? [];
      // Build flat lookup map
      regionsFlatCache = flattenRegionsTree(regionsTreeCache, null, new Map());
    }
    return regionsTreeCache;
  }

  // Trim tree to specified depth
  function trimTreeToDepth(nodes, maxDepth, currentDepth = 1) {
    if (!nodes || currentDepth > maxDepth) return null;
    return nodes.map((node) => ({
      id: node.id,
      label: node.label,
      children: currentDepth < maxDepth ? trimTreeToDepth(node.children, maxDepth, currentDepth + 1) : null,
    }));
  }

  // Find a region node by ID in the tree
  function findRegionInTree(nodes, regionId) {
    if (!nodes) return null;
    for (const node of nodes) {
      if (Number(node.id) === regionId) {
        return node;
      }
      if (node.children) {
        const found = findRegionInTree(node.children, regionId);
        if (found) return found;
      }
    }
    return null;
  }

  // Get all descendant region IDs for a given region (inclusive)
  function getDescendantRegionIds(regionId) {
    const descendants = new Set([regionId]);
    if (!regionsTreeCache) return descendants;

    const regionNode = findRegionInTree(regionsTreeCache, regionId);
    if (!regionNode) return descendants;

    function collectDescendants(node) {
      if (!node.children) return;
      for (const child of node.children) {
        descendants.add(Number(child.id));
        collectDescendants(child);
      }
    }
    collectDescendants(regionNode);
    return descendants;
  }

  const server = new McpServer({
    name: 'yandex-wordstat',
    version: '2.0.1',
  });

  // Tool 1: Get Regions Tree
  server.registerTool(
    'get-regions-tree',
    {
      title: 'Get Regions Tree',
      description:
        'Returns the top 3 levels of the Wordstat regions tree (countries, federal districts, major regions). Use get-region-children to drill down into specific regions.',
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
        'Returns the children of a specific region. Use this to drill down into a region from get-regions-tree.',
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

  // Tool 2: Top Requests
  server.registerTool(
    'top-requests',
    {
      title: 'Top Requests',
      description:
        'Returns popular search queries containing the specified keyword for the last 30 days, plus similar/associated queries. The phrase supports Wordstat search operators.',
      inputSchema: {
        phrase: z.string().describe("Keyword to search for (e.g., 'купить телефон')"),
        numPhrases: z
          .number()
          .min(1)
          .max(2000)
          .optional()
          .describe('Number of phrases to return (1-2000, default: 50)'),
        regions: z
          .array(z.number())
          .optional()
          .describe('Array of region IDs to scope the query (get IDs from get-regions-tree; e.g. 213 = Moscow)'),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
      },
      outputSchema: {
        topRequests: z.array(z.object({ phrase: z.string(), count: z.number() })),
        associations: z.array(z.object({ phrase: z.string(), count: z.number() })),
        totalCount: z.number(),
      },
    },
    async ({ phrase, numPhrases = 50, regions, devices }) => {
      const body = { phrase, numPhrases };
      const regionStrings = regionsToStrings(regions);
      if (regionStrings) body.regions = regionStrings;
      const deviceEnums = toYandexDevices(devices);
      if (deviceEnums) body.devices = deviceEnums;

      const data = await wordstatRequest('/v2/wordstat/topRequests', body);

      const topRequests = (data.results ?? []).map((r) => ({ phrase: r.phrase, count: toInt(r.count) }));
      const associations = (data.associations ?? []).map((r) => ({ phrase: r.phrase, count: toInt(r.count) }));
      const totalCount = toInt(data.totalCount);

      const associationsText = associations.length
        ? `\n\nRelated queries:\n${associations
            .slice(0, 10)
            .map((r) => `• "${r.phrase}" — ${r.count.toLocaleString()}`)
            .join('\n')}`
        : '';

      return {
        content: [
          {
            type: 'text',
            text: `Found ${topRequests.length} queries for "${phrase}" (total matching: ${totalCount.toLocaleString()}):\n\n${topRequests
              .slice(0, 20)
              .map((r, i) => `${i + 1}. "${r.phrase}" — ${r.count.toLocaleString()} queries`)
              .join('\n')}${associationsText}`,
          },
        ],
        structuredContent: { topRequests, associations, totalCount },
      };
    },
  );

  // Tool 3: Dynamics
  server.registerTool(
    'dynamics',
    {
      title: 'Search Dynamics',
      description:
        'Returns search volume dynamics (trend) for a keyword over time. Note: all search operators work at daily granularity; weekly/monthly granularity supports only the "+" operator.',
      inputSchema: {
        phrase: z.string().describe('Keyword to analyze trends for'),
        period: z
          .enum(['daily', 'weekly', 'monthly'])
          .optional()
          .describe(
            'Time granularity: daily (last 59 days), weekly (last 52 weeks), or monthly (default, last 12 months)',
          ),
        fromDate: z
          .string()
          .optional()
          .describe('Start date in YYYY-MM-DD format (auto-aligned per period if omitted)'),
        toDate: z.string().optional().describe('End date in YYYY-MM-DD format (auto-aligned per period if omitted)'),
        regions: z.array(z.number()).optional().describe('Array of region IDs to scope the query'),
        devices: z
          .array(z.enum(['desktop', 'phone', 'tablet']))
          .optional()
          .describe('Filter by device types'),
      },
      outputSchema: {
        dynamics: z.array(z.object({ date: z.string(), count: z.number(), share: z.number() })),
        trend: z.string(),
      },
    },
    async ({ phrase, period: rawPeriod, fromDate, toDate, regions, devices }) => {
      const period = normalizePeriod(rawPeriod);
      const { fromDate: from, toDate: to } = resolveDynamicsDates(period, fromDate, toDate);

      const body = {
        phrase,
        period: toYandexPeriod(period),
        fromDate: toRFC3339Date(from),
        toDate: toRFC3339Date(to),
      };
      const regionStrings = regionsToStrings(regions);
      if (regionStrings) body.regions = regionStrings;
      const deviceEnums = toYandexDevices(devices);
      if (deviceEnums) body.devices = deviceEnums;

      const data = await wordstatRequest('/v2/wordstat/dynamics', body);

      const points = (data.results ?? []).map((p) => ({
        date: fromRFC3339Date(p.date),
        count: toInt(p.count),
        share: p.share ?? 0,
      }));

      const trend = calculateTrend(points);
      const trendText = points.length >= 2 ? `\n\nTrend: ${trend}` : '';

      return {
        content: [
          {
            type: 'text',
            text: `Search dynamics for "${phrase}" (${points.length} data points):${trendText}\n\n${points
              .map((p) => `${p.date}: ${p.count.toLocaleString()}`)
              .join('\n')}`,
          },
        ],
        structuredContent: { dynamics: points, trend },
      };
    },
  );

  // Tool 4: Regions Distribution
  const regionRowSchema = z.object({
    regionId: z.number(),
    regionName: z.string(),
    count: z.number(),
    share: z.number(),
    affinityIndex: z.number(),
  });

  server.registerTool(
    'regions',
    {
      title: 'Regional Distribution',
      description:
        'Returns how search volume for a keyword is distributed across regions over the last 30 days. Includes region names, share percentage and affinity index. The v2 API has no server-side region filter, so the optional `regions` parameter is applied client-side using the cached regions tree.',
      inputSchema: {
        phrase: z.string().describe('Keyword to analyze regional distribution for'),
        granularity: z
          .enum(['all', 'cities', 'regions'])
          .optional()
          .describe('Distribution granularity: all (default), cities (cities only), or regions (regions only)'),
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
        regions: z.array(regionRowSchema),
        topByAffinity: z.array(regionRowSchema),
      },
    },
    async ({ phrase, granularity, regions: filterRegions, devices, limit = 20 }) => {
      const body = { phrase, region: toYandexRegionGranularity(granularity) };
      const deviceEnums = toYandexDevices(devices);
      if (deviceEnums) body.devices = deviceEnums;

      // Fetch regions data and ensure regions tree is cached (for name enrichment + filtering)
      const [data] = await Promise.all([wordstatRequest('/v2/wordstat/regions', body), getRegionsTree()]);

      // v2 returns region IDs as strings with no names; normalize to numbers.
      let items = (data.results ?? []).map((r) => ({
        regionId: Number(r.region),
        count: toInt(r.count),
        share: r.share ?? 0,
        affinityIndex: r.affinityIndex ?? 0,
      }));

      // If a regions filter is specified, filter to only those regions and their descendants.
      if (filterRegions?.length) {
        const allowedRegionIds = new Set();
        for (const regionId of filterRegions) {
          for (const id of getDescendantRegionIds(regionId)) {
            allowedRegionIds.add(id);
          }
        }
        items = items.filter((r) => allowedRegionIds.has(r.regionId));
      }

      const enrichName = (r) => ({
        ...r,
        regionName: regionsFlatCache.get(r.regionId)?.label || `Unknown (${r.regionId})`,
      });

      const enriched = [...items]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(enrichName);

      // Also surface the top by affinity for interesting insights.
      const topByAffinity = [...items]
        .sort((a, b) => b.affinityIndex - a.affinityIndex)
        .slice(0, 5)
        .map(enrichName);

      const filterNote = filterRegions?.length ? ` (filtered to ${items.length} regions in specified areas)` : '';

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
                    `${i + 1}. ${r.regionName}: ${r.count.toLocaleString()} queries (${formatShare(r.share)}% share, affinity: ${r.affinityIndex.toFixed(0)})`,
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
