#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from './client.mjs';
import { registerAccountTools } from './tools/account.mjs';
import { registerAdGroupTools } from './tools/adgroups.mjs';
import { registerAdTools } from './tools/ads.mjs';
import { registerCampaignTools } from './tools/campaigns.mjs';
import { registerKeywordTools } from './tools/keywords.mjs';
import { registerReportTools } from './tools/reports.mjs';

// Handle CLI commands
const command = process.argv[2];
if (command === 'auth') {
  const { runAuth } = await import('./auth.mjs');
  await runAuth();
} else {
  await runServer();
}

async function runServer() {
  const client = createClient();

  const server = new McpServer({ name: 'yandex-direct', version: '1.0.0' });

  registerCampaignTools(server, client);
  registerAdGroupTools(server, client);
  registerAdTools(server, client);
  registerKeywordTools(server, client);
  registerReportTools(server, client);
  registerAccountTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const env = client.live ? 'LIVE (real money)' : 'SANDBOX';
  console.error(`yandex-direct-mcp running on stdio — ${env}`);
}
