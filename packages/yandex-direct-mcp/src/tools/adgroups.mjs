import { z } from 'zod';
import { listResult, writeResult } from '../format.mjs';

const ADGROUP_FIELDS = ['Id', 'Name', 'CampaignId', 'RegionIds', 'Status', 'Type'];

export function registerAdGroupTools(server, client) {
  server.registerTool(
    'list-adgroups',
    {
      title: 'List Ad Groups',
      description: 'READ. Lists ad groups, optionally filtered by campaign.',
      inputSchema: {
        campaign_ids: z.array(z.number()).optional().describe('Filter by campaign IDs'),
        limit: z.number().min(1).max(1000).optional().describe('Max ad groups to return (default 100)'),
      },
    },
    async ({ campaign_ids, limit = 100 }) => {
      const SelectionCriteria = {};
      if (campaign_ids?.length) SelectionCriteria.CampaignIds = campaign_ids;
      const result = await client.directRequest('adgroups', 'get', {
        SelectionCriteria,
        FieldNames: ADGROUP_FIELDS,
        Page: { Limit: limit },
      });
      const lines = (result.AdGroups || []).map(
        (g) => `- ${g.Name} (ID ${g.Id}) — campaign ${g.CampaignId}, status ${g.Status}`,
      );
      return listResult('ad group', lines, result);
    },
  );

  server.registerTool(
    'create-adgroup',
    {
      title: 'Create Ad Group',
      description:
        'WRITE — creates an ad group in a campaign. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1. Region IDs default to [225] (Russia); use get-regions for others.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID to create the ad group in'),
        name: z.string().describe('Ad group name'),
        region_ids: z
          .array(z.number())
          .optional()
          .describe('Target region IDs (default [225] = Russia; see get-regions)'),
      },
    },
    async ({ campaign_id, name, region_ids }) => {
      const result = await client.directRequest('adgroups', 'add', {
        AdGroups: [{ Name: name, CampaignId: campaign_id, RegionIds: region_ids?.length ? region_ids : [225] }],
      });
      return writeResult('Create ad group', result);
    },
  );

  server.registerTool(
    'delete-adgroup',
    {
      title: 'Delete Ad Group',
      description: 'WRITE — deletes an ad group. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        adgroup_id: z.number().describe('Ad group ID'),
      },
    },
    async ({ adgroup_id }) => {
      const result = await client.directRequest('adgroups', 'delete', {
        SelectionCriteria: { Ids: [adgroup_id] },
      });
      return writeResult(`Delete ad group ${adgroup_id}`, result);
    },
  );
}
