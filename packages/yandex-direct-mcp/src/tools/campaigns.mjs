import { z } from 'zod';
import { listResult, today, writeResult } from '../format.mjs';
import { fromMicro, toMicro } from '../money.mjs';

const CAMPAIGN_FIELDS = [
  'Id',
  'Name',
  'Type',
  'State',
  'Status',
  'StatusPayment',
  'StartDate',
  'DailyBudget',
  'Currency',
];

function formatCampaign(c) {
  const budget = c.DailyBudget ? `, daily budget ${fromMicro(c.DailyBudget.Amount)} ${c.Currency || ''}` : '';
  return `- ${c.Name} (ID ${c.Id}) — ${c.Type}, state ${c.State}, status ${c.Status}${budget}`;
}

export function registerCampaignTools(server, client) {
  server.registerTool(
    'list-campaigns',
    {
      title: 'List Campaigns',
      description: 'READ. Lists Yandex Direct campaigns with their type, state, status, and daily budget.',
      inputSchema: {
        states: z
          .array(z.enum(['ON', 'OFF', 'SUSPENDED', 'ENDED', 'CONVERTED', 'ARCHIVED']))
          .optional()
          .describe('Filter by campaign state'),
        limit: z.number().min(1).max(1000).optional().describe('Max campaigns to return (default 100)'),
      },
    },
    async ({ states, limit = 100 }) => {
      const SelectionCriteria = {};
      if (states?.length) SelectionCriteria.States = states;
      const result = await client.directRequest('campaigns', 'get', {
        SelectionCriteria,
        FieldNames: CAMPAIGN_FIELDS,
        Page: { Limit: limit },
      });
      return listResult('campaign', (result.Campaigns || []).map(formatCampaign), result);
    },
  );

  server.registerTool(
    'get-campaign',
    {
      title: 'Get Campaign',
      description: 'READ. Returns details for a single campaign by ID.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
      },
    },
    async ({ campaign_id }) => {
      const result = await client.directRequest('campaigns', 'get', {
        SelectionCriteria: { Ids: [campaign_id] },
        FieldNames: CAMPAIGN_FIELDS,
      });
      const c = (result.Campaigns || [])[0];
      const text = c ? formatCampaign(c) : `Campaign ${campaign_id} not found.`;
      return { content: [{ type: 'text', text }], structuredContent: result };
    },
  );

  server.registerTool(
    'create-campaign',
    {
      title: 'Create Campaign',
      description:
        'WRITE — creates a new text campaign. Defaults to the SANDBOX account; with YANDEX_DIRECT_LIVE=1 this creates a real campaign. Uses a manual (highest-position) search strategy with network serving off; tune later with update-campaign.',
      inputSchema: {
        name: z.string().describe('Campaign name'),
        start_date: z.string().optional().describe('Start date YYYY-MM-DD (default: today)'),
        daily_budget: z
          .number()
          .optional()
          .describe('Daily budget in account currency (e.g. rubles); converted to micro-units'),
      },
    },
    async ({ name, start_date, daily_budget }) => {
      const campaign = {
        Name: name,
        StartDate: start_date || today(),
        TextCampaign: {
          BiddingStrategy: {
            Search: { BiddingStrategyType: 'HIGHEST_POSITION' },
            Network: { BiddingStrategyType: 'SERVING_OFF' },
          },
        },
      };
      if (daily_budget != null) {
        campaign.DailyBudget = { Amount: toMicro(daily_budget), Mode: 'STANDARD' };
      }
      const result = await client.directRequest('campaigns', 'add', { Campaigns: [campaign] });
      return writeResult('Create campaign', result);
    },
  );

  server.registerTool(
    'update-campaign',
    {
      title: 'Update Campaign',
      description:
        'WRITE — updates a campaign name and/or daily budget. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        name: z.string().optional().describe('New campaign name'),
        daily_budget: z.number().optional().describe('New daily budget in account currency (converted to micro-units)'),
      },
    },
    async ({ campaign_id, name, daily_budget }) => {
      const update = { Id: campaign_id };
      if (name != null) update.Name = name;
      if (daily_budget != null) update.DailyBudget = { Amount: toMicro(daily_budget), Mode: 'STANDARD' };
      const result = await client.directRequest('campaigns', 'update', { Campaigns: [update] });
      return writeResult('Update campaign', result);
    },
  );

  server.registerTool(
    'manage-campaign',
    {
      title: 'Manage Campaign State',
      description:
        'WRITE — changes a campaign lifecycle state. suspend/resume pause or run it; archive/unarchive; delete removes it. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        action: z.enum(['suspend', 'resume', 'archive', 'unarchive', 'delete']).describe('Lifecycle action'),
      },
    },
    async ({ campaign_id, action }) => {
      const result = await client.directRequest('campaigns', action, {
        SelectionCriteria: { Ids: [campaign_id] },
      });
      return writeResult(`${action} campaign ${campaign_id}`, result);
    },
  );
}
