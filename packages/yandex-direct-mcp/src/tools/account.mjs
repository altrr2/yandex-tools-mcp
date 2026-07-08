import { z } from 'zod';

// Session cache for the geo-region dictionary (it is large and static within a session).
let regionsCache = null;

export function registerAccountTools(server, client) {
  server.registerTool(
    'get-balance',
    {
      title: 'Get Account Balance',
      description:
        'READ. Returns the advertising account balance and currency (via the Live v4 AccountManagement API, since v5 has no balance endpoint).',
      inputSchema: {},
    },
    async () => {
      const data = await client.liveV4Request('AccountManagement', { Action: 'Get', SelectionCriteria: {} });
      const accounts = data?.Accounts || [];
      const text = accounts.length
        ? accounts
            .map(
              (a) =>
                `- ${a.Login || a.AccountID}: ${a.Amount} ${a.Currency}${a.SumBalance != null ? ` (balance ${a.SumBalance})` : ''}`,
            )
            .join('\n')
        : 'No accounts returned.';
      return {
        content: [{ type: 'text', text: `Account balance:\n${text}` }],
        structuredContent: data,
      };
    },
  );

  server.registerTool(
    'get-regions',
    {
      title: 'Get Geo Regions',
      description:
        'READ. Returns Yandex Direct geo-region IDs (for use as region_ids in create-adgroup). Cached per session; optionally filter by name.',
      inputSchema: {
        name: z.string().optional().describe('Case-insensitive substring to filter region names'),
        limit: z.number().min(1).max(500).optional().describe('Max regions to return (default 50)'),
      },
    },
    async ({ name, limit = 50 }) => {
      if (!regionsCache) {
        const result = await client.directRequest('dictionaries', 'get', { DictionaryNames: ['GeoRegions'] });
        regionsCache = result.GeoRegions || [];
      }
      let regions = regionsCache;
      if (name) {
        const needle = name.toLowerCase();
        regions = regions.filter((r) => (r.GeoRegionName || '').toLowerCase().includes(needle));
      }
      const shown = regions.slice(0, limit);
      const text = shown.length
        ? shown.map((r) => `- ${r.GeoRegionId}: ${r.GeoRegionName} (${r.GeoRegionType})`).join('\n')
        : 'No regions matched.';
      const more =
        regions.length > shown.length ? `\n… and ${regions.length - shown.length} more (narrow with name).` : '';
      return {
        content: [{ type: 'text', text: `${regions.length} region(s):\n${text}${more}` }],
        structuredContent: { regions: shown },
      };
    },
  );
}
