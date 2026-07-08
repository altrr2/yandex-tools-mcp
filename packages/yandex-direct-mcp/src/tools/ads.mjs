import { z } from 'zod';
import { listResult, writeResult } from '../format.mjs';

const AD_FIELDS = ['Id', 'AdGroupId', 'CampaignId', 'State', 'Status', 'Type'];
const TEXT_AD_FIELDS = ['Title', 'Title2', 'Text', 'Href', 'DisplayUrlPath'];

export function registerAdTools(server, client) {
  server.registerTool(
    'list-ads',
    {
      title: 'List Ads',
      description:
        'READ. Lists ads, optionally filtered by campaign or ad group, with their text and moderation status.',
      inputSchema: {
        campaign_ids: z.array(z.number()).optional().describe('Filter by campaign IDs'),
        adgroup_ids: z.array(z.number()).optional().describe('Filter by ad group IDs'),
        limit: z.number().min(1).max(1000).optional().describe('Max ads to return (default 100)'),
      },
    },
    async ({ campaign_ids, adgroup_ids, limit = 100 }) => {
      const SelectionCriteria = {};
      if (campaign_ids?.length) SelectionCriteria.CampaignIds = campaign_ids;
      if (adgroup_ids?.length) SelectionCriteria.AdGroupIds = adgroup_ids;
      const result = await client.directRequest('ads', 'get', {
        SelectionCriteria,
        FieldNames: AD_FIELDS,
        TextAdFieldNames: TEXT_AD_FIELDS,
        Page: { Limit: limit },
      });
      const lines = (result.Ads || []).map((a) => {
        const title = a.TextAd?.Title ? ` — "${a.TextAd.Title}"` : '';
        return `- Ad ${a.Id} (group ${a.AdGroupId}) — ${a.Type}, state ${a.State}, status ${a.Status}${title}`;
      });
      return listResult('ad', lines, result);
    },
  );

  server.registerTool(
    'create-text-ad',
    {
      title: 'Create Text Ad',
      description:
        'WRITE — creates a text ad in an ad group. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1. New ads enter moderation.',
      inputSchema: {
        adgroup_id: z.number().describe('Ad group ID to add the ad to'),
        title: z.string().describe('Ad title (max 56 chars)'),
        text: z.string().describe('Ad body text (max 81 chars)'),
        href: z.string().optional().describe('Landing page URL'),
        title2: z.string().optional().describe('Second title (max 30 chars)'),
      },
    },
    async ({ adgroup_id, title, text, href, title2 }) => {
      const textAd = {
        Title: title,
        Text: text,
        Mobile: 'NO',
        ...(href ? { Href: href } : {}),
        ...(title2 ? { Title2: title2 } : {}),
      };
      const result = await client.directRequest('ads', 'add', {
        Ads: [{ AdGroupId: adgroup_id, TextAd: textAd }],
      });
      return writeResult('Create text ad', result);
    },
  );

  server.registerTool(
    'manage-ad',
    {
      title: 'Manage Ad State',
      description:
        'WRITE — changes an ad lifecycle state. moderate submits a draft for review; suspend/resume; archive/unarchive; delete removes it. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        ad_id: z.number().describe('Ad ID'),
        action: z
          .enum(['moderate', 'suspend', 'resume', 'archive', 'unarchive', 'delete'])
          .describe('Lifecycle action'),
      },
    },
    async ({ ad_id, action }) => {
      const result = await client.directRequest('ads', action, {
        SelectionCriteria: { Ids: [ad_id] },
      });
      return writeResult(`${action} ad ${ad_id}`, result);
    },
  );
}
