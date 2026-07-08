import { z } from 'zod';

// The flexible statistics engine. Built on the Reports service: the caller picks a
// ReportType (which determines the legal fields) and a list of fields that mixes
// grouping columns (Date, CampaignName, Device, ...) and metrics (Impressions,
// Clicks, Cost, Ctr, ...). Money is returned in account currency (see client.mjs).

const REPORT_TYPES = [
  'ACCOUNT_PERFORMANCE_REPORT',
  'CAMPAIGN_PERFORMANCE_REPORT',
  'ADGROUP_PERFORMANCE_REPORT',
  'AD_PERFORMANCE_REPORT',
  'CRITERIA_PERFORMANCE_REPORT',
  'SEARCH_QUERY_PERFORMANCE_REPORT',
];

const DATE_RANGE_TYPES = [
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
  'ALL_TIME',
  'CUSTOM_DATE',
];

const DEFAULT_FIELDS = ['CampaignName', 'Impressions', 'Clicks', 'Cost', 'Ctr', 'AvgCpc'];

// ReportName must be distinct per request; a timestamp keeps repeated calls from
// colliding with a previously cached report.
let reportCounter = 0;

export function registerReportTools(server, client) {
  server.registerTool(
    'get-report',
    {
      title: 'Get Statistics Report',
      description:
        'READ. Flexible Yandex Direct statistics: choose a report type and any mix of grouping fields and metrics. Costs are returned in account currency. Use date_from/date_to for a custom range, otherwise a preset range.',
      inputSchema: {
        report_type: z
          .enum(REPORT_TYPES)
          .optional()
          .describe('Report type (default CAMPAIGN_PERFORMANCE_REPORT); it constrains the valid fields'),
        fields: z
          .array(z.string())
          .optional()
          .describe(
            'Fields to return — mix of groupings (Date, CampaignName, Device) and metrics (Impressions, Clicks, Cost, Ctr, AvgCpc, Conversions). Default: campaign performance basics.',
          ),
        date_from: z.string().optional().describe('Custom range start YYYY-MM-DD (forces a custom date range)'),
        date_to: z.string().optional().describe('Custom range end YYYY-MM-DD (forces a custom date range)'),
        date_range_type: z
          .enum(DATE_RANGE_TYPES)
          .optional()
          .describe('Preset range when date_from/date_to are omitted (default LAST_30_DAYS)'),
        campaign_ids: z.array(z.number()).optional().describe('Restrict the report to these campaign IDs'),
      },
    },
    async ({ report_type, fields, date_from, date_to, date_range_type, campaign_ids }) => {
      const custom = Boolean(date_from && date_to);
      if ((date_from && !date_to) || (!date_from && date_to)) {
        throw new Error('Provide both date_from and date_to for a custom range, or neither.');
      }
      if (date_range_type === 'CUSTOM_DATE' && !custom) {
        throw new Error('date_range_type CUSTOM_DATE requires date_from and date_to.');
      }

      const SelectionCriteria = {};
      if (custom) {
        SelectionCriteria.DateFrom = date_from;
        SelectionCriteria.DateTo = date_to;
      }
      if (campaign_ids?.length) {
        SelectionCriteria.Filter = [{ Field: 'CampaignId', Operator: 'IN', Values: campaign_ids.map(String) }];
      }

      reportCounter += 1;
      const params = {
        SelectionCriteria,
        FieldNames: fields?.length ? fields : DEFAULT_FIELDS,
        ReportName: `mcp-report-${Date.now()}-${reportCounter}`,
        ReportType: report_type || 'CAMPAIGN_PERFORMANCE_REPORT',
        DateRangeType: custom ? 'CUSTOM_DATE' : date_range_type || 'LAST_30_DAYS',
        IncludeVAT: 'NO',
      };

      const rows = await client.reportRequest(params);
      const text = rows.length
        ? rows
            .slice(0, 50)
            .map(
              (row, i) =>
                `${i + 1}. ${Object.entries(row)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}`,
            )
            .join('\n')
        : 'No data for the selected range.';
      const more = rows.length > 50 ? `\n… and ${rows.length - 50} more rows (see structured content).` : '';
      return {
        content: [{ type: 'text', text: `${rows.length} row(s):\n${text}${more}` }],
        structuredContent: { rows },
      };
    },
  );
}
