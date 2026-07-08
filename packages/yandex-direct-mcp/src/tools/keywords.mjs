import { z } from 'zod';
import { listResult, writeResult } from '../format.mjs';
import { fromMicro, toMicro } from '../money.mjs';

const KEYWORD_FIELDS = ['Id', 'Keyword', 'AdGroupId', 'CampaignId', 'State', 'Status', 'Bid', 'ContextBid'];

export function registerKeywordTools(server, client) {
  server.registerTool(
    'list-keywords',
    {
      title: 'List Keywords',
      description:
        'READ. Lists keywords with their current search and network bids (shown in account currency, converted from micro-units).',
      inputSchema: {
        adgroup_ids: z.array(z.number()).optional().describe('Filter by ad group IDs'),
        campaign_ids: z.array(z.number()).optional().describe('Filter by campaign IDs'),
        limit: z.number().min(1).max(1000).optional().describe('Max keywords to return (default 100)'),
      },
    },
    async ({ adgroup_ids, campaign_ids, limit = 100 }) => {
      const SelectionCriteria = {};
      if (adgroup_ids?.length) SelectionCriteria.AdGroupIds = adgroup_ids;
      if (campaign_ids?.length) SelectionCriteria.CampaignIds = campaign_ids;
      const result = await client.directRequest('keywords', 'get', {
        SelectionCriteria,
        FieldNames: KEYWORD_FIELDS,
        Page: { Limit: limit },
      });
      const lines = (result.Keywords || []).map((k) => {
        const bid = k.Bid != null ? `, search bid ${fromMicro(k.Bid)}` : '';
        const ctx = k.ContextBid != null ? `, network bid ${fromMicro(k.ContextBid)}` : '';
        return `- "${k.Keyword}" (ID ${k.Id}, group ${k.AdGroupId}) — status ${k.Status}${bid}${ctx}`;
      });
      return listResult('keyword', lines, result);
    },
  );

  server.registerTool(
    'add-keywords',
    {
      title: 'Add Keywords',
      description:
        'WRITE — adds keywords to an ad group. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1. Optional starting bid applies to every keyword added.',
      inputSchema: {
        adgroup_id: z.number().describe('Ad group ID to add keywords to'),
        keywords: z.array(z.string()).min(1).describe('Keyword phrases to add'),
        bid: z
          .number()
          .optional()
          .describe('Starting search bid in account currency for each keyword (converted to micro-units)'),
      },
    },
    async ({ adgroup_id, keywords, bid }) => {
      const items = keywords.map((keyword) => {
        const entry = { AdGroupId: adgroup_id, Keyword: keyword };
        if (bid != null) entry.Bid = toMicro(bid);
        return entry;
      });
      const result = await client.directRequest('keywords', 'add', { Keywords: items });
      return writeResult('Add keywords', result);
    },
  );

  server.registerTool(
    'set-bids',
    {
      title: 'Set Keyword Bids',
      description:
        'WRITE — sets search and/or network bids on keywords. Bids are given in account currency (e.g. rubles) and converted to micro-units. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1 — check balance before raising bids on a live account.',
      inputSchema: {
        keyword_ids: z.array(z.number()).min(1).describe('Keyword IDs to set bids for'),
        bid: z.number().optional().describe('Search bid in account currency (converted to micro-units)'),
        context_bid: z
          .number()
          .optional()
          .describe('Network/context bid in account currency (converted to micro-units)'),
      },
    },
    async ({ keyword_ids, bid, context_bid }) => {
      if (bid == null && context_bid == null) {
        throw new Error('Provide at least one of bid or context_bid.');
      }
      const keywordBids = keyword_ids.map((id) => {
        const entry = { KeywordId: id };
        if (bid != null) entry.Bid = toMicro(bid);
        if (context_bid != null) entry.ContextBid = toMicro(context_bid);
        return entry;
      });
      const result = await client.directRequest('keywordbids', 'set', { KeywordBids: keywordBids });
      return writeResult('Set bids', result);
    },
  );

  server.registerTool(
    'set-negative-keywords',
    {
      title: 'Set Negative Keywords',
      description:
        'WRITE — replaces the negative-keyword list on a campaign or ad group (existing negatives are overwritten). Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        level: z.enum(['campaign', 'adgroup']).describe('Attach negatives to a campaign or an ad group'),
        id: z.number().describe('Campaign ID or ad group ID (matching level)'),
        negative_keywords: z.array(z.string()).describe('Negative keyword phrases (empty array clears them)'),
      },
    },
    async ({ level, id, negative_keywords }) => {
      const NegativeKeywords = { Items: negative_keywords };
      const service = level === 'campaign' ? 'campaigns' : 'adgroups';
      const collection = level === 'campaign' ? 'Campaigns' : 'AdGroups';
      const result = await client.directRequest(service, 'update', {
        [collection]: [{ Id: id, NegativeKeywords }],
      });
      return writeResult(`Set negative keywords on ${level} ${id}`, result);
    },
  );
}
